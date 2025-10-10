# Smart Tank PWA - Code Structure Guide for Beginners

## 📁 Project Structure Overview

```
smart-tank-pwa/
├── src/                          # Main source code
│   ├── components/               # Reusable UI components
│   ├── context/                  # WebSocket communication
│   ├── pages/                    # Main pages (Dashboard, Settings)
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utility functions
├── arduino-example/              # ESP32 firmware code
│   └── smart_tank_esp32/
└── public/                       # Static files
```

## 🎨 UI Components (src/components/)

### 1. **Dashboard.tsx** - Main Dashboard Page
**Location**: `src/pages/Dashboard.tsx`
**Purpose**: Main page showing tank levels, motor controls, and system status

**Key Features**:
- Motor control buttons
- Tank level displays
- System status information
- Debug information panel

**Key Functions**:
```typescript
const handleMotorToggle = () => {
  // Toggles motor ON/OFF
  const isMotorCurrentlyOn = currentMotorState === 'ON' || currentMotorState === true;
  const newMotorState = !isMotorCurrentlyOn;
  sendMessage({ type: 'motorControl', motorOn: newMotorState });
};
```

### 2. **Settings.tsx** - Settings Page
**Location**: `src/pages/Settings.tsx`
**Purpose**: Configuration page for system settings

**Key Features**:
- System mode selection (Auto/Manual)
- Tank dimensions configuration
- Sensor enable/disable options
- Special functions settings
- WiFi configuration

**Key Functions**:
```typescript
const handleModeChange = (mode: 'Auto Mode' | 'Manual Mode') => {
  setSettings(prev => ({ ...prev, mode }));
};

const handleSave = () => {
  sendMessage({ type: 'updateSettings', settings });
};
```

### 3. **StatusCard.tsx** - Status Display Component
**Location**: `src/components/StatusCard.tsx`
**Purpose**: Shows system status information

### 4. **TankLevelCard.tsx** - Tank Level Display
**Location**: `src/components/TankLevelCard.tsx`
**Purpose**: Shows water levels for individual tanks

### 5. **ToggleSwitch.tsx** - Toggle Switch Component
**Location**: `src/components/ToggleSwitch.tsx`
**Purpose**: Custom toggle switch for settings

### 6. **SensorCheckbox.tsx** - Sensor Checkbox Component
**Location**: `src/components/SensorCheckbox.tsx`
**Purpose**: Checkbox for enabling/disabling sensors

## 🔌 WebSocket Communication (src/context/)

### 1. **WebSocketContext.tsx** - Main Communication Hub
**Location**: `src/context/WebSocketContext.tsx`
**Purpose**: Manages all WebSocket communication between PWA and ESP32

**Key Functions**:

#### Connection Management:
```typescript
const connect = useCallback((url: string) => {
  const ws = new WebSocket(url);
  ws.onopen = handleOpen;
  ws.onmessage = handleMessage;
  ws.onerror = handleError;
  ws.onclose = handleClose;
  setWs(ws);
}, []);
```

#### Message Handling:
```typescript
const handleMessage = useCallback((event: MessageEvent) => {
  const message = JSON.parse(event.data);
  
  // Handle motor status updates
  if (message.MSV !== undefined && message.RTV === undefined) {
    newState.systemStatus.motorStatus = message.MSV === 'ON' ? 'ON' : 'OFF';
  }
  
  // Handle home data
  else if (message.RTV !== undefined) {
    newState.systemStatus.runtime = parseFloat(message.RTV);
    newState.systemStatus.mode = message.SM;
    // ... more data handling
  }
}, []);
```

#### Sending Messages:
```typescript
const sendMessage = useCallback((message: WebSocketMessage) => {
  switch (message.type) {
    case 'motorControl':
      if (message.motorOn) {
        ws.send('motorOn');
      } else {
        ws.send('motorOff');
      }
      break;
    case 'updateSettings':
      // Send settings as JSON
      ws.send(JSON.stringify(settingsMessage));
      break;
  }
}, [ws]);
```

### 2. **useWebSocket.ts** - WebSocket Hook
**Location**: `src/context/useWebSocket.ts`
**Purpose**: Custom React hook for WebSocket functionality

### 3. **WebSocketUtils.ts** - Utility Functions
**Location**: `src/context/WebSocketUtils.ts`
**Purpose**: Initial state and utility functions

## 📊 Data Types (src/types/)

### **index.ts** - Type Definitions
**Location**: `src/types/index.ts`
**Purpose**: Defines all data structures used in the app

**Key Types**:
```typescript
interface AppState {
  isConnected: boolean;
  systemStatus: SystemStatus;
  tankData: TankData;
  systemSettings: SystemSettings;
  error: string | null;
}

interface SystemStatus {
  connected: boolean;
  runtime: number;
  mode: 'Auto Mode' | 'Manual Mode';
  motorStatus: boolean | 'ON' | 'OFF';
  autoModeReasons: string;
  lastUpdated: string;
}

interface WebSocketMessage {
  type?: 'motorControl' | 'updateSettings' | 'getSettingData' | ...;
  motorOn?: boolean;
  settings?: SystemSettings;
  // ... more fields
}
```

## 🔧 ESP32 Firmware (arduino-example/)

### **smart_tank_esp32.ino** - Main ESP32 Code
**Location**: `arduino-example/smart_tank_esp32/smart_tank_esp32.ino`
**Purpose**: ESP32 firmware that controls the hardware

