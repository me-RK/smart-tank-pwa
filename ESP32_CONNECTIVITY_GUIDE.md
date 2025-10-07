# ESP32 Connectivity Troubleshooting Guide

## 🚨 **IMPORTANT: App Now Requires ESP32 Connection**

The Smart Tank PWA has been refactored to **require a valid ESP32 connection** before accessing the dashboard. This ensures data integrity and prevents errors.

## 🔧 **New Connection Flow**

### **1. Connection Guard**
- **Blocks dashboard access** until ESP32 is connected
- **Auto-scans** for ESP32 devices on network startup
- **Shows connection screen** with troubleshooting options

### **2. Enhanced Device Discovery**
- **Automatic scanning** of common ESP32 IP addresses
- **Parallel testing** for faster discovery
- **Visual feedback** for found devices

### **3. Advanced Troubleshooting**
- **Step-by-step diagnostics** for connection issues
- **Real-time testing** of each connection component
- **Detailed error reporting** with solutions

## 🔍 **Troubleshooting Steps**

### **Step 1: ESP32 Device Status**
✅ **Check ESP32 Power & Status**
- ESP32 is connected to power supply
- Status LED is blinking/steady
- Serial Monitor shows "System initialized!"
- WiFi connection established

**Serial Monitor Output Should Show:**
```
WiFi connected!
IP address: 192.168.1.100
System initialized!
```

### **Step 2: Network Connectivity**
✅ **Verify Network Connection**
- Both ESP32 and your device are on same WiFi
- No firewall blocking port 81
- Network signal is strong
- Try mobile hotspot if WiFi fails

**Test Network:**
- Open browser and visit any website
- Check WiFi signal strength
- Ensure both devices on same network

### **Step 3: IP Address Verification**
✅ **Confirm ESP32 IP Address**
- Check ESP32 Serial Monitor for IP address
- IP address format: 192.168.x.x
- Try common addresses: 192.168.1.100, 192.168.4.1
- Use network scanner to find device

**Common ESP32 IP Addresses:**
```
192.168.1.100 - 192.168.1.105
192.168.4.1 - 192.168.4.2 (AP mode)
192.168.0.100 - 192.168.0.102
10.0.0.1
172.16.0.1
```

### **Step 4: WebSocket Connection Test**
✅ **Test WebSocket Connection**
- ESP32 WebSocket server is running on port 81
- Connection test passes
- No timeout errors
- Data exchange is working

**Expected ESP32 Messages:**
```json
{
  "type": "sensorData",
  "sensorA": 1250,
  "sensorB": 980,
  "timestamp": 12345
}
```

## 🛠️ **Advanced Troubleshooting**

### **Connection Guard Features**
1. **Auto-Scan**: Automatically scans for ESP32 devices
2. **Manual Connection**: Enter IP address manually
3. **Retry Logic**: Up to 3 connection attempts
4. **Advanced Diagnostics**: Step-by-step troubleshooting

### **Troubleshooting Guide Features**
1. **ESP32 Power Test**: Verify device status
2. **Network Test**: Check connectivity
3. **IP Address Test**: Validate IP format
4. **WebSocket Test**: Test connection to ESP32

## 📱 **App Usage Flow**

### **1. First Launch**
1. App shows connection screen
2. Auto-scans for ESP32 devices
3. Shows found devices or manual connection option

### **2. Connection Process**
1. **Auto-Scan**: App automatically finds ESP32
2. **Manual Entry**: Enter IP address manually
3. **Test Connection**: Verify connectivity before connecting
4. **Connect**: Establish WebSocket connection

### **3. Dashboard Access**
- **Only accessible** after successful ESP32 connection
- **Real-time data** from ESP32 sensors
- **Connection status** always visible
- **Auto-reconnection** if connection lost

## 🔧 **ESP32 Arduino Code Requirements**

### **WebSocket Server**
```cpp
// Must run on port 81
WebSocketsServer webSocket = WebSocketsServer(81);
webSocket.begin();
```

### **Message Format**
```cpp
// Sensor data message
{
  "type": "sensorData",
  "sensorA": mmDistA,
  "sensorB": mmDistB,
  "timestamp": millis()
}

// Status message
{
  "type": "status",
  "systemEnabled": true,
  "pump1Enabled": false,
  "pump2Enabled": false,
  "faultDetected": false
}
```

### **Command Handling**
```cpp
// Handle incoming commands
if (command == "getData") {
  sendSensorData();
}
```

## 🚨 **Common Issues & Solutions**

### **Issue: "No ESP32 devices found"**
**Solutions:**
1. Check ESP32 is powered on
2. Verify WiFi connection
3. Check Serial Monitor for IP address
4. Try manual connection with correct IP

### **Issue: "Connection timeout"**
**Solutions:**
1. Check network connectivity
2. Verify IP address is correct
3. Check firewall settings
4. Try different network

### **Issue: "WebSocket connection failed"**
**Solutions:**
1. Ensure ESP32 code is uploaded
2. Check WebSocket server is running
3. Verify port 81 is not blocked
4. Check ESP32 Serial Monitor for errors

### **Issue: "No data received"**
**Solutions:**
1. Check ESP32 sensor connections
2. Verify message format
3. Check browser console for errors
4. Test ESP32 with Serial Monitor

## 📋 **Quick Checklist**

### **ESP32 Setup**
- [ ] Arduino code uploaded successfully
- [ ] ESP32 connected to WiFi
- [ ] Serial Monitor shows IP address
- [ ] WebSocket server running on port 81
- [ ] Sensors connected and reading data

### **Network Setup**
- [ ] Both devices on same WiFi network
- [ ] No firewall blocking port 81
- [ ] Strong network signal
- [ ] IP address accessible

### **App Connection**
- [ ] App shows connection screen
- [ ] Auto-scan finds ESP32 or manual entry works
- [ ] Connection test passes
- [ ] WebSocket connection established
- [ ] Dashboard accessible with data

## 🆘 **Emergency Reset**

If all else fails:
1. **Reset ESP32**: Power cycle the device
2. **Clear App Data**: Clear browser cache and localStorage
3. **Restart Network**: Restart WiFi router
4. **Fresh Start**: Re-upload Arduino code

## 📞 **Support Information**

### **Debug Information to Collect:**
1. ESP32 Serial Monitor output
2. Browser console errors
3. Network connectivity status
4. IP address and port information

### **Files to Check:**
- `src/components/ConnectionGuard.tsx` - Connection logic
- `src/utils/connectionTest.ts` - Connection testing
- `src/context/WebSocketContext.tsx` - WebSocket handling

The app now ensures **reliable ESP32 connectivity** before allowing dashboard access! 🎉
