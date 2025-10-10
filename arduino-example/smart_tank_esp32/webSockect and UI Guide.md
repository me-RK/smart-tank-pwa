stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  send(command) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(command);
      return true;
    }
    return false;
  }

  sendJSON(data) {
    return this.send(JSON.stringify(data));
  }

  disconnect() {
    this.stopPolling();
    this.ws?.close();
    this.listeners.clear();
  }
}

// Usage
const monitor = new RealtimeMonitor();

monitor.on('connected', () => {
  console.log('Device connected!');
  updateUI({ connected: true });
});

monitor.on('homeData', (data) => {
  updateDashboard(data);
});

monitor.on('motorState', (data) => {
  showNotification(`Motor ${data.motor} turned ${data.state}`);
  updateMotorButton(data.motor, data.state);
});

monitor.connect('192.168.1.100');
```

---

## 🎨 UI/UX Design Guidelines

### Recommended Pages Structure

#### 1. **Dashboard (Home)**
**Purpose:** Real-time monitoring and quick controls

**Key Elements:**
- Connection status indicator (green/red dot)
- Current system mode (Manual/Auto) with toggle
- Tank level displays (circular gauges or bar charts)
- Motor controls (ON/OFF switches with status)
- Last update timestamp
- Automation reason display (in Auto mode)
- Quick access to settings

**Data Source:** `getHomeData` every 2 seconds

**Layout Suggestion:**
```
┌─────────────────────────────────────┐
│  🟢 Connected    Manual Mode  ⚙️    │
├─────────────────────────────────────┤
│  ╔═══════╗  ╔═══════╗  ╔═══════╗   │
│  ║ 75.5% ║  ║ 45.2% ║  ║ 80.1% ║   │
│  ║Upper A║  ║Lower A║  ║Upper B║   │
│  ╚═══════╝  ╚═══════╝  ╚═══════╝   │
├─────────────────────────────────────┤
│  Motor 1: ⚫ OFF → [TURN ON]         │
│  Reason: Lower Tank A < Threshold   │
│                                     │
│  Motor 2: 🟢 ON  → [TURN OFF]       │
│  Reason: Upper Tank B < Min Limit   │
└─────────────────────────────────────┘
```

#### 2. **Settings Page**
**Purpose:** Configure all system parameters

**Tabs/Sections:**

**A. System Configuration**
- System Mode: Radio buttons (Manual/Auto)
- Motor Configuration: Dropdown
  - Single Tank, Single Motor
  - Single Tank, Dual Motor
  - Dual Tank, Dual Motor
- For Dual Motor: Sync Mode dropdown
  - Simultaneous
  - Alternate
  - Primary/Backup
- Motor Enable checkboxes (Motor 1, Motor 2)

**B. Tank A Configuration**
- Upper Tank Dimensions (Height, Full Level, Empty Level) in cm
- Lower Tank Dimensions (Height, Full Level, Empty Level) in cm
- Automation Settings:
  - Enable Automation checkbox
  - Min Auto Value (% slider: 0-100)
  - Max Auto Value (% slider: 0-100)
  - Lower Threshold (% slider: 0-100)
  - Lower Overflow (% slider: 0-100)
- Sensor Enable (Upper A, Lower A checkboxes)

**C. Tank B Configuration**
- (Same structure as Tank A)

**D. Safety & Features**
- Upper Tank Overflow Lock (checkbox)
- Lower Tank Overflow Lock (checkbox)
- Buzzer Alerts (checkbox)
- Sync Both Tanks (legacy, checkbox)

**Data Source:** `getSettingData` on page load

**Save Action:** Send complete config JSON via WebSocket

**Layout Suggestion:**
```
┌─────────────────────────────────────┐
│ Settings                      [Save]│
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐   │
│ │ System Configuration          │   │
│ │                               │   │
│ │ Mode: ⚪ Manual  ⚫ Auto       │   │
│ │                               │   │
│ │ Motor Config: [Dropdown ▼]    │   │
│ │ └─> Single Tank, Single Motor │   │
│ │                               │   │
│ │ ☑ Enable Motor 1              │   │
│ │ ☑ Enable Motor 2              │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ Tank A - Automation           │   │
│ │                               │   │
│ │ ☑ Enable Automation           │   │
│ │                               │   │
│ │ Min Level:  ━━━━━⚫━━━━  50%  │   │
│ │ Max Level:  ━━━━━━━━⚫━  90%  │   │
│ │                               │   │
│ │ ☑ Upper Sensor A              │   │
│ │ ☑ Lower Sensor A              │   │
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### 3. **Tank Calibration Page**
**Purpose:** Set tank dimensions with visual guides

**Features:**
- Visual diagram showing sensor placement
- Input fields with real-time validation
- "Test Reading" button to show current raw sensor value
- Calculated percentage preview
- Save per tank

**Visual Guide:**
```
    Sensor mounted here
           ↓
    ┌─────────────┐  ← Tank Top (e.g., 75cm)
    │             │
    │~~~~~~~~~~~~~│  ← Full Level (e.g., 70cm)
    │~~~~~~~~~~~~~│
    │~~~~~~~~~~~~~│
    │~~~~~~~~~~~~~│
    │             │  ← Empty Level (e.g., 5cm)
    └─────────────┘  ← Tank Bottom (0cm)
```

**Data Source:** 
- `getSettingData` for current dimensions
- `getSensorData` for test readings

#### 4. **Diagnostics Page**
**Purpose:** Troubleshooting and monitoring

**Sections:**

**A. Connection Info**
- Device IP Address
- MAC Address
- WiFi Mode (AP/STA)
- WiFi SSID
- Signal Strength (RSSI with quality indicator)
- WebSocket Status

**B. Raw Sensor Data**
- Upper Tank A: XXX mm → XX.X%
- Upper Tank B: XXX mm → XX.X%
- Lower Tank A: XXX mm → XX.X%
- Lower Tank B: XXX mm → XX.X%
- Last ESP-NOW Update: XX.X seconds ago

**C. System Status**
- Firmware Version: v3.0
- Uptime: XX:XX:XX
- Free Memory: XXXX bytes
- NVS Free Entries: XXX

**D. Action Buttons**
- Restart Device
- Export Configuration (JSON download)
- Import Configuration (JSON upload)

**Data Sources:**
- `getWiFiConfig` for connection info
- `getSensorData` for sensor readings
- `getHomeData` for uptime

#### 5. **History/Logs Page** (Future Enhancement)
**Purpose:** View historical data and events

**Features:**
- Water level charts (24 hours, 7 days, 30 days)
- Motor runtime statistics
- Automation events log
- Alert history

---

## 🎨 UI Component Examples

### Tank Level Display Component

```jsx
const TankLevelDisplay = ({ label, level, enabled, sensor }) => {
  const getColor = (level) => {
    if (level < 20) return '#dc3545'; // Red
    if (level < 50) return '#ffc107'; // Yellow
    return '#28a745'; // Green
  };

  const getStatusText = () => {
    if (!enabled) return 'Sensor Disabled';
    if (!sensor) return 'No Data';
    if (level < 20) return 'Critical Low';
    if (level < 40) return 'Low';
    if (level < 70) return 'Normal';
    if (level < 90) return 'Good';
    return 'Full';
  };

  return (
    <div className="tank-display">
      <div className="tank-label">{label}</div>
      
      {/* Circular Progress */}
      <svg viewBox="0 0 100 100" className="tank-gauge">
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke="#e9ecef"
          strokeWidth="8"
        />
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke={enabled ? getColor(level) : '#ccc'}
          strokeWidth="8"
          strokeDasharray={`${level * 2.51} 251`}
          strokeDashoffset="62.75"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        <text
          x="50" y="50"
          textAnchor="middle"
          dominantBaseline="middle"
          className="tank-percentage"
          fill={enabled ? getColor(level) : '#6c757d'}
        >
          {enabled ? `${level.toFixed(1)}%` : '--'}
        </text>
      </svg>

      <div className="tank-status" style={{ color: getColor(level) }}>
        {getStatusText()}
      </div>
    </div>
  );
};
```

