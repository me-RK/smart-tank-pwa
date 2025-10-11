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
String password = "12345678";
String wifiMode = "AP";

// WiFi connection state tracking
bool wifiConnected = false;
bool wifiReconnectEnabled = true;
unsigned long lastWifiAttempt = 0;
unsigned long wifiReconnectInterval = 30000; // 30 seconds
int wifiConnectionAttempts = 0;
const int maxWifiAttempts = 5;
bool wifiCredentialsValid = false;
String lastConnectionError = "";
unsigned long lastWifiEvent = 0;
 
// Network configuration
uint8_t SIP0 = 192, SIP1 = 168, SIP2 = 1, SIP3 = 1;
uint8_t GW0 = 192, GW1 = 168, GW2 = 1, GW3 = 1;
uint8_t SNM0 = 255, SNM1 = 255, SNM2 = 255, SNM3 = 0;
uint8_t PDNS0 = 8, PDNS1 = 8, PDNS2 = 8, PDNS3 = 8;
uint8_t SDNS0 = 8, SDNS1 = 8, SDNS2 = 4, SDNS3 = 4;

// IP configuration type
String ipConfigType = "static"; // "static" or "dynamic"
 
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

// ESP-NOW ACK message structure for Channel Auto-Discovery
typedef struct ack_message {
  uint8_t msgType;    // 0xAA = ACK
  uint8_t channel;    // Current channel
  uint32_t timestamp; // Timestamp for debugging
} ack_message;
 
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
 
// Tank dimensions and calibration (in cm)
// Physical tank dimensions
float upperTankHeightA = 75.0;        // Total height of upper tank A
float lowerTankHeightA = 75.0;        // Total height of lower tank A
float upperTankHeightB = 75.0;        // Total height of upper tank B
float lowerTankHeightB = 75.0;        // Total height of lower tank B

// Water level calibration points (distance from sensor to water surface)
float upperWaterFullHeightA = 5.0;    // Distance when tank is full (cm from sensor)
float upperWaterEmptyHeightA = 70.0;  // Distance when tank is empty (cm from sensor)
float lowerWaterFullHeightA = 5.0;    // Distance when tank is full (cm from sensor)
float lowerWaterEmptyHeightA = 70.0;  // Distance when tank is empty (cm from sensor)

float upperWaterFullHeightB = 5.0;    // Distance when tank is full (cm from sensor)
float upperWaterEmptyHeightB = 70.0;  // Distance when tank is empty (cm from sensor)
float lowerWaterFullHeightB = 5.0;    // Distance when tank is full (cm from sensor)
float lowerWaterEmptyHeightB = 70.0;  // Distance when tank is empty (cm from sensor)

// Sensor calibration offsets (to compensate for sensor mounting position)
float upperSensorOffsetA = 0.0;       // Offset for upper sensor A (cm)
float lowerSensorOffsetA = 0.0;       // Offset for lower sensor A (cm)
float upperSensorOffsetB = 0.0;       // Offset for upper sensor B (cm)
float lowerSensorOffsetB = 0.0;       // Offset for lower sensor B (cm)

// Sensor reading validation
float minSensorReading = 20.0;        // Minimum valid sensor reading (mm)
float maxSensorReading = 4000.0;      // Maximum valid sensor reading (mm)
 
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
unsigned long lastDataReceived = 0;  // Timestamp of last ESP-NOW data received
unsigned long systemUptime = 0;      // System uptime in seconds
uint32_t readDelayA = 500;
uint32_t readDelayB = 500;
uint8_t clientNumGlobal = 0;
 
// ESP-NOW data
struct_message subData;

// ESP-NOW Channel Auto-Discovery System
esp_now_peer_info_t transmitterPeer;
bool transmitterRegistered = false;
uint8_t currentChannel = 0;
uint32_t lastAckSent = 0;
uint32_t ackCount = 0;
 
 // Task handles
 TaskHandle_t motorControlTaskHandle;
 TaskHandle_t espNowAndLowerTankSensorsTaskHandle;
 TaskHandle_t countTaskHandle;
 
// Function declarations
void doBuzzerAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay);
void doStatusAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay);
void doFaultAlert(uint8_t count, uint16_t onDelay, uint16_t offDelay);
void updateMotorStateInNVS(uint8_t motorNum, bool newState);
void printChannelAutoDiscoveryStatus();
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
String getWiFiStatusString(wl_status_t status);

// Enhanced WiFi functions
void clearWiFiCredentials();
void validateWiFiCredentials();
void resetWiFiStack();
void attemptWiFiConnection();
void handleWiFiDisconnection();
void startFallbackAP();
void logWiFiEvent(WiFiEvent_t event);
bool isWiFiCredentialsCorrupted();
void performWiFiDiagnostics();

// Water level calculation functions
float calculateWaterLevelPercentage(uint32_t sensorReadingMm, float fullDistanceCm, float emptyDistanceCm, float sensorOffsetCm);
bool validateSensorReading(uint32_t sensorReadingMm);
void updateWaterLevelCalculations(void);
 
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

// Channel Auto-Discovery Status Function
void printChannelAutoDiscoveryStatus() {
  Serial.println("\n=== CHANNEL AUTO-DISCOVERY STATUS ===");
  Serial.printf("Transmitter Registered: %s\n", transmitterRegistered ? "YES" : "NO");
  Serial.printf("Current Channel: %d\n", currentChannel);
  Serial.printf("Total ACKs Sent: %lu\n", ackCount);
  if (lastAckSent > 0) {
    Serial.printf("Last ACK Sent: %lu ms ago\n", millis() - lastAckSent);
  } else {
    Serial.println("Last ACK Sent: Never");
  }
  
  if (transmitterRegistered) {
    Serial.print("Transmitter MAC: ");
    for (int i = 0; i < 6; i++) {
      Serial.printf("%02X", transmitterPeer.peer_addr[i]);
      if (i < 5) Serial.print(":");
    }
    Serial.println();
    Serial.printf("Peer Channel: %d\n", transmitterPeer.channel);
  }
  Serial.println("=====================================\n");
}

// Water level calculation functions
bool validateSensorReading(uint32_t sensorReadingMm) {
  // Validate sensor reading is within reasonable range
  if (sensorReadingMm < minSensorReading || sensorReadingMm > maxSensorReading) {
    Serial.printf("Invalid sensor reading: %u mm (range: %.1f - %.1f mm)\n", 
                  sensorReadingMm, minSensorReading, maxSensorReading);
    return false;
  }
  return true;
}

