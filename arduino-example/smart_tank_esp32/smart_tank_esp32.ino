/*
 * Smart Tank Management System - ESP32 Arduino Code
 * 
 * This code reads ultrasonic sensor data and controls relays for water management.
 * It also provides a WebSocket server for communication with the PWA app.
 * 
 * Hardware Setup:
 * - ESP32 Dev Board
 * - 2x Ultrasonic sensors (connected to Serial and Serial2)
 * - 2x Relays for pump control
 * - Status LEDs and buzzer
 * 
 * Author: Smart Water Management System
 * Version: 1.0
 */

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// Pin definitions
const int relay1Pin = 25;    // Pump 1 control
const int relay2Pin = 26;    // Pump 2 control
const int out1Pin = 18;      // Output 1
const int out2Pin = 19;      // Output 2
const int statusPin = 23;    // Status LED
const int faultPin = 15;     // Fault LED
const int buzzerPin = 13;    // Buzzer
const int configPin = 34;    // Configuration button

// WiFi credentials (update these)
const char* ssid = "Sivagami Illam 2.4G";
const char* password = "Sivagami@27";

// WebSocket server
WebSocketsServer webSocket = WebSocketsServer(81);

// Sensor data
volatile int mmDistA = 0;  // Distance from sensor A (mm)
volatile int mmDistB = 0;  // Distance from sensor B (mm)

// System state
bool systemEnabled = true;
bool pump1Enabled = false;
bool pump2Enabled = false;
bool faultDetected = false;

// Sensor manager class
class SensorManager {
private:
  int readDelayA = 1000;  // Delay for sensor A (ms)
  int readDelayB = 1000;  // Delay for sensor B (ms)
  
public:
  int getReadDelayA() { return readDelayA; }
  int getReadDelayB() { return readDelayB; }
  void setReadDelayA(int delay) { readDelayA = delay; }
  void setReadDelayB(int delay) { readDelayB = delay; }
};

SensorManager sensorManager;

// Task handles
TaskHandle_t readData1Task;
TaskHandle_t readData2Task;
TaskHandle_t webSocketTask;

// Task functions for reading sensor data
void readData1(void *pvParameters) {
  for (;;) {
    byte StartByte = 0;
    byte MSByte = 0;
    byte LSByte = 0;
    byte CheckSum = 0;

    Serial2.flush();
    Serial2.write(0x55);  // 0x55
    delay(50);

    if (Serial2.available() >= 4) {
      StartByte = Serial2.read();
      if (StartByte == 0xFF) {
        MSByte = Serial2.read();
        LSByte = Serial2.read();
        CheckSum = Serial2.read();
        CheckSum = LSByte + CheckSum;
        mmDistA = MSByte * 256 + LSByte;
      } else {
        Serial2.flush();
      }
    }
    delay(sensorManager.getReadDelayB());
  }
}

void readData2(void *pvParameters) {
  for (;;) {
    byte StartByte = 0;
    byte MSByte = 0;
    byte LSByte = 0;
    byte CheckSum = 0;
    Serial.flush();
    Serial.write(0x55);  // 0x55
    delay(50);

    if (Serial.available() >= 4) {
      StartByte = Serial.read();
      if (StartByte == 0xFF) {
        MSByte = Serial.read();
        LSByte = Serial.read();
        CheckSum = Serial.read();
        CheckSum = LSByte + CheckSum;
        mmDistB = MSByte * 256 + LSByte;
      } else {
        Serial.flush();
      }
    }
    delay(sensorManager.getReadDelayA());
  }
}