### Motor Control Component

```jsx
const MotorControl = ({ motorNum, state, enabled, reason, onToggle, systemMode }) => {
  const isOn = state === 'ON';
  const canControl = enabled && systemMode === 'Manual Mode';

  return (
    <div className={`motor-control ${isOn ? 'active' : ''}`}>
      <div className="motor-header">
        <h3>Motor {motorNum}</h3>
        <div className={`status-indicator ${isOn ? 'on' : 'off'}`}>
          {isOn ? '🟢 ON' : '⚫ OFF'}
        </div>
      </div>

      {enabled ? (
        <>
          <button
            className={`motor-button ${isOn ? 'stop' : 'start'}`}
            onClick={() => onToggle(motorNum, state)}
            disabled={!canControl}
            style={{
              backgroundColor: isOn ? '#dc3545' : '#28a745',
              cursor: canControl ? 'pointer' : 'not-allowed',
              opacity: canControl ? 1 : 0.6
            }}
          >
            {isOn ? 'TURN OFF' : 'TURN ON'}
          </button>

          {systemMode === 'Auto Mode' && (
            <div className="automation-info">
              <small>🤖 Auto: {reason}</small>
            </div>
          )}

          {!canControl && systemMode === 'Auto Mode' && (
            <div className="warning-message">
              <small>⚠️ Switch to Manual Mode to control</small>
            </div>
          )}
        </>
      ) : (
        <div className="motor-disabled">
          <p>Motor {motorNum} is disabled in configuration</p>
        </div>
      )}
    </div>
  );
};
```

### Connection Status Component

```jsx
const ConnectionStatus = ({ connected, ip, rssi }) => {
  const getSignalQuality = (rssi) => {
    if (rssi > -50) return { level: 'Excellent', bars: 4 };
    if (rssi > -60) return { level: 'Good', bars: 3 };
    if (rssi > -70) return { level: 'Fair', bars: 2 };
    return { level: 'Weak', bars: 1 };
  };

  const signal = rssi ? getSignalQuality(rssi) : null;

  return (
    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
      <div className="status-dot" />
      <span className="status-text">
        {connected ? 'Connected' : 'Disconnected'}
      </span>
      
      {connected && ip && (
        <span className="device-ip">
          📡 {ip}
        </span>
      )}

      {connected && signal && (
        <span className="signal-strength">
          {'📶'.repeat(signal.bars)} {signal.level}
        </span>
      )}
    </div>
  );
};
```

### System Mode Toggle Component

```jsx
const SystemModeToggle = ({ currentMode, onChange, disabled }) => {
  const isAuto = currentMode === 'Auto Mode';

  return (
    <div className="mode-toggle-container">
      <label className="mode-label">System Mode</label>
      
      <div className="toggle-switch">
        <button
          className={`toggle-option ${!isAuto ? 'active' : ''}`}
          onClick={() => onChange('Manual Mode')}
          disabled={disabled}
        >
          🎮 Manual
        </button>
        <button
          className={`toggle-option ${isAuto ? 'active' : ''}`}
          onClick={() => onChange('Auto Mode')}
          disabled={disabled}
        >
          🤖 Auto
        </button>
      </div>

      <div className="mode-description">
        {isAuto ? (
          <small>✓ System automatically manages water levels</small>
        ) : (
          <small>✓ You have full manual control of motors</small>
        )}
      </div>
    </div>
  );
};
```

### Settings Form Component

```jsx
const SettingsForm = ({ settings, onSave }) => {
  const [formData, setFormData] = useState(settings);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      setIsDirty(false);
      alert('Settings saved successfully!');
    } catch (error) {
      alert('Error saving settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-form">
      <div className="form-header">
        <h2>System Settings</h2>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="save-button"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* System Configuration */}
      <section className="form-section">
        <h3>System Configuration</h3>
        
        <div className="form-group">
          <label>System Mode</label>
          <select
            value={formData.systemMode}
            onChange={(e) => handleChange('systemMode', e.target.value)}
          >
            <option value="Manual Mode">Manual Mode</option>
            <option value="Auto Mode">Auto Mode</option>
          </select>
        </div>

        <div className="form-group">
          <label>Motor Configuration</label>
          <select
            value={formData.motorConfig}
            onChange={(e) => handleChange('motorConfig', e.target.value)}
          >
            <option value="SINGLE_TANK_SINGLE_MOTOR">Single Tank, Single Motor</option>
            <option value="SINGLE_TANK_DUAL_MOTOR">Single Tank, Dual Motor</option>
            <option value="DUAL_TANK_DUAL_MOTOR">Dual Tank, Dual Motor</option>
          </select>
        </div>

        {formData.motorConfig === 'SINGLE_TANK_DUAL_MOTOR' && (
          <div className="form-group">
            <label>Dual Motor Sync Mode</label>
            <select
              value={formData.dualMotorSyncMode}
              onChange={(e) => handleChange('dualMotorSyncMode', e.target.value)}
            >
              <option value="SIMULTANEOUS">Simultaneous</option>
              <option value="ALTERNATE">Alternate</option>
              <option value="PRIMARY_BACKUP">Primary/Backup</option>
            </select>
          </div>
        )}

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.motor1Enabled}
              onChange={(e) => handleChange('motor1Enabled', e.target.checked)}
            />
            Enable Motor 1
          </label>
          <label>
            <input
              type="checkbox"
              checked={formData.motor2Enabled}
              onChange={(e) => handleChange('motor2Enabled', e.target.checked)}
            />
            Enable Motor 2
          </label>
        </div>
      </section>

      {/* Tank A Configuration */}
      <section className="form-section">
        <h3>Tank A Configuration</h3>
        
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={formData.tankAAutomationEnabled}
              onChange={(e) => handleChange('tankAAutomationEnabled', e.target.checked)}
            />
            Enable Tank A Automation
          </label>
        </div>

        <div className="slider-group">
          <label>Minimum Auto Level: {formData.minAutoValueA}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={formData.minAutoValueA}
            onChange={(e) => handleChange('minAutoValueA', parseFloat(e.target.value))}
          />
        </div>

        <div className="slider-group">
          <label>Maximum Auto Level: {formData.maxAutoValueA}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={formData.maxAutoValueA}
            onChange={(e) => handleChange('maxAutoValueA', parseFloat(e.target.value))}
          />
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.upperSensorAEnabled}
              onChange={(e) => handleChange('upperSensorAEnabled', e.target.checked)}
            />
            Upper Sensor A
          </label>
          <label>
            <input
              type="checkbox"
              checked={formData.lowerSensorAEnabled}
              onChange={(e) => handleChange('lowerSensorAEnabled', e.target.checked)}
            />
            Lower Sensor A
          </label>
        </div>
      </section>

      {/* Repeat for Tank B if needed */}
      
      {/* Safety Features */}
      <section className="form-section">
        <h3>Safety Features</h3>
        
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.upperTankOverFlowLock}
              onChange={(e) => handleChange('upperTankOverFlowLock', e.target.checked)}
            />
            Upper Tank Overflow Protection
          </label>
          <label>
            <input
              type="checkbox"
              checked={formData.lowerTankOverFlowLock}
              onChange={(e) => handleChange('lowerTankOverFlowLock', e.target.checked)}
            />
            Lower Tank Overflow Protection
          </label>
          <label>
            <input
              type="checkbox"
              checked={formData.buzzerAlert}
              onChange={(e) => handleChange('buzzerAlert', e.target.checked)}
            />
            Buzzer Alerts
          </label>
        </div>
      </section>

      {isDirty && (
        <div className="unsaved-warning">
          ⚠️ You have unsaved changes
        </div>
      )}
    </div>
  );
};
```

---

## 🔔 Notification System

### Recommended Notifications

