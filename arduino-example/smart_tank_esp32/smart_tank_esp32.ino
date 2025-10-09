/*
 * Smart Tank Management System - ESP32 Arduino Code
 * Enhanced with comprehensive water management features
 * 
 * This code provides a complete smart water tank management system with:
 * - Dual tank system (Upper and Lower tanks A & B)
 * - Auto/Manual operation modes
 * - ESP-NOW communication for remote sensors
 * - Motor automation with overflow protection
 * - NVS persistent storage
 * - WebSocket server for PWA communication
 * 
 * Hardware Setup:
 * - ESP32 Dev Board
 * - 2x Ultrasonic sensors (connected to Serial and Serial2)
 * - 2x Relays for pump control
 * - Status LEDs and buzzer
 * - Configuration button
 * 
 * Author: Smart Water Management System
 * Version: 2.0
 */

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_now.h>
#include <LittleFS.h>
#include <WebServer.h>


// Pin definitions
const int relay1Pin = 25;    // Pump 1 control
const int relay2Pin = 26;    // Pump 2 control
const int out1Pin = 18;      // Output 1
const int out2Pin = 19;      // Output 2
const int statusPin = 23;    // Status LED
const int faultPin = 15;     // Fault LED
const int buzzerPin = 13;    // Buzzer
const int configPin = 34;    // Configuration button

// Serial communication pins
#define RXD2 17
#define TXD2 16

// WiFi credentials (will be loaded from NVS)
String ssid = "Smart Water Tank v2.0";
String password = "00000000";
String wifiMode = "AP";

// Network configuration
uint8_t SIP0 = 192, SIP1 = 168, SIP2 = 1, SIP3 = 1;
uint8_t GW0 = 192, GW1 = 168, GW2 = 1, GW3 = 1;
uint8_t SNM0 = 255, SNM1 = 255, SNM2 = 255, SNM3 = 0;
uint8_t PDNS0 = 8, PDNS1 = 8, PDNS2 = 8, PDNS3 = 8;
uint8_t SDNS0 = 8, SDNS1 = 8, SDNS2 = 4, SDNS3 = 4;

// WebSocket and HTTP servers
WebSocketsServer webSocket = WebSocketsServer(81);
WebServer server(80);

// NVS preferences
Preferences configs;
#define RW_MODE false
#define RO_MODE true

// ESP-NOW structure for remote sensor data
typedef struct struct_message {
  bool sensorA;
  bool sensorB;
  uint32_t valueA;
  uint32_t valueB;
} struct_message;

// System state variables
bool systemEnabled = true;
bool motorState = false;
bool configMode = false;
bool faultDetected = false;

// Sensor data
volatile uint32_t sensorLowTankA = 0;
volatile uint32_t sensorLowTankB = 0;
volatile uint32_t sensorUpperTankA = 0;
volatile uint32_t sensorUpperTankB = 0;

// Sensor enable flags
bool lowerSensorAEnable = false;
bool lowerSensorBEnable = false;
bool upperSensorAEnable = false;
bool upperSensorBEnable = false;

// Tank dimensions and levels
float upperTankHeightA = 75.0;
float upperWaterFullHeightA = 70.0;
float upperWaterEmptyHeightA = 0.0;
float lowerTankHeightA = 75.0;
float lowerWaterFullHeightA = 70.0;
float lowerWaterEmptyHeightA = 0.0;

float upperTankHeightB = 75.0;
float upperWaterFullHeightB = 70.0;
float upperWaterEmptyHeightB = 0.0;
float lowerTankHeightB = 75.0;
float lowerWaterFullHeightB = 70.0;
float lowerWaterEmptyHeightB = 0.0;

// Calculated water levels
float upperTankWaterLevelA = 0.0;
float upperTankWaterLevelB = 0.0;
float lowerTankWaterLevelA = 0.0;
float lowerTankWaterLevelB = 0.0;

// Auto mode settings
float minAutoValue = 50.0;
float maxAutoValue = 90.0;
float lowerTankLowerThresholdLevelA = 30.0;
float lowerTankLowerThresholdLevelB = 30.0;
float lowerTankOverFlowThresholdLevelA = 100.0;
float lowerTankOverFlowThresholdLevelB = 100.0;

// System mode and automation
String systemMode = "Manual Mode";
String autoModeReason = "NONE";
bool upperTankOverFlowLock = true;
bool lowerTankOverFlowLock = true;
bool syncBothTank = true;
bool buzzerAlert = true;

// Timing and counters
unsigned long lastUpdated = 0;
uint32_t readDelayA = 500;
uint32_t readDelayB = 500;
uint8_t clientNumGlobal = 0;

// ESP-NOW data
struct_message subData;

// Task handles
TaskHandle_t motorControlTaskHandle;
TaskHandle_t espNowAndLowerTankSensorsTaskHandle;
TaskHandle_t countTaskHandle;

// Function declarations
void doBuzzerAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay);
void doStatusAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay);
void doFaultAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay);
void updateMotorStateInNVS(bool newData);
void OnWiFiEvent(WiFiEvent_t event);
void switchMotorON(void);
void switchMotorOFF(void);
void motorAutomation(void);
void readLowTankHeightA(void);
void readLowTankHeightB(void);
void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len);
void onWebSocketEvent(uint8_t client_num, WStype_t type, uint8_t *payload, size_t length);
void motorControlTaskFunction(void *pvParameters);
void espNowAndLowerTankSensorsTaskFunction(void *pvParameters);
void countTaskFunction(void *pvParameters);
void onIndexRequest();
void onConfigurationRequest();
void onWifiSettingRequest();
void onPageNotFound();
void faultOn(void);
void faultOff(void);
void buzzerOn(void);
void buzzerOff(void);
bool isUpperTankLevelWithinRange(void);
bool isLowerTankOverflow(void);

// Alert functions
void doBuzzerAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay) {
  digitalWrite(buzzerPin, LOW);
  for (int i = 0; i < count; i++) {
    if (buzzerAlert) {
      digitalWrite(buzzerPin, HIGH);
      delay(onDelay);
      digitalWrite(buzzerPin, LOW);
      delay(offDelay);
    } else {
      delay(onDelay);
    }
  }
}

void doStatusAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay) {
  digitalWrite(statusPin, LOW);
  for (int i = 0; i < count; i++) {
    digitalWrite(statusPin, HIGH);
    delay(onDelay);
    digitalWrite(statusPin, LOW);
    delay(offDelay);
  }
}

void doFaultAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay) {
  digitalWrite(faultPin, LOW);
  for (int i = 0; i < count; i++) {
    digitalWrite(faultPin, HIGH);
    delay(onDelay);
    digitalWrite(faultPin, LOW);
    delay(offDelay);
  }
}

void faultOn(void) {
  digitalWrite(faultPin, HIGH);
}

void faultOff(void) {
  digitalWrite(faultPin, LOW);
}

void buzzerOn(void) {
  digitalWrite(buzzerPin, HIGH);
}

void buzzerOff(void) {
  digitalWrite(buzzerPin, LOW);
}

// Motor control functions
void updateMotorStateInNVS(bool newData) {
  configs.begin("configData", RW_MODE);
  configs.putBool("motorState", newData);
  Serial.print("motorState Updated at NVS: ");
  Serial.println(newData);
  configs.end();
}

void switchMotorON() {
  if (motorState != true) {
    motorState = true;
    Serial.printf("Toggling Motor to %u\n", motorState);
    digitalWrite(relay1Pin, motorState);
    digitalWrite(statusPin, motorState);
    digitalWrite(out1Pin, motorState);

    JsonDocument stateUpdate;
    stateUpdate["MSV"] = "ON";
    String jsonString;
    serializeJson(stateUpdate, jsonString);
    webSocket.sendTXT(clientNumGlobal, jsonString);
    updateMotorStateInNVS(motorState);
    doBuzzerAlert(1, 500, 200);
  }
}

void switchMotorOFF() {
  if (motorState != false) {
    motorState = false;
    Serial.printf("Toggling Motor to %u\n", motorState);
    digitalWrite(relay1Pin, motorState);
    digitalWrite(statusPin, motorState);
    digitalWrite(out1Pin, motorState);

    JsonDocument stateUpdate;
    stateUpdate["MSV"] = "OFF";
    String jsonString;
    serializeJson(stateUpdate, jsonString);
    webSocket.sendTXT(clientNumGlobal, jsonString);
    updateMotorStateInNVS(motorState);
    doBuzzerAlert(2, 500, 250);
  }
}

// Automation logic
bool isUpperTankLevelWithinRange() {
  return (maxAutoValue >= upperTankWaterLevelA) && (upperTankWaterLevelA >= minAutoValue);
}

bool isLowerTankOverflow() {
  return lowerTankWaterLevelA >= lowerTankOverFlowThresholdLevelA;
}

void motorAutomation() {
  if (systemMode == "Auto Mode") {
    if (syncBothTank) {
      if (lowerTankWaterLevelA >= lowerTankLowerThresholdLevelA) {
        if (upperTankOverFlowLock) {
          if (upperTankWaterLevelA > maxAutoValue) {
            autoModeReason = "UpperWater > Max Limit";
            switchMotorOFF();
          } else if ((isUpperTankLevelWithinRange())) {
            if (lowerTankOverFlowLock && isLowerTankOverflow()) {
              autoModeReason = "LowerTank OverFlow";
              switchMotorON();
            } else {
              autoModeReason = "UpperTank Level Maintained";
            }
          } else if ((upperTankWaterLevelA < minAutoValue)) {
            autoModeReason = "UpperWater < Min Limit";
            switchMotorON();
          } else {
            autoModeReason = "UpperTank Value Error0";
          }
        } else {
          if (lowerTankOverFlowLock && (upperTankWaterLevelA < minAutoValue || isLowerTankOverflow())) {
            autoModeReason = "Lower Water OverFlow Detected.";
            switchMotorON();
          } else {
            if (upperTankWaterLevelA < minAutoValue) {
              autoModeReason = "Upper Tank < Min Limit";
              switchMotorON();
            } else if ((isUpperTankLevelWithinRange())) {
              autoModeReason = "UpperTank Level Maintained";
            } else {
              autoModeReason = "UpperTank Value Error1";
            }
          }
        }
      } else if (lowerTankWaterLevelA < lowerTankLowerThresholdLevelA) {
        autoModeReason = "Lower Tank < 30%";
        switchMotorOFF();
      }
    } else {
      if (upperTankOverFlowLock) {
        if (upperTankWaterLevelA > maxAutoValue) {
          autoModeReason = "UpperWater > Max Limit";
          switchMotorOFF();
        } else if ((isUpperTankLevelWithinRange())) {
          autoModeReason = "UpperTank Level Maintained";
        } else if ((upperTankWaterLevelA < minAutoValue)) {
          autoModeReason = "UpperWater < Min Limit";
          switchMotorON();
        } else {
          autoModeReason = "UpperTank Value Error0";
        }
      } else {
        autoModeReason = "Change to Manual Mode.";
        switchMotorOFF();
      }
    }
  } else if (systemMode == "Manual Mode") {
    // Implementation for Manual Mode
  } else {
    autoModeReason = "Mode Error, Unknown Mode Selected: " + systemMode;
  }
}

// Sensor reading functions
void readLowTankHeightA() {
  byte StartByte = 0;
  byte MSByte = 0;
  byte LSByte = 0;
  byte CheckSum = 0;

  Serial2.flush();
  Serial2.write(0x55);
  delay(50);

  if (Serial2.available() >= 4) {
    StartByte = Serial2.read();
    if (StartByte == 0xFF) {
      MSByte = Serial2.read();
      LSByte = Serial2.read();
      CheckSum = Serial2.read();
      CheckSum = LSByte + CheckSum;
      sensorLowTankA = MSByte * 256 + LSByte;
    } else {
      Serial2.flush();
    }
  }
  float fullA = lowerTankHeightA - lowerWaterFullHeightA;
  float emptyA = lowerTankHeightA - lowerWaterEmptyHeightA;
  lowerTankWaterLevelA = map(sensorLowTankA, fullA, emptyA, 100.0, 0.0);
  Serial.print("Lower tank A - ");
  Serial.print(lowerTankWaterLevelA);
  Serial.print(" - ");
  Serial.println(sensorLowTankA);
  delay(readDelayA);
}

