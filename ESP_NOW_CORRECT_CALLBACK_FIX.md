# ESP-NOW Correct Callback Signature Fix

## ✅ **Issue Resolved**

**Problem**: ESP-NOW callback function signature mismatch between Arduino ESP32 core expectations and ESP-IDF framework requirements.

**Root Cause**: ESP32 Arduino framework 3.2.0 uses the new ESP-IDF callback signature, not the old Arduino signature.

## 🔧 **Correct Fix Applied**

### **Callback Function Signature**

**Location**: `arduino-example/smart_tank_esp32/smart_tank_esp32.ino`

**Function Declaration** (Line 203):
```cpp
void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len);
```

**Function Implementation** (Line 1067):
```cpp
void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len) {
  memcpy(&subData, incomingData, sizeof(subData));
  Serial.print("Bytes received: ");
  Serial.println(len);
  Serial.print("From MAC: ");
  for (int i = 0; i < 6; i++) {
    Serial.printf("%02X", recv_info->src_addr[i]);
    if (i < 5) Serial.print(":");
  }
  Serial.println();
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
```

## 🎯 **Key Differences from Old Signature**

1. **Parameter Change**: `const uint8_t *mac` → `const esp_now_recv_info *recv_info`
2. **MAC Address Access**: `mac[i]` → `recv_info->src_addr[i]`
3. **Additional Info**: The new signature provides more information about the received packet

## 🎯 **Expected Behavior Now**

### **Initialization**:
```
Task2 running on core 1
ESP Now Initiated Successfully.
```

### **Data Reception** (Should work now):
```
Bytes received: 10
From MAC: 08:D1:F9:A6:DE:6C
sensorA: 1
sensorB: 1
valueA: 255
valueB: 753

Wifi Strength: -45
Upper Tank A: 70.2% (Raw: 255mm)
Upper Tank B: 68.5% (Raw: 753mm)
```

## 📝 **Why This is the Correct Fix**

ESP32 Arduino framework 3.2.0 uses the new ESP-IDF callback signature:
- `esp_now_recv_cb_t` expects `void (*)(const esp_now_recv_info*, const uint8_t*, int)`
- The old Arduino signature `void (*)(const uint8_t*, const uint8_t*, int)` is no longer supported

## 🎉 **Summary**

The ESP-NOW should now work correctly with the proper ESP-IDF callback signature! The key was using the new signature `(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len)` and accessing the MAC address via `recv_info->src_addr[i]`.

This fix is compatible with ESP32 Arduino framework 3.2.0 and should resolve the compilation error.