```javascript
const NotificationTypes = {
  // Motor Events
  MOTOR_ON: {
    type: 'success',
    icon: '🟢',
    message: (motor) => `Motor ${motor} turned ON`
  },
  MOTOR_OFF: {
    type: 'info',
    icon: '⚫',
    message: (motor) => `Motor ${motor} turned OFF`
  },

  // Water Level Alerts
  TANK_LOW: {
    type: 'warning',
    icon: '⚠️',
    message: (tank) => `${tank} water level is low (<20%)`
  },
  TANK_CRITICAL: {
    type: 'error',
    icon: '🚨',
    message: (tank) => `${tank} water level is critical (<10%)`
  },
  TANK_FULL: {
    type: 'success',
    icon: '💧',
    message: (tank) => `${tank} is full`
  },

  // Connection Events
  CONNECTED: {
    type: 'success',
    icon: '🟢',
    message: () => 'Connected to device'
  },
  DISCONNECTED: {
    type: 'error',
    icon: '🔴',
    message: () => 'Disconnected from device'
  },
  RECONNECTING: {
    type: 'warning',
    icon: '🔄',
    message: (attempt) => `Reconnecting... (${attempt}/5)`
  },

  // Configuration Events
  SETTINGS_SAVED: {
    type: 'success',
    icon: '✅',
    message: () => 'Settings saved successfully'
  },
  SETTINGS_ERROR: {
    type: 'error',
    icon: '❌',
    message: (error) => `Error saving settings: ${error}`
  },

  // System Events
  MODE_CHANGED: {
    type: 'info',
    icon: '🔄',
    message: (mode) => `System mode changed to ${mode}`
  },
  DEVICE_RESTARTING: {
    type: 'warning',
    icon: '🔄',
    message: () => 'Device is restarting...'
  }
};

// Notification Component
const Notification = ({ type, icon, message, onClose }) => (
  <div className={`notification notification-${type}`}>
    <span className="notification-icon">{icon}</span>
    <span className="notification-message">{message}</span>
    <button className="notification-close" onClick={onClose}>×</button>
  </div>
);
```

---

## 📱 Responsive Design Breakpoints

```css
/* Mobile First Approach */

/* Small devices (phones, up to 640px) */
@media (max-width: 640px) {
  .tank-display {
    width: 100%;
    margin-bottom: 20px;
  }
  
  .motor-control {
    width: 100%;
  }
  
  .settings-form {
    padding: 15px;
  }
}

/* Medium devices (tablets, 641px to 1024px) */
@media (min-width: 641px) and (max-width: 1024px) {
  .tank-display {
    width: 48%;
    display: inline-block;
  }
  
  .motor-control {
    width: 48%;
    display: inline-block;
  }
}

/* Large devices (desktops, 1025px and up) */
@media (min-width: 1025px) {
  .tank-display {
    width: 23%;
    display: inline-block;
  }
  
  .motor-control {
    width: 48%;
    display: inline-block;
  }
  
  .settings-form {
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

---

## 🎯 Complete WebSocket Manager Class

```javascript
class SmartTankWebSocket {
  constructor(ip) {
    this.ip = ip;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.pollingInterval = null;
    this.listeners = new Map();
    this.connected = false;
    this.lastHomeData = null;
    this.lastSettings = null;
  }

  // Connection Management
  connect() {
    this.ws = new WebSocket(`ws://${this.ip}:81`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.startPolling();
      this.requestHomeData();
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.connected = false;
      this.stopPolling();
      this.emit('disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.emit('reconnecting', this.reconnectAttempts);
      setTimeout(() => this.connect(), this.reconnectDelay);
    } else {
      this.emit('reconnectFailed');
    }
  }

  disconnect() {
    this.stopPolling();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  // Message Handling
  handleMessage(data) {
    if (data.type === 'homeData') {
      this.lastHomeData = data;
      this.emit('homeData', data);
    } else if (data.type === 'settingData') {
      this.lastSettings = data;
      this.emit('settingData', data);
    } else if (data.type === 'sensorData') {
      this.emit('sensorData', data);
    } else if (data.type === 'motorState') {
      // Update cached home data
      if (this.lastHomeData) {
        this.lastHomeData[`motor${data.motor}State`] = data.state;
        this.emit('homeData', this.lastHomeData);
      }
      this.emit('motorState', data);
    } else if (data.type === 'configUpdate') {
      this.emit('configUpdate', data);
    } else if (data.type === 'wifiConfigUpdate') {
      this.emit('wifiConfigUpdate', data);
    } else if (data.type === 'systemReset') {
      this.emit('systemReset', data);
    }
  }

  // Data Requests
  requestHomeData() {
    return this.send('getHomeData');
  }

  requestSettings() {
    return this.send('getSettingData');
  }

  requestSensorData() {
    return this.send('getSensorData');
  }

  requestWiFiConfig() {
    return this.send('getWiFiConfig');
  }

  // Motor Control
  turnMotorOn(motorNum) {
    return this.send(`motor${motorNum}On`);
  }

  turnMotorOff(motorNum) {
    return this.send(`motor${motorNum}Off`);
  }

  toggleMotor(motorNum, currentState) {
    return currentState === 'ON' ? 
      this.turnMotorOff(motorNum) : 
      this.turnMotorOn(motorNum);
  }

  // Configuration
  async updateSettings(settings) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for response'));
      }, 5000);

      const handler = (data) => {
        if (data.status === 'success') {
          clearTimeout(timeout);
          this.off('configUpdate', handler);
          resolve(data);
        } else {
          clearTimeout(timeout);
          this.off('configUpdate', handler);
          reject(new Error(data.message || 'Configuration update failed'));
        }
      };

