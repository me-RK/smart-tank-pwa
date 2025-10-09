#include <esp_now.h>
#include <WiFi.h>
#include <SPIFFS.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <Preferences.h>
#include <Wire.h>

#define RW_MODE false
#define RO_MODE true

#define RXD2 17
#define TXD2 16

Preferences configs;
// Constants

const int http_port = 80;
const int ws_port = 1337;
const int relay1Pin = 25;
const int relay2Pin = 26;
const int out1Pin = 18;
const int out2Pin = 19;
const int statusPin = 23;
const int faultPin = 15;
const int buzzerPin = 13;
const int configPin = 34;

unsigned long waitTime = 3000;
// Globals
AsyncWebServer server(http_port);
WebSocketsServer webSocket = WebSocketsServer(ws_port);
bool motorState = false;

String ssid = "Smart Water Tank v1.0";
String password = "00000000";
String wifiMode = "AP";

uint8_t SIP0 = 192;
uint8_t SIP1 = 168;
uint8_t SIP2 = 1;
uint8_t SIP3 = 1;

uint8_t GW0 = 192;
uint8_t GW1 = 168;
uint8_t GW2 = 1;
uint8_t GW3 = 1;

uint8_t SNM0 = 255;
uint8_t SNM1 = 255;
uint8_t SNM2 = 255;
uint8_t SNM3 = 0;

uint8_t PDNS0 = 8;
uint8_t PDNS1 = 8;
uint8_t PDNS2 = 8;
uint8_t PDNS3 = 8;

uint8_t SDNS0 = 8;
uint8_t SDNS1 = 8;
uint8_t SDNS2 = 4;
uint8_t SDNS3 = 4;

bool isStaticIP = false;

// IPAddress local_ip(SIP0, SIP1, SIP2, SIP3);
// IPAddress gateway(GW0, GW1, GW2, GW3);
// IPAddress subnet(SNM0, SNM1, SNM2, SNM3);
// IPAddress primaryDNS(PDNS0, PDNS1, PDNS2, PDNS3);    //optional
// IPAddress secondaryDNS(SDNS0, SDNS1, SDNS2, SDNS3);  //optional
bool configMode = false;

// Structure to receive data via ESP-NOW
typedef struct struct_message
{
  bool sensorA;
  bool sensorB;
  uint32_t valueA;
  uint32_t valueB;
} struct_message;

// unsigned int sensorLowTank = 0;
bool lowerSensorAEnable = false;
bool lowerSensorBEnable = false;
bool upperSensorAEnable = false;
bool upperSensorBEnable = false;

uint32_t sensorLowTankA = 0;
uint32_t sensorLowTankB = 0;

uint32_t readDelayA = 500;
uint32_t readDelayB = 500;
// Create a struct_message called subData
struct_message subData;

float upperTankHeightA = 0.0;
float upperWaterFullHeightA = 0.0;
float upperWaterEmptyHeightA = 0.0;
float lowerTankHeightA = 0.0;
float lowerWaterFullHeightA = 0.0;
float lowerWaterEmptyHeightA = 0.0;

float upperTankHeightB = 0.0;
float upperWaterFullHeightB = 0.0;
float upperWaterEmptyHeightB = 0.0;
float lowerTankHeightB = 0.0;
float lowerWaterFullHeightB = 0.0;
float lowerWaterEmptyHeightB = 0.0;

float minAutoValue = 0.0;
float maxAutoValue = 0.0;

float upperTankWaterLevelA = 0.0;
float upperTankWaterLevelB = 0.0;
float lowerTankWaterLevelA = 0.0;
float lowerTankWaterLevelB = 0.0;
float lowerTankLowerThresholdLevelA = 30.0;
float lowerTankLowerThresholdLevelB = 30.0;
float lowerTankOverFlowThresholdLevelA = 100.0;
float lowerTankOverFlowThresholdLevelB = 100.0;
String systemMode = "";
String autoModeReason = "NONE";
bool upperTankOverFlowLock;
bool lowerTankOverFlowLock;
// bool upperTankOverFlowLockA;
// bool upperTankOverFlowLockB;
// bool lowerTankOverFlowLockA;
// bool lowerTankOverFlowLockB;
bool syncBothTank;
bool buzzerAlert = true;

unsigned long lastUpdated = 0;

uint8_t clientNumGlobal = 0;

TaskHandle_t Task1;
TaskHandle_t Task2;
TaskHandle_t Task3;

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
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len);
void onWebSocketEvent(uint8_t client_num, WStype_t type, uint8_t *payload, size_t length);

void motorControlTask(void *pvParameters);
void espNowAndLowerTankSensorsTask(void *pvParameters);
void countTask(void *pvParameters);

void onIndexRequest(AsyncWebServerRequest *request);
void onConfigurationRequest(AsyncWebServerRequest *request);
void onWifiSettingRequest(AsyncWebServerRequest *request);
void onPageNotFound(AsyncWebServerRequest *request);

void faultOn(void);
void faultOff(void);
void buzzerOn(void);
void buzzerOff(void);

bool isUpperTankLevelWithinRange(void);
bool isLowerTankOverflow(void);

void doBuzzerAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay)
{
  digitalWrite(buzzerPin, LOW);
  for (int i = 0; i < count; i++)
  {
    if (buzzerAlert)
    {
      digitalWrite(buzzerPin, HIGH);
      delay(onDelay);
      digitalWrite(buzzerPin, LOW);
      delay(offDelay);
    }
    else
    {
      delay(onDelay);
    }
  }
}

void doStatusAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay)
{
  digitalWrite(statusPin, LOW);
  for (int i = 0; i < count; i++)
  {
    digitalWrite(statusPin, HIGH);
    delay(onDelay);
    digitalWrite(statusPin, LOW);
    delay(offDelay);
  }
}

void doFaultAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay)
{
  digitalWrite(faultPin, LOW);
  for (int i = 0; i < count; i++)
  {
    digitalWrite(faultPin, HIGH);
    delay(onDelay);
    digitalWrite(faultPin, LOW);
    delay(offDelay);
  }
}

void faultOn(void)
{
  digitalWrite(faultPin, HIGH);
}

void faultOff(void)
{
  digitalWrite(faultPin, LOW);
}

void buzzerOn(void)
{
  digitalWrite(buzzerPin, HIGH);
}

void buzzerOff(void)
{
  digitalWrite(buzzerPin, LOW);
}

void OnWiFiEvent(WiFiEvent_t event)
{
  switch (event)
  {

  case SYSTEM_EVENT_STA_CONNECTED:
    Serial.println("ESP32 Connected to WiFi Network");
    break;
  case SYSTEM_EVENT_AP_START:
    Serial.println("ESP32 soft AP started");
    break;
  case SYSTEM_EVENT_AP_STACONNECTED:
    Serial.println("Station connected to ESP32 soft AP");
    break;
  case SYSTEM_EVENT_AP_STADISCONNECTED:
    Serial.println("Station disconnected from ESP32 soft AP");
    break;
  default:
    break;
  }
}

// motorControlTask: Motor Automation
void motorControlTask(void *pvParameters)
{
  Serial.print("Task1 running on core ");
  Serial.println(xPortGetCoreID());

  for (;;)
  {
    motorAutomation();
    doStatusAlert(1, 150, 150);
  }
}