float calculateWaterLevelPercentage(uint32_t sensorReadingMm, float fullDistanceCm, float emptyDistanceCm, float sensorOffsetCm) {
  // Validate sensor reading first
  if (!validateSensorReading(sensorReadingMm)) {
    return -1.0; // Return -1 to indicate invalid reading
  }
  
  // Convert sensor reading from mm to cm
  float sensorDistanceCm = (sensorReadingMm / 10.0) + sensorOffsetCm;
  
  // Ensure calibration values are valid
  if (fullDistanceCm >= emptyDistanceCm) {
    Serial.printf("ERROR: Invalid calibration - full distance (%.1f) >= empty distance (%.1f)\n", 
                  fullDistanceCm, emptyDistanceCm);
    return -1.0;
  }
  
  // Calculate water level percentage
  // When sensor distance is at fullDistanceCm, tank is 100% full
  // When sensor distance is at emptyDistanceCm, tank is 0% full
  float waterLevelPercentage = 0.0;
  
  if (sensorDistanceCm <= fullDistanceCm) {
    // Tank is full or overflowing
    waterLevelPercentage = 100.0;
  } else if (sensorDistanceCm >= emptyDistanceCm) {
    // Tank is empty
    waterLevelPercentage = 0.0;
  } else {
    // Calculate percentage based on distance
    float totalRange = emptyDistanceCm - fullDistanceCm;
    float currentRange = sensorDistanceCm - fullDistanceCm;
    waterLevelPercentage = 100.0 - ((currentRange / totalRange) * 100.0);
  }
  
  // Constrain to valid range
  waterLevelPercentage = constrain(waterLevelPercentage, 0.0, 100.0);
  
  Serial.printf("Water Level Calc: Reading=%umm, Distance=%.1fcm, Full=%.1fcm, Empty=%.1fcm, Level=%.1f%%\n",
                sensorReadingMm, sensorDistanceCm, fullDistanceCm, emptyDistanceCm, waterLevelPercentage);
  
  return waterLevelPercentage;
}

void updateWaterLevelCalculations(void) {
  // This function can be called to recalculate all water levels
  // Useful for when calibration values are updated
  Serial.println("Updating water level calculations...");
  
  // Recalculate upper tank levels if sensors are enabled
  if (upperSensorAEnable && sensorUpperTankA > 0) {
    upperTankWaterLevelA = calculateWaterLevelPercentage(
      sensorUpperTankA, 
      upperWaterFullHeightA, 
      upperWaterEmptyHeightA, 
      upperSensorOffsetA
    );
  }
  
  if (upperSensorBEnable && sensorUpperTankB > 0) {
    upperTankWaterLevelB = calculateWaterLevelPercentage(
      sensorUpperTankB, 
      upperWaterFullHeightB, 
      upperWaterEmptyHeightB, 
      upperSensorOffsetB
    );
  }
  
  // Recalculate lower tank levels if sensors are enabled
  if (lowerSensorAEnable && sensorLowTankA > 0) {
    lowerTankWaterLevelA = calculateWaterLevelPercentage(
      sensorLowTankA, 
      lowerWaterFullHeightA, 
      lowerWaterEmptyHeightA, 
      lowerSensorOffsetA
    );
  }
  
  if (lowerSensorBEnable && sensorLowTankB > 0) {
    lowerTankWaterLevelB = calculateWaterLevelPercentage(
      sensorLowTankB, 
      lowerWaterFullHeightB, 
      lowerWaterEmptyHeightB, 
      lowerSensorOffsetB
    );
  }
}

// WiFi status decoder function
String getWiFiStatusString(wl_status_t status) {
  switch (status) {
    case WL_NO_SHIELD: return "NO_SHIELD";
    case WL_IDLE_STATUS: return "IDLE_STATUS";
    case WL_NO_SSID_AVAIL: return "NO_SSID_AVAIL";
    case WL_SCAN_COMPLETED: return "SCAN_COMPLETED";
    case WL_CONNECTED: return "CONNECTED";
    case WL_CONNECT_FAILED: return "CONNECT_FAILED";
    case WL_CONNECTION_LOST: return "CONNECTION_LOST";
    case WL_DISCONNECTED: return "DISCONNECTED";
    default: return "UNKNOWN";
  }
}

// Enhanced WiFi Functions for Robust Connectivity

void logWiFiEvent(WiFiEvent_t event) {
  lastWifiEvent = millis();
  String eventStr = "";
  
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_START:
      eventStr = "STA_START";
      Serial.println("WiFi: Station mode started");
      break;
    case ARDUINO_EVENT_WIFI_STA_STOP:
      eventStr = "STA_STOP";
      Serial.println("WiFi: Station mode stopped");
      break;
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      eventStr = "STA_CONNECTED";
      Serial.println("WiFi: Connected to network");
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      eventStr = "STA_DISCONNECTED";
      Serial.println("WiFi: Disconnected from network");
      wifiConnected = false;
      handleWiFiDisconnection();
      break;
    case ARDUINO_EVENT_WIFI_STA_AUTHMODE_CHANGE:
      eventStr = "STA_AUTHMODE_CHANGE";
      Serial.println("WiFi: Authentication mode changed");
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      eventStr = "STA_GOT_IP";
      Serial.println("WiFi: Got IP address");
      wifiConnected = true;
      wifiConnectionAttempts = 0;
      lastConnectionError = "";
      break;
    case ARDUINO_EVENT_WIFI_STA_LOST_IP:
      eventStr = "STA_LOST_IP";
      Serial.println("WiFi: Lost IP address");
      wifiConnected = false;
      break;
    case ARDUINO_EVENT_WIFI_AP_START:
      eventStr = "AP_START";
      Serial.println("WiFi: Access Point started");
      break;
    case ARDUINO_EVENT_WIFI_AP_STOP:
      eventStr = "AP_STOP";
      Serial.println("WiFi: Access Point stopped");
      break;
    case ARDUINO_EVENT_WIFI_AP_STACONNECTED:
      eventStr = "AP_STACONNECTED";
      Serial.println("WiFi: Station connected to AP");
      break;
    case ARDUINO_EVENT_WIFI_AP_STADISCONNECTED:
      eventStr = "AP_STADISCONNECTED";
      Serial.println("WiFi: Station disconnected from AP");
      break;
    case ARDUINO_EVENT_WIFI_AP_PROBEREQRECVED:
      eventStr = "AP_PROBEREQRECVED";
      break;
    default:
      eventStr = "UNKNOWN_" + String(event);
      Serial.printf("WiFi: Unknown event %d\n", event);
      break;
  }
  
  Serial.printf("WiFi Event: %s (ID: %d) at %lu ms\n", eventStr.c_str(), event, lastWifiEvent);
}

