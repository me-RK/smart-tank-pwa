# Smart Tank ESP32 Wiring Diagram

## Component Connections

### ESP32 Development Board
```
ESP32 DevKit V1 (30 pins)
```

### Power Supply
- **5V Power Supply** → ESP32 VIN pin
- **Ground** → ESP32 GND pin
- **3.3V** → ESP32 3.3V pin (for sensors and relays)

### Ultrasonic Sensors

#### Sensor A (Primary)
```
Sensor A VCC  → ESP32 3.3V
Sensor A GND  → ESP32 GND
Sensor A TX   → ESP32 GPIO 1 (TX0)
Sensor A RX   → ESP32 GPIO 3 (RX0)
```

#### Sensor B (Secondary)
```
Sensor B VCC  → ESP32 3.3V
Sensor B GND → ESP32 GND
Sensor B TX   → ESP32 GPIO 17 (TX2)
Sensor B RX   → ESP32 GPIO 16 (RX2)
```

### Relay Modules

#### Relay 1 (Pump 1 Control)
```
Relay 1 VCC   → ESP32 3.3V
Relay 1 GND   → ESP32 GND
Relay 1 IN    → ESP32 GPIO 25
Relay 1 NO    → Pump 1 Positive
Relay 1 COM   → Power Supply Positive
```

#### Relay 2 (Pump 2 Control)
```
Relay 2 VCC   → ESP32 3.3V
Relay 2 GND   → ESP32 GND
Relay 2 IN    → ESP32 GPIO 26
Relay 2 NO    → Pump 2 Positive
Relay 2 COM   → Power Supply Positive
```

### Status Indicators

#### LEDs
```
Status LED Anode  → ESP32 GPIO 23
Status LED Cathode → 220Ω Resistor → ESP32 GND

Fault LED Anode   → ESP32 GPIO 15
Fault LED Cathode → 220Ω Resistor → ESP32 GND
```

#### Buzzer
```
Buzzer Positive → ESP32 GPIO 13
Buzzer Negative → ESP32 GND
```

### Control Inputs

#### Configuration Button
```
Button Pin 1 → ESP32 GPIO 34
Button Pin 2 → ESP32 GND
```

### General Outputs
```
Output 1 → ESP32 GPIO 18
Output 2 → ESP32 GPIO 19
```

## Complete Wiring Diagram

```
                    ESP32 DevKit V1
                    ┌─────────────────┐
                    │                 │
    3.3V ──────────►│ 3.3V            │
                    │                 │
    GND ───────────►│ GND              │
                    │                 │
                    │                 │
    Sensor A TX ───►│ GPIO 1 (TX0)    │
    Sensor A RX ───►│ GPIO 3 (RX0)    │
                    │                 │
    Sensor B TX ───►│ GPIO 17 (TX2)   │
    Sensor B RX ───►│ GPIO 16 (RX2)   │
                    │                 │
    Relay 1 IN ────►│ GPIO 25         │
    Relay 2 IN ────►│ GPIO 26         │
                    │                 │
    Status LED ────►│ GPIO 23         │
    Fault LED ─────►│ GPIO 15         │
    Buzzer ────────►│ GPIO 13         │
                    │                 │
    Config Button ─►│ GPIO 34         │
                    │                 │
    Output 1 ──────►│ GPIO 18         │
    Output 2 ──────►│ GPIO 19         │
                    │                 │
                    └─────────────────┘
```

## Power Requirements

### ESP32 Board
- **Voltage**: 3.3V (internal) or 5V (external)
- **Current**: ~240mA (WiFi active)

### Sensors
- **Voltage**: 3.3V
- **Current**: ~50mA each

### Relays
- **Voltage**: 3.3V (logic) / 5V-12V (switching)
- **Current**: ~70mA each

### Total System
- **Recommended Power Supply**: 5V, 2A
- **Peak Current**: ~500mA

## Safety Considerations

### Electrical Safety
- Use proper fuses and circuit breakers
- Ensure proper grounding
- Keep water away from electrical components
- Use waterproof enclosures for outdoor installation

### Relay Safety
- Use appropriate relay ratings for pump loads
- Consider using contactors for high-power pumps
- Add flyback diodes for inductive loads

### Sensor Safety
- Ensure sensors are properly sealed
- Use appropriate mounting hardware
- Consider environmental factors (temperature, humidity)

## Enclosure Recommendations

### Indoor Installation
- Plastic enclosure with IP54 rating
- Ventilation for heat dissipation
- Cable glands for wire entry

### Outdoor Installation
- Metal or fiberglass enclosure with IP65 rating
- UV-resistant materials
- Proper sealing for weather protection

## Testing Checklist

Before deployment:
- [ ] All connections secure
- [ ] Power supply adequate
- [ ] Sensors responding correctly
- [ ] Relays switching properly
- [ ] WiFi connection stable
- [ ] WebSocket communication working
- [ ] Status indicators functioning
- [ ] Fault detection working
- [ ] Configuration button working

