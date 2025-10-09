import type { AppState } from '../types';

export const initialAppState: AppState = {
  systemStatus: {
    connected: false,
    lastUpdated: new Date().toISOString(),
    runtime: 0,
    motorStatus: 'OFF',
    mode: 'Manual Mode',
    autoModeReasons: 'NONE'
  },
  systemSettings: {
    mode: 'Manual Mode',
    autoMode: {
      minWaterLevel: 50,
      maxWaterLevel: 90,
      specialFunctions: {
        upperTankOverFlowLock: true,
        lowerTankOverFlowLock: true,
        syncBothTank: true,
        buzzerAlert: true
      }
    },
    manualMode: {
      motorControl: false
    },
    sensors: {
      lowerTankA: false,
      lowerTankB: false,
      upperTankA: false,
      upperTankB: false
    },
    tankDimensions: {
      upperTankA: { height: 75, waterFullHeight: 70, waterEmptyHeight: 0 },
      upperTankB: { height: 75, waterFullHeight: 70, waterEmptyHeight: 0 },
      lowerTankA: { height: 75, waterFullHeight: 70, waterEmptyHeight: 0 },
      lowerTankB: { height: 75, waterFullHeight: 70, waterEmptyHeight: 0 }
    }
  },
  tankData: {
    tankA: { upper: 0, lower: 0 },
    tankB: { upper: 0, lower: 0 },
    dimensions: {
      upper: { height: 75, waterFullHeight: 70, waterEmptyHeight: 0 },
      lower: { height: 75, waterFullHeight: 70, waterEmptyHeight: 0 }
    }
  },
  isConnected: false,
  error: null
};