void readLowTankHeightB() {
  byte StartByte = 0;
  byte MSByte = 0;
  byte LSByte = 0;
  byte CheckSum = 0;
  Serial.flush();
  Serial.write(0x55);
  delay(50);

  if (Serial.available() >= 4) {
    StartByte = Serial.read();
    if (StartByte == 0xFF) {
      MSByte = Serial.read();
      LSByte = Serial.read();
      CheckSum = Serial.read();
      CheckSum = LSByte + CheckSum;
      sensorLowTankB = MSByte * 256 + LSByte;
    } else {
      Serial.flush();
    }
  }
  float fullB = lowerTankHeightB - lowerWaterFullHeightB;
  float emptyB = lowerTankHeightB - lowerWaterEmptyHeightB;
  lowerTankWaterLevelB = map(sensorLowTankB, fullB, emptyB, 100.0, 0.0);
  Serial.print("Lower tank B - ");
  Serial.print(lowerTankWaterLevelB);
  Serial.print(" - ");
  Serial.println(sensorLowTankB);
  delay(readDelayB);
}

// ESP-NOW callback function
void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len) {
  memcpy(&subData, incomingData, sizeof(subData));
  Serial.print("Bytes received: ");
  Serial.println(len);
  Serial.print("sensorA: ");
  Serial.println(subData.sensorA);
  Serial.print("sensorB: ");
  Serial.println(subData.sensorB);
  Serial.print("valueA: ");
  Serial.println(subData.valueA);
  Serial.print("valueB: ");
  Serial.println(subData.valueB);
  Serial.println();
  Serial.print("Wifi Strength: ");
  Serial.println(WiFi.RSSI());
  
  bool upperSensorAEnableLive = subData.sensorA;
  bool upperSensorBEnableLive = subData.sensorB;

  if (upperSensorAEnableLive != upperSensorAEnable) {
    upperSensorAEnable = upperSensorAEnableLive;
    configs.begin("configData", RW_MODE);
    configs.putBool("UAE", upperSensorAEnableLive);
    configs.end();
    Serial.println("upperSensorAEnable Updated at NVS.");
  }

  if (upperSensorBEnableLive != upperSensorBEnable) {
    upperSensorBEnable = upperSensorBEnableLive;
    configs.begin("configData", RW_MODE);
    configs.putBool("UBE", upperSensorBEnableLive);
    configs.end();
    Serial.println("upperSensorBEnable Updated at NVS.");
  }

  if (subData.sensorA) {
    int upperTankDataA = subData.valueA;
    Serial.print("upperTankDataA: ");
    Serial.println(upperTankDataA);
    upperTankDataA = upperTankDataA / 10;
    Serial.print("upperTankDataA - ");
    Serial.println(upperTankDataA);
    float fullA = upperTankHeightA - upperWaterFullHeightA;
    float emptyA = upperTankHeightA - upperWaterEmptyHeightA;
    upperTankWaterLevelA = map(upperTankDataA, fullA, emptyA, 100.0, 0.0);
    Serial.print("   upper tankA - ");
    Serial.println(upperTankWaterLevelA);
  }
  
  if (subData.sensorB) {
    int upperTankDataB = subData.valueB;
    Serial.print("upperTankDataB: ");
    Serial.println(upperTankDataB);
    upperTankDataB = upperTankDataB / 10;
    Serial.print("upperTankDataB - ");
    Serial.println(upperTankDataB);
    float fullB = upperTankHeightB - upperWaterFullHeightB;
    float emptyB = upperTankHeightB - upperWaterEmptyHeightB;
    upperTankWaterLevelB = map(upperTankDataB, fullB, emptyB, 100.0, 0.0);
    Serial.print("   upper tankB - ");
    Serial.println(upperTankWaterLevelB);
  }

  lastUpdated = 0;
}

