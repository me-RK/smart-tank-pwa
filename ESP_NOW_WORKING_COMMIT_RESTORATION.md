# ESP-NOW Working Commit Restoration

## Issue Analysis

**Problem**: ESP-NOW was initializing successfully but not receiving any data from the transmitter.

**Solution**: Restored the exact ESP-NOW code from the working commit `cbddef9d417e6c26dbcde2af81b81a68f1a8f2c8`.

## Key Differences Found

The working commit had a **much simpler ESP-NOW implementation** compared to our complex version:

| Component | Our Complex Version | Working Commit Version |
|-----------|-------------------|----------------------|
| **Initialization** | Complex with peer config, delays, debugging | Simple: just `esp_now_init()` + `esp_now_register_recv_cb()` |
| **Callback Function** | Complex with validation, raw bytes, detailed logging | Simple: basic data copying and printing |
| **Error Handling** | `esp_err_t result` with detailed error messages | `uint8_t error` with simple error handling |
| **Peer Configuration** | Broadcast peer setup | No peer configuration |
| **Task Name** | "SensorsESPNOW" | "Task2" |
| **Debugging** | Extensive MAC address, data validation, raw bytes | Basic sensor data and WiFi strength |

## Fixes Applied

### 1. **Simplified ESP-NOW Initialization**
**Before** (Complex):
```cpp
// Wait for WiFi to be initialized by main setup
Serial.println("ESP-NOW: Waiting for WiFi initialization...");
vTaskDelay(pdMS_TO_TICKS(5000)); // Wait 5 seconds for WiFi setup

// Print MAC Address for debugging
Serial.printf("ESP-NOW Receiver MAC Address: %s\n", WiFi.macAddress().c_str());
Serial.printf("ESP-NOW WiFi Mode: %s\n", (WiFi.getMode() == WIFI_STA) ? "STA" : "AP");

// Init ESP-NOW (don't change WiFi mode - work with existing setup)
if (esp_now_init() != ESP_OK) {
  Serial.println("ESP-NOW initialization failed");
  doFaultAlert(3, 500, 200);
  vTaskDelete(NULL);
  return;
}

// Once ESPNow is successfully Init, we will register for recv CB to
// get recv packer info (ESP32 Arduino 3.2.0 compatible)
esp_err_t result = esp_now_register_recv_cb(OnDataRecv);

if (result == ESP_OK) {
  Serial.println("ESP Now Initiated Successfully.");
} else {
  Serial.printf("ESP Now Initiated Failed: %d\n", result);
  doFaultAlert(2, 1000, 200);
  vTaskDelete(NULL);
  return;
}

// Add broadcast peer for ESP32 Arduino 3.2.0 compatibility
esp_now_peer_info_t peerInfo = {};
peerInfo.channel = 0;  // Use current WiFi channel
peerInfo.ifidx = WIFI_IF_STA;
peerInfo.encrypt = false;  // No encryption for broadcast

// Add broadcast peer (MAC: FF:FF:FF:FF:FF:FF)
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
memcpy(peerInfo.peer_addr, broadcastAddress, 6);

result = esp_now_add_peer(&peerInfo);
if (result == ESP_OK) {
  Serial.println("ESP-NOW broadcast peer added successfully");
} else {
  Serial.printf("ESP-NOW broadcast peer add failed: %d\n", result);
  // Continue anyway - might still work without explicit peer
}

Serial.println("ESP-NOW ready to receive data");
```

**After** (Simple - from working commit):
```cpp
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
```

### 2. **Simplified OnDataRecv Callback**
**Before** (Complex):
```cpp
// ESP-NOW callback function (ESP32 Arduino 3.2.0 signature)
void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len) {
  // Print sender MAC address for debugging
  Serial.printf("ESP-NOW: Received %d bytes from MAC: %02X:%02X:%02X:%02X:%02X:%02X\n", 
                len,
                recv_info->src_addr[0], recv_info->src_addr[1], recv_info->src_addr[2],
                recv_info->src_addr[3], recv_info->src_addr[4], recv_info->src_addr[5]);
  
  // Validate data length
  Serial.printf("ESP-NOW: Expected data size: %d bytes, Received: %d bytes\n", sizeof(struct_message), len);
  if (len != sizeof(struct_message)) {
    Serial.printf("ESP-NOW: Invalid data length. Expected: %d, Received: %d\n", sizeof(struct_message), len);
    Serial.println("ESP-NOW: This might indicate a data structure mismatch with transmitter");
    return;
  }
  
  // Print raw data bytes for debugging
  Serial.print("ESP-NOW: Raw data bytes: ");
  for (int i = 0; i < len; i++) {
    Serial.printf("%02X ", incomingData[i]);
  }
  Serial.println();
  
  memcpy(&subData, incomingData, sizeof(subData));
  
  Serial.println("=== ESP-NOW Data Received ===");
  Serial.printf("Bytes: %d\n", len);
  Serial.printf("Sensor A Active: %d, Value: %u\n", subData.sensorA, subData.valueA);
  Serial.printf("Sensor B Active: %d, Value: %u\n", subData.sensorB, subData.valueB);
  Serial.printf("WiFi RSSI: %d dBm\n", WiFi.RSSI());
  Serial.println("============================");
```

**After** (Simple - from working commit):
```cpp
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
```

### 3. **Updated Task Name**
**Before**: `"SensorsESPNOW"`
**After**: `"Task2"` (matching working commit)

## Expected Behavior Now

### **Initialization** (Should match working commit):
```
Task2 running on core 1
ESP Now Initiated Successfully.
```

### **Data Reception** (Should work like working commit):
```
Bytes received: 10
sensorA: 1
sensorB: 1
valueA: 255
valueB: 753

Wifi Strength: -45
```

## Why This Should Work

1. **Proven Working Code**: Uses the exact same ESP-NOW implementation that was working in commit `cbddef9d417e6c26dbcde2af81b81a68f1a8f2c8`
2. **Simple and Direct**: No complex peer configuration or validation that might interfere
3. **Minimal Overhead**: Basic data copying and printing without extensive debugging
4. **Framework Compatible**: Uses the correct ESP32 Arduino 3.2.0 callback signature

## Files Modified

1. **`arduino-example/smart_tank_esp32/smart_tank_esp32.ino`**:
   - Restored simple ESP-NOW initialization from working commit
   - Restored simple OnDataRecv callback from working commit
   - Updated task name to "Task2" to match working commit
   - Removed complex peer configuration and debugging

The ESP-NOW receiver should now work exactly like it did in the working commit!