bool isWiFiCredentialsCorrupted() {
  // Check for common signs of corrupted credentials
  if (ssid.length() == 0 || ssid.length() > 32) {
    Serial.println("WiFi: SSID appears corrupted (invalid length)");
    return true;
  }
  
  if (password.length() > 63) {
    Serial.println("WiFi: Password appears corrupted (too long)");
    return true;
  }
  
  // Check for null characters or invalid characters
  for (int i = 0; i < ssid.length(); i++) {
    if (ssid[i] == 0 || ssid[i] < 32 || ssid[i] > 126) {
      Serial.println("WiFi: SSID contains invalid characters");
      return true;
    }
  }
  
  return false;
}

void clearWiFiCredentials() {
  Serial.println("WiFi: Clearing potentially corrupted credentials...");
  
  // Clear NVS WiFi credentials
  configs.begin("configData", RW_MODE);
  configs.remove("SSID");
  configs.remove("PASS");
  configs.remove("WIFIMode");
  configs.end();
  
  // Reset to default values
  ssid = "Smart Water Tank v3.0";
  password = "12345678";
  wifiMode = "AP";
  wifiCredentialsValid = false;
  
  Serial.println("WiFi: Credentials cleared and reset to defaults");
}

void validateWiFiCredentials() {
  Serial.println("WiFi: Validating stored credentials...");
  
  if (isWiFiCredentialsCorrupted()) {
    Serial.println("WiFi: Credentials appear corrupted, clearing...");
    clearWiFiCredentials();
    return;
  }
  
  // Additional validation
  if (wifiMode != "STA" && wifiMode != "AP") {
    Serial.println("WiFi: Invalid mode, resetting to AP");
    wifiMode = "AP";
  }
  
  wifiCredentialsValid = true;
  Serial.println("WiFi: Credentials validated successfully");
}

void resetWiFiStack() {
  Serial.println("WiFi: Performing complete WiFi stack reset...");
  
  // Disconnect and stop WiFi
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(1000);
  
  // Clear any persistent WiFi config
  WiFi.persistent(false);
  
  // Restart WiFi - USE APSTA for ESP-NOW compatibility
  WiFi.mode(WIFI_MODE_APSTA);  // Changed from WIFI_STA
  delay(500);
  
  Serial.println("WiFi: Stack reset completed");
}
void performWiFiDiagnostics() {
  Serial.println("\n=== WiFi Diagnostics ===");
  Serial.printf("SSID: '%s' (length: %d)\n", ssid.c_str(), ssid.length());
  Serial.printf("Password: [%d chars]\n", password.length());
  Serial.printf("Mode: %s\n", wifiMode.c_str());
  Serial.printf("IP Config: %s\n", ipConfigType.c_str());
  Serial.printf("Connected: %s\n", wifiConnected ? "YES" : "NO");
  Serial.printf("Status: %s\n", getWiFiStatusString(WiFi.status()).c_str());
  Serial.printf("RSSI: %d dBm\n", WiFi.RSSI());
  Serial.printf("MAC: %s\n", WiFi.macAddress().c_str());
  Serial.printf("Connection Attempts: %d/%d\n", wifiConnectionAttempts, maxWifiAttempts);
  Serial.printf("Last Error: %s\n", lastConnectionError.c_str());
  Serial.printf("Auto Reconnect: %s\n", wifiReconnectEnabled ? "ENABLED" : "DISABLED");
  Serial.println("=======================\n");
}

void handleWiFiDisconnection() {
  Serial.println("WiFi: Handling disconnection...");
  
  if (wifiReconnectEnabled && wifiMode == "STA") {
    wifiConnectionAttempts++;
    
    if (wifiConnectionAttempts <= maxWifiAttempts) {
      Serial.printf("WiFi: Attempting reconnection %d/%d\n", wifiConnectionAttempts, maxWifiAttempts);
      lastWifiAttempt = millis();
      
      // Wait before retry
      delay(2000);
      attemptWiFiConnection();
    } else {
      Serial.println("WiFi: Max reconnection attempts reached, starting fallback AP");
      startFallbackAP();
    }
  }
}

void attemptWiFiConnection() {
  if (wifiMode != "STA") {
    Serial.println("WiFi: Not in STA mode, skipping connection attempt");
    return;
  }
  
  Serial.printf("WiFi: Attempting connection to '%s'...\n", ssid.c_str());
  
  // Reset WiFi stack if too many attempts
  if (wifiConnectionAttempts > 2) {
    resetWiFiStack();
  }
  
// Set WiFi mode and options - USE APSTA for ESP-NOW compatibility
WiFi.mode(WIFI_MODE_APSTA);  // Changed from WIFI_STA to WIFI_MODE_APSTA
WiFi.setAutoReconnect(true);
WiFi.persistent(false);
  
  // Set hostname
  String hostname = "SWT_Node_" + WiFi.macAddress().substring(12);
  hostname.replace(":", "");
  WiFi.setHostname(hostname.c_str());
  
  // Configure static IP if needed
  if (ipConfigType == "static") {
    IPAddress local_ip(SIP0, SIP1, SIP2, SIP3);
    IPAddress gateway(GW0, GW1, GW2, GW3);
    IPAddress subnet(SNM0, SNM1, SNM2, SNM3);
    IPAddress primaryDNS(PDNS0, PDNS1, PDNS2, PDNS3);
    IPAddress secondaryDNS(SDNS0, SDNS1, SDNS2, SDNS3);
    
    if (!WiFi.config(local_ip, gateway, subnet, primaryDNS, secondaryDNS)) {
      Serial.println("WiFi: Static IP configuration failed");
      lastConnectionError = "Static IP config failed";
    }
  }
  
  // Begin connection
  WiFi.begin(ssid.c_str(), password.c_str());
  
  // Monitor connection with timeout
  int attempts = 0;
  const int maxAttempts = 20; // 10 seconds
  
  while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
    delay(500);
    attempts++;
    
    wl_status_t status = WiFi.status();
    Serial.printf("WiFi: [%2d] %s (RSSI: %d)\n", 
                  attempts, 
                  getWiFiStatusString(status).c_str(),
                  WiFi.RSSI());
    
    if (status == WL_CONNECT_FAILED) {
      lastConnectionError = "Connection failed - wrong password";
      break;
    } else if (status == WL_NO_SSID_AVAIL) {
      lastConnectionError = "SSID not available";
      break;
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi: Connection successful!");
    wifiConnected = true;
    wifiConnectionAttempts = 0;
    lastConnectionError = "";
    performWiFiDiagnostics();
  } else {
    Serial.printf("WiFi: Connection failed after %d attempts\n", attempts);
    lastConnectionError = "Connection timeout";
  }
}

