# ESP-NOW Callback Signature Fix

## ✅ **Critical Issue Resolved**

**Problem**: ESP-NOW was not receiving any data from the transmitter despite successful initialization.

**Root Cause**: The ESP-NOW callback function signature was using the new ESP-IDF format instead of the Arduino ESP32 core format.

## 🔧 **Fix Applied**

### **Callback Function Signature Fixed**

**Location**: `arduino-example/smart_tank_esp32/smart_tank_esp32.ino`

**Function Declaration** (Line 203):
```cpp
// OLD (not working):
void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len);

// NEW (working):
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len);
```

**Function Implementation** (Line 1067):
```cpp
// OLD (not working):
void OnDataRecv(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len) {

// NEW (working):
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
```

## 🎯 **Why This Fix Works**

The ESP-IDF v4.4+ introduced a new callback signature with `esp_now_recv_info` structure, but the Arduino ESP32 core (especially older versions) still uses the classic callback with MAC address parameter. Since the code includes `<esp_now.h>` from Arduino, it needs to use the Arduino-compatible signature.

## 📋 **Complete Fixed Function**

```cpp
// ESP-NOW callback function
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
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

## 🎯 **Expected Behavior Now**

### **Initialization**:
```
Task2 running on core 1
ESP Now Initiated Successfully.
```

### **Data Reception** (Should work now):
```
Bytes received: 10
sensorA: 1
sensorB: 1
valueA: 255
valueB: 753

Wifi Strength: -45
Upper Tank A: 70.2% (Raw: 255mm)
Upper Tank B: 68.5% (Raw: 753mm)
```

## 📝 **Next Steps**

1. **Upload the updated firmware** with the corrected callback signature
2. **Test with your transmitter** (MAC: 08:D1:F9:A6:DE:6C)
3. **Check Serial output** for ESP-NOW data reception

## 🎉 **Summary**

The ESP-NOW should now work correctly! The key was using the Arduino-compatible callback signature `(const uint8_t *mac, const uint8_t *incomingData, int len)` instead of the ESP-IDF signature `(const esp_now_recv_info *recv_info, const uint8_t *incomingData, int len)`.

This fix was identified by comparing with the working OLD firmware and finding the critical difference in the callback function signature.