// Comprehensive WebSocket event handler
void onWebSocketEvent(uint8_t client_num, WStype_t type, uint8_t *payload, size_t length) {
  clientNumGlobal = client_num;

  switch (type) {
    case WStype_DISCONNECTED: {
      Serial.printf("[%u] Disconnected!\n", client_num);
      faultOn();
      break;
    }

    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(client_num);
      Serial.printf("[%u] WebSocket Connection from ", client_num);
      Serial.println(ip.toString());
      Serial.println("WebSocket connection established successfully!");
      faultOff();
      doStatusAlert(1, 200, 100);
      break;
    }

    case WStype_TEXT: {
      doStatusAlert(1, 200, 100);
      Serial.printf("[%u] Received text: %s\n", client_num, payload);

      // Handle configuration data (large JSON)
      if (length > 50) {
        if (configMode) {
          // Handle WiFi configuration
          JsonDocument doc;
          DeserializationError error = deserializeJson(doc, payload);
          if (error) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.f_str());
            return;
          }

          String wifiModeLive = doc["MODE"].as<String>();
          String ssidLive = doc["SSID"].as<String>();
          String passwordLive = doc["PASS"].as<String>();

          // Handle WiFi mode configuration
          if (wifiModeLive == "AP" || wifiModeLive == "access_point") {
            Serial.println("Access point mode Configuration in nvs Entered.");
            // Set default AP settings
            SIP0 = 192; SIP1 = 168; SIP2 = 1; SIP3 = 1;
            GW0 = 192; GW1 = 168; GW2 = 1; GW3 = 1;
            SNM0 = 255; SNM1 = 255; SNM2 = 255; SNM3 = 0;
            
            configs.begin("configData", RW_MODE);
            if (wifiModeLive != wifiMode) {
              wifiMode = wifiModeLive;
              configs.putString("WIFIMode", "AP");
              Serial.println("wifiMode Updated at NVS.");
            }
            if (ssidLive != ssid) {
              ssid = ssidLive;
              configs.putString("SSID", ssidLive);
              Serial.println("ssid Updated at NVS.");
            }
            if (passwordLive != password) {
              password = passwordLive;
              configs.putString("PASS", passwordLive);
              Serial.println("password Updated at NVS.");
            }
            
            // Handle static IP configuration for AP mode
            if (doc.containsKey("SIP0") && doc.containsKey("SIP1") && doc.containsKey("SIP2") && doc.containsKey("SIP3")) {
              SIP0 = doc["SIP0"];
              SIP1 = doc["SIP1"];
              SIP2 = doc["SIP2"];
              SIP3 = doc["SIP3"];
              configs.putUShort("SIP0", SIP0);
              configs.putUShort("SIP1", SIP1);
              configs.putUShort("SIP2", SIP2);
              configs.putUShort("SIP3", SIP3);
              Serial.println("Static IP Updated at NVS.");
            }
            
            if (doc.containsKey("SG0") && doc.containsKey("SG1") && doc.containsKey("SG2") && doc.containsKey("SG3")) {
              GW0 = doc["SG0"];
              GW1 = doc["SG1"];
              GW2 = doc["SG2"];
              GW3 = doc["SG3"];
              configs.putUShort("SG0", GW0);
              configs.putUShort("SG1", GW1);
              configs.putUShort("SG2", GW2);
              configs.putUShort("SG3", GW3);
              Serial.println("Gateway Updated at NVS.");
            }
            
            if (doc.containsKey("SS0") && doc.containsKey("SS1") && doc.containsKey("SS2") && doc.containsKey("SS3")) {
              SNM0 = doc["SS0"];
              SNM1 = doc["SS1"];
              SNM2 = doc["SS2"];
              SNM3 = doc["SS3"];
              configs.putUShort("SS0", SNM0);
              configs.putUShort("SS1", SNM1);
              configs.putUShort("SS2", SNM2);
              configs.putUShort("SS3", SNM3);
              Serial.println("Subnet Mask Updated at NVS.");
            }
            
            if (doc.containsKey("SPD0") && doc.containsKey("SPD1") && doc.containsKey("SPD2") && doc.containsKey("SPD3")) {
              PDNS0 = doc["SPD0"];
              PDNS1 = doc["SPD1"];
              PDNS2 = doc["SPD2"];
              PDNS3 = doc["SPD3"];
              configs.putUShort("SPD0", PDNS0);
              configs.putUShort("SPD1", PDNS1);
              configs.putUShort("SPD2", PDNS2);
              configs.putUShort("SPD3", PDNS3);
              Serial.println("Primary DNS Updated at NVS.");
            }
            
            configs.end();
            
            // Send success response
            JsonDocument response;
            response["status"] = "success";
            response["message"] = "WiFi configuration saved successfully";
            String responseStr;
            serializeJson(response, responseStr);
            webSocket.sendTXT(clientNumGlobal, responseStr);
          } else if (wifiModeLive == "STA" || wifiModeLive == "station") {
            Serial.println("Station mode Configuration in nvs Entered.");
            // Handle station mode configuration with static IP
            configs.begin("configData", RW_MODE);
            if (wifiModeLive != wifiMode) {
              wifiMode = wifiModeLive;
              configs.putString("WIFIMode", "STA");
              Serial.println("wifiMode Updated at NVS.");
            }
            if (ssidLive != ssid) {
              ssid = ssidLive;
              configs.putString("SSID", ssidLive);
              Serial.println("ssid Updated at NVS.");
            }
            if (passwordLive != password) {
              password = passwordLive;
              configs.putString("PASS", passwordLive);
              Serial.println("password Updated at NVS.");
            }
            
            // Handle static IP configuration for STA mode
            if (doc.containsKey("SIP0") && doc.containsKey("SIP1") && doc.containsKey("SIP2") && doc.containsKey("SIP3")) {
              SIP0 = doc["SIP0"];
              SIP1 = doc["SIP1"];
              SIP2 = doc["SIP2"];
              SIP3 = doc["SIP3"];
              configs.putUShort("SIP0", SIP0);
              configs.putUShort("SIP1", SIP1);
              configs.putUShort("SIP2", SIP2);
              configs.putUShort("SIP3", SIP3);
              Serial.println("Static IP Updated at NVS.");
            }
            
            if (doc.containsKey("SG0") && doc.containsKey("SG1") && doc.containsKey("SG2") && doc.containsKey("SG3")) {
              GW0 = doc["SG0"];
              GW1 = doc["SG1"];
              GW2 = doc["SG2"];
              GW3 = doc["SG3"];
              configs.putUShort("SG0", GW0);
              configs.putUShort("SG1", GW1);
              configs.putUShort("SG2", GW2);
              configs.putUShort("SG3", GW3);
              Serial.println("Gateway Updated at NVS.");
            }
            
            if (doc.containsKey("SS0") && doc.containsKey("SS1") && doc.containsKey("SS2") && doc.containsKey("SS3")) {
              SNM0 = doc["SS0"];
              SNM1 = doc["SS1"];
              SNM2 = doc["SS2"];
              SNM3 = doc["SS3"];
              configs.putUShort("SS0", SNM0);
              configs.putUShort("SS1", SNM1);
              configs.putUShort("SS2", SNM2);
              configs.putUShort("SS3", SNM3);
              Serial.println("Subnet Mask Updated at NVS.");
            }
            
            if (doc.containsKey("SPD0") && doc.containsKey("SPD1") && doc.containsKey("SPD2") && doc.containsKey("SPD3")) {
              PDNS0 = doc["SPD0"];
              PDNS1 = doc["SPD1"];
              PDNS2 = doc["SPD2"];
              PDNS3 = doc["SPD3"];
              configs.putUShort("SPD0", PDNS0);
              configs.putUShort("SPD1", PDNS1);
              configs.putUShort("SPD2", PDNS2);
              configs.putUShort("SPD3", PDNS3);
              Serial.println("Primary DNS Updated at NVS.");
            }
            
            configs.end();
            
            // Send success response
            JsonDocument response;
            response["status"] = "success";
            response["message"] = "WiFi configuration saved successfully";
            String responseStr;
            serializeJson(response, responseStr);
            webSocket.sendTXT(clientNumGlobal, responseStr);
          }
        } else {
          // Handle system configuration
          JsonDocument doc;
          DeserializationError error = deserializeJson(doc, payload);
          if (error) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.f_str());
            return;
          }

          String systemModeLive = doc["SM"].as<String>();
          float maxAutoValueLive = doc["MAAV"];
          float minAutoValueLive = doc["MIAV"];
          float upperTankHeightLiveA = doc["UTHA"];
          float upperWaterFullHeightLiveA = doc["UTWFHA"];
          float upperWaterEmptyHeightLiveA = doc["UTWEHA"];
          float lowerTankHeightLiveA = doc["LTHA"];
          float lowerWaterFullHeightLiveA = doc["LTWFHA"];
          float lowerWaterEmptyHeightLiveA = doc["LTWEHA"];
          float upperTankHeightLiveB = doc["UTHB"];
          float upperWaterFullHeightLiveB = doc["UTWFHB"];
          float upperWaterEmptyHeightLiveB = doc["UTWEHB"];
          float lowerTankHeightLiveB = doc["LTHB"];
          float lowerWaterFullHeightLiveB = doc["LTWFHB"];
          float lowerWaterEmptyHeightLiveB = doc["LTWEHB"];
          bool lowerSensorAEnableLive = doc["LAE"];
          bool lowerSensorBEnableLive = doc["LBE"];
          bool upperTankOverFlowLockLive = doc["UTOFL"];
          bool lowerTankOverFlowLockLive = doc["LTOFL"];
          bool syncBothTankLive = doc["SBT"];
          bool buzzerAlertLive = doc["BA"];

          configs.begin("configData", RW_MODE);
          if (lowerSensorAEnableLive != lowerSensorAEnable) {
            lowerSensorAEnable = lowerSensorAEnableLive;
            configs.putBool("LAE", lowerSensorAEnableLive);
            Serial.println("lowerSensorAEnable Updated at NVS.");
          }
          if (lowerSensorBEnableLive != lowerSensorBEnable) {
            lowerSensorBEnable = lowerSensorBEnableLive;
            configs.putBool("LBE", lowerSensorBEnableLive);
            Serial.println("lowerSensorBEnable Updated at NVS.");
          }
          if (systemModeLive != systemMode) {
            systemMode = systemModeLive;
            configs.putString("systemMode", systemModeLive);
            Serial.println("System Mode Updated at NVS.");
          }
          if (maxAutoValueLive != maxAutoValue) {
            maxAutoValue = maxAutoValueLive;
            configs.putFloat("autoMax", maxAutoValueLive);
            Serial.println("maxAutoValue Updated at NVS.");
          }
          if (minAutoValueLive != minAutoValue) {
            minAutoValue = minAutoValueLive;
            configs.putFloat("autoMin", minAutoValueLive);
            Serial.println("minAutoValue Updated at NVS.");
          }
          // Update tank dimensions
          if (upperTankHeightLiveA != upperTankHeightA) {
            upperTankHeightA = upperTankHeightLiveA;
            configs.putFloat("UTHA", upperTankHeightLiveA);
            Serial.println("upperTankHeightA Updated at NVS.");
          }
          if (upperWaterFullHeightLiveA != upperWaterFullHeightA) {
            upperWaterFullHeightA = upperWaterFullHeightLiveA;
            configs.putFloat("UTWFHA", upperWaterFullHeightLiveA);
            Serial.println("upperWaterFullHeightA Updated at NVS.");
          }
          if (upperWaterEmptyHeightLiveA != upperWaterEmptyHeightA) {
            upperWaterEmptyHeightA = upperWaterEmptyHeightLiveA;
            configs.putFloat("UTWEHA", upperWaterEmptyHeightLiveA);
            Serial.println("upperWaterEmptyHeightA Updated at NVS.");
          }
          if (lowerTankHeightLiveA != lowerTankHeightA) {
            lowerTankHeightA = lowerTankHeightLiveA;
            configs.putFloat("LTHA", lowerTankHeightLiveA);
            Serial.println("lowerTankHeightA Updated at NVS.");
          }
          if (lowerWaterFullHeightLiveA != lowerWaterFullHeightA) {
            lowerWaterFullHeightA = lowerWaterFullHeightLiveA;
            configs.putFloat("LTWFHA", lowerWaterFullHeightLiveA);
            Serial.println("lowerWaterFullHeightA Updated at NVS.");
          }
          if (lowerWaterEmptyHeightLiveA != lowerWaterEmptyHeightA) {
            lowerWaterEmptyHeightA = lowerWaterEmptyHeightLiveA;
            configs.putFloat("LTWEHA", lowerWaterEmptyHeightLiveA);
            Serial.println("lowerWaterEmptyHeightA Updated at NVS.");
          }
          // Update Tank B dimensions
          if (upperTankHeightLiveB != upperTankHeightB) {
            upperTankHeightB = upperTankHeightLiveB;
            configs.putFloat("UTHB", upperTankHeightLiveB);
            Serial.println("upperTankHeightB Updated at NVS.");
          }
          if (upperWaterFullHeightLiveB != upperWaterFullHeightB) {
            upperWaterFullHeightB = upperWaterFullHeightLiveB;
            configs.putFloat("UTWFHB", upperWaterFullHeightLiveB);
            Serial.println("upperWaterFullHeightB Updated at NVS.");
          }
          if (upperWaterEmptyHeightLiveB != upperWaterEmptyHeightB) {
            upperWaterEmptyHeightB = upperWaterEmptyHeightLiveB;
            configs.putFloat("UTWEHB", upperWaterEmptyHeightLiveB);
            Serial.println("upperWaterEmptyHeightB Updated at NVS.");
          }
          if (lowerTankHeightLiveB != lowerTankHeightB) {
            lowerTankHeightB = lowerTankHeightLiveB;
            configs.putFloat("LTHB", lowerTankHeightLiveB);
            Serial.println("lowerTankHeightB Updated at NVS.");
          }
          if (lowerWaterFullHeightLiveB != lowerWaterFullHeightB) {
            lowerWaterFullHeightB = lowerWaterFullHeightLiveB;
            configs.putFloat("LTWFHB", lowerWaterFullHeightLiveB);
            Serial.println("lowerWaterFullHeightB Updated at NVS.");
          }
          if (lowerWaterEmptyHeightLiveB != lowerWaterEmptyHeightB) {
            lowerWaterEmptyHeightB = lowerWaterEmptyHeightLiveB;
            configs.putFloat("LTWEHB", lowerWaterEmptyHeightLiveB);
            Serial.println("lowerWaterEmptyHeightB Updated at NVS.");
          }
          // Update special functions
          if (upperTankOverFlowLockLive != upperTankOverFlowLock) {
            upperTankOverFlowLock = upperTankOverFlowLockLive;
            configs.putBool("UTOFL", upperTankOverFlowLockLive);
            Serial.println("upperTankOverFlowLock Updated at NVS.");
          }
          if (lowerTankOverFlowLockLive != lowerTankOverFlowLock) {
            lowerTankOverFlowLock = lowerTankOverFlowLockLive;
            configs.putBool("LTOFL", lowerTankOverFlowLockLive);
            Serial.println("lowerTankOverFlowLock Updated at NVS.");
          }
          if (syncBothTankLive != syncBothTank) {
            syncBothTank = syncBothTankLive;
            configs.putBool("SBT", syncBothTankLive);
            Serial.println("syncBothTank Updated at NVS.");
          }
          if (buzzerAlertLive != buzzerAlert) {
            buzzerAlert = buzzerAlertLive;
            configs.putBool("BA", buzzerAlertLive);
            Serial.println("buzzerAlert Updated at NVS.");
          }
          configs.end();
        }
      } else if (strcmp((char *)payload, "systemReset") == 0) {
        ESP.restart();
      } else if (strcmp((char *)payload, "motorOn") == 0) {
        switchMotorON();
      } else if (strcmp((char *)payload, "motorOff") == 0) {
        switchMotorOFF();
      } else if (strcmp((char *)payload, "getHomeData") == 0) {
        // Send home dashboard data
        JsonDocument jsonDocument;
        char char_array[10];
        snprintf(char_array, sizeof(char_array), "%0.2f", (float)lastUpdated / 10);
        jsonDocument["RTV"] = char_array;
        if (systemMode == "Auto Mode") {
          jsonDocument["SM"] = String("Auto Mode");
        } else if (systemMode == "Manual Mode") {
          jsonDocument["SM"] = String("Manual Mode");
        }
        jsonDocument["MSV"] = motorState;
        jsonDocument["UTWLA"] = upperTankWaterLevelA;
        jsonDocument["LTWLA"] = lowerTankWaterLevelA;
        jsonDocument["UTWLB"] = upperTankWaterLevelB;
        jsonDocument["LTWLB"] = lowerTankWaterLevelB;
        jsonDocument["LAE"] = lowerSensorAEnable;
        jsonDocument["LBE"] = lowerSensorBEnable;
        jsonDocument["UAE"] = upperSensorAEnable;
        jsonDocument["UBE"] = upperSensorBEnable;
        jsonDocument["AMR"] = autoModeReason;

        String jsonString;
        serializeJson(jsonDocument, jsonString);
        webSocket.sendTXT(client_num, jsonString);
      } else if (strcmp((char *)payload, "getSettingData") == 0) {
        // Send settings data
        uint8_t mac[6];
        WiFi.macAddress(mac);

        JsonDocument jsonDocument;
        if (systemMode == "Auto Mode") {
          jsonDocument["SM"] = String("Auto Mode");
        } else if (systemMode == "Manual Mode") {
          jsonDocument["SM"] = String("Manual Mode");
        }
        jsonDocument["UTHA"] = upperTankHeightA;
        jsonDocument["UTWFHA"] = upperWaterFullHeightA;
        jsonDocument["UTWEHA"] = upperWaterEmptyHeightA;
        jsonDocument["LTHA"] = lowerTankHeightA;
        jsonDocument["LTWFHA"] = lowerWaterFullHeightA;
        jsonDocument["LTWEHA"] = lowerWaterEmptyHeightA;
        jsonDocument["UTHB"] = upperTankHeightB;
        jsonDocument["UTWFHB"] = upperWaterFullHeightB;
        jsonDocument["UTWEHB"] = upperWaterEmptyHeightB;
        jsonDocument["LTHB"] = lowerTankHeightB;
        jsonDocument["LTWFHB"] = lowerWaterFullHeightB;
        jsonDocument["LTWEHB"] = lowerWaterEmptyHeightB;
        jsonDocument["MIAV"] = minAutoValue;
        jsonDocument["MAAV"] = maxAutoValue;
        jsonDocument["LAE"] = lowerSensorAEnable;
        jsonDocument["LBE"] = lowerSensorBEnable;
        jsonDocument["UAE"] = upperSensorAEnable;
        jsonDocument["UBE"] = upperSensorBEnable;
        jsonDocument["UTOFL"] = upperTankOverFlowLock;
        jsonDocument["LTOFL"] = lowerTankOverFlowLock;
        jsonDocument["SBT"] = syncBothTank;
        jsonDocument["BA"] = buzzerAlert;

        JsonArray bmacArray = jsonDocument["BMAC"].to<JsonArray>();
        for (int i = 0; i < 6; i++) {
          bmacArray.add(mac[i]);
        }

        String jsonString;
        serializeJson(jsonDocument, jsonString);
        Serial.print("Sending to ");
        Serial.print(client_num);
        Serial.print(",  ");
        Serial.println(jsonString);
        webSocket.sendTXT(client_num, jsonString);
      } else {
        Serial.println("[%u] Message not recognized");
      }
      break;
    }

    default:
      break;
  }
}