**Key Functions**:

#### WebSocket Event Handler:
```cpp
void onWebSocketEvent(uint8_t client_num, WStype_t type, uint8_t *payload, size_t length) {
  clientNumGlobal = client_num;
  
  switch (type) {
    case WStype_TEXT:
      if (strcmp((char *)payload, "motorOn") == 0) {
        switchMotorON();
      } else if (strcmp((char *)payload, "motorOff") == 0) {
        switchMotorOFF();
      } else if (strcmp((char *)payload, "getHomeData") == 0) {
        // Send home data
      }
      break;
  }
}
```

#### Motor Control:
```cpp
void switchMotorON() {
  motorState = true;
  digitalWrite(relay1Pin, motorState);
  
  JsonDocument stateUpdate;
  stateUpdate["MSV"] = "ON";
  String jsonString;
  serializeJson(stateUpdate, jsonString);
  webSocket.sendTXT(clientNumGlobal, jsonString);
}
```

## 🛠️ How to Modify Things (Beginner Guide)

### 1. **Changing UI Text/Labels**

**Example**: Change "Turn ON Motor" to "Start Motor"
**File**: `src/pages/Dashboard.tsx`
**Find**: Line with button text
**Change**:
```typescript
// Before
{(appState.systemStatus.motorStatus === 'ON' || appState.systemStatus.motorStatus === true) ? 'Turn OFF Motor' : 'Turn ON Motor'}

// After
{(appState.systemStatus.motorStatus === 'ON' || appState.systemStatus.motorStatus === true) ? 'Stop Motor' : 'Start Motor'}
```

### 2. **Adding New Settings**

**Example**: Add a new setting for "Pump Speed"
**File**: `src/types/index.ts`
**Add to SystemSettings interface**:
```typescript
interface SystemSettings {
  // ... existing fields
  pumpSpeed: number;  // Add this
}
```

**File**: `src/pages/Settings.tsx`
**Add input field**:
```typescript
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    Pump Speed
  </label>
  <input
    type="number"
    value={settings.pumpSpeed}
    onChange={(e) => setSettings(prev => ({ ...prev, pumpSpeed: Number(e.target.value) }))}
    className="w-full px-3 py-2 border border-gray-300 rounded-md"
  />
</div>
```

### 3. **Adding New WebSocket Commands**

**Example**: Add a "restartSystem" command
**File**: `src/types/index.ts`
**Add to WebSocketMessage type**:
```typescript
type?: 'motorControl' | 'updateSettings' | 'restartSystem' | ...;
```

**File**: `src/context/WebSocketContext.tsx`
**Add to sendMessage function**:
```typescript
case 'restartSystem':
  ws.send('restartSystem');
  break;
```

**File**: `arduino-example/smart_tank_esp32/smart_tank_esp32.ino`
**Add to WebSocket handler**:
```cpp
} else if (strcmp((char *)payload, "restartSystem") == 0) {
  ESP.restart();
}
```

### 4. **Changing Button Colors**

**File**: `src/pages/Dashboard.tsx`
**Find button className**:
```typescript
// Change from green/red to blue/purple
? ((appState.systemStatus.motorStatus === 'ON' || appState.systemStatus.motorStatus === true)
    ? 'bg-purple-500 hover:bg-purple-600 text-white'  // Changed from red
    : 'bg-blue-500 hover:bg-blue-600 text-white')     // Changed from green
```

### 5. **Adding New Tank Display**

**File**: `src/pages/Dashboard.tsx`
**Add new TankLevelCard**:
```typescript
<TankLevelCard
  tankName="Tank C"
  upperLevel={appState.tankData.tankC.upper}
  lowerLevel={appState.tankData.tankC.lower}
  isActive={appState.systemSettings.sensors.upperTankC}
/>
```

## 🔍 Common Modification Patterns

### 1. **Adding Debug Information**
```typescript
console.log('Debug:', variableName);
```

### 2. **Adding New State Variables**
```typescript
const [newVariable, setNewVariable] = useState(initialValue);
```

### 3. **Adding New Functions**
```typescript
const handleNewFunction = () => {
  // Your code here
  console.log('New function called');
};
```

### 4. **Adding New UI Elements**
```typescript
<div className="mb-4">
  <h3 className="text-lg font-semibold">New Section</h3>
  <p className="text-sm text-gray-600">Description</p>
</div>
```

## 📝 Step-by-Step Modification Process

1. **Identify the file** you need to modify
2. **Open the file** in your code editor
3. **Find the relevant section** using Ctrl+F (search)
4. **Make your changes** carefully
5. **Test the build**: `npm run build`
6. **Check for errors** and fix them
7. **Test the functionality** in the browser

## 🚨 Important Notes for Beginners

1. **Always backup** your code before making changes
2. **Test small changes** one at a time
3. **Check the browser console** for errors
4. **Use the debug features** to understand what's happening
5. **Read error messages** carefully - they tell you what's wrong
6. **Ask for help** when you're stuck!

## 📚 Learning Resources

- **React Basics**: Learn about components, state, and props
- **TypeScript**: Learn about types and interfaces
- **WebSocket**: Learn about real-time communication
- **Arduino/ESP32**: Learn about microcontroller programming

This guide should help you understand the code structure and make modifications safely!

