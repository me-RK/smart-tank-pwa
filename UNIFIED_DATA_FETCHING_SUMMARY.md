# Unified Data Fetching Implementation Summary

## Problem Solved
The previous implementation was making multiple separate WebSocket requests (`getHomeData`, `getSettingData`, `getSensorData`) which caused:
- Backend overload with multiple requests
- Inefficient data transfer
- Potential race conditions
- Settings update interference

## Solution: Unified Data Request
Created a single `getAllData` command that fetches all necessary data in one request, combining:
- System status (motor states, mode, runtime)
- Tank levels (real-time sensor data)
- System settings (configuration, automation settings)
- Sensor states and calibration
- Tank dimensions and limits

## Implementation Details

### 1. New WebSocket Command: `getAllData`
**Frontend Request:**
```javascript
sendMessage({ type: 'getAllData' });
```

**Backend Response (ESP32):**
```json
{
  "type": "allData",
  "lastUpdate": "1234",
  "systemMode": "Auto Mode",
  "motor1State": "ON",
  "motor2State": "OFF",
  "motor1Enabled": true,
  "motor2Enabled": false,
  "motorConfig": "SINGLE_TANK_SINGLE_MOTOR",
  "upperTankA": 75.5,
  "lowerTankA": 45.2,
  "upperTankB": 80.1,
  "lowerTankB": 50.0,
  "upperSensorAEnabled": true,
  "lowerSensorAEnabled": true,
  "upperSensorBEnabled": false,
  "lowerSensorBEnabled": false,
  "autoReasonMotor1": "TANK_A_LOW",
  "autoReasonMotor2": "NONE",
  "dualMotorSyncMode": "SIMULTANEOUS",
  "minAutoValueA": 50,
  "maxAutoValueA": 90,
  "lowerThresholdA": 30,
  "lowerOverflowA": 95,
  "minAutoValueB": 50,
  "maxAutoValueB": 90,
  "lowerThresholdB": 30,
  "lowerOverflowB": 95,
  "tankAAutomationEnabled": true,
  "tankBAutomationEnabled": false,
  "upperTankHeightA": 75,
  "upperWaterFullHeightA": 5,
  "upperWaterEmptyHeightA": 70,
  "upperTankHeightB": 75,
  "upperWaterFullHeightB": 5,
  "upperWaterEmptyHeightB": 70,
  "lowerTankHeightA": 75,
  "lowerWaterFullHeightA": 5,
  "lowerWaterEmptyHeightA": 70,
  "lowerTankHeightB": 75,
  "lowerWaterFullHeightB": 5,
  "lowerWaterEmptyHeightB": 70,
  "upperSensorOffsetA": 0,
  "lowerSensorOffsetA": 0,
  "upperSensorOffsetB": 0,
  "lowerSensorOffsetB": 0,
  "minSensorReading": 20,
  "maxSensorReading": 4000,
  "upperTankOverFlowLock": false,
  "lowerTankOverFlowLock": false,
  "syncBothTank": false,
  "buzzerAlert": true,
  "macAddress": [0x24, 0x6F, 0x28, 0x12, 0x34, 0x56]
}
```

### 2. Updated WebSocket Context
- Added `getAllData` command handler
- Added `allData` response handler that updates all app state
- Maintains backward compatibility with existing commands

### 3. Updated Page Data Hook (`usePageData`)
- Dashboard: Uses `getAllData` for initial load and periodic updates
- Settings: Uses `getAllData` for initial load and after updates
- Other pages: No automatic data fetching

### 4. Updated Components
- **Dashboard**: Manual sync now uses `getAllData`
- **Settings**: After save, requests `getAllData` to confirm changes

### 5. ESP32 Firmware Updates
- Added `getAllData` command handler
- Combines data from `getHomeData`, `getSettingData`, and `getSensorData`
- Single JSON response with all necessary information

## Data Flow

### Dashboard Page
1. **Initial Load**: `getAllData` → Complete system state
2. **Periodic Updates**: `getAllData` every N seconds (user configurable)
3. **Manual Sync**: `getAllData` on demand
4. **Page Leave**: Stop periodic requests

### Settings Page
1. **Initial Load**: `getAllData` → Complete system state
2. **After Update**: `getAllData` after 1 second delay
3. **Page Leave**: No ongoing requests

### Other Pages
- No automatic data fetching
- Clean state management

## Benefits

### 1. **Reduced Backend Load**
- **Before**: 3 separate requests (`getHomeData`, `getSettingData`, `getSensorData`)
- **After**: 1 unified request (`getAllData`)
- **Reduction**: 66% fewer WebSocket messages

### 2. **Improved Efficiency**
- Single network round-trip instead of multiple
- Reduced ESP32 processing overhead
- Faster data synchronization

### 3. **Better Settings Updates**
- No interference from multiple concurrent requests
- Cleaner update confirmation process
- Reduced race conditions

### 4. **Simplified Data Management**
- Single source of truth for all data
- Consistent state across all components
- Easier debugging and monitoring

### 5. **Backward Compatibility**
- Existing commands still work
- Gradual migration possible
- No breaking changes

## Configuration
- Dashboard sync interval: Configurable in Settings (2s, 5s, 10s, 30s, 1m, 5m, or off)
- Settings update delay: 1 second after save
- All settings stored in localStorage

## Testing
The implementation has been tested to ensure:
- ✅ Single request gets all necessary data
- ✅ Dashboard periodic updates work correctly
- ✅ Settings updates work without interference
- ✅ No data requests on other pages
- ✅ Proper cleanup when switching pages
- ✅ Backward compatibility maintained

## Migration Path
1. **Phase 1**: Implement `getAllData` alongside existing commands
2. **Phase 2**: Update frontend to use `getAllData`
3. **Phase 3**: (Optional) Remove old commands in future firmware version

This unified approach significantly reduces backend load while improving data consistency and user experience.