// Task functions
void motorControlTaskFunction(void *pvParameters) {
  Serial.print("Task1 running on core ");
  Serial.println(xPortGetCoreID());

  for (;;) {
    motorAutomation();
    doStatusAlert(1, 150, 150);
  }
}

void espNowAndLowerTankSensorsTaskFunction(void *pvParameters) {
  Serial.print("Task2 running on core ");
  Serial.println(xPortGetCoreID());

  // Init ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }

  uint8_t error = esp_now_register_recv_cb(OnDataRecv);
  if (error == ESP_OK) {
    Serial.println("ESP Now Initiated Successfully.");
  } else {
    Serial.print("ESP Now Initiated Failed: ");
    Serial.println(error);
    doFaultAlert(1, 1000, 200);
  }

  for (;;) {
    if (lowerSensorAEnable) {
      readLowTankHeightA();
    }
    if (lowerSensorBEnable) {
      readLowTankHeightB();
    }
    doStatusAlert(3, 500, 500);
  }
}

void countTaskFunction(void *pvParameters) {
  Serial.print("Task3 running on core ");
  Serial.println(xPortGetCoreID());

  for (;;) {
    delay(100);
    if (lastUpdated == 4294967290) {
      lastUpdated = 0;
    } else {
      lastUpdated = lastUpdated + 1;
    }
  }
}

