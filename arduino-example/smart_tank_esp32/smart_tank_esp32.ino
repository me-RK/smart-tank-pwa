/*
 * Smart Tank Management System - ESP32 Arduino Code v3.0
 * Enhanced with comprehensive dual-tank and dual-motor management
 * 
 * Features:
 * - Flexible motor configuration (single/dual tank, single/dual motor)
 * - Complete automation logic for all configurations
 * - Enhanced WebSocket protocol with structured messages
 * - Comprehensive NVS management with write protection
 * - Tank A & B independent automation support
 * - Safety interlocks and overflow protection
 * 
 * Author: Smart Water Management System
 * Version: 3.0
 */

 #include <WiFi.h>
 #include <WebSocketsServer.h>
 #include <ArduinoJson.h>
 #include <Preferences.h>
 #include <esp_now.h>
 #include <LittleFS.h>
 #include <WebServer.h>
 
 // Pin definitions
 const int relay1Pin = 25;    // Motor 1 control
 const int relay2Pin = 26;    // Motor 2 control
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
 String ssid = "Smart Water Tank v3.0";
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
 bool configMode = false;
 bool faultDetected = false;
 
 // Motor configuration
 String motorConfiguration = "SINGLE_TANK_SINGLE_MOTOR";
 // Options: "SINGLE_TANK_SINGLE_MOTOR", "SINGLE_TANK_DUAL_MOTOR", "DUAL_TANK_DUAL_MOTOR"
 
 bool motor1Enabled = true;
 bool motor2Enabled = false;
 bool motor1State = false;
 bool motor2State = false;
 String motor1TargetTank = "A";
 String motor2TargetTank = "B";
 
 // For dual motor single tank, synchronization mode
 String dualMotorSyncMode = "SIMULTANEOUS"; // "SIMULTANEOUS", "ALTERNATE", "PRIMARY_BACKUP"
 uint32_t motorAlternateInterval = 3600000; // 1 hour in milliseconds
 unsigned long lastMotorSwitch = 0;
 bool primaryMotorIsMotor1 = true;
 
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
 
 // Tank dimensions and levels (in cm)
 float upperTankHeightA = 75.0;
 float upperWaterFullHeightA = 70.0;
 float upperWaterEmptyHeightA = 5.0;
 float lowerTankHeightA = 75.0;
 float lowerWaterFullHeightA = 70.0;
 float lowerWaterEmptyHeightA = 5.0;
 
 float upperTankHeightB = 75.0;
 float upperWaterFullHeightB = 70.0;
 float upperWaterEmptyHeightB = 5.0;
 float lowerTankHeightB = 75.0;
 float lowerWaterFullHeightB = 70.0;
 float lowerWaterEmptyHeightB = 5.0;
 
 // Calculated water levels (percentage)
 float upperTankWaterLevelA = 0.0;
 float upperTankWaterLevelB = 0.0;
 float lowerTankWaterLevelA = 0.0;
 float lowerTankWaterLevelB = 0.0;
 
 // Auto mode settings - Tank A
 float minAutoValueA = 50.0;
 float maxAutoValueA = 90.0;
 float lowerTankLowerThresholdLevelA = 30.0;
 float lowerTankOverFlowThresholdLevelA = 95.0;
 
 // Auto mode settings - Tank B
 float minAutoValueB = 50.0;
 float maxAutoValueB = 90.0;
 float lowerTankLowerThresholdLevelB = 30.0;
 float lowerTankOverFlowThresholdLevelB = 95.0;
 
 // System mode and automation
 String systemMode = "Manual Mode";
 String autoModeReasonMotor1 = "NONE";
 String autoModeReasonMotor2 = "NONE";
 bool upperTankOverFlowLock = true;
 bool lowerTankOverFlowLock = true;
 bool syncBothTank = true;
 bool buzzerAlert = true;
 
 // Independent tank automation
 bool tankAAutomationEnabled = true;
 bool tankBAutomationEnabled = false;
 
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
 void updateMotorStateInNVS(uint8_t motorNum, bool newState);
 void OnWiFiEvent(WiFiEvent_t event);
 void switchMotorON(uint8_t motorNum);
 void switchMotorOFF(uint8_t motorNum);
 void motorAutomation(void);
 void motorAutomationTankA(void);
 void motorAutomationTankB(void);
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
 bool isUpperTankLevelWithinRange(String tank);
 bool isLowerTankOverflow(String tank);
 bool isLowerTankBelowThreshold(String tank);
 void sendWebSocketMessage(String msgType, JsonDocument& doc);
 void handleConfigurationUpdate(JsonDocument& doc);
 void handleWiFiConfigUpdate(JsonDocument& doc);
 
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
       delay(onDelay + offDelay);
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
   if (buzzerAlert) {
     digitalWrite(buzzerPin, HIGH);
   }
 }
 
 void buzzerOff(void) {
   digitalWrite(buzzerPin, LOW);
 }
 
 // Motor control functions
 void updateMotorStateInNVS(uint8_t motorNum, bool newState) {
   configs.begin("configData", RW_MODE);
   if (motorNum == 1) {
     bool currentState = configs.getBool("motor1State", false);
     if (currentState != newState) {
       configs.putBool("motor1State", newState);
       Serial.printf("Motor 1 state updated in NVS: %d\n", newState);
     }
   } else if (motorNum == 2) {
     bool currentState = configs.getBool("motor2State", false);
     if (currentState != newState) {
       configs.putBool("motor2State", newState);
       Serial.printf("Motor 2 state updated in NVS: %d\n", newState);
     }
   }
   configs.end();
 }
 
 void switchMotorON(uint8_t motorNum) {
   bool *motorState = (motorNum == 1) ? &motor1State : &motor2State;
   bool motorEnabled = (motorNum == 1) ? motor1Enabled : motor2Enabled;
   int relayPin = (motorNum == 1) ? relay1Pin : relay2Pin;
   int outPin = (motorNum == 1) ? out1Pin : out2Pin;
 
   if (!motorEnabled) {
     Serial.printf("Motor %d is disabled in configuration\n", motorNum);
     return;
   }
 
   if (*motorState != true) {
     *motorState = true;
     Serial.printf("Turning Motor %d ON\n", motorNum);
     digitalWrite(relayPin, HIGH);
     if (motorNum == 1) {
       digitalWrite(statusPin, HIGH);
     }
     digitalWrite(outPin, HIGH);
 
     JsonDocument stateUpdate;
     stateUpdate["type"] = "motorState";
     stateUpdate["motor"] = motorNum;
     stateUpdate["state"] = "ON";
     
     String jsonString;
     serializeJson(stateUpdate, jsonString);
     
     if (webSocket.connectedClients() > 0) {
       webSocket.broadcastTXT(jsonString);
       Serial.printf("Motor %d ON status broadcasted\n", motorNum);
     }
     
     updateMotorStateInNVS(motorNum, true);
     doBuzzerAlert(1, 300, 100);
   }
 }
 
 void switchMotorOFF(uint8_t motorNum) {
   bool *motorState = (motorNum == 1) ? &motor1State : &motor2State;
   int relayPin = (motorNum == 1) ? relay1Pin : relay2Pin;
   int outPin = (motorNum == 1) ? out1Pin : out2Pin;
 
   if (*motorState != false) {
     *motorState = false;
     Serial.printf("Turning Motor %d OFF\n", motorNum);
     digitalWrite(relayPin, LOW);
     if (motorNum == 1) {
       digitalWrite(statusPin, LOW);
     }
     digitalWrite(outPin, LOW);
 
     JsonDocument stateUpdate;
     stateUpdate["type"] = "motorState";
     stateUpdate["motor"] = motorNum;
     stateUpdate["state"] = "OFF";
     
     String jsonString;
     serializeJson(stateUpdate, jsonString);
     
     if (webSocket.connectedClients() > 0) {
       webSocket.broadcastTXT(jsonString);
       Serial.printf("Motor %d OFF status broadcasted\n", motorNum);
     }
     
     updateMotorStateInNVS(motorNum, false);
     doBuzzerAlert(2, 300, 150);
   }
 }
 
 // Tank level check functions
 bool isUpperTankLevelWithinRange(String tank) {
   if (tank == "A") {
     return (maxAutoValueA >= upperTankWaterLevelA) && (upperTankWaterLevelA >= minAutoValueA);
   } else if (tank == "B") {
     return (maxAutoValueB >= upperTankWaterLevelB) && (upperTankWaterLevelB >= minAutoValueB);
   }
   return false;
 }
 
 bool isLowerTankOverflow(String tank) {
   if (tank == "A") {
     return lowerTankWaterLevelA >= lowerTankOverFlowThresholdLevelA;
   } else if (tank == "B") {
     return lowerTankWaterLevelB >= lowerTankOverFlowThresholdLevelB;
   }
   return false;
 }
 
 bool isLowerTankBelowThreshold(String tank) {
   if (tank == "A") {
     return lowerTankWaterLevelA < lowerTankLowerThresholdLevelA;
   } else if (tank == "B") {
     return lowerTankWaterLevelB < lowerTankLowerThresholdLevelB;
   }
   return false;
 }
 
 // Tank A automation logic
 void motorAutomationTankA() {
   if (!tankAAutomationEnabled) return;
 
   float upperLevel = upperTankWaterLevelA;
   float lowerLevel = lowerTankWaterLevelA;
   
   // Safety: Lower tank is too low
   if (isLowerTankBelowThreshold("A")) {
     autoModeReasonMotor1 = "Lower Tank A < Threshold";
     switchMotorOFF(1);
     return;
   }
 
   // Check if we should fill overhead tank
   if (upperLevel < minAutoValueA) {
     // Need to fill
     if (upperTankOverFlowLock) {
       autoModeReasonMotor1 = "Upper Tank A < Min Limit";
       switchMotorON(1);
     } else {
       // Check for lower tank overflow emergency
       if (lowerTankOverFlowLock && isLowerTankOverflow("A")) {
         autoModeReasonMotor1 = "Lower Tank A Overflow Protection";
         switchMotorON(1);
       } else {
         autoModeReasonMotor1 = "Upper A < Min, No Overflow Lock";
         switchMotorON(1);
       }
     }
   } else if (upperLevel > maxAutoValueA) {
     // Tank is full enough, stop
     autoModeReasonMotor1 = "Upper Tank A > Max Limit";
     switchMotorOFF(1);
   } else if (isUpperTankLevelWithinRange("A")) {
     // Within range
     if (lowerTankOverFlowLock && isLowerTankOverflow("A")) {
       autoModeReasonMotor1 = "Lower Tank A Overflow - Pumping";
       switchMotorON(1);
     } else {
       autoModeReasonMotor1 = "Upper Tank A Level Maintained";
       // Keep current state
     }
   }
 }
 
 // Tank B automation logic
 void motorAutomationTankB() {
   if (!tankBAutomationEnabled) return;
 
   float upperLevel = upperTankWaterLevelB;
   float lowerLevel = lowerTankWaterLevelB;
   
   // Safety: Lower tank is too low
   if (isLowerTankBelowThreshold("B")) {
     autoModeReasonMotor2 = "Lower Tank B < Threshold";
     switchMotorOFF(2);
     return;
   }
 
   // Check if we should fill overhead tank
   if (upperLevel < minAutoValueB) {
     // Need to fill
     if (upperTankOverFlowLock) {
       autoModeReasonMotor2 = "Upper Tank B < Min Limit";
       switchMotorON(2);
     } else {
       // Check for lower tank overflow emergency
       if (lowerTankOverFlowLock && isLowerTankOverflow("B")) {
         autoModeReasonMotor2 = "Lower Tank B Overflow Protection";
         switchMotorON(2);
       } else {
         autoModeReasonMotor2 = "Upper B < Min, No Overflow Lock";
         switchMotorON(2);
       }
     }
   } else if (upperLevel > maxAutoValueB) {
     // Tank is full enough, stop
     autoModeReasonMotor2 = "Upper Tank B > Max Limit";
     switchMotorOFF(2);
   } else if (isUpperTankLevelWithinRange("B")) {
     // Within range
     if (lowerTankOverFlowLock && isLowerTankOverflow("B")) {
       autoModeReasonMotor2 = "Lower Tank B Overflow - Pumping";
       switchMotorON(2);
     } else {
       autoModeReasonMotor2 = "Upper Tank B Level Maintained";
       // Keep current state
     }
   }
 }
 
 // Main automation logic
 void motorAutomation() {
   if (systemMode != "Auto Mode") {
     return;
   }
 
   if (motorConfiguration == "SINGLE_TANK_SINGLE_MOTOR") {
     // Single motor controls single tank (Tank A)
     motorAutomationTankA();
     
   } else if (motorConfiguration == "SINGLE_TANK_DUAL_MOTOR") {
     // Two motors control same tank (Tank A)
     if (dualMotorSyncMode == "SIMULTANEOUS") {
       // Both motors operate together
       motorAutomationTankA();
       // Mirror motor 1 decision to motor 2
       if (motor1State && motor2Enabled) {
         switchMotorON(2);
       } else if (!motor1State && motor2Enabled) {
         switchMotorOFF(2);
       }
       autoModeReasonMotor2 = "Synced with Motor 1: " + autoModeReasonMotor1;
       
     } else if (dualMotorSyncMode == "ALTERNATE") {
       // Switch between motors periodically
       if (millis() - lastMotorSwitch > motorAlternateInterval) {
         primaryMotorIsMotor1 = !primaryMotorIsMotor1;
         lastMotorSwitch = millis();
         Serial.printf("Switching primary motor to Motor %d\n", primaryMotorIsMotor1 ? 1 : 2);
       }
       
       if (primaryMotorIsMotor1) {
         motorAutomationTankA(); // Controls motor 1
         switchMotorOFF(2);
         autoModeReasonMotor2 = "Standby (Motor 1 Active)";
       } else {
         // Use motor 2 for automation
         float upperLevel = upperTankWaterLevelA;
         
         if (isLowerTankBelowThreshold("A")) {
           switchMotorOFF(2);
           autoModeReasonMotor2 = "Lower Tank A < Threshold";
         } else if (upperLevel < minAutoValueA) {
           switchMotorON(2);
           autoModeReasonMotor2 = "Upper Tank A < Min Limit";
         } else if (upperLevel > maxAutoValueA) {
           switchMotorOFF(2);
           autoModeReasonMotor2 = "Upper Tank A > Max Limit";
         } else {
           autoModeReasonMotor2 = "Upper Tank A Level Maintained";
         }
         
         switchMotorOFF(1);
         autoModeReasonMotor1 = "Standby (Motor 2 Active)";
       }
       
     } else if (dualMotorSyncMode == "PRIMARY_BACKUP") {
       // Motor 1 is primary, motor 2 only if motor 1 fails or as needed
       motorAutomationTankA(); // Controls motor 1
       
       // Motor 2 remains off unless explicitly needed (can be expanded)
       if (motor2Enabled && !motor1Enabled) {
         // If motor 1 is disabled, use motor 2
         float upperLevel = upperTankWaterLevelA;
         if (isLowerTankBelowThreshold("A")) {
           switchMotorOFF(2);
           autoModeReasonMotor2 = "Lower Tank A < Threshold";
         } else if (upperLevel < minAutoValueA) {
           switchMotorON(2);
           autoModeReasonMotor2 = "Backup Mode: Upper A < Min";
         } else if (upperLevel > maxAutoValueA) {
           switchMotorOFF(2);
           autoModeReasonMotor2 = "Backup Mode: Upper A > Max";
         }
       } else {
         switchMotorOFF(2);
         autoModeReasonMotor2 = "Backup Standby";
       }
     }
     
   } else if (motorConfiguration == "DUAL_TANK_DUAL_MOTOR") {
     // Independent tank automation
     if (motor1Enabled) {
       motorAutomationTankA();
     }
     if (motor2Enabled) {
       motorAutomationTankB();
     }
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
       sensorLowTankA = MSByte * 256 + LSByte;
       
       // Calculate water level percentage
       float sensorDistanceCm = sensorLowTankA / 10.0; // Convert mm to cm
       float emptyDistance = lowerTankHeightA - lowerWaterEmptyHeightA;
       float fullDistance = lowerTankHeightA - lowerWaterFullHeightA;
       
       // Map sensor distance to percentage (0-100%)
       lowerTankWaterLevelA = map(sensorDistanceCm, fullDistance, emptyDistance, 100.0, 0.0);
       lowerTankWaterLevelA = constrain(lowerTankWaterLevelA, 0.0, 100.0);
       
       Serial.printf("Lower Tank A: %.1f%% (Distance: %.1fcm)\n", lowerTankWaterLevelA, sensorDistanceCm);
     } else {
       Serial2.flush();
     }
   }
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
       sensorLowTankB = MSByte * 256 + LSByte;
       
       // Calculate water level percentage
       float sensorDistanceCm = sensorLowTankB / 10.0; // Convert mm to cm
       float emptyDistance = lowerTankHeightB - lowerWaterEmptyHeightB;
       float fullDistance = lowerTankHeightB - lowerWaterFullHeightB;
       
       // Map sensor distance to percentage (0-100%)
       lowerTankWaterLevelB = map(sensorDistanceCm, fullDistance, emptyDistance, 100.0, 0.0);
       lowerTankWaterLevelB = constrain(lowerTankWaterLevelB, 0.0, 100.0);
       
       Serial.printf("Lower Tank B: %.1f%% (Distance: %.1fcm)\n", lowerTankWaterLevelB, sensorDistanceCm);
     } else {
       Serial.flush();
     }
   }
   delay(readDelayB);
 }
 
 // ESP-NOW callback function
 void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len) {
   memcpy(&subData, incomingData, sizeof(subData));
   
   Serial.println("=== ESP-NOW Data Received ===");
   Serial.printf("Bytes: %d\n", len);
   Serial.printf("Sensor A Active: %d, Value: %u\n", subData.sensorA, subData.valueA);
   Serial.printf("Sensor B Active: %d, Value: %u\n", subData.sensorB, subData.valueB);
   Serial.printf("WiFi RSSI: %d dBm\n", WiFi.RSSI());
   Serial.println("============================");
   
   // Update sensor enable states if changed
   bool upperSensorAEnableLive = subData.sensorA;
   bool upperSensorBEnableLive = subData.sensorB;
 
   if (upperSensorAEnableLive != upperSensorAEnable) {
     upperSensorAEnable = upperSensorAEnableLive;
     configs.begin("configData", RW_MODE);
     configs.putBool("UAE", upperSensorAEnableLive);
     configs.end();
     Serial.println("Upper Sensor A enable state updated in NVS");
   }
 
   if (upperSensorBEnableLive != upperSensorBEnable) {
     upperSensorBEnable = upperSensorBEnableLive;
     configs.begin("configData", RW_MODE);
     configs.putBool("UBE", upperSensorBEnableLive);
     configs.end();
     Serial.println("Upper Sensor B enable state updated in NVS");
   }
 
   // Process Tank A data
   if (subData.sensorA) {
     float sensorDistanceCm = subData.valueA / 10.0; // Convert mm to cm
     float emptyDistance = upperTankHeightA - upperWaterEmptyHeightA;
     float fullDistance = upperTankHeightA - upperWaterFullHeightA;
     
     upperTankWaterLevelA = map(sensorDistanceCm, fullDistance, emptyDistance, 100.0, 0.0);
     upperTankWaterLevelA = constrain(upperTankWaterLevelA, 0.0, 100.0);
     
     Serial.printf("Upper Tank A: %.1f%% (Distance: %.1fcm)\n", upperTankWaterLevelA, sensorDistanceCm);
   }
   
   // Process Tank B data
   if (subData.sensorB) {
     float sensorDistanceCm = subData.valueB / 10.0; // Convert mm to cm
     float emptyDistance = upperTankHeightB - upperWaterEmptyHeightB;
     float fullDistance = upperTankHeightB - upperWaterFullHeightB;
     
     upperTankWaterLevelB = map(sensorDistanceCm, fullDistance, emptyDistance, 100.0, 0.0);
     upperTankWaterLevelB = constrain(upperTankWaterLevelB, 0.0, 100.0);
     
     Serial.printf("Upper Tank B: %.1f%% (Distance: %.1fcm)\n", upperTankWaterLevelB, sensorDistanceCm);
   }
 
   lastUpdated = 0; // Reset update counter
 }
 
 // Configuration update handler
 void handleConfigurationUpdate(JsonDocument& doc) {
   configs.begin("configData", RW_MODE);
   
   // System mode
   if (doc.containsKey("systemMode")) {
     String newMode = doc["systemMode"].as<String>();
     if (newMode != systemMode) {
       systemMode = newMode;
       configs.putString("systemMode", newMode);
       Serial.printf("System mode updated: %s\n", newMode.c_str());
     }
   }
   
   // Motor configuration
   if (doc.containsKey("motorConfig")) {
     String newConfig = doc["motorConfig"].as<String>();
     if (newConfig != motorConfiguration) {
       motorConfiguration = newConfig;
       configs.putString("motorConfig", newConfig);
       Serial.printf("Motor configuration updated: %s\n", newConfig.c_str());
     }
   }
   
   if (doc.containsKey("motor1Enabled")) {
     bool newValue = doc["motor1Enabled"];
     if (newValue != motor1Enabled) {
       motor1Enabled = newValue;
       configs.putBool("motor1Enable", newValue);
     }
   }
   
   if (doc.containsKey("motor2Enabled")) {
     bool newValue = doc["motor2Enabled"];
     if (newValue != motor2Enabled) {
       motor2Enabled = newValue;
       configs.putBool("motor2Enable", newValue);
     }
   }
   
   if (doc.containsKey("dualMotorSyncMode")) {
     String newMode = doc["dualMotorSyncMode"].as<String>();
     if (newMode != dualMotorSyncMode) {
       dualMotorSyncMode = newMode;
       configs.putString("dualMotorSync", newMode);
     }
   }
   
   // Tank A automation settings
   if (doc.containsKey("minAutoValueA")) {
     float newValue = doc["minAutoValueA"];
     if (newValue != minAutoValueA) {
       minAutoValueA = newValue;
       configs.putFloat("autoMinA", newValue);
     }
   }
   
   if (doc.containsKey("maxAutoValueA")) {
     float newValue = doc["maxAutoValueA"];
     if (newValue != maxAutoValueA) {
       maxAutoValueA = newValue;
       configs.putFloat("autoMaxA", newValue);
     }
   }
   
   if (doc.containsKey("lowerThresholdA")) {
     float newValue = doc["lowerThresholdA"];
     if (newValue != lowerTankLowerThresholdLevelA) {
       lowerTankLowerThresholdLevelA = newValue;
       configs.putFloat("lowerThreshA", newValue);
     }
   }
   
   if (doc.containsKey("lowerOverflowA")) {
     float newValue = doc["lowerOverflowA"];
     if (newValue != lowerTankOverFlowThresholdLevelA) {
       lowerTankOverFlowThresholdLevelA = newValue;
       configs.putFloat("lowerOvrflwA", newValue);
     }
   }
   
   // Tank B automation settings
   if (doc.containsKey("minAutoValueB")) {
     float newValue = doc["minAutoValueB"];
     if (newValue != minAutoValueB) {
       minAutoValueB = newValue;
       configs.putFloat("autoMinB", newValue);
     }
   }
   
   if (doc.containsKey("maxAutoValueB")) {
     float newValue = doc["maxAutoValueB"];
     if (newValue != maxAutoValueB) {
       maxAutoValueB = newValue;
       configs.putFloat("autoMaxB", newValue);
     }
   }
   
   if (doc.containsKey("lowerThresholdB")) {
     float newValue = doc["lowerThresholdB"];
     if (newValue != lowerTankLowerThresholdLevelB) {
       lowerTankLowerThresholdLevelB = newValue;
       configs.putFloat("lowerThreshB", newValue);
     }
   }
   
   if (doc.containsKey("lowerOverflowB")) {
     float newValue = doc["lowerOverflowB"];
     if (newValue != lowerTankOverFlowThresholdLevelB) {
       lowerTankOverFlowThresholdLevelB = newValue;
       configs.putFloat("lowerOvrflwB", newValue);
     }
   }
   
   // Tank dimensions - Upper Tank A
   if (doc.containsKey("upperTankHeightA")) {
     float newValue = doc["upperTankHeightA"];
     if (newValue != upperTankHeightA) {
       upperTankHeightA = newValue;
       configs.putFloat("UTHA", newValue);
     }
   }
   
   if (doc.containsKey("upperWaterFullHeightA")) {
     float newValue = doc["upperWaterFullHeightA"];
     if (newValue != upperWaterFullHeightA) {
       upperWaterFullHeightA = newValue;
       configs.putFloat("UTWFHA", newValue);
     }
   }
   
   if (doc.containsKey("upperWaterEmptyHeightA")) {
     float newValue = doc["upperWaterEmptyHeightA"];
     if (newValue != upperWaterEmptyHeightA) {
       upperWaterEmptyHeightA = newValue;
       configs.putFloat("UTWEHA", newValue);
     }
   }
   
   // Tank dimensions - Lower Tank A
   if (doc.containsKey("lowerTankHeightA")) {
     float newValue = doc["lowerTankHeightA"];
     if (newValue != lowerTankHeightA) {
       lowerTankHeightA = newValue;
       configs.putFloat("LTHA", newValue);
     }
   }
   
   if (doc.containsKey("lowerWaterFullHeightA")) {
     float newValue = doc["lowerWaterFullHeightA"];
     if (newValue != lowerWaterFullHeightA) {
       lowerWaterFullHeightA = newValue;
       configs.putFloat("LTWFHA", newValue);
     }
   }
   
   if (doc.containsKey("lowerWaterEmptyHeightA")) {
     float newValue = doc["lowerWaterEmptyHeightA"];
     if (newValue != lowerWaterEmptyHeightA) {
       lowerWaterEmptyHeightA = newValue;
       configs.putFloat("LTWEHA", newValue);
     }
   }
   
   // Tank dimensions - Upper Tank B
   if (doc.containsKey("upperTankHeightB")) {
     float newValue = doc["upperTankHeightB"];
     if (newValue != upperTankHeightB) {
       upperTankHeightB = newValue;
       configs.putFloat("UTHB", newValue);
     }
   }
   
   if (doc.containsKey("upperWaterFullHeightB")) {
     float newValue = doc["upperWaterFullHeightB"];
     if (newValue != upperWaterFullHeightB) {
       upperWaterFullHeightB = newValue;
       configs.putFloat("UTWFHB", newValue);
     }
   }
   
   if (doc.containsKey("upperWaterEmptyHeightB")) {
     float newValue = doc["upperWaterEmptyHeightB"];
     if (newValue != upperWaterEmptyHeightB) {
       upperWaterEmptyHeightB = newValue;
       configs.putFloat("UTWEHB", newValue);
     }
   }
   
   // Tank dimensions - Lower Tank B
   if (doc.containsKey("lowerTankHeightB")) {
     float newValue = doc["lowerTankHeightB"];
     if (newValue != lowerTankHeightB) {
       lowerTankHeightB = newValue;
       configs.putFloat("LTHB", newValue);
     }
   }
   
   if (doc.containsKey("lowerWaterFullHeightB")) {
     float newValue = doc["lowerWaterFullHeightB"];
     if (newValue != lowerWaterFullHeightB) {
       lowerWaterFullHeightB = newValue;
       configs.putFloat("LTWFHB", newValue);
     }
   }
   
   if (doc.containsKey("lowerWaterEmptyHeightB")) {
     float newValue = doc["lowerWaterEmptyHeightB"];
     if (newValue != lowerWaterEmptyHeightB) {
       lowerWaterEmptyHeightB = newValue;
       configs.putFloat("LTWEHB", newValue);
     }
   }
   
   // Sensor enable flags
   if (doc.containsKey("lowerSensorAEnable")) {
     bool newValue = doc["lowerSensorAEnable"];
     if (newValue != lowerSensorAEnable) {
       lowerSensorAEnable = newValue;
       configs.putBool("LAE", newValue);
     }
   }
   
   if (doc.containsKey("lowerSensorBEnable")) {
     bool newValue = doc["lowerSensorBEnable"];
     if (newValue != lowerSensorBEnable) {
       lowerSensorBEnable = newValue;
       configs.putBool("LBE", newValue);
     }
   }
   
   // System flags
   if (doc.containsKey("upperTankOverFlowLock")) {
     bool newValue = doc["upperTankOverFlowLock"];
     if (newValue != upperTankOverFlowLock) {
       upperTankOverFlowLock = newValue;
       configs.putBool("UTOFL", newValue);
     }
   }
   
   if (doc.containsKey("lowerTankOverFlowLock")) {
     bool newValue = doc["lowerTankOverFlowLock"];
     if (newValue != lowerTankOverFlowLock) {
       lowerTankOverFlowLock = newValue;
       configs.putBool("LTOFL", newValue);
     }
   }
   
   if (doc.containsKey("syncBothTank")) {
     bool newValue = doc["syncBothTank"];
     if (newValue != syncBothTank) {
       syncBothTank = newValue;
       configs.putBool("SBT", newValue);
     }
   }
   
   if (doc.containsKey("buzzerAlert")) {
     bool newValue = doc["buzzerAlert"];
     if (newValue != buzzerAlert) {
       buzzerAlert = newValue;
       configs.putBool("BA", newValue);
     }
   }
   
   if (doc.containsKey("tankAAutomationEnabled")) {
     bool newValue = doc["tankAAutomationEnabled"];
     if (newValue != tankAAutomationEnabled) {
       tankAAutomationEnabled = newValue;
       configs.putBool("tankAAutoEn", newValue);
     }
   }
   
   if (doc.containsKey("tankBAutomationEnabled")) {
     bool newValue = doc["tankBAutomationEnabled"];
     if (newValue != tankBAutomationEnabled) {
       tankBAutomationEnabled = newValue;
       configs.putBool("tankBAutoEn", newValue);
     }
   }
   
   configs.end();
   
   // Send acknowledgment
   JsonDocument response;
   response["type"] = "configUpdate";
   response["status"] = "success";
   response["message"] = "Configuration updated successfully";
   
   String jsonString;
   serializeJson(response, jsonString);
   webSocket.sendTXT(clientNumGlobal, jsonString);
   
   Serial.println("Configuration update completed");
 }
 
 // WiFi configuration update handler
 void handleWiFiConfigUpdate(JsonDocument& doc) {
   String wifiModeLive = doc["MODE"].as<String>();
   String ssidLive = doc["SSID"].as<String>();
   String passwordLive = doc["PASS"].as<String>();
 
   configs.begin("configData", RW_MODE);
   
   if (wifiModeLive == "AP" || wifiModeLive == "access_point") {
     Serial.println("Updating AP mode configuration");
     
     if (wifiModeLive != wifiMode) {
       wifiMode = "AP";
       configs.putString("WIFIMode", "AP");
     }
     if (ssidLive != ssid) {
       ssid = ssidLive;
       configs.putString("SSID", ssidLive);
     }
     if (passwordLive != password) {
       password = passwordLive;
       configs.putString("PASS", passwordLive);
     }
     
     // Handle static IP for AP mode
     if (doc.containsKey("SIP0")) {
       SIP0 = doc["SIP0"]; SIP1 = doc["SIP1"];
       SIP2 = doc["SIP2"]; SIP3 = doc["SIP3"];
       configs.putUShort("SIP0", SIP0);
       configs.putUShort("SIP1", SIP1);
       configs.putUShort("SIP2", SIP2);
       configs.putUShort("SIP3", SIP3);
     }
     
     if (doc.containsKey("SG0")) {
       GW0 = doc["SG0"]; GW1 = doc["SG1"];
       GW2 = doc["SG2"]; GW3 = doc["SG3"];
       configs.putUShort("SG0", GW0);
       configs.putUShort("SG1", GW1);
       configs.putUShort("SG2", GW2);
       configs.putUShort("SG3", GW3);
     }
     
     if (doc.containsKey("SS0")) {
       SNM0 = doc["SS0"]; SNM1 = doc["SS1"];
       SNM2 = doc["SS2"]; SNM3 = doc["SS3"];
       configs.putUShort("SS0", SNM0);
       configs.putUShort("SS1", SNM1);
       configs.putUShort("SS2", SNM2);
       configs.putUShort("SS3", SNM3);
     }
     
   } else if (wifiModeLive == "STA" || wifiModeLive == "station") {
     Serial.println("Updating STA mode configuration");
     
     if (wifiModeLive != wifiMode) {
       wifiMode = "STA";
       configs.putString("WIFIMode", "STA");
     }
     if (ssidLive != ssid) {
       ssid = ssidLive;
       configs.putString("SSID", ssidLive);
     }
     if (passwordLive != password) {
       password = passwordLive;
       configs.putString("PASS", passwordLive);
     }
     
     // Handle static IP for STA mode
     if (doc.containsKey("SIP0")) {
       SIP0 = doc["SIP0"]; SIP1 = doc["SIP1"];
       SIP2 = doc["SIP2"]; SIP3 = doc["SIP3"];
       configs.putUShort("SIP0", SIP0);
       configs.putUShort("SIP1", SIP1);
       configs.putUShort("SIP2", SIP2);
       configs.putUShort("SIP3", SIP3);
     }
     
     if (doc.containsKey("SG0")) {
       GW0 = doc["SG0"]; GW1 = doc["SG1"];
       GW2 = doc["SG2"]; GW3 = doc["SG3"];
       configs.putUShort("SG0", GW0);
       configs.putUShort("SG1", GW1);
       configs.putUShort("SG2", GW2);
       configs.putUShort("SG3", GW3);
     }
     
     if (doc.containsKey("SS0")) {
       SNM0 = doc["SS0"]; SNM1 = doc["SS1"];
       SNM2 = doc["SS2"]; SNM3 = doc["SS3"];
       configs.putUShort("SS0", SNM0);
       configs.putUShort("SS1", SNM1);
       configs.putUShort("SS2", SNM2);
       configs.putUShort("SS3", SNM3);
     }
     
     if (doc.containsKey("SPD0")) {
       PDNS0 = doc["SPD0"]; PDNS1 = doc["SPD1"];
       PDNS2 = doc["SPD2"]; PDNS3 = doc["SPD3"];
       configs.putUShort("SPD0", PDNS0);
       configs.putUShort("SPD1", PDNS1);
       configs.putUShort("SPD2", PDNS2);
       configs.putUShort("SPD3", PDNS3);
     }
   }
   
   configs.end();
   
   // Send success response
   JsonDocument response;
   response["type"] = "wifiConfigUpdate";
   response["status"] = "success";
   response["message"] = "WiFi configuration saved. Restart required.";
   
   String responseStr;
   serializeJson(response, responseStr);
   webSocket.sendTXT(clientNumGlobal, responseStr);
   
   Serial.println("WiFi configuration updated");
 }
 
 // WebSocket event handler
 void onWebSocketEvent(uint8_t client_num, WStype_t type, uint8_t *payload, size_t length) {
   clientNumGlobal = client_num;
 
   switch (type) {
     case WStype_DISCONNECTED: {
       Serial.printf("[%u] WebSocket Disconnected\n", client_num);
       faultOn();
       break;
     }
 
     case WStype_CONNECTED: {
       IPAddress ip = webSocket.remoteIP(client_num);
       Serial.printf("[%u] WebSocket Connected from %s\n", client_num, ip.toString().c_str());
       faultOff();
       doStatusAlert(1, 200, 100);
       break;
     }
 
     case WStype_TEXT: {
       doStatusAlert(1, 200, 100);
       Serial.printf("[%u] Received: %s\n", client_num, payload);
 
       // Handle large configuration payloads
       if (length > 50) {
         JsonDocument doc;
         DeserializationError error = deserializeJson(doc, payload);
         
         if (error) {
           Serial.printf("JSON parse error: %s\n", error.c_str());
           return;
         }
 
         if (configMode) {
           // WiFi configuration in config mode
           handleWiFiConfigUpdate(doc);
         } else {
           // System configuration
           handleConfigurationUpdate(doc);
         }
       } 
       // Handle command messages
       else if (strcmp((char *)payload, "systemReset") == 0) {
         Serial.println("System restart requested");
         JsonDocument response;
         response["type"] = "systemReset";
         response["status"] = "restarting";
         String jsonString;
         serializeJson(response, jsonString);
         webSocket.sendTXT(client_num, jsonString);
         delay(500);
         ESP.restart();
         
       } else if (strcmp((char *)payload, "motor1On") == 0) {
         Serial.println("Motor 1 ON command received");
         switchMotorON(1);
         
       } else if (strcmp((char *)payload, "motor1Off") == 0) {
         Serial.println("Motor 1 OFF command received");
         switchMotorOFF(1);
         
       } else if (strcmp((char *)payload, "motor2On") == 0) {
         Serial.println("Motor 2 ON command received");
         switchMotorON(2);
         
       } else if (strcmp((char *)payload, "motor2Off") == 0) {
         Serial.println("Motor 2 OFF command received");
         switchMotorOFF(2);
         
       } else if (strcmp((char *)payload, "getHomeData") == 0) {
         // Send comprehensive home dashboard data
         JsonDocument jsonDoc;
         
         char timeStr[10];
         snprintf(timeStr, sizeof(timeStr), "%.2f", (float)lastUpdated / 10);
         jsonDoc["type"] = "homeData";
         jsonDoc["lastUpdate"] = timeStr;
         jsonDoc["systemMode"] = systemMode;
         
         // Motor states
         jsonDoc["motor1State"] = motor1State ? "ON" : "OFF";
         jsonDoc["motor2State"] = motor2State ? "ON" : "OFF";
         jsonDoc["motor1Enabled"] = motor1Enabled;
         jsonDoc["motor2Enabled"] = motor2Enabled;
         
         // Tank levels
         jsonDoc["upperTankA"] = round(upperTankWaterLevelA * 10) / 10.0;
         jsonDoc["lowerTankA"] = round(lowerTankWaterLevelA * 10) / 10.0;
         jsonDoc["upperTankB"] = round(upperTankWaterLevelB * 10) / 10.0;
         jsonDoc["lowerTankB"] = round(lowerTankWaterLevelB * 10) / 10.0;
         
         // Sensor states
         jsonDoc["lowerSensorAEnabled"] = lowerSensorAEnable;
         jsonDoc["lowerSensorBEnabled"] = lowerSensorBEnable;
         jsonDoc["upperSensorAEnabled"] = upperSensorAEnable;
         jsonDoc["upperSensorBEnabled"] = upperSensorBEnable;
         
         // Automation reasons
         jsonDoc["autoReasonMotor1"] = autoModeReasonMotor1;
         jsonDoc["autoReasonMotor2"] = autoModeReasonMotor2;
         
         // Configuration
         jsonDoc["motorConfig"] = motorConfiguration;
         
         String jsonString;
         serializeJson(jsonDoc, jsonString);
         webSocket.sendTXT(client_num, jsonString);
         Serial.println("Home data sent");
         
       } else if (strcmp((char *)payload, "getSettingData") == 0) {
         // Send comprehensive settings data
         JsonDocument jsonDoc;
         jsonDoc["type"] = "settingData";
         
         // System configuration
         jsonDoc["systemMode"] = systemMode;
         jsonDoc["motorConfig"] = motorConfiguration;
         jsonDoc["motor1Enabled"] = motor1Enabled;
         jsonDoc["motor2Enabled"] = motor2Enabled;
         jsonDoc["dualMotorSyncMode"] = dualMotorSyncMode;
         
         // Tank A automation
         jsonDoc["minAutoValueA"] = minAutoValueA;
         jsonDoc["maxAutoValueA"] = maxAutoValueA;
         jsonDoc["lowerThresholdA"] = lowerTankLowerThresholdLevelA;
         jsonDoc["lowerOverflowA"] = lowerTankOverFlowThresholdLevelA;
         
         // Tank B automation
         jsonDoc["minAutoValueB"] = minAutoValueB;
         jsonDoc["maxAutoValueB"] = maxAutoValueB;
         jsonDoc["lowerThresholdB"] = lowerTankLowerThresholdLevelB;
         jsonDoc["lowerOverflowB"] = lowerTankOverFlowThresholdLevelB;
         
         // Tank dimensions - Upper A
         jsonDoc["upperTankHeightA"] = upperTankHeightA;
         jsonDoc["upperWaterFullHeightA"] = upperWaterFullHeightA;
         jsonDoc["upperWaterEmptyHeightA"] = upperWaterEmptyHeightA;
         
         // Tank dimensions - Lower A
         jsonDoc["lowerTankHeightA"] = lowerTankHeightA;
         jsonDoc["lowerWaterFullHeightA"] = lowerWaterFullHeightA;
         jsonDoc["lowerWaterEmptyHeightA"] = lowerWaterEmptyHeightA;
         
         // Tank dimensions - Upper B
         jsonDoc["upperTankHeightB"] = upperTankHeightB;
         jsonDoc["upperWaterFullHeightB"] = upperWaterFullHeightB;
         jsonDoc["upperWaterEmptyHeightB"] = upperWaterEmptyHeightB;
         
         // Tank dimensions - Lower B
         jsonDoc["lowerTankHeightB"] = lowerTankHeightB;
         jsonDoc["lowerWaterFullHeightB"] = lowerWaterFullHeightB;
         jsonDoc["lowerWaterEmptyHeightB"] = lowerWaterEmptyHeightB;
         
         // Sensor enables
         jsonDoc["lowerSensorAEnabled"] = lowerSensorAEnable;
         jsonDoc["lowerSensorBEnabled"] = lowerSensorBEnable;
         jsonDoc["upperSensorAEnabled"] = upperSensorAEnable;
         jsonDoc["upperSensorBEnabled"] = upperSensorBEnable;
         
         // System flags
         jsonDoc["upperTankOverFlowLock"] = upperTankOverFlowLock;
         jsonDoc["lowerTankOverFlowLock"] = lowerTankOverFlowLock;
         jsonDoc["syncBothTank"] = syncBothTank;
         jsonDoc["buzzerAlert"] = buzzerAlert;
         jsonDoc["tankAAutomationEnabled"] = tankAAutomationEnabled;
         jsonDoc["tankBAutomationEnabled"] = tankBAutomationEnabled;
         
         // MAC address
         uint8_t mac[6];
         WiFi.macAddress(mac);
         JsonArray macArray = jsonDoc["macAddress"].to<JsonArray>();
         for (int i = 0; i < 6; i++) {
           macArray.add(mac[i]);
         }
         
         String jsonString;
         serializeJson(jsonDoc, jsonString);
         webSocket.sendTXT(client_num, jsonString);
         Serial.println("Settings data sent");
         
       } else if (strcmp((char *)payload, "getSensorData") == 0) {
         // Send raw sensor data
         JsonDocument jsonDoc;
         jsonDoc["type"] = "sensorData";
         
         jsonDoc["sensorUpperA"] = sensorUpperTankA;
         jsonDoc["sensorUpperB"] = sensorUpperTankB;
         jsonDoc["sensorLowerA"] = sensorLowTankA;
         jsonDoc["sensorLowerB"] = sensorLowTankB;
         
         jsonDoc["upperTankAPercent"] = upperTankWaterLevelA;
         jsonDoc["upperTankBPercent"] = upperTankWaterLevelB;
         jsonDoc["lowerTankAPercent"] = lowerTankWaterLevelA;
         jsonDoc["lowerTankBPercent"] = lowerTankWaterLevelB;
         
         jsonDoc["wifiRSSI"] = WiFi.RSSI();
         
         String jsonString;
         serializeJson(jsonDoc, jsonString);
         webSocket.sendTXT(client_num, jsonString);
         
       } else if (strcmp((char *)payload, "getWiFiConfig") == 0) {
         // Send WiFi configuration
         JsonDocument jsonDoc;
         jsonDoc["type"] = "wifiConfig";
         
         jsonDoc["wifiMode"] = wifiMode;
         jsonDoc["ssid"] = ssid;
         jsonDoc["password"] = password;
         
         jsonDoc["staticIP"] = String(SIP0) + "." + String(SIP1) + "." + String(SIP2) + "." + String(SIP3);
         jsonDoc["gateway"] = String(GW0) + "." + String(GW1) + "." + String(GW2) + "." + String(GW3);
         jsonDoc["subnet"] = String(SNM0) + "." + String(SNM1) + "." + String(SNM2) + "." + String(SNM3);
         jsonDoc["primaryDNS"] = String(PDNS0) + "." + String(PDNS1) + "." + String(PDNS2) + "." + String(PDNS3);
         
         if (wifiMode == "STA") {
           jsonDoc["currentIP"] = WiFi.localIP().toString();
         } else {
           jsonDoc["currentIP"] = WiFi.softAPIP().toString();
         }
         
         String jsonString;
         serializeJson(jsonDoc, jsonString);
         webSocket.sendTXT(client_num, jsonString);
         
       } else {
         Serial.println("Unknown command");
       }
       break;
     }
 
     default:
       break;
   }
 }
 
 // Task functions
 void motorControlTaskFunction(void *pvParameters) {
   Serial.printf("Motor Control Task started on core %d\n", xPortGetCoreID());
 
   for (;;) {
     motorAutomation();
     vTaskDelay(pdMS_TO_TICKS(1000)); // Run every 1 second
   }
 }
 
 void espNowAndLowerTankSensorsTaskFunction(void *pvParameters) {
   Serial.printf("ESP-NOW and Sensors Task started on core %d\n", xPortGetCoreID());
 
   // Init ESP-NOW
   if (esp_now_init() != ESP_OK) {
     Serial.println("ESP-NOW initialization failed");
     doFaultAlert(3, 500, 200);
     vTaskDelete(NULL);
     return;
   }
 
   esp_err_t result = esp_now_register_recv_cb(OnDataRecv);
   if (result == ESP_OK) {
     Serial.println("ESP-NOW initialized successfully");
   } else {
     Serial.printf("ESP-NOW callback registration failed: %d\n", result);
     doFaultAlert(2, 1000, 200);
   }
 
   for (;;) {
     if (lowerSensorAEnable) {
       readLowTankHeightA();
     }
     if (lowerSensorBEnable) {
       readLowTankHeightB();
     }
     vTaskDelay(pdMS_TO_TICKS(readDelayA)); // Adjustable delay
   }
 }
 
 void countTaskFunction(void *pvParameters) {
   Serial.printf("Counter Task started on core %d\n", xPortGetCoreID());
 
   for (;;) {
     vTaskDelay(pdMS_TO_TICKS(100));
     if (lastUpdated >= 4294967290) {
       lastUpdated = 0;
     } else {
       lastUpdated++;
     }
   }
 }
 
 // WiFi event handler
 void OnWiFiEvent(WiFiEvent_t event) {
   switch (event) {
     case WIFI_EVENT_STA_CONNECTED:
       Serial.println("WiFi: Connected to network");
       break;
     case WIFI_EVENT_AP_START:
       Serial.println("WiFi: Access Point started");
       break;
     case WIFI_EVENT_AP_STACONNECTED:
       Serial.println("WiFi: Station connected to AP");
       break;
     case WIFI_EVENT_AP_STADISCONNECTED:
       Serial.println("WiFi: Station disconnected from AP");
       break;
     case WIFI_EVENT_STA_DISCONNECTED:
       Serial.println("WiFi: Disconnected from network");
       break;
     default:
       break;
   }
 }
 
 // HTTP server handlers
 void onIndexRequest() {
   IPAddress remote_ip = server.client().remoteIP();
   Serial.printf("[%s] HTTP GET /\n", remote_ip.toString().c_str());
   server.sendHeader("Location", "/wifiSetting.html", true);
   server.send(302, "text/plain", "Redirecting");
 }
 
 void onConfigurationRequest() {
   IPAddress remote_ip = server.client().remoteIP();
   Serial.printf("[%s] HTTP GET /configuration\n", remote_ip.toString().c_str());
   server.send(200, "text/plain", "Use WebSocket for configuration");
 }
 
 void onWifiSettingRequest() {
   IPAddress remote_ip = server.client().remoteIP();
   Serial.printf("[%s] HTTP GET /wifiSetting\n", remote_ip.toString().c_str());
   
   File file = LittleFS.open("/wifiSetting.html", "r");
   if (file) {
     server.streamFile(file, "text/html");
     file.close();
   } else {
     server.send(404, "text/plain", "WiFi configuration page not found");
   }
 }
 
 void onPageNotFound() {
   IPAddress remote_ip = server.client().remoteIP();
   Serial.printf("[%s] HTTP GET %s - Not Found\n", remote_ip.toString().c_str(), server.uri().c_str());
   server.send(404, "text/plain", "Page not found");
 }
 
 // Setup function
 void setup() {
   configMode = false;
   Serial.begin(9600);
   Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);
 
   Serial.println("\n\n=================================");
   Serial.println("Smart Water Tank System v3.0");
   Serial.println("=================================\n");
 
   // Initialize pins
   pinMode(relay1Pin, OUTPUT);
   pinMode(relay2Pin, OUTPUT);
   pinMode(out1Pin, OUTPUT);
   pinMode(out2Pin, OUTPUT);
   pinMode(statusPin, OUTPUT);
   pinMode(faultPin, OUTPUT);
   pinMode(buzzerPin, OUTPUT);
   pinMode(configPin, INPUT_PULLUP);
 
   // Initialize outputs to safe state
   digitalWrite(relay1Pin, LOW);
   digitalWrite(relay2Pin, LOW);
   digitalWrite(out1Pin, LOW);
   digitalWrite(out2Pin, LOW);
   digitalWrite(faultPin, LOW);
   digitalWrite(statusPin, LOW);
   digitalWrite(buzzerPin, LOW);
 
   Serial.println("Pins initialized");
 
   // NVS Data Initialization
   configs.begin("configData", RO_MODE);
   bool initCheck = configs.isKey("nvsInit");
 
   if (!initCheck) {
     Serial.println("First boot detected - Initializing NVS with defaults...");
     configs.end();
     configs.begin("configData", RW_MODE);
 
     // System configuration
     configs.putString("systemMode", "Manual Mode");
     configs.putString("motorConfig", "SINGLE_TANK_SINGLE_MOTOR");
     configs.putString("dualMotorSync", "SIMULTANEOUS");
     
     // Motor states
     configs.putBool("motor1Enable", true);
     configs.putBool("motor2Enable", false);
     configs.putBool("motor1State", false);
     configs.putBool("motor2State", false);
     
     // Tank A automation
     configs.putFloat("autoMinA", 50.0);
     configs.putFloat("autoMaxA", 90.0);
     configs.putFloat("lowerThreshA", 30.0);
     configs.putFloat("lowerOvrflwA", 95.0);
     
     // Tank B automation
     configs.putFloat("autoMinB", 50.0);
     configs.putFloat("autoMaxB", 90.0);
     configs.putFloat("lowerThreshB", 30.0);
     configs.putFloat("lowerOvrflwB", 95.0);
     
     // Sensor enables
     configs.putBool("LAE", false);
     configs.putBool("LBE", false);
     configs.putBool("UAE", false);
     configs.putBool("UBE", false);
     
     // Tank dimensions - Upper Tank A
     configs.putFloat("UTHA", 75.0);
     configs.putFloat("UTWFHA", 70.0);
     configs.putFloat("UTWEHA", 5.0);
     
     // Tank dimensions - Lower Tank A
     configs.putFloat("LTHA", 75.0);
     configs.putFloat("LTWFHA", 70.0);
     configs.putFloat("LTWEHA", 5.0);
     
     // Tank dimensions - Upper Tank B
     configs.putFloat("UTHB", 75.0);
     configs.putFloat("UTWFHB", 70.0);
     configs.putFloat("UTWEHB", 5.0);
     
     // Tank dimensions - Lower Tank B
     configs.putFloat("LTHB", 75.0);
     configs.putFloat("LTWFHB", 70.0);
     configs.putFloat("LTWEHB", 5.0);
     
     // WiFi configuration
     configs.putString("WIFIMode", "AP");
     configs.putString("SSID", "Smart Water Tank v3.0");
     configs.putString("PASS", "00000000");
     
     // Network configuration
     configs.putUShort("SIP0", 192);
     configs.putUShort("SIP1", 168);
     configs.putUShort("SIP2", 1);
     configs.putUShort("SIP3", 1);
     configs.putUShort("SG0", 192);
     configs.putUShort("SG1", 168);
     configs.putUShort("SG2", 1);
     configs.putUShort("SG3", 1);
     configs.putUShort("SS0", 255);
     configs.putUShort("SS1", 255);
     configs.putUShort("SS2", 255);
     configs.putUShort("SS3", 0);
     configs.putUShort("SPD0", 8);
     configs.putUShort("SPD1", 8);
     configs.putUShort("SPD2", 8);
     configs.putUShort("SPD3", 8);
     configs.putUShort("SSD0", 8);
     configs.putUShort("SSD1", 8);
     configs.putUShort("SSD2", 4);
     configs.putUShort("SSD3", 4);
     
     // System flags
     configs.putBool("UTOFL", true);
     configs.putBool("LTOFL", true);
     configs.putBool("SBT", true);
     configs.putBool("BA", true);
     configs.putBool("tankAAutoEn", true);
     configs.putBool("tankBAutoEn", false);
     
     configs.putBool("nvsInit", true);
     configs.end();
     
     Serial.println("NVS initialized with default values");
     configs.begin("configData", RO_MODE);
   }
 
   // Load configuration from NVS
   Serial.println("Loading configuration from NVS...");
   
   systemMode = configs.getString("systemMode", "Manual Mode");
   motorConfiguration = configs.getString("motorConfig", "SINGLE_TANK_SINGLE_MOTOR");
   dualMotorSyncMode = configs.getString("dualMotorSync", "SIMULTANEOUS");
   
   motor1Enabled = configs.getBool("motor1Enable", true);
   motor2Enabled = configs.getBool("motor2Enable", false);
   
   minAutoValueA = configs.getFloat("autoMinA", 50.0);
   maxAutoValueA = configs.getFloat("autoMaxA", 90.0);
   lowerTankLowerThresholdLevelA = configs.getFloat("lowerThreshA", 30.0);
   lowerTankOverFlowThresholdLevelA = configs.getFloat("lowerOvrflwA", 95.0);
   
   minAutoValueB = configs.getFloat("autoMinB", 50.0);
   maxAutoValueB = configs.getFloat("autoMaxB", 90.0);
   lowerTankLowerThresholdLevelB = configs.getFloat("lowerThreshB", 30.0);
   lowerTankOverFlowThresholdLevelB = configs.getFloat("lowerOvrflwB", 95.0);
   
   upperTankOverFlowLock = configs.getBool("UTOFL", true);
   lowerTankOverFlowLock = configs.getBool("LTOFL", true);
   syncBothTank = configs.getBool("SBT", true);
   buzzerAlert = configs.getBool("BA", true);
   tankAAutomationEnabled = configs.getBool("tankAAutoEn", true);
   tankBAutomationEnabled = configs.getBool("tankBAutoEn", false);
   
   // Tank dimensions
   lowerTankHeightA = configs.getFloat("LTHA", 75.0);
   lowerWaterFullHeightA = configs.getFloat("LTWFHA", 70.0);
   lowerWaterEmptyHeightA = configs.getFloat("LTWEHA", 5.0);
   upperTankHeightA = configs.getFloat("UTHA", 75.0);
   upperWaterFullHeightA = configs.getFloat("UTWFHA", 70.0);
   upperWaterEmptyHeightA = configs.getFloat("UTWEHA", 5.0);
   
   lowerTankHeightB = configs.getFloat("LTHB", 75.0);
   lowerWaterFullHeightB = configs.getFloat("LTWFHB", 70.0);
   lowerWaterEmptyHeightB = configs.getFloat("LTWEHB", 5.0);
   upperTankHeightB = configs.getFloat("UTHB", 75.0);
   upperWaterFullHeightB = configs.getFloat("UTWFHB", 70.0);
   upperWaterEmptyHeightB = configs.getFloat("UTWEHB", 5.0);
   
   // Sensor enables
   lowerSensorAEnable = configs.getBool("LAE", false);
   lowerSensorBEnable = configs.getBool("LBE", false);
   upperSensorAEnable = configs.getBool("UAE", false);
   upperSensorBEnable = configs.getBool("UBE", false);
   
   // WiFi configuration
   ssid = configs.getString("SSID", "Smart Water Tank v3.0");
   password = configs.getString("PASS", "00000000");
   wifiMode = configs.getString("WIFIMode", "AP");
   
   SIP0 = configs.getUShort("SIP0", 192);
   SIP1 = configs.getUShort("SIP1", 168);
   SIP2 = configs.getUShort("SIP2", 1);
   SIP3 = configs.getUShort("SIP3", 1);
   GW0 = configs.getUShort("SG0", 192);
   GW1 = configs.getUShort("SG1", 168);
   GW2 = configs.getUShort("SG2", 1);
   GW3 = configs.getUShort("SG3", 1);
   SNM0 = configs.getUShort("SS0", 255);
   SNM1 = configs.getUShort("SS1", 255);
   SNM2 = configs.getUShort("SS2", 255);
   SNM3 = configs.getUShort("SS3", 0);
   PDNS0 = configs.getUShort("SPD0", 8);
   PDNS1 = configs.getUShort("SPD1", 8);
   PDNS2 = configs.getUShort("SPD2", 8);
   PDNS3 = configs.getUShort("SPD3", 8);
   SDNS0 = configs.getUShort("SSD0", 8);
   SDNS1 = configs.getUShort("SSD1", 8);
   SDNS2 = configs.getUShort("SSD2", 4);
   SDNS3 = configs.getUShort("SSD3", 4);
 
   // Restore motor states
   bool savedMotor1State = configs.getBool("motor1State", false);
   bool savedMotor2State = configs.getBool("motor2State", false);
   
   size_t freeEntries = configs.freeEntries();
   Serial.printf("NVS free entries: %u\n", freeEntries);
   configs.end();
 
   // Apply saved motor states
   if (savedMotor1State && motor1Enabled) {
     motor1State = true;
     digitalWrite(relay1Pin, HIGH);
     digitalWrite(statusPin, HIGH);
     digitalWrite(out1Pin, HIGH);
     Serial.println("Motor 1 restored to ON state");
   }
   
   if (savedMotor2State && motor2Enabled) {
     motor2State = true;
     digitalWrite(relay2Pin, HIGH);
     digitalWrite(out2Pin, HIGH);
     Serial.println("Motor 2 restored to ON state");
   }
 
   Serial.println("Configuration loaded successfully");
   doBuzzerAlert(1, 1000, 500);
 
   // Check for configuration mode (button press)
   Serial.println("Checking for configuration mode...");
   if (digitalRead(configPin) == LOW) {
     unsigned long pressStart = millis();
     bool configRequested = false;
     
     while ((millis() - pressStart) <= 3000) {
       if (digitalRead(configPin) == LOW) {
         configRequested = true;
       } else {
         configRequested = false;
         break;
       }
       delay(10);
     }
     
     if (configRequested) {
       configMode = true;
       Serial.println("Configuration mode activated!");
       doBuzzerAlert(3, 200, 200);
     }
   }
 
   // Configuration Mode Setup
   if (configMode) {
     Serial.println("\n=== CONFIGURATION MODE ===");
     
     IPAddress local_ip(192, 168, 1, 1);
     IPAddress gateway(192, 168, 1, 1);
     IPAddress subnet(255, 255, 255, 0);
 
     WiFi.mode(WIFI_AP);
     WiFi.softAP("Smart Water Tank v3.0", "00000000");
     WiFi.softAPConfig(local_ip, gateway, subnet);
     Serial.println("Configuration AP started");
     Serial.printf("AP IP: %s\n", WiFi.softAPIP().toString().c_str());
 
     if (!LittleFS.begin(false, "/littlefs", 10, "littlefs")) {
       Serial.println("ERROR: LittleFS mount failed!");
       while (1) {
         doFaultAlert(5, 200, 200);
         delay(2000);
       }
     }
 
     server.on("/", onWifiSettingRequest);
     server.on("/wifiSetting.html", onWifiSettingRequest);
     server.onNotFound(onPageNotFound);
     server.begin();
     Serial.println("HTTP server started on port 80");
 
     webSocket.begin();
     webSocket.onEvent(onWebSocketEvent);
     Serial.println("WebSocket server started on port 81");
     Serial.println("Configuration mode ready - connect to AP to configure");
 
     // Stay in config mode loop
     while (configMode) {
       webSocket.loop();
       server.handleClient();
       delay(10);
     }
   }
 
   doBuzzerAlert(2, 500, 500);
 
   // Normal Operation Mode Setup
   Serial.println("\n=== NORMAL OPERATION MODE ===");
   
   char SSIDTemp[50];
   char PASSTemp[20];
   ssid.toCharArray(SSIDTemp, 50);
   password.toCharArray(PASSTemp, 20);
   
   WiFi.onEvent(OnWiFiEvent);
 
   if (wifiMode == "STA") {
     Serial.println("Starting Station Mode...");
     
     IPAddress local_ip(SIP0, SIP1, SIP2, SIP3);
     IPAddress gateway(GW0, GW1, GW2, GW3);
     IPAddress subnet(SNM0, SNM1, SNM2, SNM3);
     IPAddress primaryDNS(PDNS0, PDNS1, PDNS2, PDNS3);
     IPAddress secondaryDNS(SDNS0, SDNS1, SDNS2, SDNS3);
     
     if (!WiFi.config(local_ip, gateway, subnet, primaryDNS, secondaryDNS)) {
       Serial.println("WiFi config failed!");
       faultOn();
     }
     
     WiFi.mode(WIFI_STA);
     WiFi.setAutoReconnect(true);
     WiFi.setHostname("SWT_ControlNode_v3");
     WiFi.begin(SSIDTemp, PASSTemp);
     
     Serial.printf("Connecting to %s", ssid.c_str());
     int attempts = 0;
     while (WiFi.status() != WL_CONNECTED && attempts < 30) {
       doFaultAlert(1, 300, 200);
       Serial.print(".");
       attempts++;
       delay(500);
     }
     
     if (WiFi.status() == WL_CONNECTED) {
       Serial.println("\nWiFi connected!");
       Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
       Serial.printf("MAC Address: %s\n", WiFi.macAddress().c_str());
       faultOff();
     } else {
       Serial.println("\nWiFi connection failed!");
       Serial.println("Starting fallback AP mode...");
       
       WiFi.mode(WIFI_AP);
       WiFi.softAP(SSIDTemp, PASSTemp);
       IPAddress fallback_ip(192, 168, 1, 1);
       IPAddress fallback_gw(192, 168, 1, 1);
       IPAddress fallback_sn(255, 255, 255, 0);
       WiFi.softAPConfig(fallback_ip, fallback_gw, fallback_sn);
       Serial.printf("Fallback AP IP: %s\n", WiFi.softAPIP().toString().c_str());
     }
     
   } else if (wifiMode == "AP") {
     Serial.println("Starting Access Point Mode...");
     
     IPAddress local_ip(SIP0, SIP1, SIP2, SIP3);
     IPAddress gateway(GW0, GW1, GW2, GW3);
     IPAddress subnet(SNM0, SNM1, SNM2, SNM3);
     
     WiFi.mode(WIFI_MODE_APSTA);
     WiFi.softAP(SSIDTemp, PASSTemp);
     WiFi.softAPConfig(local_ip, gateway, subnet);
     
     Serial.printf("AP SSID: %s\n", ssid.c_str());
     Serial.printf("AP IP: %s\n", WiFi.softAPIP().toString().c_str());
     
   } else {
     Serial.printf("ERROR: Unknown WiFi mode: %s\n", wifiMode.c_str());
     while (1) {
       faultOn();
       buzzerOn();
       delay(1000);
       faultOff();
       buzzerOff();
       delay(1000);
     }
   }
 
   // Initialize LittleFS for web files
   if (!LittleFS.begin(false, "/littlefs", 10, "littlefs")) {
     Serial.println("ERROR: LittleFS mount failed!");
     while (1) {
       faultOn();
       buzzerOn();
       delay(1000);
       faultOff();
       buzzerOff();
       delay(1000);
     }
   }
   Serial.println("LittleFS mounted successfully");
 
   // HTTP server routes
   server.on("/", onIndexRequest);
   server.on("/wifiSetting.html", onWifiSettingRequest);
   server.on("/configuration.html", onConfigurationRequest);
   server.onNotFound(onPageNotFound);
   server.begin();
   Serial.println("HTTP server started on port 80");
 
   // Start WebSocket server
   webSocket.begin();
   webSocket.onEvent(onWebSocketEvent);
   Serial.println("WebSocket server started on port 81");
 
   // Create FreeRTOS tasks
   Serial.println("\nCreating FreeRTOS tasks...");
   
   xTaskCreatePinnedToCore(
     motorControlTaskFunction,
     "MotorControl",
     10000,
     NULL,
     1,
     &motorControlTaskHandle,
     0
   );
 
   xTaskCreatePinnedToCore(
     espNowAndLowerTankSensorsTaskFunction,
     "SensorsESPNOW",
     5000,
     NULL,
     1,
     &espNowAndLowerTankSensorsTaskHandle,
     1
   );
 
   xTaskCreatePinnedToCore(
     countTaskFunction,
     "Counter",
     1000,
     NULL,
     1,
     &countTaskHandle,
     0
   );
 
   Serial.println("\n=================================");
   Serial.println("System Initialization Complete!");
   Serial.println("=================================");
   Serial.printf("System Mode: %s\n", systemMode.c_str());
   Serial.printf("Motor Config: %s\n", motorConfiguration.c_str());
   Serial.printf("WiFi Mode: %s\n", wifiMode.c_str());
   
   if (wifiMode == "STA") {
     Serial.printf("WebSocket: ws://%s:81\n", WiFi.localIP().toString().c_str());
   } else {
     Serial.printf("WebSocket: ws://%s:81\n", WiFi.softAPIP().toString().c_str());
   }
   
   Serial.println("=================================\n");
   
   digitalWrite(statusPin, HIGH);
   doBuzzerAlert(1, 200, 100);
 }
 
 // Main loop
 void loop() {
   webSocket.loop();
   server.handleClient();
   
   // Watchdog - monitor task health
   static unsigned long lastTaskCheck = 0;
   if (millis() - lastTaskCheck > 10000) {
     lastTaskCheck = millis();
     
     // Check if tasks are still running
     if (eTaskGetState(motorControlTaskHandle) == eDeleted ||
         eTaskGetState(espNowAndLowerTankSensorsTaskHandle) == eDeleted ||
         eTaskGetState(countTaskHandle) == eDeleted) {
       Serial.println("CRITICAL: Task failure detected!");
       faultOn();
       buzzerOn();
     }
   }
   
   delay(10);
 }