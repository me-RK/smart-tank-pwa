import type { AppState } from '../types';

export const initialAppState: AppState = {
  systemStatus: {
    connected: false,
    lastUpdated: new Date().toISOString(),
    runtime: 0,
    motorStatus: 'OFF',
    mode: 'auto',
    autoModeReasons: []
  },
  systemSettings: {
    mode: 'auto',
    autoMode: {
      minWaterLevel: 20,
      maxWaterLevel: 80,
      specialFunctions: {
        autoMode: true
      }
    },
    manualMode: {
      motorControl: false
    },
    sensors: {
      lowerTankA: true,
      lowerTankB: true,
      upperTankA: true,
      upperTankB: true
    }
  },
  tankData: {
    tankA: { upper: 0, lower: 0 },
    tankB: { upper: 0, lower: 0 },
    dimensions: {
      upper: { height: 100, waterFullHeight: 90, waterEmptyHeight: 10 },
      lower: { height: 100, waterFullHeight: 90, waterEmptyHeight: 10 }
    }
  },
  isConnected: false,
  error: null
};