void startFallbackAP() {
  Serial.println("WiFi: Starting fallback Access Point...");
  
  WiFi.mode(WIFI_AP);
  
  String fallbackSSID = "SWT_FALLBACK_" + WiFi.macAddress().substring(12);
  fallbackSSID.replace(":", "");
  
  WiFi.softAP(fallbackSSID.c_str(), "12345678");
  
  IPAddress fallbackIP(192, 168, 4, 1);
  IPAddress fallbackGW(192, 168, 4, 1);
  IPAddress fallbackSN(255, 255, 255, 0);
  WiFi.softAPConfig(fallbackIP, fallbackGW, fallbackSN);
  
  Serial.printf("WiFi: Fallback AP started - SSID: %s, IP: %s\n", 
                fallbackSSID.c_str(), WiFi.softAPIP().toString().c_str());
  
  faultOn();
  doBuzzerAlert(3, 500, 200);
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
      
      // Calculate water level percentage using improved method
      lowerTankWaterLevelA = calculateWaterLevelPercentage(
        sensorLowTankA, 
        lowerWaterFullHeightA, 
        lowerWaterEmptyHeightA, 
        lowerSensorOffsetA
      );
      
      if (lowerTankWaterLevelA >= 0) {
        Serial.printf("Lower Tank A: %.1f%% (Raw: %umm)\n", lowerTankWaterLevelA, sensorLowTankA);
      } else {
        Serial.printf("Lower Tank A: Invalid reading (Raw: %umm)\n", sensorLowTankA);
        lowerTankWaterLevelA = 0.0; // Set to 0 for invalid readings
      }
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
       
       // Calculate water level percentage using improved method
       lowerTankWaterLevelB = calculateWaterLevelPercentage(
         sensorLowTankB, 
         lowerWaterFullHeightB, 
         lowerWaterEmptyHeightB, 
         lowerSensorOffsetB
       );
       
       if (lowerTankWaterLevelB >= 0) {
         Serial.printf("Lower Tank B: %.1f%% (Raw: %umm)\n", lowerTankWaterLevelB, sensorLowTankB);
       } else {
         Serial.printf("Lower Tank B: Invalid reading (Raw: %umm)\n", sensorLowTankB);
         lowerTankWaterLevelB = 0.0; // Set to 0 for invalid readings
       }
     } else {
       Serial.flush();
     }
   }
   delay(readDelayB);
 }
 