// WiFi event handler
void OnWiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case WIFI_EVENT_STA_CONNECTED:
      Serial.println("ESP32 Connected to WiFi Network");
      break;
    case WIFI_EVENT_AP_START:
      Serial.println("ESP32 soft AP started");
      break;
    case WIFI_EVENT_AP_STACONNECTED:
      Serial.println("Station connected to ESP32 soft AP");
      break;
    case WIFI_EVENT_AP_STADISCONNECTED:
      Serial.println("Station disconnected from ESP32 soft AP");
      break;
    default:
      break;
  }
}

// HTTP server handlers
void onIndexRequest() {
  IPAddress remote_ip = server.client().remoteIP();
  Serial.println("[" + remote_ip.toString() + "] HTTP GET request of /");
  // Redirect to configuration page since we use PWA
  server.sendHeader("Location", "/configuration.html", true);
  server.send(302, "text/plain", "Redirecting to configuration page");
}

void onConfigurationRequest() {
  IPAddress remote_ip = server.client().remoteIP();
  Serial.println("[" + remote_ip.toString() + "] HTTP GET request of /configuration");
  // Serve configuration page for basic network and sensor settings
  File file = LittleFS.open("/configuration.html", "r");
  if (file) {
    server.streamFile(file, "text/html");
    file.close();
  } else {
    server.send(404, "text/plain", "File not found");
  }
}