// WebSocket event handler
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      break;
      
    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[%u] Connected from %d.%d.%d.%d url: %s\n", num, ip[0], ip[1], ip[2], ip[3], payload);
      
      // Send initial data
      sendSensorData();
      break;
    }
    
    case WStype_TEXT: {
      Serial.printf("[%u] get Text: %s\n", num, payload);
      
      // Parse JSON command
      DynamicJsonDocument doc(1024);
      deserializeJson(doc, payload);
      
      String command = doc["command"];
      
      if (command == "togglePump1") {
        pump1Enabled = !pump1Enabled;
        digitalWrite(relay1Pin, pump1Enabled ? HIGH : LOW);
        sendStatusUpdate();
      }
      else if (command == "togglePump2") {
        pump2Enabled = !pump2Enabled;
        digitalWrite(relay2Pin, pump2Enabled ? HIGH : LOW);
        sendStatusUpdate();
      }
      else if (command == "toggleSystem") {
        systemEnabled = !systemEnabled;
        sendStatusUpdate();
      }
      else if (command == "getData") {
        sendSensorData();
      }
      else if (command == "setDelayA") {
        int delay = doc["value"];
        sensorManager.setReadDelayA(delay);
      }
      else if (command == "setDelayB") {
        int delay = doc["value"];
        sensorManager.setReadDelayB(delay);
      }
      break;
    }
    
    default:
      break;
  }
}

// Send sensor data via WebSocket
void sendSensorData() {
  DynamicJsonDocument doc(1024);
  doc["type"] = "sensorData";
  doc["sensorA"] = mmDistA;
  doc["sensorB"] = mmDistB;
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.broadcastTXT(jsonString);
}

// Send status update via WebSocket
void sendStatusUpdate() {
  DynamicJsonDocument doc(1024);
  doc["type"] = "status";
  doc["systemEnabled"] = systemEnabled;
  doc["pump1Enabled"] = pump1Enabled;
  doc["pump2Enabled"] = pump2Enabled;
  doc["faultDetected"] = faultDetected;
  
  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.broadcastTXT(jsonString);
}

// Check for faults
void checkFaults() {
  bool newFault = false;
  
  // Check if sensors are reading valid data
  if (mmDistA < 0 || mmDistA > 5000) newFault = true;
  if (mmDistB < 0 || mmDistB > 5000) newFault = true;
  
  // Check if pumps are running when they shouldn't be
  if (systemEnabled && !pump1Enabled && digitalRead(relay1Pin) == HIGH) newFault = true;
  if (systemEnabled && !pump2Enabled && digitalRead(relay2Pin) == HIGH) newFault = true;
  
  if (newFault != faultDetected) {
    faultDetected = newFault;
    digitalWrite(faultPin, faultDetected ? HIGH : LOW);
    
    if (faultDetected) {
      // Sound buzzer for fault
      digitalWrite(buzzerPin, HIGH);
      delay(100);
      digitalWrite(buzzerPin, LOW);
    }
    
    sendStatusUpdate();
  }
}

// Setup function
void setup() {
  Serial.begin(115200);
  Serial2.begin(115200);
  
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
  digitalWrite(relay1Pin, LOW);
  digitalWrite(relay2Pin, LOW);
  digitalWrite(out1Pin, LOW);
  digitalWrite(out2Pin, LOW);
  digitalWrite(statusPin, LOW);
  digitalWrite(faultPin, LOW);
  digitalWrite(buzzerPin, LOW);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  
  Serial.println("WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  
  // Start WebSocket server
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  
  // Create tasks for sensor reading
  xTaskCreatePinnedToCore(
    readData1,     // Task function
    "ReadData1",   // Task name
    2048,          // Stack size
    NULL,          // Parameters
    1,             // Priority
    &readData1Task, // Task handle
    0              // Core
  );
  
  xTaskCreatePinnedToCore(
    readData2,     // Task function
    "ReadData2",   // Task name
    2048,          // Stack size
    NULL,          // Parameters
    1,             // Priority
    &readData2Task, // Task handle
    1              // Core
  );
  
  Serial.println("System initialized!");
  digitalWrite(statusPin, HIGH);  // Status LED on
}

// Main loop
void loop() {
  webSocket.loop();
  
  // Check for faults
  checkFaults();
  
  // Send sensor data periodically
  static unsigned long lastDataSend = 0;
  if (millis() - lastDataSend > 1000) {  // Send every second
    sendSensorData();
    lastDataSend = millis();
  }
  
  // Check configuration button
  if (digitalRead(configPin) == LOW) {
    delay(50);  // Debounce
    if (digitalRead(configPin) == LOW) {
      // Toggle system
      systemEnabled = !systemEnabled;
      sendStatusUpdate();
      
      // Wait for button release
      while (digitalRead(configPin) == LOW) {
        delay(10);
      }
    }
  }
  
  delay(10);
}