// ESP-NOW callback function with Channel Auto-Discovery
void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len) {
  memcpy(&subData, incomingData, sizeof(subData));
  
  // Get current WiFi channel using Arduino WiFi library
  currentChannel = WiFi.channel();
  
  Serial.print("Bytes received: ");
  Serial.println(len);
  Serial.print("From MAC: ");
  for (int i = 0; i < 6; i++) {
    Serial.printf("%02X", recv_info->src_addr[i]);
    if (i < 5) Serial.print(":");
  }
  Serial.println();
  Serial.printf("ESP-NOW data received on channel %d\n", currentChannel);
  
  // ===== CHANNEL AUTO-DISCOVERY: SEND ACK BACK TO TRANSMITTER =====
  if (!transmitterRegistered) {
    // Register transmitter as peer
    memcpy(transmitterPeer.peer_addr, recv_info->src_addr, 6);
    transmitterPeer.channel = currentChannel;  // Use current channel
    transmitterPeer.encrypt = false;
    
    if (esp_now_add_peer(&transmitterPeer) == ESP_OK) {
      transmitterRegistered = true;
      Serial.println("Transmitter registered as peer for Channel Auto-Discovery");
    } else {
      Serial.println("Failed to register transmitter as peer");
    }
  }
  
  // Send ACK message back to transmitter
  if (transmitterRegistered) {
    ack_message ack;
    ack.msgType = 0xAA;  // ACK identifier
    ack.channel = currentChannel;
    ack.timestamp = millis();
    
    esp_err_t result = esp_now_send(recv_info->src_addr, (uint8_t *)&ack, sizeof(ack));
    if (result == ESP_OK) {
      ackCount++;
      lastAckSent = millis();
      Serial.printf("ACK sent to transmitter on channel %d (Total ACKs: %lu)\n", currentChannel, ackCount);
    } else {
      Serial.printf("ACK send failed: %d\n", result);
    }
  }
  // ===== END CHANNEL AUTO-DISCOVERY =====
  
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
    sensorUpperTankA = subData.valueA; // Store raw sensor value
    
    // Calculate water level percentage using improved method
    upperTankWaterLevelA = calculateWaterLevelPercentage(
      subData.valueA, 
      upperWaterFullHeightA, 
      upperWaterEmptyHeightA, 
      upperSensorOffsetA
    );
    
    if (upperTankWaterLevelA >= 0) {
      Serial.printf("Upper Tank A: %.1f%% (Raw: %umm)\n", upperTankWaterLevelA, subData.valueA);
    } else {
      Serial.printf("Upper Tank A: Invalid reading (Raw: %umm)\n", subData.valueA);
      upperTankWaterLevelA = 0.0; // Set to 0 for invalid readings
    }
  }
  
  // Process Tank B data
  if (subData.sensorB) {
    sensorUpperTankB = subData.valueB; // Store raw sensor value
    
    // Calculate water level percentage using improved method
    upperTankWaterLevelB = calculateWaterLevelPercentage(
      subData.valueB, 
      upperWaterFullHeightB, 
      upperWaterEmptyHeightB, 
      upperSensorOffsetB
    );
    
    if (upperTankWaterLevelB >= 0) {
      Serial.printf("Upper Tank B: %.1f%% (Raw: %umm)\n", upperTankWaterLevelB, subData.valueB);
    } else {
      Serial.printf("Upper Tank B: Invalid reading (Raw: %umm)\n", subData.valueB);
      upperTankWaterLevelB = 0.0; // Set to 0 for invalid readings
    }
  }
 
   lastDataReceived = systemUptime; // Update timestamp of last data received
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
  
  // Sensor calibration offsets
  if (doc.containsKey("upperSensorOffsetA")) {
    float newValue = doc["upperSensorOffsetA"];
    if (newValue != upperSensorOffsetA) {
      upperSensorOffsetA = newValue;
      configs.putFloat("USOA", newValue);
    }
  }
  
  if (doc.containsKey("lowerSensorOffsetA")) {
    float newValue = doc["lowerSensorOffsetA"];
    if (newValue != lowerSensorOffsetA) {
      lowerSensorOffsetA = newValue;
      configs.putFloat("LSOA", newValue);
    }
  }
  
  if (doc.containsKey("upperSensorOffsetB")) {
    float newValue = doc["upperSensorOffsetB"];
    if (newValue != upperSensorOffsetB) {
      upperSensorOffsetB = newValue;
      configs.putFloat("USOB", newValue);
    }
  }
  
  if (doc.containsKey("lowerSensorOffsetB")) {
    float newValue = doc["lowerSensorOffsetB"];
    if (newValue != lowerSensorOffsetB) {
      lowerSensorOffsetB = newValue;
      configs.putFloat("LSOB", newValue);
    }
  }
  
  // Sensor validation limits
  if (doc.containsKey("minSensorReading")) {
    float newValue = doc["minSensorReading"];
    if (newValue != minSensorReading) {
      minSensorReading = newValue;
      configs.putFloat("minSensor", newValue);
    }
  }
  
  if (doc.containsKey("maxSensorReading")) {
    float newValue = doc["maxSensorReading"];
    if (newValue != maxSensorReading) {
      maxSensorReading = newValue;
      configs.putFloat("maxSensor", newValue);
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
   
   if (doc.containsKey("upperSensorAEnable")) {
     bool newValue = doc["upperSensorAEnable"];
     if (newValue != upperSensorAEnable) {
       upperSensorAEnable = newValue;
       configs.putBool("UAE", newValue);
     }
   }
   
   if (doc.containsKey("upperSensorBEnable")) {
     bool newValue = doc["upperSensorBEnable"];
     if (newValue != upperSensorBEnable) {
       upperSensorBEnable = newValue;
       configs.putBool("UBE", newValue);
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
  
  // Recalculate water levels with new calibration values
  updateWaterLevelCalculations();
  
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
 
// WiFi configuration update handler - FIXED VERSION
void handleWiFiConfigUpdate(JsonDocument& doc) {
  String wifiModeLive = doc["MODE"].as<String>();
  String ssidLive = doc["SSID"].as<String>();
  String passwordLive = doc["PASS"].as<String>();

  configs.begin("configData", RW_MODE);
  
  // Normalize WiFi mode to "AP" or "STA" only
  if (wifiModeLive == "access_point" || wifiModeLive == "AP") {
    wifiModeLive = "AP";
  } else if (wifiModeLive == "station" || wifiModeLive == "STA") {
    wifiModeLive = "STA";
  }
  
  // Determine IP configuration type based on presence and validity of static IP values
  String newIpConfigType = "dynamic"; // Default to dynamic
  
  if (doc.containsKey("SIP0") && doc.containsKey("SG0") && doc.containsKey("SS0")) {
    uint8_t sip0 = doc["SIP0"];
    uint8_t sip1 = doc["SIP1"];
    uint8_t sip2 = doc["SIP2"];
    uint8_t sip3 = doc["SIP3"];
    
    // Valid static IP must have at least first octet non-zero
    if (sip0 != 0) {
      newIpConfigType = "static";
      Serial.println("Static IP configuration detected");
      
      // Save all static IP parameters
      SIP0 = sip0; SIP1 = sip1; SIP2 = sip2; SIP3 = sip3;
      configs.putUShort("SIP0", SIP0);
      configs.putUShort("SIP1", SIP1);
      configs.putUShort("SIP2", SIP2);
      configs.putUShort("SIP3", SIP3);
      
      GW0 = doc["SG0"]; GW1 = doc["SG1"];
      GW2 = doc["SG2"]; GW3 = doc["SG3"];
      configs.putUShort("SG0", GW0);
      configs.putUShort("SG1", GW1);
      configs.putUShort("SG2", GW2);
      configs.putUShort("SG3", GW3);
      
      SNM0 = doc["SS0"]; SNM1 = doc["SS1"];
      SNM2 = doc["SS2"]; SNM3 = doc["SS3"];
      configs.putUShort("SS0", SNM0);
      configs.putUShort("SS1", SNM1);
      configs.putUShort("SS2", SNM2);
      configs.putUShort("SS3", SNM3);
      
      if (doc.containsKey("SPD0")) {
        PDNS0 = doc["SPD0"]; PDNS1 = doc["SPD1"];
        PDNS2 = doc["SPD2"]; PDNS3 = doc["SPD3"];
        configs.putUShort("SPD0", PDNS0);
        configs.putUShort("SPD1", PDNS1);
        configs.putUShort("SPD2", PDNS2);
        configs.putUShort("SPD3", PDNS3);
      }
    } else {
      newIpConfigType = "dynamic";
      Serial.println("Dynamic IP configuration (zero IP values)");
    }
  } else {
    newIpConfigType = "dynamic";
    Serial.println("Dynamic IP configuration (no static IP parameters)");
  }
  
  // Update all configuration values
  if (newIpConfigType != ipConfigType) {
    ipConfigType = newIpConfigType;
    configs.putString("ipConfigType", ipConfigType);
    Serial.printf("IP configuration type updated: %s\n", ipConfigType.c_str());
  }
  
  if (wifiModeLive != wifiMode) {
    wifiMode = wifiModeLive;
    configs.putString("WIFIMode", wifiModeLive);
    Serial.printf("WiFi mode updated: %s\n", wifiModeLive.c_str());
  }
  
  if (ssidLive != ssid) {
    ssid = ssidLive;
    configs.putString("SSID", ssidLive);
    Serial.printf("SSID updated: %s\n", ssidLive.c_str());
  }
  
  if (passwordLive != password) {
    password = passwordLive;
    configs.putString("PASS", passwordLive);
    Serial.printf("Password updated (length: %d)\n", passwordLive.length());
  }
  
  configs.end();
  
  // Send success response
  JsonDocument response;
  response["type"] = "wifiConfigUpdate";
  response["status"] = "success";
  response["message"] = "WiFi configuration saved. Please restart device to apply changes.";
  
  String responseStr;
  serializeJson(response, responseStr);
  webSocket.sendTXT(clientNumGlobal, responseStr);
  
  Serial.println("WiFi configuration update completed");
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
         
        // Calculate time since last data received from transmitter
        unsigned long timeSinceLastData = (lastDataReceived > 0) ? (systemUptime - lastDataReceived) : 0;
        char timeStr[10];
        snprintf(timeStr, sizeof(timeStr), "%lu", timeSinceLastData);
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
        
        // Sensor calibration offsets
        jsonDoc["upperSensorOffsetA"] = upperSensorOffsetA;
        jsonDoc["lowerSensorOffsetA"] = lowerSensorOffsetA;
        jsonDoc["upperSensorOffsetB"] = upperSensorOffsetB;
        jsonDoc["lowerSensorOffsetB"] = lowerSensorOffsetB;
        
        // Sensor validation limits
        jsonDoc["minSensorReading"] = minSensorReading;
        jsonDoc["maxSensorReading"] = maxSensorReading;
         
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
         
       } else if (strcmp((char *)payload, "getAllData") == 0) {
         // Send unified data response - combines home, settings, and sensor data
         JsonDocument jsonDoc;
         jsonDoc["type"] = "allData";
         
         // Calculate time since last data received from transmitter
         unsigned long timeSinceLastData = (lastDataReceived > 0) ? (systemUptime - lastDataReceived) : 0;
         
         // System status data (from getHomeData)
         jsonDoc["lastUpdate"] = String(timeSinceLastData);
         jsonDoc["systemMode"] = systemMode;
         jsonDoc["motor1State"] = motor1State ? "ON" : "OFF";
         jsonDoc["motor2State"] = motor2State ? "ON" : "OFF";
         jsonDoc["motor1Enabled"] = motor1Enabled;
         jsonDoc["motor2Enabled"] = motor2Enabled;
         jsonDoc["motorConfig"] = motorConfiguration;
         jsonDoc["autoReasonMotor1"] = autoModeReasonMotor1;
         jsonDoc["autoReasonMotor2"] = autoModeReasonMotor2;
         
         // Tank data (from getHomeData)
         jsonDoc["upperTankA"] = round(upperTankWaterLevelA * 10) / 10.0;
         jsonDoc["lowerTankA"] = round(lowerTankWaterLevelA * 10) / 10.0;
         jsonDoc["upperTankB"] = round(upperTankWaterLevelB * 10) / 10.0;
         jsonDoc["lowerTankB"] = round(lowerTankWaterLevelB * 10) / 10.0;
         
         // Sensor enable states (from getHomeData)
         jsonDoc["upperSensorAEnabled"] = upperSensorAEnable;
         jsonDoc["lowerSensorAEnabled"] = lowerSensorAEnable;
         jsonDoc["upperSensorBEnabled"] = upperSensorBEnable;
         jsonDoc["lowerSensorBEnabled"] = lowerSensorBEnable;
         
         // Settings data (from getSettingData)
         jsonDoc["dualMotorSyncMode"] = dualMotorSyncMode;
         jsonDoc["minAutoValueA"] = minAutoValueA;
         jsonDoc["maxAutoValueA"] = maxAutoValueA;
         jsonDoc["lowerThresholdA"] = lowerTankLowerThresholdLevelA;
         jsonDoc["lowerOverflowA"] = lowerTankOverFlowThresholdLevelA;
         jsonDoc["minAutoValueB"] = minAutoValueB;
         jsonDoc["maxAutoValueB"] = maxAutoValueB;
         jsonDoc["lowerThresholdB"] = lowerTankLowerThresholdLevelB;
         jsonDoc["lowerOverflowB"] = lowerTankOverFlowThresholdLevelB;
         jsonDoc["tankAAutomationEnabled"] = tankAAutomationEnabled;
         jsonDoc["tankBAutomationEnabled"] = tankBAutomationEnabled;
         
         // Tank dimensions
         jsonDoc["upperTankHeightA"] = upperTankHeightA;
         jsonDoc["upperWaterFullHeightA"] = upperWaterFullHeightA;
         jsonDoc["upperWaterEmptyHeightA"] = upperWaterEmptyHeightA;
         jsonDoc["upperTankHeightB"] = upperTankHeightB;
         jsonDoc["upperWaterFullHeightB"] = upperWaterFullHeightB;
         jsonDoc["upperWaterEmptyHeightB"] = upperWaterEmptyHeightB;
         jsonDoc["lowerTankHeightA"] = lowerTankHeightA;
         jsonDoc["lowerWaterFullHeightA"] = lowerWaterFullHeightA;
         jsonDoc["lowerWaterEmptyHeightA"] = lowerWaterEmptyHeightA;
         jsonDoc["lowerTankHeightB"] = lowerTankHeightB;
         jsonDoc["lowerWaterFullHeightB"] = lowerWaterFullHeightB;
         jsonDoc["lowerWaterEmptyHeightB"] = lowerWaterEmptyHeightB;
         
         // Sensor calibration
         jsonDoc["upperSensorOffsetA"] = upperSensorOffsetA;
         jsonDoc["lowerSensorOffsetA"] = lowerSensorOffsetA;
         jsonDoc["upperSensorOffsetB"] = upperSensorOffsetB;
         jsonDoc["lowerSensorOffsetB"] = lowerSensorOffsetB;
         
         // Sensor limits
         jsonDoc["minSensorReading"] = minSensorReading;
         jsonDoc["maxSensorReading"] = maxSensorReading;
         
         // Special functions
         jsonDoc["upperTankOverFlowLock"] = upperTankOverFlowLock;
         jsonDoc["lowerTankOverFlowLock"] = lowerTankOverFlowLock;
         jsonDoc["syncBothTank"] = syncBothTank;
         jsonDoc["buzzerAlert"] = buzzerAlert;
         
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
         Serial.println("All data sent");
         
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
        jsonDoc["ipConfigType"] = ipConfigType;
        
        if (ipConfigType == "static") {
          jsonDoc["staticIP"] = String(SIP0) + "." + String(SIP1) + "." + String(SIP2) + "." + String(SIP3);
          jsonDoc["gateway"] = String(GW0) + "." + String(GW1) + "." + String(GW2) + "." + String(GW3);
          jsonDoc["subnet"] = String(SNM0) + "." + String(SNM1) + "." + String(SNM2) + "." + String(SNM3);
          jsonDoc["primaryDNS"] = String(PDNS0) + "." + String(PDNS1) + "." + String(PDNS2) + "." + String(PDNS3);
        } else {
          jsonDoc["staticIP"] = "0.0.0.0";
          jsonDoc["gateway"] = "0.0.0.0";
          jsonDoc["subnet"] = "0.0.0.0";
          jsonDoc["primaryDNS"] = "0.0.0.0";
        }
        
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
     vTaskDelay(pdMS_TO_TICKS(readDelayA)); // Adjustable delay
   }
 }
 
void countTaskFunction(void *pvParameters) {
  Serial.printf("System Uptime Task started on core %d\n", xPortGetCoreID());

  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(1000)); // Update every 1 second
    
    // Increment system uptime
    systemUptime++;
    
    // Check if we haven't received data from transmitter for more than 10 minutes (600 seconds)
    if (lastDataReceived > 0 && (systemUptime - lastDataReceived) > 600) {
      Serial.printf("WARNING: No data from transmitter for %lu seconds (10+ minutes)\n", 
                    systemUptime - lastDataReceived);
      
      // Set fault condition for extended communication loss
      if ((systemUptime - lastDataReceived) > 900) { // 15 minutes
        Serial.println("CRITICAL: Transmitter communication lost for 15+ minutes!");
        faultOn();
        doBuzzerAlert(5, 1000, 500); // Long alert for critical condition
      }
    }
  }
}
 
 // Enhanced WiFi event handler
 void OnWiFiEvent(WiFiEvent_t event) {
   logWiFiEvent(event);
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
    configs.putFloat("UTWFHA", 5.0);   // Distance when full
    configs.putFloat("UTWEHA", 70.0);  // Distance when empty
    
    // Tank dimensions - Lower Tank A
    configs.putFloat("LTHA", 75.0);
    configs.putFloat("LTWFHA", 5.0);   // Distance when full
    configs.putFloat("LTWEHA", 70.0);  // Distance when empty
    
    // Tank dimensions - Upper Tank B
    configs.putFloat("UTHB", 75.0);
    configs.putFloat("UTWFHB", 5.0);   // Distance when full
    configs.putFloat("UTWEHB", 70.0);  // Distance when empty
    
    // Tank dimensions - Lower Tank B
    configs.putFloat("LTHB", 75.0);
    configs.putFloat("LTWFHB", 5.0);   // Distance when full
    configs.putFloat("LTWEHB", 70.0);  // Distance when empty
    
    // Sensor calibration offsets
    configs.putFloat("USOA", 0.0);     // Upper sensor offset A
    configs.putFloat("LSOA", 0.0);     // Lower sensor offset A
    configs.putFloat("USOB", 0.0);     // Upper sensor offset B
    configs.putFloat("LSOB", 0.0);     // Lower sensor offset B
    
    // Sensor validation limits
    configs.putFloat("minSensor", 20.0);
    configs.putFloat("maxSensor", 4000.0);
     
    // WiFi configuration
    configs.putString("WIFIMode", "AP");
    configs.putString("SSID", "Smart Water Tank v3.0");
    configs.putString("PASS", "00000000");
    configs.putString("ipConfigType", "static");
     
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
 lowerWaterFullHeightA = configs.getFloat("LTWFHA", 5.0);   // Distance when full
 lowerWaterEmptyHeightA = configs.getFloat("LTWEHA", 70.0); // Distance when empty
 upperTankHeightA = configs.getFloat("UTHA", 75.0);
 upperWaterFullHeightA = configs.getFloat("UTWFHA", 5.0);   // Distance when full
 upperWaterEmptyHeightA = configs.getFloat("UTWEHA", 70.0); // Distance when empty
 
 lowerTankHeightB = configs.getFloat("LTHB", 75.0);
 lowerWaterFullHeightB = configs.getFloat("LTWFHB", 5.0);   // Distance when full
 lowerWaterEmptyHeightB = configs.getFloat("LTWEHB", 70.0); // Distance when empty
 upperTankHeightB = configs.getFloat("UTHB", 75.0);
 upperWaterFullHeightB = configs.getFloat("UTWFHB", 5.0);   // Distance when full
 upperWaterEmptyHeightB = configs.getFloat("UTWEHB", 70.0); // Distance when empty
 
 // Sensor calibration offsets
 upperSensorOffsetA = configs.getFloat("USOA", 0.0);
 lowerSensorOffsetA = configs.getFloat("LSOA", 0.0);
 upperSensorOffsetB = configs.getFloat("USOB", 0.0);
 lowerSensorOffsetB = configs.getFloat("LSOB", 0.0);
 
 // Sensor validation limits
 minSensorReading = configs.getFloat("minSensor", 20.0);
 maxSensorReading = configs.getFloat("maxSensor", 4000.0);
   
   // Sensor enables
   lowerSensorAEnable = configs.getBool("LAE", false);
   lowerSensorBEnable = configs.getBool("LBE", false);
   upperSensorAEnable = configs.getBool("UAE", false);
   upperSensorBEnable = configs.getBool("UBE", false);
   
  // WiFi configuration with enhanced validation
  ssid = configs.getString("SSID", "Smart Water Tank v3.0");
  password = configs.getString("PASS", "12345678");
  wifiMode = configs.getString("WIFIMode", "AP");
  ipConfigType = configs.getString("ipConfigType", "static");
  
  Serial.printf("Loaded from NVS - SSID: '%s', Password length: %d, Mode: %s, IPConfig: %s\n", 
                ssid.c_str(), password.length(), wifiMode.c_str(), ipConfigType.c_str());
  
  // Enhanced WiFi credential validation and corruption detection
  Serial.println("\n=== WiFi Credential Validation ===");
  validateWiFiCredentials();
  
  // Check for firmware flash detection (new boot after re-flash)
  bool isNewFirmwareBoot = configs.getBool("firmwareFlashDetected", false);
  if (!isNewFirmwareBoot) {
    Serial.println("WiFi: New firmware detected - performing credential validation");
    configs.begin("configData", RW_MODE);
    configs.putBool("firmwareFlashDetected", true);
    configs.end();
    
    // Perform additional validation after firmware flash
    if (isWiFiCredentialsCorrupted()) {
      Serial.println("WiFi: Credentials corrupted after firmware flash - clearing");
      clearWiFiCredentials();
    }
  }
   
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
    WiFi.softAP(ssid, password);
    WiFi.softAPConfig(local_ip, gateway, subnet);
    Serial.println("Configuration AP started");
    Serial.printf("AP SSID: %s\n", ssid);
    Serial.printf("AP IP: %s\n", password);
 
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
 
  // Enhanced WiFi Setup with Robust Connection Logic
  Serial.println("\n=== ENHANCED WIFI SETUP ===");
  Serial.printf("WiFi Configuration - Mode: %s, SSID: '%s', IP Type: %s\n", 
    wifiMode.c_str(), ssid.c_str(), ipConfigType.c_str());

  // Register WiFi event handler for enhanced monitoring
  WiFi.onEvent(OnWiFiEvent);
  
  // Perform WiFi diagnostics before connection
  performWiFiDiagnostics();

  // Disconnect any existing connections and reset stack
  Serial.println("WiFi: Disconnecting and resetting stack...");
  WiFi.disconnect(true);
  delay(1000);
  
  // Reset WiFi stack to clear any corrupted state
  resetWiFiStack();

  if (wifiMode == "STA") {
    Serial.println("\n>>> Starting Enhanced Station Mode <<<");
    
    // Perform network scan for diagnostics
    Serial.println("\nScanning for networks...");
    int n = WiFi.scanNetworks();
    Serial.printf("Found %d networks:\n", n);

    bool targetFound = false;
    int targetRSSI = 0;
    int targetChannel = 0;

    for (int i = 0; i < n; i++) {
      String currentSSID = WiFi.SSID(i);
      int currentRSSI = WiFi.RSSI(i);

      Serial.printf("  %d: %s (RSSI: %d dBm, Ch: %d) %s\n", 
              i + 1, 
              currentSSID.c_str(), 
              currentRSSI,
              WiFi.channel(i),
              WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "[OPEN]" : "[SECURED]");

      if (currentSSID == ssid) {
        targetFound = true;
        targetRSSI = currentRSSI;
        targetChannel = WiFi.channel(i);
        Serial.printf(">>> TARGET NETWORK FOUND: '%s' at %d dBm on channel %d <<<\n", 
              ssid.c_str(), targetRSSI, targetChannel);
      }
    }

    if (!targetFound) {
      Serial.printf("\n!!! WARNING: Target network '%s' NOT FOUND in scan !!!\n", ssid.c_str());
      Serial.println("Possible reasons:");
      Serial.println("  1. SSID is incorrect (case-sensitive)");
      Serial.println("  2. Router is out of range");
      Serial.println("  3. Router is on 5GHz band (ESP32 only supports 2.4GHz)");
      Serial.println("  4. Router is powered off");
      Serial.println("\nProceeding with connection attempt anyway...");
    }

    // Attempt connection using enhanced function
    attemptWiFiConnection();

    // Check final connection status
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n========================================");
      Serial.println("    ✓ WiFi Connected Successfully!");
      Serial.println("========================================");
      Serial.printf("SSID:       %s\n", WiFi.SSID().c_str());
      Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("Gateway:    %s\n", WiFi.gatewayIP().toString().c_str());
      Serial.printf("Subnet:     %s\n", WiFi.subnetMask().toString().c_str());
      Serial.printf("DNS:        %s\n", WiFi.dnsIP().toString().c_str());
      Serial.printf("MAC:        %s\n", WiFi.macAddress().c_str());
      Serial.printf("RSSI:       %d dBm\n", WiFi.RSSI());
      Serial.printf("Channel:    %d\n", WiFi.channel());
      Serial.println("========================================\n");

      faultOff();
      digitalWrite(statusPin, HIGH);
      doBuzzerAlert(2, 200, 100);

    } else {
      Serial.println("\n========================================");
      Serial.println("    ✗ WiFi Connection Failed!");
      Serial.println("========================================");
      Serial.printf("Final Status: %s (%d)\n", getWiFiStatusString(WiFi.status()).c_str(), WiFi.status());
      Serial.printf("Connection Attempts: %d/%d\n", wifiConnectionAttempts, maxWifiAttempts);
      Serial.printf("Last Error: %s\n", lastConnectionError.c_str());
      Serial.println("\nTroubleshooting steps:");
      Serial.println("1. Verify SSID is correct (case-sensitive)");
      Serial.println("2. Verify password is correct");
      Serial.println("3. Ensure router is on 2.4GHz band");
      Serial.println("4. Check router security type (WPA2 recommended)");
      Serial.println("5. Try moving device closer to router");
      Serial.println("6. Check if MAC filtering is enabled on router");
      Serial.println("7. Try clearing WiFi credentials and reconfiguring");
      Serial.println("========================================\n");

      // Start fallback AP mode
      startFallbackAP();
    }

} else if (wifiMode == "AP") {
Serial.println("\n>>> Starting Access Point Mode <<<");

WiFi.mode(WIFI_MODE_APSTA);
WiFi.persistent(false);

// Start AP
Serial.printf("Creating AP with SSID: '%s'\n", ssid.c_str());
Serial.printf("Password length: %d\n", password.length());

bool apStarted = WiFi.softAP(ssid.c_str(), password.c_str());

if (!apStarted) {
Serial.println("ERROR: Failed to start Access Point!");
faultOn();
doBuzzerAlert(5, 200, 200);
}

// Configure IP address
if (ipConfigType == "static") {
Serial.println("Using custom static IP for AP...");
IPAddress local_ip(SIP0, SIP1, SIP2, SIP3);
IPAddress gateway(GW0, GW1, GW2, GW3);
IPAddress subnet(SNM0, SNM1, SNM2, SNM3);
WiFi.softAPConfig(local_ip, gateway, subnet);
Serial.printf("AP IP configured: %d.%d.%d.%d\n", SIP0, SIP1, SIP2, SIP3);
} else {
Serial.println("Using default AP IP configuration...");
IPAddress default_ip(192, 168, 4, 1);
IPAddress default_gw(192, 168, 4, 1);
IPAddress default_sn(255, 255, 255, 0);
WiFi.softAPConfig(default_ip, default_gw, default_sn);
}

delay(100); // Wait for AP to stabilize

Serial.println("\n========================================");
Serial.println("    ✓ Access Point Started!");
Serial.println("========================================");
Serial.printf("AP SSID:    %s\n", ssid.c_str());
Serial.printf("AP IP:      %s\n", WiFi.softAPIP().toString().c_str());
Serial.printf("AP MAC:     %s\n", WiFi.softAPmacAddress().c_str());
Serial.printf("Max Clients: %d\n", WiFi.softAPgetStationNum());
Serial.println("========================================\n");

faultOff();
digitalWrite(statusPin, HIGH);
doBuzzerAlert(1, 500, 100);

} else {
Serial.printf("\n!!! ERROR: Unknown WiFi mode '%s' !!!\n", wifiMode.c_str());
Serial.println("Valid modes are: 'STA' or 'AP'");
Serial.println("System will halt. Please reconfigure in configuration mode.\n");

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
     "Task2",
     5000,
     NULL,
     1,
     &espNowAndLowerTankSensorsTaskHandle,
     1
   );
 
  xTaskCreatePinnedToCore(
    countTaskFunction,
    "Counter",
    2048,
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
   
   // Print Channel Auto-Discovery status
   printChannelAutoDiscoveryStatus();
   
   digitalWrite(statusPin, HIGH);
   doBuzzerAlert(1, 200, 100);
 }
 
 // Main loop with enhanced WiFi monitoring
 void loop() {
   webSocket.loop();
   server.handleClient();
   
   // Enhanced WiFi monitoring and reconnection
   static unsigned long lastWiFiCheck = 0;
   static unsigned long lastChannelStatusCheck = 0;
   if (millis() - lastWiFiCheck > 5000) { // Check every 5 seconds
     lastWiFiCheck = millis();
     
     if (wifiMode == "STA" && !wifiConnected) {
       // Check if we should attempt reconnection
       if (wifiReconnectEnabled && 
           (millis() - lastWifiAttempt) > wifiReconnectInterval &&
           wifiConnectionAttempts < maxWifiAttempts) {
         
         Serial.println("WiFi: Attempting scheduled reconnection...");
         attemptWiFiConnection();
       }
     }
     
     // Monitor WiFi connection health
     if (wifiMode == "STA" && WiFi.status() != WL_CONNECTED && wifiConnected) {
       Serial.println("WiFi: Connection lost, triggering reconnection...");
       wifiConnected = false;
       handleWiFiDisconnection();
     }
   }
   
   // Channel Auto-Discovery status monitoring
   if (millis() - lastChannelStatusCheck > 30000) { // Check every 30 seconds
     lastChannelStatusCheck = millis();
     if (transmitterRegistered) {
       Serial.printf("Channel Auto-Discovery: Active on channel %d, %lu ACKs sent\n", 
                     currentChannel, ackCount);
     } else {
       Serial.println("Channel Auto-Discovery: Waiting for transmitter...");
     }
   }
   
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