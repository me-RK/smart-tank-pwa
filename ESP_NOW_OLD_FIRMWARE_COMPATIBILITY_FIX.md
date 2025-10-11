# ESP-NOW OLD Firmware Compatibility Fix

## Issue Analysis

**Problem**: ESP-NOW was still not receiving data despite all previous fixes.

**Root Cause**: The current firmware was using **new ESP32 framework callback signature** and **complex peer configuration**, while the OLD working firmware uses **simple initialization** with **old callback signature**.

## Key Differences Found

| Component | OLD Firmware (Working) | Current Firmware (Not Working) |
|-----------|------------------------|--------------------------------|
| **Callback Signature** | `(const uint8_t *mac, const uint8_t *incomingData, int len)` | `(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len)` |
| **Initialization** | Simple: `esp_now_init()` + `esp_now_register_recv_cb()` | Complex: WiFi delays + peer configuration |
| **Peer Config** | None | Broadcast peer + auto-discovery |
| **Timing** | Immediate initialization | 5-second delay |

## Fixes Applied

### 1. **Reverted to OLD Callback Signature**
**Before**:
```cpp
void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len)
```

**After**:
```cpp
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len)
```

### 2. **Simplified Initialization (Exact OLD Firmware Copy)**
**Before**:
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

// Register receive callback
esp_err_t result = esp_now_register_recv_cb(OnDataRecv);
if (result != ESP_OK) {
  Serial.printf("ESP-NOW callback registration failed: %d\n", result);
  doFaultAlert(2, 1000, 200);
  vTaskDelete(NULL);
  return;
}

// Add broadcast peer to receive from any transmitter (like testing code)
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

Serial.println("ESP-NOW initialized successfully - ready to receive data");
```

**After** (Exact OLD Firmware Copy):
```cpp
// Init ESP-NOW (exactly like OLD firmware - no delays, no peer config)
if (esp_now_init() != ESP_OK) {
  Serial.println("Error initializing ESP-NOW");
  doFaultAlert(3, 500, 200);
  vTaskDelete(NULL);
  return;
}

// Once ESPNow is successfully Init, we will register for recv CB to
// get recv packer info (exactly like OLD firmware)
uint8_t error = esp_now_register_recv_cb(OnDataRecv);

if (error == ESP_OK) {
  Serial.println("ESP Now Initiated Successfully.");
} else {
  Serial.printf("ESP Now Initiated Failed: %d\n", error);
  doFaultAlert(2, 1000, 200);
  vTaskDelete(NULL);
  return;
}

Serial.println("ESP-NOW ready to receive data");
```

### 3. **Removed Complex Peer Management**
- Removed `addEspNowPeer()` function
- Removed broadcast peer configuration
- Removed automatic peer discovery
- Removed WiFi mode debugging

### 4. **Updated MAC Address Access**
**Before**:
```cpp
Serial.printf("ESP-NOW: Received %d bytes from MAC: %02X:%02X:%02X:%02X:%02X:%02X\n", 
              len,
              recv_info->src_addr[0], recv_info->src_addr[1], recv_info->src_addr[2],
              recv_info->src_addr[3], recv_info->src_addr[4], recv_info->src_addr[5]);
```

**After**:
```cpp
Serial.printf("ESP-NOW: Received %d bytes from MAC: %02X:%02X:%02X:%02X:%02X:%02X\n", 
              len, mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
```

## Expected Behavior Now

### **Initialization** (Should match OLD firmware):
```
ESP-NOW and Sensors Task started on core 1
ESP Now Initiated Successfully.
ESP-NOW ready to receive data
```

### **Data Reception** (Should work like OLD firmware):
```
ESP-NOW: Received 10 bytes from MAC: 08:D1:F9:A6:DE:6C
ESP-NOW: Expected data size: 10 bytes, Received: 10 bytes
ESP-NOW: Raw data bytes: 01 01 00 00 FF 00 00 00 F1 02
=== ESP-NOW Data Received ===
Bytes: 10
Sensor A Active: 1, Value: 255
Sensor B Active: 1, Value: 753
WiFi RSSI: -45 dBm
============================
```

## Why This Should Work

1. **Exact OLD Firmware Logic**: Copied the working initialization sequence exactly
2. **Compatible Callback**: Uses the same callback signature that worked in OLD firmware
3. **No Complex Configuration**: Removed all the complex peer management that wasn't needed
4. **Simple and Direct**: Matches the proven working approach

## Files Modified

1. **`arduino-example/smart_tank_esp32/smart_tank_esp32.ino`**:
   - Reverted to OLD firmware callback signature
   - Simplified ESP-NOW initialization to match OLD firmware exactly
   - Removed complex peer configuration and management
   - Updated MAC address access in callback

The ESP-NOW receiver should now work exactly like the OLD firmware that was receiving data successfully!