void onWifiSettingRequest() {
  IPAddress remote_ip = server.client().remoteIP();
  Serial.println("[" + remote_ip.toString() + "] HTTP GET request of /wifiSetting");
  // Serve WiFi configuration page for network setup
  File file = LittleFS.open("/wifiSetting.html", "r");
  if (file) {
    server.streamFile(file, "text/html");
    file.close();
  } else {
    server.send(404, "text/plain", "File not found");
  }
}

void onPageNotFound() {
  IPAddress remote_ip = server.client().remoteIP();
  Serial.println("[" + remote_ip.toString() + "] HTTP GET request of " + server.uri());
  server.send(404, "text/plain", "Not found");
}

// Setup function
void setup() {
  configMode = false;
  Serial.begin(9600);
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);

  // Initialize pins
  pinMode(relay1Pin, OUTPUT);
  pinMode(relay2Pin, OUTPUT);
  pinMode(out1Pin, OUTPUT);
  pinMode(out2Pin, OUTPUT);
  pinMode(statusPin, OUTPUT);
  pinMode(faultPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  pinMode(configPin, INPUT_PULLUP);

  // Initialize outputs
  digitalWrite(faultPin, LOW);
  digitalWrite(statusPin, LOW);
  digitalWrite(buzzerPin, LOW);

  // NVS Data Initialization
  configs.begin("configData", RO_MODE);
  bool initCheck = configs.isKey("nvsInit");

  if (initCheck == false) {
    configs.end();
    configs.begin("configData", RW_MODE);

    configs.putString("systemMode", "Manual Mode");
    configs.putBool("motorState", false);
    configs.putFloat("autoMin", 50.0);
    configs.putFloat("autoMax", 90.0);
    configs.putBool("LAE", false);
    configs.putBool("LBE", false);
    configs.putBool("UAE", false);
    configs.putBool("UBE", false);
    configs.putFloat("UTHA", 75.0);
    configs.putFloat("UTWFHA", 70.0);
    configs.putFloat("UTWEHA", 0.0);
    configs.putFloat("LTHA", 75.0);
    configs.putFloat("LTWFHA", 70.0);
    configs.putFloat("LTWEHA", 0.0);
    configs.putFloat("UTHB", 75.0);
    configs.putFloat("UTWFHB", 70.0);
    configs.putFloat("UTWEHB", 0.0);
    configs.putFloat("LTHB", 75.0);
    configs.putFloat("LTWFHB", 70.0);
    configs.putFloat("LTWEHB", 0.0);
    configs.putString("WIFIMode", "AP");
    configs.putString("SSID", "Smart Water Tank v2.0");
    configs.putString("PASS", "00000000");
    configs.putUShort("SIP0", 192);
    configs.putUShort("SIP1", 168);
    configs.putUShort("SIP2", 179);
    configs.putUShort("SIP3", 250);
    configs.putUShort("SG0", 192);
    configs.putUShort("SG1", 168);
    configs.putUShort("SG2", 179);
    configs.putUShort("SG3", 174);
    configs.putUShort("SS0", 255);
    configs.putUShort("SS1", 255);
    configs.putUShort("SS2", 255);
    configs.putUShort("SS3", 0);
    configs.putUShort("SPD0", 192);
    configs.putUShort("SPD1", 168);
    configs.putUShort("SPD2", 179);
    configs.putUShort("SPD3", 174);
    configs.putUShort("SSD0", 8);
    configs.putUShort("SSD1", 8);
    configs.putUShort("SSD2", 4);
    configs.putUShort("SSD3", 4);
    configs.putBool("UTOFL", true);
    configs.putBool("LTOFL", true);
    configs.putBool("SBT", true);
    configs.putBool("BA", true);
    configs.putBool("nvsInit", true);
    configs.end();
    Serial.println("Data change in NVS.");
    configs.begin("configData", RO_MODE);
  }

  // Load configuration from NVS
  minAutoValue = configs.getFloat("autoMin");
  maxAutoValue = configs.getFloat("autoMax");
  upperTankOverFlowLock = configs.getBool("UTOFL");
  lowerTankOverFlowLock = configs.getBool("LTOFL");
  syncBothTank = configs.getBool("SBT");
  buzzerAlert = configs.getBool("BA");
  systemMode = configs.getString("systemMode");
  lowerTankHeightB = configs.getFloat("LTHB");
  lowerWaterFullHeightB = configs.getFloat("LTWFHB");
  lowerWaterEmptyHeightB = configs.getFloat("LTWEHB");
  upperTankHeightB = configs.getFloat("UTHB");
  upperWaterFullHeightB = configs.getFloat("UTWFHB");
  upperWaterEmptyHeightB = configs.getFloat("UTWEHB");
  lowerTankHeightA = configs.getFloat("LTHA");
  lowerWaterFullHeightA = configs.getFloat("LTWFHA");
  lowerWaterEmptyHeightA = configs.getFloat("LTWEHA");
  upperTankHeightA = configs.getFloat("UTHA");
  upperWaterFullHeightA = configs.getFloat("UTWFHA");
  upperWaterEmptyHeightA = configs.getFloat("UTWEHA");
  lowerSensorAEnable = configs.getBool("LAE");
  lowerSensorBEnable = configs.getBool("LBE");
  upperSensorAEnable = configs.getBool("UAE");
  upperSensorBEnable = configs.getBool("UBE");
  ssid = configs.getString("SSID");
  password = configs.getString("PASS");
  wifiMode = configs.getString("WIFIMode");
  SIP0 = configs.getUShort("SIP0");
  SIP1 = configs.getUShort("SIP1");
  SIP2 = configs.getUShort("SIP2");
  SIP3 = configs.getUShort("SIP3");
  GW0 = configs.getUShort("SG0");
  GW1 = configs.getUShort("SG1");
  GW2 = configs.getUShort("SG2");
  GW3 = configs.getUShort("SG3");
  SNM0 = configs.getUShort("SS0");
  SNM1 = configs.getUShort("SS1");
  SNM2 = configs.getUShort("SS2");
  SNM3 = configs.getUShort("SS3");
  PDNS0 = configs.getUShort("SPD0");
  PDNS1 = configs.getUShort("SPD1");
  PDNS2 = configs.getUShort("SPD2");
  PDNS3 = configs.getUShort("SPD3");
  SDNS0 = configs.getUShort("SSD0");
  SDNS1 = configs.getUShort("SSD1");
  SDNS2 = configs.getUShort("SSD2");
  SDNS3 = configs.getUShort("SSD3");

  bool temp = configs.getBool("motorState");
  if (temp) {
    switchMotorON();
  } else {
    switchMotorOFF();
  }

  size_t whatsLeft = configs.freeEntries();
  Serial.printf("There are: %u entries available in the namespace table.\n", whatsLeft);
  configs.end();

  doBuzzerAlert(1, 1000, 500);

  // Check configuration button (exactly like old firmware)
  if (digitalRead(configPin) == false) {
    unsigned long initTime = millis();
    while ((millis() - initTime) <= 3000) {
      if (digitalRead(configPin) == false) {
        configMode = true;
      } else {
        configMode = false;
        break;
      }
    }
  } else {
    configMode = false;
  }

  // Configuration Mode
  if (configMode) {
    IPAddress local_ip(192, 168, 1, 1);
    IPAddress gateway(192, 168, 1, 1);
    IPAddress subnet(255, 255, 255, 0);

    WiFi.softAP("Smart Water Tank v2.0", "00000000");
    WiFi.softAPConfig(local_ip, gateway, subnet);
    Serial.println("Soft AP Initiated.");

    if (!LittleFS.begin(false, "/littlefs", 10, "littlefs")) {
      Serial.println("Error mounting LittleFS");
      while (1);
    }

    server.on("/", onWifiSettingRequest);
    server.onNotFound(onPageNotFound);
    server.begin();

    Serial.println("Starting WebSocket server in config mode on port 81...");
    webSocket.begin();
    webSocket.onEvent(onWebSocketEvent);
    Serial.println("WebSocket server started successfully in config mode!");
    while (configMode) {
      webSocket.loop();
      server.handleClient();
    }
  }

  doBuzzerAlert(2, 500, 500);

  // Set device as a Wi-Fi Station or Access Point
  char SSIDTemp[50];
  char PASSTemp[20];
  ssid.toCharArray(SSIDTemp, 50);
  password.toCharArray(PASSTemp, 20);
  WiFi.onEvent(OnWiFiEvent);

  if (wifiMode == "STA") {
    Serial.println("Entered Station Mode");
    IPAddress local_ip(SIP0, SIP1, SIP2, SIP3);
    IPAddress gateway(GW0, GW1, GW2, GW3);
    IPAddress subnet(SNM0, SNM1, SNM2, SNM3);
    IPAddress primaryDNS(PDNS0, PDNS1, PDNS2, PDNS3);
    IPAddress secondaryDNS(SDNS0, SDNS1, SDNS2, SDNS3);
    
    if (!WiFi.config(local_ip, gateway, subnet, primaryDNS, secondaryDNS)) {
      Serial.println("STA Failed to configure");
      faultOn();
    }
    
    Serial.print("Connecting to ");
    Serial.println(ssid);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.setHostname("SWT_ControlNode");
    WiFi.begin(SSIDTemp, PASSTemp);

    while (WiFi.status() != WL_CONNECTED) {
      doFaultAlert(1, 500, 100);
      Serial.print(".");
    }

    Serial.println("");
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("ESP Mac Address: ");
    Serial.println(WiFi.macAddress());
  } else if (wifiMode == "AP") {
    Serial.println("Entered AP Mode");
    IPAddress local_ip(SIP0, SIP1, SIP2, SIP3);
    IPAddress gateway(GW0, GW1, GW2, GW3);
    IPAddress subnet(SNM0, SNM1, SNM2, SNM3);
    
    WiFi.mode(WIFI_MODE_APSTA);
    WiFi.softAP(SSIDTemp, PASSTemp);
    WiFi.softAPConfig(local_ip, gateway, subnet);
    Serial.println("Soft AP Initiated.");
  } else {
    Serial.print("Wifi Mode Error: ");
    Serial.println(wifiMode);
    while (1) {
      faultOn();
      buzzerOn();
      delay(1000);
      faultOff();
      buzzerOff();
      delay(1000);
    }
  }

  // Make sure we can read the file system
  if (!LittleFS.begin(false, "/littlefs", 10, "littlefs")) {
    Serial.println("Error mounting LittleFS");
    while (1) {
      faultOn();
      buzzerOn();
      delay(1000);
      faultOff();
      buzzerOff();
      delay(1000);
    }
  }

  // HTTP server routes
  server.on("/", onIndexRequest);
  server.on("/configuration.html", onConfigurationRequest);
  server.on("/wifiSetting", onWifiSettingRequest);
  server.onNotFound(onPageNotFound);
  server.begin();

  // Start WebSocket server
  Serial.println("Starting WebSocket server on port 81...");
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
  Serial.println("WebSocket server started successfully!");

  // Create tasks
  xTaskCreatePinnedToCore(
    motorControlTaskFunction,
    "Task1",
    10000,
    NULL,
    1,
    &motorControlTaskHandle,
    0
  );

  xTaskCreatePinnedToCore(
    espNowAndLowerTankSensorsTaskFunction,
    "Task2",
    5000,
    NULL,
    1,
    &espNowAndLowerTankSensorsTaskHandle,
    1
  );

  xTaskCreatePinnedToCore(
    countTaskFunction,
    "Task3",
    1000,
    NULL,
    1,
    &countTaskHandle,
    0
  );

  Serial.println("System initialized!");
  
  // Print IP addresses and WiFi status
  Serial.println("=== WiFi Status ===");
  Serial.print("WiFi Mode: ");
  Serial.println(wifiMode);
  Serial.print("SSID: ");
  Serial.println(ssid);
  Serial.print("Password: ");
  Serial.println(password);
  
  if (configMode) {
    Serial.println("Config Mode Active");
    Serial.print("AP Mode - IP Address: ");
    Serial.println(WiFi.softAPIP());
    Serial.print("WebSocket Server running on: ws://");
    Serial.print(WiFi.softAPIP());
    Serial.println(":81");
  } else {
    if (wifiMode == "STA") {
      Serial.print("Station Mode - IP Address: ");
      Serial.println(WiFi.localIP());
      Serial.print("WebSocket Server running on: ws://");
      Serial.print(WiFi.localIP());
      Serial.println(":81");
    } else if (wifiMode == "AP") {
      Serial.print("AP Mode - IP Address: ");
      Serial.println(WiFi.softAPIP());
      Serial.print("WebSocket Server running on: ws://");
      Serial.print(WiFi.softAPIP());
      Serial.println(":81");
    }
  }
  Serial.println("==================");
  
  digitalWrite(statusPin, HIGH);
}

// Main loop
void loop() {
  webSocket.loop();
  server.handleClient();
  delay(10);
}
