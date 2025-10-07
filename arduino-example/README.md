# Smart Tank Management System - ESP32 Arduino Example

This folder contains the Arduino code for the ESP32 microcontroller that works with the Smart Tank PWA application.

## Hardware Requirements

### ESP32 Development Board
- ESP32 DevKit or similar
- WiFi capability
- Multiple GPIO pins

### Sensors
- 2x Ultrasonic sensors (compatible with serial communication)
- Sensors should respond to 0x55 command and return 4-byte data format

### Control Components
- 2x Relay modules for pump control
- Status LEDs
- Buzzer for alerts
- Configuration button

## Pin Configuration

| Component | ESP32 Pin | Description |
|-----------|-----------|-------------|
| Relay 1 | GPIO 25 | Pump 1 control |
| Relay 2 | GPIO 26 | Pump 2 control |
| Output 1 | GPIO 18 | General output 1 |
| Output 2 | GPIO 19 | General output 2 |
| Status LED | GPIO 23 | System status indicator |
| Fault LED | GPIO 15 | Fault indicator |
| Buzzer | GPIO 13 | Audio alerts |
| Config Button | GPIO 34 | Configuration button |
| Sensor A | Serial (UART0) | Primary sensor |
| Sensor B | Serial2 (UART2) | Secondary sensor |

## Software Requirements

### Arduino IDE Libraries
Install the following libraries through Arduino IDE Library Manager:

1. **WebSockets** by Markus Sattler
   - Go to Tools → Manage Libraries
   - Search for "WebSockets"
   - Install "WebSockets" by Markus Sattler

2. **ArduinoJson** by Benoit Blanchon
   - Search for "ArduinoJson"
   - Install "ArduinoJson" by Benoit Blanchon

3. **Preferences** (built-in ESP32 library)
   - No installation needed, comes with ESP32 core

## Setup Instructions

### 1. Install ESP32 Board Package
1. Open Arduino IDE
2. Go to File → Preferences
3. Add this URL to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to Tools → Board → Boards Manager
5. Search for "ESP32" and install "esp32 by Espressif Systems"

### 2. Configure WiFi
1. Open `smart_tank_esp32.ino`
2. Update WiFi credentials:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```

### 3. Upload Code
1. Select your ESP32 board: Tools → Board → ESP32 Arduino → ESP32 Dev Module
2. Select the correct COM port: Tools → Port
3. Click Upload button

### 4. Monitor Serial Output
1. Open Serial Monitor (Tools → Serial Monitor)
2. Set baud rate to 115200
3. You should see WiFi connection status and IP address

## WebSocket Communication

The ESP32 creates a WebSocket server on port 81 that communicates with the PWA application.

### Data Format
All communication uses JSON format:

**Sensor Data (ESP32 → PWA):**
```json
{
  "type": "sensorData",
  "sensorA": 1250,
  "sensorB": 980,
  "timestamp": 12345
}
```

**Status Update (ESP32 → PWA):**
```json
{
  "type": "status",
  "systemEnabled": true,
  "pump1Enabled": false,
  "pump2Enabled": true,
  "faultDetected": false
}
```

**Commands (PWA → ESP32):**
```json
{
  "command": "togglePump1"
}
```

```json
{
  "command": "setDelayA",
  "value": 2000
}
```

## Available Commands

| Command | Description | Parameters |
|---------|-------------|------------|
| `togglePump1` | Toggle pump 1 on/off | None |
| `togglePump2` | Toggle pump 2 on/off | None |
| `toggleSystem` | Toggle entire system | None |
| `getData` | Request current sensor data | None |
| `setDelayA` | Set sensor A read delay | `value`: delay in ms |
| `setDelayB` | Set sensor B read delay | `value`: delay in ms |

## Troubleshooting

### WiFi Connection Issues
- Check SSID and password are correct
- Ensure WiFi network is 2.4GHz (ESP32 doesn't support 5GHz)
- Check signal strength

### Sensor Reading Issues
- Verify sensor connections
- Check sensor power supply
- Ensure sensors respond to 0x55 command
- Monitor serial output for sensor data

### WebSocket Connection Issues
- Check ESP32 IP address in serial monitor
- Ensure PWA app is connecting to correct IP:81
- Check firewall settings

### Relay Control Issues
- Verify relay module connections
- Check relay module power supply
- Test relay operation with simple digitalWrite commands

## Customization

### Adding More Sensors
1. Create new task function similar to `readData1()`
2. Add new sensor variables
3. Update `sendSensorData()` function
4. Add new commands if needed

### Adding More Relays
1. Define new pin constants
2. Add relay control variables
3. Update `sendStatusUpdate()` function
4. Add new toggle commands

### Modifying Sensor Protocol
1. Update the sensor reading functions
2. Modify the command format (currently 0x55)
3. Adjust data parsing logic

## Safety Notes

- Always use proper electrical isolation for relay circuits
- Ensure proper grounding
- Use appropriate fuses and circuit breakers
- Test all connections before powering on
- Keep water away from electrical components

## Support

For issues or questions:
1. Check serial monitor output
2. Verify all connections
3. Test individual components
4. Review this documentation

## Version History

- v1.0: Initial release with basic sensor reading and relay control
- Includes WebSocket communication with PWA app
- Supports dual sensor configuration
- Fault detection and status monitoring

