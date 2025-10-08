# Complete ESP32 + PWA Setup Guide

## 🎯 **Main Objectives**
1. **Auto-discover ESP32** on local network
2. **Manual connection** by entering IP address
3. **Transfer sensor data** to dashboard
4. **Control motors** connected to ESP32

## 🔧 **ESP32 Arduino Code Setup**

### **Step 1: Install Required Libraries**
Open Arduino IDE and install these libraries:
1. **WebSockets** by Markus Sattler
2. **ArduinoJson** by Benoit Blanchon

### **Step 2: Configure WiFi Credentials**
Edit the Arduino code and update these lines:
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```

### **Step 3: Upload Code to ESP32**
1. Select **ESP32 Dev Module** board
2. Set correct **COM port**
3. Click **Upload**
4. Open **Serial Monitor** (115200 baud)

### **Step 4: Verify ESP32 Setup**
Look for this output in Serial Monitor:
```
Starting WiFi connection...
Connecting to WiFi... Attempt 1
WiFi connected successfully!
IP address: 192.168.1.100
WebSocket server running on: ws://192.168.1.100:81
System initialized!
```

**Note the IP address** - you'll need it for the PWA!

## 📱 **PWA App Setup**

### **Step 1: Build the PWA**
```bash
npm run build
```

### **Step 2: Serve the PWA**
```bash
npm run preview
# or
npx serve dist
```

### **Step 3: Open in Browser**
Navigate to the PWA URL (usually `http://localhost:3000`)

## 🔗 **Connection Process**

### **Method 1: Auto-Discovery**
1. **Start ESP32** - Ensure it's connected to WiFi
2. **Open PWA** - App automatically scans for ESP32 devices
3. **Wait for Discovery** - App finds ESP32 and shows connection option
4. **Click Connect** - Establishes WebSocket connection

### **Method 2: Manual Connection**
1. **Get ESP32 IP** - From Serial Monitor output
2. **Open PWA** - Click "Manual Connection"
3. **Enter IP Address** - e.g., `192.168.1.100`
4. **Test Connection** - Verify connectivity
5. **Connect** - Establishes WebSocket connection

## 📊 **Dashboard Features**

### **Real-time Sensor Data**
- **Tank A Level** - From sensor A (Serial2)
- **Tank B Level** - From sensor B (Serial)
- **Live Updates** - Data refreshes every second

### **Pump Control**
- **System Toggle** - Enable/disable entire system
- **Pump 1 Control** - Toggle primary pump (GPIO 25)
- **Pump 2 Control** - Toggle secondary pump (GPIO 26)
- **Real-time Status** - Shows pump states

### **Connection Status**
- **Connection Indicator** - Shows ESP32 connection status
- **Error Handling** - Displays connection errors
- **Auto-reconnection** - Automatically reconnects if connection lost

## 🔧 **Hardware Connections**

### **ESP32 Pinout**
```
GPIO 25 → Relay 1 (Pump 1)
GPIO 26 → Relay 2 (Pump 2)
GPIO 18 → Output 1
GPIO 19 → Output 2
GPIO 23 → Status LED
GPIO 15 → Fault LED
GPIO 13 → Buzzer
GPIO 34 → Config Button
```

### **Sensor Connections**
```
Sensor A → Serial2 (GPIO 16/17)
Sensor B → Serial (GPIO 1/3)
```

## 🚨 **Troubleshooting**

### **ESP32 Issues**
1. **WiFi Connection Failed**
   - Check SSID and password
   - Ensure WiFi is 2.4GHz (not 5GHz)
   - Check signal strength

2. **WebSocket Server Not Starting**
   - Check Serial Monitor for errors
   - Verify libraries are installed
   - Restart ESP32

3. **Sensor Data Not Reading**
   - Check sensor connections
   - Verify sensor power supply
   - Check Serial Monitor for sensor readings

### **PWA Issues**
1. **Auto-Discovery Not Working**
   - Check both devices on same network
   - Try manual connection
   - Check firewall settings

2. **Connection Timeout**
   - Verify ESP32 IP address
   - Check port 81 is not blocked
   - Try different network

3. **No Data Received**
   - Check browser console for errors
   - Verify WebSocket connection
   - Check ESP32 Serial Monitor

## 📋 **Testing Checklist**

### **ESP32 Testing**
- [ ] WiFi connected successfully
- [ ] IP address displayed in Serial Monitor
- [ ] WebSocket server running on port 81
- [ ] Sensor data being read
- [ ] Relays responding to commands

### **PWA Testing**
- [ ] App loads connection screen
- [ ] Auto-discovery finds ESP32
- [ ] Manual connection works
- [ ] Dashboard shows sensor data
- [ ] Pump controls work
- [ ] Real-time updates working

## 🔄 **Data Flow**

### **ESP32 → PWA**
```json
{
  "type": "sensorData",
  "sensorA": 1250,
  "sensorB": 980,
  "timestamp": 12345
}
```

### **PWA → ESP32**
```json
{
  "command": "togglePump1"
}
```

## 🎉 **Success Indicators**

### **ESP32 Serial Monitor Should Show:**
```
WiFi connected successfully!
IP address: 192.168.1.100
WebSocket server running on: ws://192.168.1.100:81
System initialized!
[0] Client connected from 192.168.1.50
Sending initial data to client...
Sending sensor data: {"type":"sensorData","sensorA":1250,"sensorB":980,"timestamp":12345}
```

### **PWA Browser Console Should Show:**
```
Received message from ESP32: {type: "sensorData", sensorA: 1250, sensorB: 980, timestamp: 12345}
Sending message to ESP32: {command: "togglePump1"}
```

### **Dashboard Should Display:**
- ✅ Connection status: "Connected"
- ✅ Real-time sensor data
- ✅ Working pump control buttons
- ✅ Live data updates

## 🆘 **Emergency Reset**

If everything fails:
1. **Reset ESP32** - Power cycle the device
2. **Clear PWA Cache** - Clear browser data
3. **Restart Network** - Restart WiFi router
4. **Fresh Upload** - Re-upload Arduino code

The system is now ready for reliable ESP32-PWA communication! 🚀