      this.on('configUpdate', handler);
      this.sendJSON(settings);
    });
  }

  // System Control
  restartDevice() {
    return this.send('systemReset');
  }

  // Polling
  startPolling(interval = 2000) {
    this.stopPolling();
    this.pollingInterval = setInterval(() => {
      if (this.connected) {
        this.requestHomeData();
      }
    }, interval);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Event System
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error in ${event} listener:`, e);
        }
      });
    }
  }

  // Low-level Send
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      return true;
    }
    console.warn('WebSocket not connected');
    return false;
  }

  sendJSON(data) {
    return this.send(JSON.stringify(data));
  }

  // Getters
  isConnected() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  getLastHomeData() {
    return this.lastHomeData;
  }

  getLastSettings() {
    return this.lastSettings;
  }
}

// Usage Example
const tank = new SmartTankWebSocket('192.168.1.100');

tank.on('connected', () => {
  console.log('Connected!');
  showNotification('Connected to device', 'success');
});

tank.on('homeData', (data) => {
  updateDashboard(data);
});

tank.on('motorState', (data) => {
  showNotification(`Motor ${data.motor} turned ${data.state}`, 'info');
});

tank.on('reconnecting', (attempt) => {
  showNotification(`Reconnecting... (${attempt}/5)`, 'warning');
});

tank.connect();

// Motor control
document.getElementById('motor1-toggle').addEventListener('click', () => {
  const currentState = tank.getLastHomeData()?.motor1State;
  tank.toggleMotor(1, currentState);
});

// Save settings
document.getElementById('save-settings').addEventListener('click', async () => {
  try {
    const settings = getFormData();
    await tank.updateSettings(settings);
    showNotification('Settings saved successfully!', 'success');
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
});
```

---

## 🎨 Color Scheme Recommendations

### Modern Dark Theme
```css
:root {
  /* Primary Colors */
  --primary-blue: #4a90e2;
  --primary-green: #7ed321;
  --primary-red: #d0021b;
  
  /* Background Colors */
  --bg-dark: #1a1d23;
  --bg-medium: #2d3139;
  --bg-light: #3a3f4b;
  
  /* Text Colors */
  --text-primary: #ffffff;
  --text-secondary: #b4b9c5;
  --text-muted: #6c757d;
  
  /* Status Colors */
  --success: #28a745;
  --warning: #ffc107;
  --error: #dc3545;
  --info: #17a2b8;
  
  /* Tank Level Colors */
  --level-full: #28a745;
  --level-good: #7ed321;
  --level-normal: #ffc107;
  --level-low: #ff6b6b;
  --level-critical: #dc3545;
  
  /* Accent Colors */
  --accent-blue: #007bff;
  --accent-purple: #764ba2;
  --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Light Theme Alternative
```css
:root[data-theme="light"] {
  --bg-dark: #ffffff;
  --bg-medium: #f8f9fa;
  --bg-light: #e9ecef;
  
  --text-primary: #212529;
  --text-secondary: #495057;
  --text-muted: #6c757d;
}
```

---

## 📊 Data Visualization Examples

### Real-time Line Chart (for History Page)

```javascript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const WaterLevelChart = ({ data }) => {
  // data format: [{ time: '12:00', upperA: 75, lowerA: 45, upperB: 80, lowerB: 50 }]
  
  return (
    <LineChart width={800} height={400} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="time" />
      <YAxis domain={[0, 100]} label={{ value: 'Water Level (%)', angle: -90 }} />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="upperA" stroke="#4a90e2" name="Upper Tank A" />
      <Line type="monotone" dataKey="lowerA" stroke="#7ed321" name="Lower Tank A" />
      <Line type="monotone" dataKey="upperB" stroke="#ff6b6b" name="Upper Tank B" />
      <Line type="monotone" dataKey="lowerB" stroke="#ffc107" name="Lower Tank B" />
    </LineChart>
  );
};
```

---

## 🔐 Error Handling & Validation

### Validation Helper Functions

```javascript
class Validator {
  static validatePercentage(value, fieldName) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`${fieldName} must be a number`);
    }
    if (num < 0 || num > 100) {
      throw new Error(`${fieldName} must be between 0 and 100`);
    }
    return num;
  }

  static validateTankHeight(value, fieldName) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`${fieldName} must be a number`);
    }
    if (num < 1 || num > 500) {
      throw new Error(`${fieldName} must be between 1 and 500 cm`);
    }
    return num;
  }

  static validateTankDimensions(tankHeight, fullHeight, emptyHeight) {
    if (fullHeight >= tankHeight) {
      throw new Error('Full height must be less than tank height');
    }
    if (emptyHeight >= tankHeight) {
      throw new Error('Empty height must be less than tank height');
    }
    if (fullHeight <= emptyHeight) {
      throw new Error('Full height must be greater than empty height');
    }
    return true;
  }

  static validateAutoValues(min, max) {
    if (min >= max) {
      throw new Error('Minimum auto value must be less than maximum');
    }
    return true;
  }

  static validateMotorConfig(config) {
    const validConfigs = [
      'SINGLE_TANK_SINGLE_MOTOR',
      'SINGLE_TANK_DUAL_MOTOR',
      'DUAL_TANK_DUAL_MOTOR'
    ];
    if (!validConfigs.includes(config)) {
      throw new Error('Invalid motor configuration');
    }
    return true;
  }

  static validateSyncMode(mode) {
    const validModes = ['SIMULTANEOUS', 'ALTERNATE', 'PRIMARY_BACKUP'];
    if (!validModes.includes(mode)) {
      throw new Error('Invalid sync mode');
    }
    return true;
  }

  static validateSettings(settings) {
    const errors = [];

    try {
      // Validate system mode
      if (!['Manual Mode', 'Auto Mode'].includes(settings.systemMode)) {
        errors.push('Invalid system mode');
      }

      // Validate motor configuration
      this.validateMotorConfig(settings.motorConfig);

      // Validate Tank A settings
      if (settings.tankAAutomationEnabled) {
        this.validatePercentage(settings.minAutoValueA, 'Tank A Min Auto Value');
        this.validatePercentage(settings.maxAutoValueA, 'Tank A Max Auto Value');
        this.validateAutoValues(settings.minAutoValueA, settings.maxAutoValueA);
      }

      // Validate Tank B settings
      if (settings.tankBAutomationEnabled) {
        this.validatePercentage(settings.minAutoValueB, 'Tank B Min Auto Value');
        this.validatePercentage(settings.maxAutoValueB, 'Tank B Max Auto Value');
        this.validateAutoValues(settings.minAutoValueB, settings.maxAutoValueB);
      }

      // Validate tank dimensions
      this.validateTankHeight(settings.upperTankHeightA, 'Upper Tank A Height');
      this.validateTankHeight(settings.lowerTankHeightA, 'Lower Tank A Height');
      this.validateTankDimensions(
        settings.upperTankHeightA,
        settings.upperWaterFullHeightA,
        settings.upperWaterEmptyHeightA
      );

      // Similar validation for Tank B...

    } catch (error) {
      errors.push(error.message);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Usage in form submission
const handleSaveSettings = async (formData) => {
  const validation = Validator.validateSettings(formData);
  
  if (!validation.valid) {
    showErrors(validation.errors);
    return;
  }

  try {
    await tank.updateSettings(formData);
    showNotification('Settings saved successfully!', 'success');
  } catch (error) {
    showNotification('Error saving settings: ' + error.message, 'error');
  }
};
```

---

## 🚀 Advanced Features Implementation

### 1. Auto-Discovery of Devices

```javascript
class DeviceDiscovery {
  static async scanNetwork(subnet = '192.168.1') {
    const devices = [];
    const promises = [];

    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      promises.push(this.checkDevice(ip));
    }

    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        devices.push(result.value);
      }
    });

    return devices;
  }

  static async checkDevice(ip) {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://${ip}:81`);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(null);
      }, 2000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.send('getSettingData');
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'settingData') {
              resolve({
                ip,
                macAddress: data.macAddress,
                systemMode: data.systemMode
              });
            }
          } catch (e) {
            resolve(null);
          }
          ws.close();
        };
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
    });
  }
}

// Usage
const devices = await DeviceDiscovery.scanNetwork('192.168.1');
console.log('Found devices:', devices);
```

### 2. Data Export/Import

```javascript
class ConfigManager {
  static exportConfig(settings) {
    const config = {
      version: '3.0',
      timestamp: new Date().toISOString(),
      settings: settings
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-tank-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async importConfig(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target.result);
          
          if (config.version !== '3.0') {
            reject(new Error('Invalid configuration version'));
            return;
          }

          resolve(config.settings);
        } catch (error) {
          reject(new Error('Invalid configuration file'));
        }
      };

      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  }
}

// Usage
document.getElementById('export-btn').addEventListener('click', () => {
  const settings = tank.getLastSettings();
  ConfigManager.exportConfig(settings);
});

