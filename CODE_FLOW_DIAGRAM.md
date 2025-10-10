# Code Flow Diagram - Smart Tank PWA

## 🔄 Communication Flow

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│                 │   Connection    │                 │
│   PWA (Browser) │◄──────────────►│   ESP32 Device  │
│                 │                 │                 │
└─────────────────┘                 └─────────────────┘
```

## 📁 File Structure & Responsibilities

```
smart-tank-pwa/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx          ← 🎛️ Main control panel
│   │   └── Settings.tsx           ← ⚙️ Configuration page
│   │
│   ├── components/
│   │   ├── StatusCard.tsx         ← 📊 System status display
│   │   ├── TankLevelCard.tsx      ← 💧 Tank level display
│   │   ├── ToggleSwitch.tsx       ← 🔄 Toggle switches
│   │   └── SensorCheckbox.tsx     ← ☑️ Sensor checkboxes
│   │
│   ├── context/
│   │   ├── WebSocketContext.tsx   ← 🔌 Main communication hub
│   │   ├── useWebSocket.ts        ← 🪝 WebSocket hook
│   │   └── WebSocketUtils.ts      ← 🛠️ Utility functions
│   │
│   └── types/
│       └── index.ts               ← 📝 Data type definitions
│
└── arduino-example/
    └── smart_tank_esp32/
        └── smart_tank_esp32.ino   ← 🔧 ESP32 firmware
```

## 🔄 Data Flow Example (Motor Control)

```
1. User clicks "Turn ON Motor" button
   ↓
2. Dashboard.tsx → handleMotorToggle()
   ↓
3. WebSocketContext.tsx → sendMessage()
   ↓
4. ESP32 receives "motorOn" command
   ↓
5. ESP32 → switchMotorON()
   ↓
6. ESP32 sends {"MSV": "ON"}
   ↓
7. WebSocketContext.tsx → handleMessage()
   ↓
8. Dashboard.tsx UI updates
   ↓
9. Button shows "Turn OFF Motor"
```

## 🎯 Key Files for Common Modifications

### 🎨 UI Changes
- **Dashboard.tsx** - Main page layout, buttons, displays
- **Settings.tsx** - Configuration forms, inputs
- **StatusCard.tsx** - Status information display
- **TankLevelCard.tsx** - Tank level visualization

### 🔌 Communication Changes
- **WebSocketContext.tsx** - Message handling, connection management
- **types/index.ts** - Data structure definitions
- **smart_tank_esp32.ino** - ESP32 command handling

### ⚙️ Settings Changes
- **Settings.tsx** - Add new configuration options
- **types/index.ts** - Add new data types
- **WebSocketContext.tsx** - Handle new settings

## 🛠️ Quick Modification Guide

### Change Button Text
**File**: `src/pages/Dashboard.tsx`
**Search**: `'Turn ON Motor'`
**Replace**: `'Start Motor'`

### Add New Setting
**File**: `src/types/index.ts`
**Add**: `newSetting: boolean;`
**File**: `src/pages/Settings.tsx`
**Add**: Input field for new setting

### Change Colors
**File**: `src/pages/Dashboard.tsx`
**Search**: `bg-green-500`
**Replace**: `bg-blue-500`

### Add Debug Info
**File**: Any `.tsx` file
**Add**: `console.log('Debug:', variable);`

## 🔍 How to Find Code

1. **UI Elements**: Look in `src/pages/` and `src/components/`
2. **Communication**: Look in `src/context/WebSocketContext.tsx`
3. **Data Types**: Look in `src/types/index.ts`
4. **ESP32 Logic**: Look in `arduino-example/smart_tank_esp32/`

## 📝 Common Search Terms

- **Button text**: Search for the button text you see on screen
- **Function names**: Search for `handleMotorToggle`, `sendMessage`, etc.
- **CSS classes**: Search for `bg-green-500`, `text-white`, etc.
- **Data fields**: Search for `motorStatus`, `systemMode`, etc.

## 🚨 Safety Tips

1. **Always backup** before making changes
2. **Test one change at a time**
3. **Use `npm run build`** to check for errors
4. **Check browser console** for runtime errors
5. **Start with small changes** to understand the code