// espNowAndLowerTankSensorsTask: blinks an LED every 700 ms
void espNowAndLowerTankSensorsTask(void *pvParameters)
{
  Serial.print("Task2 running on core ");
  Serial.println(xPortGetCoreID());

  // Init ESP-NOW
  if (esp_now_init() != ESP_OK)
  {
    Serial.println("Error initializing ESP-NOW");
    return;
  }

  // Once ESPNow is successfully Init, we will register for recv CB to
  // get recv packer info
  uint8_t error = esp_now_register_recv_cb(OnDataRecv);

  if (error == ESP_OK)
  {
    Serial.println("ESP Now Initiated Successfully.");
  }
  else
  {
    Serial.print("ESP Now Initiated Failed: ");
    Serial.println(error);
    doFaultAlert(1, 1000, 200);
  }

  for (;;)
  {
    if (lowerSensorAEnable)
    {
      readLowTankHeightA();
    }

    if (lowerSensorBEnable)
    {
      readLowTankHeightB();
    }
    doStatusAlert(3, 500, 500);
  }
}

// countTask: blinks an LED every 700 ms
void countTask(void *pvParameters)
{
  Serial.print("Task3 running on core ");
  Serial.println(xPortGetCoreID());

  for (;;)
  {
    delay(100);
    if (lastUpdated == 4294967290)
    {
      lastUpdated = 0;
    }
    else
    {
      lastUpdated = lastUpdated + 1;
    }
  }
}

void updateMotorStateInNVS(bool newData)
{
  configs.begin("configData", RW_MODE);
  configs.putBool("motorState", newData); // Manual Mode, Auto Mode
  Serial.print("motorState Updated at NVS: ");
  Serial.println(newData);
  configs.end();
}

void switchMotorON()
{
  if (motorState != true)
  {
    motorState = true;

    Serial.printf("Toggling Motor to %u\n", motorState);
    digitalWrite(relay1Pin, motorState);
    digitalWrite(statusPin, motorState);
    digitalWrite(out1Pin, motorState);

    StaticJsonDocument<100> stateUpdate;
    stateUpdate["MSV"] = "ON";
    String jsonString;
    serializeJson(stateUpdate, jsonString);

    webSocket.sendTXT(clientNumGlobal, jsonString);
    updateMotorStateInNVS(motorState);

    doBuzzerAlert(1, 500, 200);
  }
}

void switchMotorOFF()
{
  if (motorState != false)
  {
    motorState = false;

    Serial.printf("Toggling Motor to %u\n", motorState);
    digitalWrite(relay1Pin, motorState);
    digitalWrite(statusPin, motorState);
    digitalWrite(out1Pin, motorState);

    StaticJsonDocument<100> stateUpdate;
    stateUpdate["MSV"] = "OFF";
    String jsonString;
    serializeJson(stateUpdate, jsonString);

    webSocket.sendTXT(clientNumGlobal, jsonString);
    updateMotorStateInNVS(motorState);

    doBuzzerAlert(2, 500, 250);
  }
}

bool isUpperTankLevelWithinRange()
{
  return (maxAutoValue >= upperTankWaterLevelA) && (upperTankWaterLevelA >= minAutoValue);
}

bool isLowerTankOverflow()
{
  return lowerTankWaterLevelA >= lowerTankOverFlowThresholdLevelA;
}

void motorAutomation()
{
  if (systemMode == "Auto Mode")
  {
    if (syncBothTank)
    {
      if (lowerTankWaterLevelA >= lowerTankLowerThresholdLevelA)
      {
        if (upperTankOverFlowLock)
        {
          if (upperTankWaterLevelA > maxAutoValue)
          {
            autoModeReason = "UpperWater > Max Limit";
            switchMotorOFF();
          }
          else if ((isUpperTankLevelWithinRange()))
          {

            if (lowerTankOverFlowLock && isLowerTankOverflow())
            {
              autoModeReason = "LowerTank OverFlow";
              switchMotorON();
            }
            else
            {
              autoModeReason = "UpperTank Level Maintained";
            }
          }
          else if ((upperTankWaterLevelA < minAutoValue))
          {
            autoModeReason = "UpperWater < Min Limit";
            switchMotorON();
          }
          else
          {
            autoModeReason = "UpperTank Value Error0";
          }
        }
        else
        {
          if (lowerTankOverFlowLock && (upperTankWaterLevelA < minAutoValue || isLowerTankOverflow()))
          {
            autoModeReason = "Lower Water OverFlow Detected.";
            switchMotorON();
          }
          else
          {
            if (upperTankWaterLevelA < minAutoValue)
            {
              autoModeReason = "Upper Tank < Min Limit";
              switchMotorON();
            }
            else if ((isUpperTankLevelWithinRange()))
            {
              autoModeReason = "UpperTank Level Maintained";
            }
            else
            {
              autoModeReason = "UpperTank Value Error1";
            }
          }
        }
      }
      else if (lowerTankWaterLevelA < lowerTankLowerThresholdLevelA)
      {
        autoModeReason = "Lower Tank < 30%";
        switchMotorOFF();
      }
    }
    else
    {
      if (upperTankOverFlowLock)
      {
        if (upperTankWaterLevelA > maxAutoValue)
        {
          autoModeReason = "UpperWater > Max Limit";
          switchMotorOFF();
        }
        else if ((isUpperTankLevelWithinRange()))
        {
          autoModeReason = "UpperTank Level Maintained";
        }
        else if ((upperTankWaterLevelA < minAutoValue))
        {
          autoModeReason = "UpperWater < Min Limit";
          switchMotorON();
        }
        else
        {
          autoModeReason = "UpperTank Value Error0";
        }
      }
      else
      {

        autoModeReason = "Change to Manual Mode.";
        switchMotorOFF();
      }
    }
  }
  else if (systemMode == "Manual Mode")
  {
    // Implementation for Manual Mode
  }
  else
  {
    autoModeReason = "Mode Error, Unknown Mode Selected: " + systemMode;
  }
}

void readLowTankHeightB()
{

  byte StartByte = 0;
  byte MSByte = 0;
  byte LSByte = 0;
  byte CheckSum = 0;
  Serial.flush();
  Serial.write(0x55); // 0x55
  delay(50);

  if (Serial.available() >= 4)
  {
    StartByte = Serial.read();
    if (StartByte == 0xFF)
    {
      MSByte = Serial.read();
      LSByte = Serial.read();
      CheckSum = Serial.read();
      CheckSum = LSByte + CheckSum;
      sensorLowTankB = MSByte * 256 + LSByte;

      // Serial.print("Distance: ");
      // Serial.print(mmDist);
    }
    else
    {
      Serial.flush();
    }
  }
  float fullB = lowerTankHeightB - lowerWaterFullHeightB;
  float emptyB = lowerTankHeightB - lowerWaterEmptyHeightB;
  // Serial.print("full: ");
  // Serial.print(full);
  // Serial.print(", empty: ");
  // Serial.println(empty);
  lowerTankWaterLevelB = map(sensorLowTankB, fullB, emptyB, 100.0, 0.0);
  Serial.print("Lower tank - ");
  Serial.print(lowerTankWaterLevelB);
  Serial.print(" - ");
  Serial.println(sensorLowTankB);
  delay(readDelayB);
}