document.getElementById('import-input').addEventListener('change', async (e) => {
  try {
    const file = e.target.files[0];
    const settings = await ConfigManager.importConfig(file);
    
    if (confirm('This will overwrite current settings. Continue?')) {
      await tank.updateSettings(settings);
      showNotification('Configuration imported successfully!', 'success');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
});
```

### 3. Offline Mode Support

```javascript
class OfflineManager {
  constructor() {
    this.db = null;
    this.initDB();
  }

  async initDB() {
    // Using IndexedDB for offline storage
    const request = indexedDB.open('SmartTankDB', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('readings')) {
        const store = db.createObjectStore('readings', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      this.db = event.target.result;
      console.log('IndexedDB initialized');
    };
  }

  async saveReading(data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['readings'], 'readwrite');
      const store = transaction.objectStore('readings');
      
      const reading = {
        timestamp: Date.now(),
        data: data
      };

      const request = store.add(reading);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getReadings(limit = 100) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['readings'], 'readonly');
      const store = transaction.objectStore('readings');
      const index = store.index('timestamp');
      
      const readings = [];
      const request = index.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && readings.length < limit) {
          readings.push(cursor.value);
          cursor.continue();
        } else {
          resolve(readings);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async saveSettings(settings) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      const data = {
        id: 'current',
        settings: settings,
        timestamp: Date.now()
      };

      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSettings() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('current');

      request.onsuccess = (event) => {
        resolve(event.target.result?.settings || null);
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Usage with WebSocket manager
const offline = new OfflineManager();

tank.on('homeData', async (data) => {
  // Save to offline storage
  await offline.saveReading(data);
  updateDashboard(data);
});

tank.on('settingData', async (data) => {
  await offline.saveSettings(data);
});

// Load offline data when disconnected
tank.on('disconnected', async () => {
  const lastReadings = await offline.getReadings(10);
  if (lastReadings.length > 0) {
    updateDashboard(lastReadings[0].data);
    showNotification('Showing last known data (offline)', 'warning');
  }
});
```

---

## 📱 PWA (Progressive Web App) Setup

### manifest.json

```json
{
  "name": "Smart Water Tank Manager",
  "short_name": "WaterTank",
  "description": "Control and monitor your smart water tank system",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1d23",
  "theme_color": "#667eea",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker (sw.js)

```javascript
const CACHE_NAME = 'smart-tank-v3.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```

### Register Service Worker

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration);
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}
```

---

## 🎯 Complete App Structure Recommendation

```
smart-tank-web-app/
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
│       ├── icon-72x72.png
│       ├── icon-96x96.png
│       ├── icon-128x128.png
│       ├── icon-144x144.png
│       ├── icon-192x192.png
│       └── icon-512x512.png
├── src/
│   ├── App.jsx                    // Main app component
│   ├── index.jsx                  // Entry point
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TankDisplay.jsx
│   │   │   ├── MotorControl.jsx
│   │   │   └── ConnectionStatus.jsx
│   │   ├── Settings/
│   │   │   ├── Settings.jsx
│   │   │   ├── SystemConfig.jsx
│   │   │   ├── TankConfig.jsx
│   │   │   └── SafetyConfig.jsx
│   │   ├── Calibration/
│   │   │   ├── Calibration.jsx
│   │   │   ├── TankDiagram.jsx
│   │   │   └── SensorTest.jsx
│   │   ├── Diagnostics/
│   │   │   ├── Diagnostics.jsx
│   │   │   ├── ConnectionInfo.jsx
│   │   │   ├── SensorData.jsx
│   │   │   └── SystemStatus.jsx
│   │   ├── History/
│   │   │   ├── History.jsx
│   │   │   ├── WaterLevelChart.jsx
│   │   │   └── EventLog.jsx
│   │   ├── Common/
│   │   │   ├── Notification.jsx
│   │   │   ├── Loading.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── Button.jsx
│   │   └── Layout/
│   │       ├── Header.jsx
│   │       ├── Sidebar.jsx
│   │       └── Footer.jsx
│   ├── services/
│   │   ├── WebSocketService.js    // WebSocket manager
│   │   ├── StorageService.js      // Local/IndexedDB storage
│   │   ├── ValidationService.js   // Form validation
│   │   └── ConfigService.js       // Config import/export
│   ├── hooks/
│   │   ├── useWebSocket.js        // WebSocket hook
│   │   ├── useSettings.js         // Settings management hook
│   │   ├── useNotification.js     // Notification hook
│   │   └── useOffline.js          // Offline mode hook
│   ├── utils/
│   │   ├── formatters.js          // Data formatting
│   │   ├── validators.js          // Validation helpers
│   │   └── constants.js           // App constants
│   ├── styles/
│   │   ├── global.css
│   │   ├── variables.css
│   │   ├── components.css
│   │   └── responsive.css
│   └── context/
│       ├── AppContext.jsx         // Global app state
│       └── ThemeContext.jsx       // Theme management
├── package.json
└── README.md
```

---

## 🎓 Quick Start Guide for Cursor AI

### Step 1: Create WebSocket Service

```javascript
// src/services/WebSocketService.js
// Copy the SmartTankWebSocket class from above
```

### Step 2: Create Custom Hook

```javascript
// src/hooks/useWebSocket.js
import { useState, useEffect, useRef } from 'react';
import { SmartTankWebSocket } from '../services/WebSocketService';

export const useWebSocket = (ip) => {
  const [connected, setConnected] = useState(false);
  const [homeData, setHomeData] = useState(null);
  const [settings, setSettings] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new SmartTankWebSocket(ip);

    ws.current.on('connected', () => setConnected(true));
    ws.current.on('disconnected', () => setConnected(false));
    ws.current.on('homeData', (data) => setHomeData(data));
    ws.current.on('settingData', (data) => setSettings(data));

    ws.current.connect();

    return () => ws.current.disconnect();
  }, [ip]);

  return {
    connected,
    homeData,
    settings,
    toggleMotor: (motorNum, state) => ws.current.toggleMotor(motorNum, state),
    updateSettings: (settings) => ws.current.updateSettings(settings),
    restartDevice: () => ws.current.restartDevice()
  };
};
```

### Step 3: Use in Component

```jsx
// src/components/Dashboard/Dashboard.jsx
import React from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import TankDisplay from './TankDisplay';
import MotorControl from './MotorControl';

const Dashboard = () => {
  const { connected, homeData, toggleMotor } = useWebSocket('192.168.1.100');

  if (!homeData) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <ConnectionStatus connected={connected} />
      
      <div className="tanks-grid">
        <TankDisplay 
          label="Upper Tank A"
          level={homeData.upperTankA}
          enabled={homeData.upperSensorAEnabled}
        />
        <TankDisplay 
          label="Lower Tank A"
          level={homeData.lowerTankA}
          enabled={homeData.lowerSensorAEnabled}
        />
      </div>

      <div className="motors-grid">
        {homeData.motor1Enabled && (
          <MotorControl
            motorNum={1}
            state={homeData.motor1State}
            reason={homeData.autoReasonMotor1}
            onToggle={toggleMotor}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
```

---

## ✅ Complete Checklist for Cursor AI

### Phase 1: Setup & Structure
- [ ] Create project structure
- [ ] Install dependencies (React, React Router, Recharts, etc.)
- [ ] Set up WebSocket service class
- [ ] Create custom hooks (useWebSocket, useSettings)
- [ ] Implement theme system (dark/light mode)

### Phase 2: Core Components
- [ ] Dashboard page with real-time data
- [ ] Tank level displays (circular gauges)
- [ ] Motor control switches
- [ ] Connection status indicator
- [ ] System mode toggle

### Phase 3: Settings & Configuration
- [ ] Settings page with all configuration options
- [ ] Form validation
- [ ] Save/load functionality
- [ ] Import/export configuration
- [ ] WiFi settings (if needed)

### Phase 4: Advanced Features
- [ ] Calibration page with visual guides
- [ ] Diagnostics page
- [ ] Raw sensor data display
- [ ] History/charts page
- [ ] Notification system

### Phase 5: Polish & PWA
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Offline mode support
- [ ] Service worker registration
- [ ] PWA manifest
- [ ] Error handling & loading states

---

## 🎉 Summary

This complete WebSocket API documentation provides:

1. ✅ **All Commands** with exact syntax and examples
2. ✅ **All Responses** with complete field descriptions
3. ✅ **Implementation Examples** for React/JavaScript
4. ✅ **UI/UX Guidelines** with component examples
5. ✅ **Complete WebSocket Manager** class ready to use
6. ✅ **Validation & Error Handling** helpers
7. ✅ **Advanced Features** (offline, export/import, PWA)
8. ✅ **Project Structure** recommendation
9. ✅ **Quick Start Guide** for Cursor AI
10. ✅ **Complete Checklist** for development

**Everything Cursor AI needs to build a professional, modern web app!** 🚀# Smart Water Tank v3.0 - Complete WebSocket API Documentation

## 📡 WebSocket Connection

### Connection Details
```javascript
// WebSocket URL format
const wsUrl = `ws://${deviceIP}:81`;

// Example
const ws = new WebSocket('ws://192.168.1.100:81');

// Connection events
ws.onopen = () => console.log('Connected to device');
ws.onclose = () => console.log('Disconnected from device');
ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleMessage(data);
};
```

### Connection States
- **CONNECTING (0)**: Connection is being established
- **OPEN (1)**: Connection is ready to send/receive
- **CLOSING (2)**: Connection is closing
- **CLOSED (3)**: Connection is closed

---

## 📤 Commands (Client → ESP32)

### 1. Get Home Dashboard Data

**Command:**
```javascript
ws.send('getHomeData');
```

**Response:**
```json
{
  "type": "homeData",
  "lastUpdate": "12.34",
  "systemMode": "Auto Mode",
  "motor1State": "ON",
  "motor2State": "OFF",
  "motor1Enabled": true,
  "motor2Enabled": false,
  "upperTankA": 75.5,
  "lowerTankA": 45.2,
  "upperTankB": 80.1,
  "lowerTankB": 50.3,
  "lowerSensorAEnabled": true,
  "lowerSensorBEnabled": false,
  "upperSensorAEnabled": true,
  "upperSensorBEnabled": false,
  "autoReasonMotor1": "Upper Tank A Level Maintained",
  "autoReasonMotor2": "Standby (Motor 1 Active)",
  "motorConfig": "SINGLE_TANK_SINGLE_MOTOR"
}
```

**Field Descriptions:**
| Field | Type | Description | Range/Values |
|-------|------|-------------|--------------|
| `type` | String | Message type identifier | `"homeData"` |
| `lastUpdate` | String | Seconds since last ESP-NOW update | `"0.00"` to `"429496729.0"` |
| `systemMode` | String | Current operation mode | `"Manual Mode"` or `"Auto Mode"` |
| `motor1State` | String | Motor 1 current state | `"ON"` or `"OFF"` |
| `motor2State` | String | Motor 2 current state | `"ON"` or `"OFF"` |
| `motor1Enabled` | Boolean | Motor 1 enabled in config | `true` or `false` |
| `motor2Enabled` | Boolean | Motor 2 enabled in config | `true` or `false` |
| `upperTankA` | Number | Upper Tank A water level % | `0.0` to `100.0` |
| `lowerTankA` | Number | Lower Tank A water level % | `0.0` to `100.0` |
| `upperTankB` | Number | Upper Tank B water level % | `0.0` to `100.0` |
| `lowerTankB` | Number | Lower Tank B water level % | `0.0` to `100.0` |
| `lowerSensorAEnabled` | Boolean | Lower sensor A active | `true` or `false` |
| `lowerSensorBEnabled` | Boolean | Lower sensor B active | `true` or `false` |
| `upperSensorAEnabled` | Boolean | Upper sensor A active | `true` or `false` |
| `upperSensorBEnabled` | Boolean | Upper sensor B active | `true` or `false` |
| `autoReasonMotor1` | String | Automation reason for motor 1 | See automation reasons below |
| `autoReasonMotor2` | String | Automation reason for motor 2 | See automation reasons below |
| `motorConfig` | String | Motor configuration mode | See motor config values below |

**Use Case:** Display real-time dashboard with tank levels, motor states, and system status.

---

### 2. Get System Settings

**Command:**
```javascript
ws.send('getSettingData');
```

**Response:**
```json
{
  "type": "settingData",
  "systemMode": "Auto Mode",
  "motorConfig": "DUAL_TANK_DUAL_MOTOR",
  "motor1Enabled": true,
  "motor2Enabled": true,
  "dualMotorSyncMode": "SIMULTANEOUS",
  "minAutoValueA": 50.0,
  "maxAutoValueA": 90.0,
  "lowerThresholdA": 30.0,
  "lowerOverflowA": 95.0,
  "minAutoValueB": 50.0,
  "maxAutoValueB": 90.0,
  "lowerThresholdB": 30.0,
  "lowerOverflowB": 95.0,
  "upperTankHeightA": 75.0,
  "upperWaterFullHeightA": 70.0,
  "upperWaterEmptyHeightA": 5.0,
  "lowerTankHeightA": 75.0,
  "lowerWaterFullHeightA": 70.0,
  "lowerWaterEmptyHeightA": 5.0,
  "upperTankHeightB": 75.0,
  "upperWaterFullHeightB": 70.0,
  "upperWaterEmptyHeightB": 5.0,
  "lowerTankHeightB": 75.0,
  "lowerWaterFullHeightB": 70.0,
  "lowerWaterEmptyHeightB": 5.0,
  "lowerSensorAEnabled": true,
  "lowerSensorBEnabled": false,
  "upperSensorAEnabled": true,
  "upperSensorBEnabled": false,
  "upperTankOverFlowLock": true,
  "lowerTankOverFlowLock": true,
  "syncBothTank": true,
  "buzzerAlert": true,
  "tankAAutomationEnabled": true,
  "tankBAutomationEnabled": false,
  "macAddress": [170, 187, 204, 221, 238, 255]
}
```

**Field Descriptions:**
| Field | Type | Description | Range/Values |
|-------|------|-------------|--------------|
| `type` | String | Message type | `"settingData"` |
| `systemMode` | String | Operation mode | `"Manual Mode"` or `"Auto Mode"` |
| `motorConfig` | String | Motor configuration | See motor config table |
| `motor1Enabled` | Boolean | Motor 1 enabled | `true`/`false` |
| `motor2Enabled` | Boolean | Motor 2 enabled | `true`/`false` |
| `dualMotorSyncMode` | String | Dual motor sync mode | See sync mode table |
| `minAutoValueA` | Number | Tank A min level for auto (%) | `0.0` to `100.0` |
| `maxAutoValueA` | Number | Tank A max level for auto (%) | `0.0` to `100.0` |
| `lowerThresholdA` | Number | Tank A lower threshold (%) | `0.0` to `100.0` |
| `lowerOverflowA` | Number | Tank A overflow threshold (%) | `0.0` to `100.0` |
| `minAutoValueB` | Number | Tank B min level for auto (%) | `0.0` to `100.0` |
| `maxAutoValueB` | Number | Tank B max level for auto (%) | `0.0` to `100.0` |
| `lowerThresholdB` | Number | Tank B lower threshold (%) | `0.0` to `100.0` |
| `lowerOverflowB` | Number | Tank B overflow threshold (%) | `0.0` to `100.0` |
| `upperTankHeightA` | Number | Upper Tank A total height (cm) | `1.0` to `500.0` |
| `upperWaterFullHeightA` | Number | Upper Tank A full level (cm) | `0.0` to `upperTankHeightA` |
| `upperWaterEmptyHeightA` | Number | Upper Tank A empty level (cm) | `0.0` to `upperTankHeightA` |
| `lowerTankHeightA` | Number | Lower Tank A total height (cm) | `1.0` to `500.0` |
| `lowerWaterFullHeightA` | Number | Lower Tank A full level (cm) | `0.0` to `lowerTankHeightA` |
| `lowerWaterEmptyHeightA` | Number | Lower Tank A empty level (cm) | `0.0` to `lowerTankHeightA` |
| *(Similar fields for Tank B)* | | | |
| `lowerSensorAEnabled` | Boolean | Lower sensor A enabled | `true`/`false` |
| `lowerSensorBEnabled` | Boolean | Lower sensor B enabled | `true`/`false` |
| `upperSensorAEnabled` | Boolean | Upper sensor A enabled | `true`/`false` |
| `upperSensorBEnabled` | Boolean | Upper sensor B enabled | `true`/`false` |
| `upperTankOverFlowLock` | Boolean | Upper tank overflow protection | `true`/`false` |
| `lowerTankOverFlowLock` | Boolean | Lower tank overflow protection | `true`/`false` |
| `syncBothTank` | Boolean | Sync both tanks (legacy) | `true`/`false` |
| `buzzerAlert` | Boolean | Buzzer alerts enabled | `true`/`false` |
| `tankAAutomationEnabled` | Boolean | Tank A automation enabled | `true`/`false` |
| `tankBAutomationEnabled` | Boolean | Tank B automation enabled | `true`/`false` |
| `macAddress` | Array[6] | Device MAC address | `[0-255, ...]` |

**Use Case:** Load settings page, display current configuration, prepare for editing.

---

### 3. Get Raw Sensor Data

**Command:**
```javascript
ws.send('getSensorData');
```

**Response:**
```json
{
  "type": "sensorData",
  "sensorUpperA": 1234,
  "sensorUpperB": 5678,
  "sensorLowerA": 910,
  "sensorLowerB": 1112,
  "upperTankAPercent": 75.5,
  "upperTankBPercent": 80.1,
  "lowerTankAPercent": 45.2,
  "lowerTankBPercent": 50.3,
  "wifiRSSI": -45
}
```

**Field Descriptions:**
| Field | Type | Description | Unit |
|-------|------|-------------|------|
| `type` | String | Message type | `"sensorData"` |
| `sensorUpperA` | Number | Raw sensor value (mm) | millimeters |
| `sensorUpperB` | Number | Raw sensor value (mm) | millimeters |
| `sensorLowerA` | Number | Raw sensor value (mm) | millimeters |
| `sensorLowerB` | Number | Raw sensor value (mm) | millimeters |
| `upperTankAPercent` | Number | Calculated percentage | `0.0` to `100.0` |
| `upperTankBPercent` | Number | Calculated percentage | `0.0` to `100.0` |
| `lowerTankAPercent` | Number | Calculated percentage | `0.0` to `100.0` |
| `lowerTankBPercent` | Number | Calculated percentage | `0.0` to `100.0` |
| `wifiRSSI` | Number | WiFi signal strength | `-100` to `0` dBm |

**Use Case:** Diagnostics page, sensor calibration, debugging sensor readings.

---

### 4. Get WiFi Configuration

**Command:**
```javascript
ws.send('getWiFiConfig');
```

**Response:**
```json
{
  "type": "wifiConfig",
  "wifiMode": "STA",
  "ssid": "MyHomeNetwork",
  "password": "mypassword123",
  "staticIP": "192.168.1.100",
  "gateway": "192.168.1.1",
  "subnet": "255.255.255.0",
  "primaryDNS": "8.8.8.8",
  "currentIP": "192.168.1.100"
}
```

**Field Descriptions:**
| Field | Type | Description |
|-------|------|-------------|
| `type` | String | Message type: `"wifiConfig"` |
| `wifiMode` | String | WiFi mode: `"AP"` or `"STA"` |
| `ssid` | String | Network name |
| `password` | String | WiFi password |
| `staticIP` | String | Configured static IP |
| `gateway` | String | Gateway address |
| `subnet` | String | Subnet mask |
| `primaryDNS` | String | Primary DNS server |
| `currentIP` | String | Current active IP address |

**Use Case:** WiFi settings page (though main WiFi config is via HTML page).

---

### 5. Motor Control Commands

#### Motor 1 ON
**Command:**
```javascript
ws.send('motor1On');
```

**Response:**
```json
{
  "type": "motorState",
  "motor": 1,
  "state": "ON"
}
```

#### Motor 1 OFF
**Command:**
```javascript
ws.send('motor1Off');
```

**Response:**
```json
{
  "type": "motorState",
  "motor": 1,
  "state": "OFF"
}
```

#### Motor 2 ON
**Command:**
```javascript
ws.send('motor2On');
```

**Response:**
```json
{
  "type": "motorState",
  "motor": 2,
  "state": "ON"
}
```

#### Motor 2 OFF
**Command:**
```javascript
ws.send('motor2Off');
```

**Response:**
```json
{
  "type": "motorState",
  "motor": 2,
  "state": "OFF"
}
```

**Field Descriptions:**
| Field | Type | Description |
|-------|------|-------------|
| `type` | String | Message type: `"motorState"` |
| `motor` | Number | Motor number: `1` or `2` |
| `state` | String | New state: `"ON"` or `"OFF"` |

**Note:** These commands work in both Manual and Auto modes. In Auto mode, automation may override manual commands.

**Use Case:** Manual motor control buttons on dashboard.

---

### 6. System Restart

**Command:**
```javascript
ws.send('systemReset');
```

**Response:**
```json
{
  "type": "systemReset",
  "status": "restarting"
}
```

**Behavior:** Device will restart in ~2 seconds. WebSocket will disconnect.

**Use Case:** Restart button in settings, apply configuration changes.

---

### 7. Update System Configuration

**Command:**
```javascript
const config = {
  systemMode: "Auto Mode",
  motorConfig: "DUAL_TANK_DUAL_MOTOR",
  motor1Enabled: true,
  motor2Enabled: true,
  dualMotorSyncMode: "SIMULTANEOUS",
  minAutoValueA: 50.0,
  maxAutoValueA: 90.0,
  lowerThresholdA: 30.0,
  lowerOverflowA: 95.0,
  minAutoValueB: 50.0,
  maxAutoValueB: 90.0,
  lowerThresholdB: 30.0,
  lowerOverflowB: 95.0,
  upperTankHeightA: 75.0,
  upperWaterFullHeightA: 70.0,
  upperWaterEmptyHeightA: 5.0,
  lowerTankHeightA: 75.0,
  lowerWaterFullHeightA: 70.0,
  lowerWaterEmptyHeightA: 5.0,
  upperTankHeightB: 75.0,
  upperWaterFullHeightB: 70.0,
  upperWaterEmptyHeightB: 5.0,
  lowerTankHeightB: 75.0,
  lowerWaterFullHeightB: 70.0,
  lowerWaterEmptyHeightB: 5.0,
  lowerSensorAEnabled: true,
  lowerSensorBEnabled: false,
  upperTankOverFlowLock: true,
  lowerTankOverFlowLock: true,
  syncBothTank: true,
  buzzerAlert: true,
  tankAAutomationEnabled: true,
  tankBAutomationEnabled: false
};

ws.send(JSON.stringify(config));
```

**Response:**
```json
{
  "type": "configUpdate",
  "status": "success",
  "message": "Configuration updated successfully"
}
```

**Important Notes:**
- You can send partial updates (only changed fields)
- ESP32 will only write to NVS if values actually change
- All numeric values are validated
- String values must match expected formats

**Field Requirements:**
| Field | Required | Default | Validation |
|-------|----------|---------|------------|
| `systemMode` | No | "Manual Mode" | Must be "Manual Mode" or "Auto Mode" |
| `motorConfig` | No | Current | See motor config table |
| `dualMotorSyncMode` | No | "SIMULTANEOUS" | See sync mode table |
| `motor1Enabled` | No | true | Boolean |
| `motor2Enabled` | No | false | Boolean |
| `minAutoValueA/B` | No | 50.0 | 0.0 to 100.0 |
| `maxAutoValueA/B` | No | 90.0 | 0.0 to 100.0, must be > min |
| `lowerThresholdA/B` | No | 30.0 | 0.0 to 100.0 |
| `lowerOverflowA/B` | No | 95.0 | 0.0 to 100.0 |
| Tank heights | No | 75.0 | 1.0 to 500.0 |
| Water levels | No | Varies | 0.0 to tank height |
| Sensor enables | No | false | Boolean |
| Automation enables | No | Varies | Boolean |
| Overflow locks | No | true | Boolean |
| `buzzerAlert` | No | true | Boolean |

**Use Case:** Save settings from configuration page.

---

### 8. Update WiFi Configuration (Config Mode Only)

**Command:**
```javascript
const wifiConfig = {
  MODE: "STA",
  SSID: "MyNetwork",
  PASS: "mypassword",
  SIP0: 192,
  SIP1: 168,
  SIP2: 1,
  SIP3: 100,
  SG0: 192,
  SG1: 168,
  SG2: 1,
  SG3: 1,
  SS0: 255,
  SS1: 255,
  SS2: 255,
  SS3: 0,
  SPD0: 8,
  SPD1: 8,
  SPD2: 8,
  SPD3: 8
};

ws.send(JSON.stringify(wifiConfig));
```

**Response:**
```json
{
  "type": "wifiConfigUpdate",
  "status": "success",
  "message": "WiFi configuration saved. Restart required."
}
```

**Field Descriptions:**
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `MODE` | String | "AP" or "STA" | Yes |
| `SSID` | String | Network name | Yes |
| `PASS` | String | Password (min 8 chars) | Yes |
| `SIP0-3` | Number | Static IP octets | No (for DHCP) |
| `SG0-3` | Number | Gateway octets | No |
| `SS0-3` | Number | Subnet mask octets | No |
| `SPD0-3` | Number | Primary DNS octets | No |

**Note:** This only works when device is in configuration mode or configMode flag is true.

---

## 📥 Broadcasts (ESP32 → Client)

### Motor State Change (Automatic)

**Trigger:** Any motor state change (manual or automatic)

**Message:**
```json
{
  "type": "motorState",
  "motor": 1,
  "state": "ON"
}
```

**Handling:**
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'motorState') {
    updateMotorUI(data.motor, data.state);
  }
};
```

**Use Case:** Real-time motor state updates without polling.

---

## 📊 Reference Tables

### Motor Configuration Values

| Value | Description | Use Case |
|-------|-------------|----------|
| `SINGLE_TANK_SINGLE_MOTOR` | One tank, one motor | Most common setup |
| `SINGLE_TANK_DUAL_MOTOR` | One tank, two motors | Redundancy or power boost |
| `DUAL_TANK_DUAL_MOTOR` | Two independent tanks | Separate tank systems |

### Dual Motor Sync Modes

| Value | Description | Behavior |
|-------|-------------|----------|
| `SIMULTANEOUS` | Both motors together | Run together, stop together |
| `ALTERNATE` | Motors alternate | Switch every hour |
| `PRIMARY_BACKUP` | Motor 1 primary | Motor 2 only if M1 fails |

### Automation Reasons (autoReasonMotor1/2)

**Normal Operation:**
- `"Upper Tank A Level Maintained"` - Level is within desired range
- `"Upper Tank A < Min Limit"` - Filling to reach minimum
- `"Upper Tank A > Max Limit"` - Stopped, tank is full enough
- `"Lower Tank A < Threshold"` - Stopped, source tank too low
- `"Lower Tank A Overflow - Pumping"` - Emergency pumping due to overflow

**Sync Modes:**
- `"Synced with Motor 1: [reason]"` - Simultaneous mode
- `"Standby (Motor 1 Active)"` - Alternate/backup mode
- `"Backup Mode: Upper A < Min"` - Backup motor activated

**Errors:**
- `"NONE"` - No automation active (Manual mode)
- `"Mode Error, Unknown Mode Selected"` - Configuration error

### WiFi Signal Strength (RSSI)

| Value | Quality | Description |
|-------|---------|-------------|
| `-30 to 0` | Excellent | Maximum performance |
| `-50 to -30` | Good | Reliable connection |
| `-60 to -50` | Fair | May have minor issues |
| `-70 to -60` | Weak | Prone to disconnections |
| `-100 to -70` | Very Weak | Connection problems |

---

## 💡 Implementation Examples

### Example 1: Complete Dashboard React Component

```jsx
import React, { useState, useEffect, useRef } from 'react';

const Dashboard = () => {
  const [connected, setConnected] = useState(false);
  const [homeData, setHomeData] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    // Connect to WebSocket
    ws.current = new WebSocket('ws://192.168.1.100:81');

    ws.current.onopen = () => {
      console.log('Connected');
      setConnected(true);
      // Request initial data
      ws.current.send('getHomeData');
    };

    ws.current.onclose = () => {
      console.log('Disconnected');
      setConnected(false);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'homeData') {
        setHomeData(data);
      } else if (data.type === 'motorState') {
        // Update motor state immediately
        setHomeData(prev => ({
          ...prev,
          [`motor${data.motor}State`]: data.state
        }));
      }
    };

    // Cleanup
    return () => ws.current?.close();
  }, []);

  // Poll for updates every 2 seconds
  useEffect(() => {
    if (!connected) return;
    
    const interval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send('getHomeData');
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [connected]);

  const toggleMotor = (motorNum, currentState) => {
    const command = currentState === 'ON' ? 
      `motor${motorNum}Off` : `motor${motorNum}On`;
    ws.current?.send(command);
  };

  if (!homeData) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <div className="connection-status">
        {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <div className="mode-display">
        Mode: {homeData.systemMode}
      </div>

      <div className="tanks">
        <TankDisplay 
          label="Upper Tank A"
          level={homeData.upperTankA}
          enabled={homeData.upperSensorAEnabled}
        />
        <TankDisplay 
          label="Lower Tank A"
          level={homeData.lowerTankA}
          enabled={homeData.lowerSensorAEnabled}
        />
        <TankDisplay 
          label="Upper Tank B"
          level={homeData.upperTankB}
          enabled={homeData.upperSensorBEnabled}
        />
        <TankDisplay 
          label="Lower Tank B"
          level={homeData.lowerTankB}
          enabled={homeData.lowerSensorBEnabled}
        />
      </div>

      <div className="motors">
        {homeData.motor1Enabled && (
          <MotorControl
            motorNum={1}
            state={homeData.motor1State}
            reason={homeData.autoReasonMotor1}
            onToggle={toggleMotor}
          />
        )}
        {homeData.motor2Enabled && (
          <MotorControl
            motorNum={2}
            state={homeData.motor2State}
            reason={homeData.autoReasonMotor2}
            onToggle={toggleMotor}
          />
        )}
      </div>
    </div>
  );
};
```

### Example 2: Settings Management

```javascript
class SettingsManager {
  constructor(wsConnection) {
    this.ws = wsConnection;
    this.settings = null;
  }

  async loadSettings() {
    return new Promise((resolve) => {
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'settingData') {
          this.settings = data;
          this.ws.removeEventListener('message', handler);
          resolve(data);
        }
      };

      this.ws.addEventListener('message', handler);
      this.ws.send('getSettingData');
    });
  }

  async saveSettings(updates) {
    const config = {
      ...this.settings,
      ...updates
    };

    // Remove fields that shouldn't be sent
    delete config.type;
    delete config.macAddress;

    return new Promise((resolve, reject) => {
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'configUpdate') {
          this.ws.removeEventListener('message', handler);
          if (data.status === 'success') {
            this.settings = { ...this.settings, ...updates };
            resolve(data.message);
          } else {
            reject(data.message);
          }
        }
      };

      this.ws.addEventListener('message', handler);
      this.ws.send(JSON.stringify(config));

      // Timeout after 5 seconds
      setTimeout(() => {
        this.ws.removeEventListener('message', handler);
        reject('Timeout waiting for response');
      }, 5000);
    });
  }

  async updateTankDimensions(tank, dimensions) {
    const prefix = tank === 'A' ? '' : 'B';
    const updates = {
      [`upperTankHeight${prefix}${tank}`]: dimensions.upperHeight,
      [`upperWaterFullHeight${prefix}${tank}`]: dimensions.upperFull,
      [`upperWaterEmptyHeight${prefix}${tank}`]: dimensions.upperEmpty,
      [`lowerTankHeight${prefix}${tank}`]: dimensions.lowerHeight,
      [`lowerWaterFullHeight${prefix}${tank}`]: dimensions.lowerFull,
      [`lowerWaterEmptyHeight${prefix}${tank}`]: dimensions.lowerEmpty
    };

    return this.saveSettings(updates);
  }
}
```

### Example 3: Real-time Monitoring

```javascript
class RealtimeMonitor {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(ip) {
    this.ws = new WebSocket(`ws://${ip}:81`);

    this.ws.onopen = () => {
      console.log('Connected to device');
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.startPolling();
    };

    this.ws.onclose = () => {
      console.log('Disconnected');
      this.emit('disconnected');
      this.stopPolling();
      this.attemptReconnect(ip);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit(data.type, data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  attemptReconnect(ip) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(ip), 3000);
    } else {
      this.emit('reconnectFailed');
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  startPolling() {
    this.pollingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('getHomeData');
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pol