void readLowTankHeightA()
{

  byte StartByte = 0;
  byte MSByte = 0;
  byte LSByte = 0;
  byte CheckSum = 0;

  Serial2.flush();
  Serial2.write(0x55); // 0x55
  delay(50);

  if (Serial2.available() >= 4)
  {
    StartByte = Serial2.read();
    if (StartByte == 0xFF)
    {
      MSByte = Serial2.read();
      LSByte = Serial2.read();
      CheckSum = Serial2.read();
      CheckSum = LSByte + CheckSum;
      sensorLowTankA = MSByte * 256 + LSByte;

      // Serial.print("Distance: ");
      // Serial.print(mmDist);
    }
    else
    {
      Serial2.flush();
    }
  }
  float fullA = lowerTankHeightA - lowerWaterFullHeightA;
  float emptyA = lowerTankHeightA - lowerWaterEmptyHeightA;
  // Serial.print("full: ");
  // Serial.print(full);
  // Serial.print(", empty: ");
  // Serial.println(empty);
  lowerTankWaterLevelA = map(sensorLowTankA, fullA, emptyA, 100.0, 0.0);
  Serial.print("Lower tank - ");
  Serial.print(lowerTankWaterLevelA);
  Serial.print(" - ");
  Serial.println(sensorLowTankA);

  delay(readDelayA);
}
// callback function that will be executed when data is received
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len)
{
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

  if (upperSensorAEnableLive != upperSensorAEnable)
  {
    upperSensorAEnable = upperSensorAEnableLive;
    configs.begin("configData", RW_MODE);
    configs.putBool("UAE", upperSensorAEnableLive); // Manual Mode, Auto Mode
    configs.end();
    Serial.println("upperSensorAEnable Updated at NVS.");
  }
  else
  {
    Serial.println("upperSensorAEnable Detected. No changes at NVS.");
  }

  if (upperSensorBEnableLive != upperSensorBEnable)
  {
    upperSensorBEnable = upperSensorBEnableLive;
    configs.begin("configData", RW_MODE);
    configs.putBool("UBE", upperSensorBEnableLive); // Manual Mode, Auto Mode
    configs.end();
    Serial.println("upperSensorBEnable Updated at NVS.");
  }
  else
  {
    Serial.println("upperSensorBEnable Detected. No changes at NVS.");
  }

  if (subData.sensorA)
  {
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
  if (subData.sensorB)
  {
    int upperTankDataB = subData.valueB;
    Serial.print("upperTankData: ");
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

// Callback: receiving any WebSocket message
void onWebSocketEvent(uint8_t client_num,
                      WStype_t type,
                      uint8_t *payload,
                      size_t length)
{

  clientNumGlobal = client_num;

  // Figure out the type of WebSocket event
  switch (type)
  {

  // Client has disconnected
  case WStype_DISCONNECTED:
  {
    Serial.printf("[%u] Disconnected!\n", client_num);
    faultOn();
  }
  break;

  // New client has connected
  case WStype_CONNECTED:
  {
    IPAddress ip = webSocket.remoteIP(client_num);
    Serial.printf("[%u] Connection from ", client_num);
    Serial.println(ip.toString());

    faultOff();
    doStatusAlert(1, 200, 100);
  }
  break;

  // Handle text messages from client
  case WStype_TEXT:
    doStatusAlert(1, 200, 100);
    // Print out raw message
    Serial.printf("[%u] Received text: %s\n", client_num, payload);

    // dESERIALIZE UPCOMMING VALUE
    if (length > 50)
    {
      if (configMode)
      {

        DynamicJsonDocument doc(500);
        DeserializationError error = deserializeJson(doc, payload);
        // Test if parsing succeeds.
        if (error)
        {
          Serial.print(F("deserializeJson() failed: "));
          Serial.println(error.f_str());
          return;
        }

        String wifiModeLive = doc["MODE"].as<String>();
        String ssidLive = doc["SSID"].as<String>();
        String passwordLive = doc["PASS"].as<String>();

        uint8_t SIP0Live = doc["SIP"][0];
        uint8_t SIP1Live = doc["SIP"][1];
        uint8_t SIP2Live = doc["SIP"][2];
        uint8_t SIP3Live = doc["SIP"][3];

        uint8_t GW0Live = doc["GW"][0];
        uint8_t GW1Live = doc["GW"][1];
        uint8_t GW2Live = doc["GW"][2];
        uint8_t GW3Live = doc["GW"][3];

        uint8_t SNM0Live = doc["SNM"][0];
        uint8_t SNM1Live = doc["SNM"][1];
        uint8_t SNM2Live = doc["SNM"][2];
        uint8_t SNM3Live = doc["SNM"][3];

        uint8_t PDNS0Live = doc["PDNS"][0];
        uint8_t PDNS1Live = doc["PDNS"][1];
        uint8_t PDNS2Live = doc["PDNS"][2];
        uint8_t PDNS3Live = doc["PDNS"][3];

        uint8_t SDNS0Live = doc["SDNS"][0];
        uint8_t SDNS1Live = doc["SDNS"][1];
        uint8_t SDNS2Live = doc["SDNS"][2];
        uint8_t SDNS3Live = doc["SDNS"][3];

        if (wifiModeLive == "access_point")
        {
          Serial.println("Access point mode Configuration in nvs Entered.");

          SIP0Live = 192;
          SIP1Live = 168;
          SIP2Live = 1;
          SIP3Live = 1;

          GW0Live = 192;
          GW1Live = 168;
          GW2Live = 1;
          GW3Live = 1;

          SNM0Live = 255;
          SNM1Live = 255;
          SNM2Live = 255;
          SNM3Live = 0;

          configs.begin("configData", RW_MODE);
          {
            if (wifiModeLive != wifiMode)
            {
              wifiMode = wifiModeLive;
              uint16_t check = configs.putString("WIFIMode", "AP"); // Manual Mode, Auto Mode
              if (check != 0)
              {
                Serial.println("wifiMode Updated at NVS.");
              }
              else
              {
                Serial.print(check);
                Serial.println(", wifiMode Updated at NVS.");
              }
            }
            else
            {
              Serial.println("wifiMode Detected. No changes at NVS.");
            }
            if (ssidLive != ssid)
            {
              ssid = ssidLive;
              configs.putString("SSID", ssidLive); // Manual Mode, Auto Mode
              Serial.println("ssid Updated at NVS.");
            }
            else
            {
              Serial.println("ssid Detected. No changes at NVS.");
            }
            if (passwordLive != password)
            {
              password = passwordLive;
              configs.putString("PASS", passwordLive); // Manual Mode, Auto Mode
              Serial.println("password Updated at NVS.");
            }
            else
            {
              Serial.println("password Detected. No changes at NVS.");
            }

            if (SIP0Live != SIP0)
            {
              SIP0 = SIP0Live;
              configs.putUShort("SIP0", SIP0Live); // Manual Mode, Auto Mode
              Serial.println("SIP0 Updated at NVS.");
            }
            else
            {
              Serial.println("SIP0 Detected. No changes at NVS.");
            }
            if (SIP1Live != SIP1)
            {
              SIP1 = SIP1Live;
              configs.putUShort("SIP1", SIP1Live); // Manual Mode, Auto Mode
              Serial.println("SIP1 Updated at NVS.");
            }
            else
            {
              Serial.println("SIP1 Detected. No changes at NVS.");
            }
            if (SIP2Live != SIP2)
            {
              SIP2 = SIP2Live;
              configs.putUShort("SIP2", SIP2Live); // Manual Mode, Auto Mode
              Serial.println("SIP2 Updated at NVS.");
            }
            else
            {
              Serial.println("SIP2 Detected. No changes at NVS.");
            }
            if (SIP3Live != SIP3)
            {
              SIP3 = SIP3Live;
              configs.putUShort("SIP3", SIP3Live); // Manual Mode, Auto Mode
              Serial.println("SIP3 Updated at NVS.");
            }
            else
            {
              Serial.println("SIP3 Detected. No changes at NVS.");
            }

            if (GW0Live != GW0)
            {
              GW0 = GW0Live;
              configs.putUShort("SG0", GW0Live); // Manual Mode, Auto Mode
              Serial.println("GW0 Updated at NVS.");
            }
            else
            {
              Serial.println("GW0 Detected. No changes at NVS.");
            }
            if (GW1Live != GW1)
            {
              GW1 = GW1Live;
              configs.putUShort("SG1", GW1Live); // Manual Mode, Auto Mode
              Serial.println("GW1 Updated at NVS.");
            }
            else
            {
              Serial.println("GW1 Detected. No changes at NVS.");
            }
            if (GW2Live != GW2)
            {
              GW2 = GW2Live;
              configs.putUShort("SG2", GW2Live); // Manual Mode, Auto Mode
              Serial.println("GW2 Updated at NVS.");
            }
            else
            {
              Serial.println("GW2 Detected. No changes at NVS.");
            }
            if (GW3Live != GW3)
            {
              GW3 = GW3Live;
              configs.putUShort("SG3", GW3Live); // Manual Mode, Auto Mode
              Serial.println("GW3 Updated at NVS.");
            }
            else
            {
              Serial.println("GW3 Detected. No changes at NVS.");
            }

            if (SNM0Live != SNM0)
            {
              SNM0 = SNM0Live;
              configs.putUShort("SS0", SNM0Live); // Manual Mode, Auto Mode
              Serial.println("SNM0 Updated at NVS.");
            }
            else
            {
              Serial.println("SNM0 Detected. No changes at NVS.");
            }
            if (SNM1Live != SNM1)
            {
              SNM1 = SNM1Live;
              configs.putUShort("SS1", SNM1Live); // Manual Mode, Auto Mode
              Serial.println("SNM1 Updated at NVS.");
            }
            else
            {
              Serial.println("SNM1 Detected. No changes at NVS.");
            }
            if (SNM2Live != SNM2)
            {
              SNM2 = SNM2Live;
              configs.putUShort("SS2", SNM2Live); // Manual Mode, Auto Mode
              Serial.println("SNM2 Updated at NVS.");
            }
            else
            {
              Serial.println("SNM2 Detected. No changes at NVS.");
            }
            if (SNM3Live != SNM3)
            {
              SNM3 = SNM3Live;
              configs.putUShort("SS3", SNM3Live); // Manual Mode, Auto Mode
              Serial.println("SNM3 Updated at NVS.");
            }
            else
            {
              Serial.println("SNM3 Detected. No changes at NVS.");
            }
          }
          configs.end();
        }
        else if (wifiModeLive == "station")
        {
          Serial.println("Station mode Configuration in nvs Entered.");
          configs.begin("configData", RW_MODE);
          {
            if (wifiModeLive != wifiMode)
            {
              wifiMode = wifiModeLive;
              uint16_t check = configs.putString("WIFIMode", "STA"); // Manual Mode, Auto Mode
              if (check != 0)
              {
                Serial.println("wifiMode Updated at NVS.");
              }
              else
              {
                Serial.print(check);
                Serial.println(", wifiMode Updated at NVS.");
              }
            }
            else
            {
              Serial.println("wifiMode Detected. No changes at NVS.");
            }
            if (ssidLive != ssid)
            {
              ssid = ssidLive;
              configs.putString("SSID", ssidLive); // Manual Mode, Auto Mode
              Serial.println("ssid Updated at NVS.");
            }
            else
            {
              Serial.println("ssid Detected. No changes at NVS.");
            }
            if (passwordLive != password)
            {
              password = passwordLive;
              configs.putString("PASS", passwordLive); // Manual Mode, Auto Mode
              Serial.println("password Updated at NVS.");
            }
            else
            {
              Serial.println("password Detected. No changes at NVS.");
            }

            if (SIP0Live != SIP0)
            {
              SIP0 = SIP0Live;
              configs.putUShort("SIP0", SIP0Live); // Manual Mode, Auto Mode
              Serial.println("SIP0 Updated at NVS.");
            }
            else
            {
              Serial.println("SIP0 Detected. No changes at NVS.");
            }
            if (SIP1Live != SIP1)
            {
              SIP1 = SIP1Live;
              configs.putUShort("SIP1", SIP1Live); // Manual Mode, Auto Mode
              Serial.println("SIP1 Updated at NVS.");
            }
            else
            {
              Serial.println("SIP1 Detected. No changes at NVS.");
            }
            if (SIP2Live != SIP2)
            {
              SIP2 = SIP2Live;
              configs.putUShort("SIP2", SIP2Live); // Manual Mode, Auto Mode
              Serial.println("SIP2 Updated at NVS.");
            }
            else
            {
              Serial.println("SIP2 Detected. No changes at NVS.");
            }
            if (SIP3Live != SIP3)
            {
              SIP3 = SIP3Live;
              configs.putUShort("SIP3", SIP3Live); // Manual Mode, Auto Mode
              Serial.println("SIP3 Updated at NVS.");
            }
            else
            {
              Serial.println("SIP3 Detected. No changes at NVS.");
            }

            if (GW0Live != GW0)
            {
              GW0 = GW0Live;
              configs.putUShort("SG0", GW0Live); // Manual Mode, Auto Mode
              Serial.println("GW0 Updated at NVS.");
            }
            else
            {
              Serial.println("GW0 Detected. No changes at NVS.");
            }
            if (GW1Live != GW1)
            {
              GW1 = GW1Live;
              configs.putUShort("SG1", GW1Live); // Manual Mode, Auto Mode
              Serial.println("GW1 Updated at NVS.");
            }
            else
            {
              Serial.println("GW1 Detected. No changes at NVS.");
            }
            if (GW2Live != GW2)
            {
              GW2 = GW2Live;
              configs.putUShort("SG2", GW2Live); // Manual Mode, Auto Mode
              Serial.println("GW2 Updated at NVS.");
            }
            else
            {
              Serial.println("GW2 Detected. No changes at NVS.");
            }
            if (GW3Live != GW3)
            {
              GW3 = GW3Live;
              configs.putUShort("SG3", GW3Live); // Manual Mode, Auto Mode
              Serial.println("GW3 Updated at NVS.");
            }
            else
            {
              Serial.println("GW3 Detected. No changes at NVS.");
            }

            if (SNM0Live != SNM0)
            {
              SNM0 = SNM0Live;
              configs.putUShort("SS0", SNM0Live); // Manual Mode, Auto Mode
              Serial.println("SNM0 Updated at NVS.");
            }
            else
            {
              Serial.println("SNM0 Detected. No changes at NVS.");
            }
            if (SNM1Live != SNM1)
            {
              SNM1 = SNM1Live;
              configs.putUShort("SS1", SNM1Live); // Manual Mode, Auto Mode
              Serial.println("SNM1 Updated at NVS.");
            }
            else
            {
              Serial.println("SNM1 Detected. No changes at NVS.");
            }
            if (SNM2Live != SNM2)
            {
              SNM2 = SNM2Live;
              configs.putUShort("SS2", SNM2Live); // Manual Mode, Auto Mode
              Serial.println("SNM2 Updated at NVS.");
            }
            else
            {
              Serial.println("SNM2 Detected. No changes at NVS.");
            }
            if (SNM3Live != SNM3)
            {
              SNM3 = SNM3Live;
              configs.putUShort("SS3", SNM3Live); // Manual Mode, Auto Mode
              Serial.println("SNM3 Updated at NVS.");
            }
            else
            {
              Serial.println("SNM3 Detected. No changes at NVS.");
            }

            if (PDNS0Live != PDNS0)
            {
              PDNS0 = PDNS0Live;
              configs.putUShort("SPD0", PDNS0Live); // Manual Mode, Auto Mode
              Serial.println("PDNS0 Updated at NVS.");
            }
            else
            {
              Serial.println("PDNS0 Detected. No changes at NVS.");
            }
            if (PDNS1Live != PDNS1)
            {
              PDNS1 = PDNS1Live;
              configs.putUShort("SPD1", PDNS1Live); // Manual Mode, Auto Mode
              Serial.println("PDNS1 Updated at NVS.");
            }
            else
            {
              Serial.println("PDNS1 Detected. No changes at NVS.");
            }
            if (PDNS2Live != PDNS2)
            {
              PDNS2 = PDNS2Live;
              configs.putUShort("SPD2", PDNS2Live); // Manual Mode, Auto Mode
              Serial.println("PDNS2 Updated at NVS.");
            }
            else
            {
              Serial.println("PDNS2 Detected. No changes at NVS.");
            }
            if (PDNS3Live != PDNS3)
            {
              PDNS3 = PDNS3Live;
              configs.putUShort("SPD3", PDNS3Live); // Manual Mode, Auto Mode
              Serial.println("PDNS3 Updated at NVS.");
            }
            else
            {
              Serial.println("PDNS3 Detected. No changes at NVS.");
            }

            if (SDNS0Live != SDNS0)
            {
              SDNS0 = SDNS0Live;
              configs.putUShort("SSD0", SDNS0Live); // Manual Mode, Auto Mode
              Serial.println("SDNS0 Updated at NVS.");
            }
            else
            {
              Serial.println("SDNS0 Detected. No changes at NVS.");
            }
            if (SDNS1Live != SDNS1)
            {
              SDNS1 = SDNS1Live;
              configs.putUShort("SSD1", SDNS1Live); // Manual Mode, Auto Mode
              Serial.println("SDNS1 Updated at NVS.");
            }
            else
            {
              Serial.println("SDNS1 Detected. No changes at NVS.");
            }
            if (SDNS2Live != SDNS2)
            {
              SDNS2 = SDNS2Live;
              configs.putUShort("SSD2", SDNS2Live); // Manual Mode, Auto Mode
              Serial.println("SDNS2 Updated at NVS.");
            }
            else
            {
              Serial.println("SDNS2 Detected. No changes at NVS.");
            }
            if (SDNS3Live != SDNS3)
            {
              SDNS3 = SDNS3Live;
              configs.putUShort("SSD3", SDNS3Live); // Manual Mode, Auto Mode
              Serial.println("SDNS3 Updated at NVS.");
            }
            else
            {
              Serial.println("SDNS3 Detected. No changes at NVS.");
            }
          }
          configs.end();
        }
      }
      else
      {
        DynamicJsonDocument doc(600);
        DeserializationError error = deserializeJson(doc, payload);

        // Test if parsing succeeds.
        if (error)
        {
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
        {

          if (lowerSensorAEnableLive != lowerSensorAEnable)
          {
            lowerSensorAEnable = lowerSensorAEnableLive;
            configs.putBool("LAE", lowerSensorAEnableLive); // Manual Mode, Auto Mode
            Serial.println("lowerSensorAEnable Updated at NVS.");
          }
          else
          {
            Serial.println("Same lowerSensorAEnable Detected. No changes at NVS.");
          }
          // 2
          if (lowerSensorBEnableLive != lowerSensorBEnable)
          {
            lowerSensorBEnable = lowerSensorBEnableLive;
            configs.putBool("LBE", lowerSensorBEnableLive); // Manual Mode, Auto Mode
            Serial.println("lowerSensorBEnable Updated at NVS.");
          }
          else
          {
            Serial.println("Same lowerSensorBEnable Detected. No changes at NVS.");
          }

          if (systemModeLive != systemMode)
          {
            systemMode = systemModeLive;
            configs.putString("systemMode", systemModeLive); // Manual Mode, Auto Mode
            Serial.println("System Mode Updated at NVS.");
          }
          else
          {
            Serial.println("Same Mode Detected. No changes at NVS.");
          }
          // 2
          if (maxAutoValueLive != maxAutoValue)
          {
            maxAutoValue = maxAutoValueLive;
            configs.putFloat("autoMax", maxAutoValueLive); // Manual Mode, Auto Mode
            Serial.println("maxAutoValue Updated at NVS.");
          }
          else
          {
            Serial.println("Same maxAutoValue Detected. No changes at NVS.");
          }
          // 3
          if (minAutoValueLive != minAutoValue)
          {
            minAutoValue = minAutoValueLive;
            configs.putFloat("autoMin", minAutoValueLive); // Manual Mode, Auto Mode
            Serial.println("minAutoValue Updated at NVS.");
          }
          else
          {
            Serial.println("Same minAutoValue Detected. No changes at NVS.");
          }
          // 4
          if (upperTankHeightLiveA != upperTankHeightA)
          {
            upperTankHeightA = upperTankHeightLiveA;
            configs.putFloat("UTHA", upperTankHeightLiveA); // Manual Mode, Auto Mode
            Serial.println("upperTankHeightA Updated at NVS.");
          }
          else
          {
            Serial.println("Same upperTankHeightA Detected. No changes at NVS.");
          }
          // 5
          if (upperWaterFullHeightLiveA != upperWaterFullHeightA)
          {
            upperWaterFullHeightA = upperWaterFullHeightLiveA;
            configs.putFloat("UTWFHA", upperWaterFullHeightLiveA); // Manual Mode, Auto Mode
            Serial.println("upperWaterFullHeightA Updated at NVS.");
          }
          else
          {
            Serial.println("Same upperWaterFullHeightA Detected. No changes at NVS.");
          }
          // 6
          Serial.print("upperWaterEmptyHeightLiveA : ");
          Serial.print(upperWaterEmptyHeightLiveA);

          Serial.print(",  upperWaterEmptyHeightA: ");
          Serial.println(upperWaterEmptyHeightA);

          if (upperWaterEmptyHeightLiveA != upperWaterEmptyHeightA)
          {
            upperWaterEmptyHeightA = upperWaterEmptyHeightLiveA;
            configs.putFloat("UTWEHA", upperWaterEmptyHeightLiveA); // Manual Mode, Auto Mode
            Serial.println("upperWaterEmptyHeightA Updated at NVS.");
          }
          else
          {
            Serial.println("Same upperWaterEmptyHeightA Detected. No changes at NVS.");
          }
          // 7
          if (lowerTankHeightLiveA != lowerTankHeightA)
          {
            lowerTankHeightA = lowerTankHeightLiveA;
            configs.putFloat("LTHA", lowerTankHeightLiveA); // Manual Mode, Auto Mode
            Serial.println("lowerTankHeightA Updated at NVS.");
          }
          else
          {
            Serial.println("Same lowerTankHeightA Detected. No changes at NVS.");
          }
          // 8
          if (lowerWaterFullHeightLiveA != lowerWaterFullHeightA)
          {
            lowerWaterFullHeightA = lowerWaterFullHeightLiveA;
            configs.putFloat("LTWFHA", lowerWaterFullHeightLiveA); // Manual Mode, Auto Mode
            Serial.println("lowerWaterFullHeightA Updated at NVS.");
          }
          else
          {
            Serial.println("Same lowerWaterFullHeightA Detected. No changes at NVS.");
          }
          // 9
          if (lowerWaterEmptyHeightLiveA != lowerWaterEmptyHeightA)
          {
            lowerWaterEmptyHeightA = lowerWaterEmptyHeightLiveA;
            configs.putFloat("LTWEHA", lowerWaterEmptyHeightLiveA); // Manual Mode, Auto Mode
            Serial.println("lowerWaterEmptyHeightA Updated at NVS.");
          }
          else
          {
            Serial.println("Same lowerWaterEmptyHeightA Detected. No changes at NVS.");
          }

          if (upperTankHeightLiveB != upperTankHeightB)
          {
            upperTankHeightB = upperTankHeightLiveB;
            configs.putFloat("UTHB", upperTankHeightLiveB); // Manual Mode, Auto Mode
            Serial.println("upperTankHeightB Updated at NVS.");
          }
          else
          {
            Serial.println("Same upperTankHeightB Detected. No changes at NVS.");
          }
          // 5
          if (upperWaterFullHeightLiveB != upperWaterFullHeightB)
          {
            upperWaterFullHeightB = upperWaterFullHeightLiveB;
            configs.putFloat("UTWFHB", upperWaterFullHeightLiveB); // Manual Mode, Auto Mode
            Serial.println("upperWaterFullHeightB Updated at NVS.");
          }
          else
          {
            Serial.println("Same upperWaterFullHeightB Detected. No changes at NVS.");
          }
          // 6
          Serial.print("upperWaterEmptyHeightLiveB : ");
          Serial.print(upperWaterEmptyHeightLiveB);

          Serial.print(",  upperWaterEmptyHeightB: ");
          Serial.println(upperWaterEmptyHeightB);

          if (upperWaterEmptyHeightLiveB != upperWaterEmptyHeightB)
          {
            upperWaterEmptyHeightB = upperWaterEmptyHeightLiveB;
            configs.putFloat("UTWEHB", upperWaterEmptyHeightLiveB); // Manual Mode, Auto Mode
            Serial.println("upperWaterEmptyHeightB Updated at NVS.");
          }
          else
          {
            Serial.println("Same upperWaterEmptyHeightB Detected. No changes at NVS.");
          }
          // 7
          if (lowerTankHeightLiveB != lowerTankHeightB)
          {
            lowerTankHeightB = lowerTankHeightLiveB;
            configs.putFloat("LTHB", lowerTankHeightLiveB); // Manual Mode, Auto Mode
            Serial.println("lowerTankHeightB Updated at NVS.");
          }
          else
          {
            Serial.println("Same lowerTankHeightB Detected. No changes at NVS.");
          }
          // 8
          if (lowerWaterFullHeightLiveB != lowerWaterFullHeightB)
          {
            lowerWaterFullHeightB = lowerWaterFullHeightLiveB;
            configs.putFloat("LTWFHB", lowerWaterFullHeightLiveB); // Manual Mode, Auto Mode
            Serial.println("lowerWaterFullHeightB Updated at NVS.");
          }
          else
          {
            Serial.println("Same lowerWaterFullHeightB Detected. No changes at NVS.");
          }
          // 9
          if (lowerWaterEmptyHeightLiveB != lowerWaterEmptyHeightB)
          {
            lowerWaterEmptyHeightB = lowerWaterEmptyHeightLiveB;
            configs.putFloat("LTWEHB", lowerWaterEmptyHeightLiveB); // Manual Mode, Auto Mode
            Serial.println("lowerWaterEmptyHeightB Updated at NVS.");
          }
          else
          {
            Serial.println("Same lowerWaterEmptyHeightB Detected. No changes at NVS.");
          }

          // 10
          if (upperTankOverFlowLockLive != upperTankOverFlowLock)
          {
            upperTankOverFlowLock = upperTankOverFlowLockLive;
            configs.putBool("UTOFL", upperTankOverFlowLockLive); // Manual Mode, Auto Mode
            Serial.println("upperTankOverFlowLock Updated at NVS.");
          }
          else
          {
            Serial.println("Same upperTankOverFlowLock Detected. No changes at NVS.");
          }
          // 11
          if (lowerTankOverFlowLockLive != lowerTankOverFlowLock)
          {
            lowerTankOverFlowLock = lowerTankOverFlowLockLive;
            configs.putBool("LTOFL", lowerTankOverFlowLockLive); // Manual Mode, Auto Mode
            Serial.println("lowerTankOverFlowLock Updated at NVS.");
          }
          else
          {
            Serial.println("Same lowerTankOverFlowLock Detected. No changes at NVS.");
          }
          // 12
          if (syncBothTankLive != syncBothTank)
          {
            syncBothTank = syncBothTankLive;
            configs.putBool("SBT", syncBothTankLive); // Manual Mode, Auto Mode
            Serial.println("syncBothTank Updated at NVS.");
          }
          else
          {
            Serial.println("Same syncBothTank Detected. No changes at NVS.");
          }
          // 13
          if (buzzerAlertLive != buzzerAlert)
          {
            buzzerAlert = buzzerAlertLive;
            configs.putBool("BA", buzzerAlertLive); // Manual Mode, Auto Mode
            Serial.println("buzzerAlert Updated at NVS.");
          }
          else
          {
            Serial.println("Same buzzerAlert Detected. No changes at NVS.");
          }
        }
        configs.end();
      }
    }
    else if (strcmp((char *)payload, "systemReset") == 0)
    {
      ESP.restart();
    }
    else if (strcmp((char *)payload, "motorOn") == 0)
    {
      switchMotorON();
    }
    else if (strcmp((char *)payload, "motorOff") == 0)
    {
      switchMotorOFF();
    }
    else if (strcmp((char *)payload, "getHomeData") == 0)
    {

      // Create a JSON document
      DynamicJsonDocument jsonDocument(500);

      // Serialize sensor data to the JSON document

      char char_array[10];
      snprintf(char_array, sizeof(char_array), "%0.2f", (float)lastUpdated / 10);

      jsonDocument["RTV"] = char_array; // serialized(String(millis() / 60000.0,2))
      if (systemMode == "Auto Mode")
      {
        jsonDocument["SM"] = String("Auto Mode");
      }
      else if (systemMode == "Manual Mode")
      {
        jsonDocument["SM"] = String("Manual Mode");
      }
      // Manual Mode  Auto Mode

      // if (motorState == true) {
      //   jsonDocument["MSV"] = = String("ON");

      // } else if (motorState == false) {
      //   jsonDocument["MSV"] = = String("OFF");
      // }
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

      // Convert the JSON document to a string
      String jsonString;

      serializeJson(jsonDocument, jsonString);

      // Serial.printf("Sending to [%u]: %s\n", client_num, jsonString);
      // Serial.print("Sending to ");
      // Serial.print(client_num);
      // Serial.print(",  ");
      // Serial.println(jsonString);
      // Send the JSON string over the WebSocket connection
      webSocket.sendTXT(client_num, jsonString);
    }
    else if (strcmp((char *)payload, "getSettingData") == 0)
    {

      uint8_t mac[6];
      WiFi.macAddress(mac);

      // Create a JSON document
      DynamicJsonDocument jsonDocument(650);

      if (systemMode == "Auto Mode")
      {
        jsonDocument["SM"] = String("Auto Mode");
      }
      else if (systemMode == "Manual Mode")
      {
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

      JsonArray bmacArray = jsonDocument.createNestedArray("BMAC");
      for (int i = 0; i < 6; i++)
      {
        bmacArray.add(mac[i]);
        // Serial.println(broadcastAddress[i]);
      }

      // Convert the JSON document to a string
      String jsonString;

      serializeJson(jsonDocument, jsonString);

      Serial.print("Sending to ");
      Serial.print(client_num);
      Serial.print(",  ");
      Serial.println(jsonString);
      // Send the JSON string over the WebSocket connection
      webSocket.sendTXT(client_num, jsonString);

      // Message not recognized
    }
    else
    {
      Serial.println("[%u] Message not recognized");
    }
    break;

  // For everything else: do nothing
  case WStype_BIN:
  case WStype_ERROR:
  case WStype_FRAGMENT_TEXT_START:
  case WStype_FRAGMENT_BIN_START:
  case WStype_FRAGMENT:
  case WStype_FRAGMENT_FIN:
  default:
    break;
  }
}

// Callback: send homepage
void onIndexRequest(AsyncWebServerRequest *request)
{
  IPAddress remote_ip = request->client()->remoteIP();
  Serial.println("[" + remote_ip.toString() + "] HTTP GET request of " + request->url());
  request->send(SPIFFS, "/index.html", "text/html");
}
// Callback: send Configuration Page
void onConfigurationRequest(AsyncWebServerRequest *request)
{
  IPAddress remote_ip = request->client()->remoteIP();
  Serial.println("[" + remote_ip.toString() + "] HTTP GET request of " + request->url());
  request->send(SPIFFS, "/configuration.html", "text/html");
}
// Callback: send Wifi Setting Page
void onWifiSettingRequest(AsyncWebServerRequest *request)
{
  IPAddress remote_ip = request->client()->remoteIP();
  Serial.println("[" + remote_ip.toString() + "] HTTP GET request of " + request->url());
  request->send(SPIFFS, "/wifiSetting.html", "text/html");
}
// Callback: send 404 if requested file does not exist
void onPageNotFound(AsyncWebServerRequest *request)
{
  IPAddress remote_ip = request->client()->remoteIP();
  Serial.println("[" + remote_ip.toString() + "] HTTP GET request of " + request->url());
  request->send(404, "text/plain", "Not found");
}

void setup()
{

  configMode = false;
  Serial.begin(9600);
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);

  pinMode(relay1Pin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  pinMode(configPin, INPUT_PULLUP);
  pinMode(statusPin, OUTPUT);
  pinMode(faultPin, OUTPUT);

  digitalWrite(faultPin, LOW);
  digitalWrite(statusPin, LOW);
  digitalWrite(buzzerPin, LOW);

  // NVS Data Initialization
  {
    configs.begin("configData", RO_MODE);

    bool initCheck = configs.isKey("nvsInit");

    if (initCheck == false)
    {

      configs.end();
      configs.begin("configData", RW_MODE);

      configs.putString("systemMode", "Manual Mode"); // Manual Mode, Auto Mode

      configs.putBool("motorState", false);

      configs.putFloat("autoMin", 50.0); // 0-100%
      configs.putFloat("autoMax", 90.0); // 0-100%

      configs.putBool("LAE", false);
      configs.putBool("LBE", false);
      configs.putBool("UAE", false);
      configs.putBool("UBE", false);

      configs.putFloat("UTHA", 75.0);   // height in centimeters
      configs.putFloat("UTWFHA", 70.0); // height in centimeters
      configs.putFloat("UTWEHA", 0.0);  // height in centimeters

      configs.putFloat("LTHA", 75.0);   // height in centimeters
      configs.putFloat("LTWFHA", 70.0); // height in centimeters
      configs.putFloat("LTWEHA", 0.0);  // height in centimeters

      configs.putFloat("UTHB", 75.0);   // height in centimeters
      configs.putFloat("UTWFHB", 70.0); // height in centimeters
      configs.putFloat("UTWEHB", 0.0);  // height in centimeters

      configs.putFloat("LTHB", 75.0);   // height in centimeters
      configs.putFloat("LTWFHB", 70.0); // height in centimeters
      configs.putFloat("LTWEHB", 0.0);  // height in centimeters

      configs.putString("WIFIMode", "AP"); // STA, AP
      configs.putString("SSID", "Smart Water Tank V1.0");
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

      configs.putBool("IsSIP", true);

      configs.putBool("nvsInit", true);
      configs.end();
      Serial.println("Data change in NVS.");
      configs.begin("configData", RO_MODE);
    }

    {

      minAutoValue = configs.getFloat("autoMin");
      maxAutoValue = configs.getFloat("autoMax");

      isStaticIP = configs.getBool("IsSIP");

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

      Serial.print("value Read from NVS : ");
      Serial.println(systemMode);
      Serial.println(minAutoValue);
      Serial.println(maxAutoValue);
      Serial.println(lowerTankHeightA);
      Serial.println(lowerWaterFullHeightA);
      Serial.println(lowerWaterEmptyHeightA);
      Serial.println(upperTankHeightA);
      Serial.println(upperWaterFullHeightA);
      Serial.println(upperWaterEmptyHeightA);
      Serial.println(lowerTankHeightB);
      Serial.println(lowerWaterFullHeightB);
      Serial.println(lowerWaterEmptyHeightB);
      Serial.println(upperTankHeightB);
      Serial.println(upperWaterFullHeightB);
      Serial.println(upperWaterEmptyHeightB);

      Serial.println(lowerSensorAEnable);
      Serial.println(lowerSensorBEnable);
      Serial.println(upperSensorAEnable);
      Serial.println(upperSensorBEnable);

      Serial.println(ssid);
      Serial.println(password);
      Serial.println(wifiMode);
      Serial.println(SIP0);
      Serial.println(SIP1);
      Serial.println(SIP2);
      Serial.println(SIP3);
      Serial.println(GW0);
      Serial.println(GW1);
      Serial.println(GW2);
      Serial.println(GW3);
      Serial.println(SNM0);
      Serial.println(SNM1);
      Serial.println(SNM2);
      Serial.println(SNM3);
      Serial.println(PDNS0);
      Serial.println(PDNS1);
      Serial.println(PDNS2);
      Serial.println(PDNS3);
      Serial.println(SDNS0);
      Serial.println(SDNS1);

      Serial.println(SDNS2);

      Serial.println(SDNS3);
      bool temp = configs.getBool("motorState");
      if (temp)
      {
        switchMotorON();
      }
      else
      {
        switchMotorOFF();
      }

      size_t whatsLeft = configs.freeEntries(); // this method works regardless of the mode in which the namespace is opened.
      Serial.printf("There are: %u entries available in the namespace table.\n", whatsLeft);
      // configs.clear();
      configs.end();
    }
    configs.end();
  }

  doBuzzerAlert(1, 1000, 500);
  {
    // Snippet for Configuration setting.
    if (digitalRead(configPin) == false)
    {
      unsigned long initTime = millis();
      while ((millis() - initTime) <= waitTime)
      {
        if (digitalRead(configPin) == false)
        {
          configMode = true;
        }
        else
        {
          configMode = false;
          break;
        }
      }
    }
    else
    {
      configMode = false;
    }

    // Configuration Mode
    if (configMode)
    {
      {
        // configs.begin("configData", RW_MODE);

        // configs.putString("systemMode", "Manual Mode"); // Manual Mode, Auto Mode

        // configs.putBool("motorState", false);

        // configs.putFloat("autoMin", 50.0); // 0-100%
        // configs.putFloat("autoMax", 90.0); // 0-100%

        // configs.putBool("LAE", false);
        // configs.putBool("LBE", false);
        // configs.putBool("UAE", false);
        // configs.putBool("UBE", false);

        // configs.putFloat("UTHA", 75.0);   // height in centimeters
        // configs.putFloat("UTWFHA", 70.0); // height in centimeters
        // configs.putFloat("UTWEHA", 0.0);  // height in centimeters

        // configs.putFloat("LTHA", 75.0);   // height in centimeters
        // configs.putFloat("LTWFHA", 70.0); // height in centimeters
        // configs.putFloat("LTWEHA", 0.0);  // height in centimeters

        // configs.putFloat("UTHB", 75.0);   // height in centimeters
        // configs.putFloat("UTWFHB", 70.0); // height in centimeters
        // configs.putFloat("UTWEHB", 0.0);  // height in centimeters

        // configs.putFloat("LTHB", 75.0);   // height in centimeters
        // configs.putFloat("LTWFHB", 70.0); // height in centimeters
        // configs.putFloat("LTWEHB", 0.0);  // height in centimeters

        // configs.putString("WIFIMode", "AP"); // STA, AP
        // configs.putString("SSID", "Smart Water Tank v1.0");
        // configs.putString("PASS", "00000000");

        // configs.putUShort("SIP0", 192);
        // configs.putUShort("SIP1", 168);
        // configs.putUShort("SIP2", 1);
        // configs.putUShort("SIP3", 1);

        // configs.putUShort("SG0", 192);
        // configs.putUShort("SG1", 168);
        // configs.putUShort("SG2", 1);
        // configs.putUShort("SG3", 1);

        // configs.putUShort("SS0", 255);
        // configs.putUShort("SS1", 255);
        // configs.putUShort("SS2", 255);
        // configs.putUShort("SS3", 0);

        // configs.putUShort("SPD0", 192);
        // configs.putUShort("SPD1", 168);
        // configs.putUShort("SPD2", 1);
        // configs.putUShort("SPD3", 1);

        // configs.putUShort("SSD0", 8);
        // configs.putUShort("SSD1", 8);
        // configs.putUShort("SSD2", 4);
        // configs.putUShort("SSD3", 4);

        // configs.putBool("UTOFL", true);
        // configs.putBool("LTOFL", true);
        // configs.putBool("SBT", true);
        // configs.putBool("BA", true);

        // configs.putBool("IsSIP", true);

        // configs.putBool("nvsInit", true);
        // configs.end();
      }

      IPAddress local_ip(192, 168, 1, 1);
      IPAddress gateway(192, 168, 1, 1);
      IPAddress subnet(255, 255, 255, 0);

      WiFi.softAP("Smart Water Tank v1.0", "00000000");
      WiFi.softAPConfig(local_ip, gateway, subnet);
      Serial.println("Soft AP Initiated.");

      // Make sure we can read the file system
      if (!SPIFFS.begin())
      {
        Serial.println("Error mounting SPIFFS");
        while (1)
          ;
      }

      server.on("/", HTTP_GET, onWifiSettingRequest);
      // Handle requests for pages that do not exist
      server.onNotFound(onPageNotFound);

      // Start web server
      server.begin();

      // Start WebSocket server and assign callback
      webSocket.begin();
      webSocket.onEvent(onWebSocketEvent);
      while (configMode)
      {
        webSocket.loop();
      }
    }
  }
  doBuzzerAlert(2, 500, 500);

  // Set device as a Wi-Fi Station
  char SSIDTemp[50];
  char PASSTemp[20];
  ssid.toCharArray(SSIDTemp, 50);
  password.toCharArray(PASSTemp, 20);
  WiFi.onEvent(OnWiFiEvent);

  if (wifiMode == "STA")
  {
    Serial.println("Entered Station Mode");
    IPAddress local_ip(SIP0, SIP1, SIP2, SIP3);
    IPAddress gateway(GW0, GW1, GW2, GW3);
    IPAddress subnet(SNM0, SNM1, SNM2, SNM3);
    IPAddress primaryDNS(PDNS0, PDNS1, PDNS2, PDNS3);   // optional
    IPAddress secondaryDNS(SDNS0, SDNS1, SDNS2, SDNS3); // optional
    Serial.println("IP ADDRESS Setting Crosed");
    if (!WiFi.config(local_ip, gateway, subnet, primaryDNS, secondaryDNS))
    {
      Serial.println("STA Failed to configure");
      faultOn();
    }
    Serial.print("Connecting to ");
    Serial.println(ssid);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    //    WiFi.enableLongRange(true);
    // WiFi.setTxPower(WIFI_POWER_19_5dBm);
    WiFi.setHostname("SWT_ControlNode");

    WiFi.begin(SSIDTemp, PASSTemp);

    while (WiFi.status() != WL_CONNECTED)
    {
      doFaultAlert(1, 500, 100);
      Serial.print(".");
    }

    Serial.println("");
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("ESP Mac Address: ");
    Serial.println(WiFi.macAddress());
    Serial.print("Subnet Mask: ");
    Serial.println(WiFi.subnetMask());
    Serial.print("Gateway IP: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("DNS: ");
    Serial.println(WiFi.dnsIP());
  }
  else if (wifiMode == "AP")
  {
    Serial.println("Entered AP Mode");
    IPAddress local_ip(SIP0, SIP1, SIP2, SIP3);
    IPAddress gateway(GW0, GW1, GW2, GW3);
    IPAddress subnet(SNM0, SNM1, SNM2, SNM3);
    Serial.println("IP ADDRESS Setting Crosed");
    WiFi.mode(WIFI_MODE_APSTA);
    // WiFi.setTxPower(WIFI_POWER_19_5dBm);
    //    WiFi.enableLongRange(true);
    WiFi.softAP(SSIDTemp, PASSTemp);
    WiFi.softAPConfig(local_ip, gateway, subnet);
    Serial.println("Soft AP Initiated.");
  }
  else
  {
    Serial.print("Wifi Mode Error: ");
    Serial.println(wifiMode);
    while (1)
    {
      faultOn();
      buzzerOn();
      delay(1000);
      faultOff();
      buzzerOff();
      delay(1000);
    }
  }

  // Make sure we can read the file system
  if (!SPIFFS.begin())
  {
    Serial.println("Error mounting SPIFFS");
    while (1)
    {
      faultOn();
      buzzerOn();
      delay(1000);
      faultOff();
      buzzerOff();
      delay(1000);
    }
  }

  // On HTTP request for root, provide index.html file
  server.on("/", HTTP_GET, onIndexRequest);

  // server.on("/setting", HTTP_GET, onSettingRequest);
  server.on("/configuration.html", HTTP_GET, onConfigurationRequest);

  server.on("/wifiSetting", HTTP_GET, onWifiSettingRequest);

  // Handle requests for pages that do not exist
  server.onNotFound(onPageNotFound);

  // Start web server
  server.begin();

  // Start WebSocket server and assign callback
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);

  xTaskCreatePinnedToCore(
      motorControlTask, /* Task function. */
      "Task1",          /* name of task. */
      10000,            /* Stack size of task */
      NULL,             /* parameter of the task */
      1,                /* priority of the task */
      &Task1,           /* Task handle to keep track of created task */
      0);               /* pin task to core 0 */

  // create a task that will be executed in the espNowAndLowerTankSensorsTask() function, with priority 1 and executed on core 1
  xTaskCreatePinnedToCore(
      espNowAndLowerTankSensorsTask, /* Task function. */
      "Task2",                       /* name of task. */
      5000,                          /* Stack size of task */
      NULL,                          /* parameter of the task */
      1,                             /* priority of the task */
      &Task2,                        /* Task handle to keep track of created task */
      1);                            /* pin task to core 1 */

  xTaskCreatePinnedToCore(
      countTask, /* Task function. */
      "Task3",   /* name of task. */
      1000,      /* Stack size of task */
      NULL,      /* parameter of the task */
      1,         /* priority of the task */
      &Task3,    /* Task handle to keep track of created task */
      0);        /* pin task to core 1 */
}

void loop()
{
  webSocket.loop();
  //  delay(1000);
}
