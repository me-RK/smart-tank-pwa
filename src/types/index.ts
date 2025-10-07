// Core data types for the Smart Water Tank PWA

export interface TankLevel {
  upper: number;
  lower: number;
}

export interface TankDimensions {
  height: number;
  waterFullHeight: number;
  waterEmptyHeight: number;
}

export interface TankData {
  tankA: TankLevel;
  tankB: TankLevel;
  dimensions: {
    upper: TankDimensions;
    lower: TankDimensions;
  };
}

export interface SystemSettings {
  mode: 'auto' | 'manual';
  autoMode: {
    minWaterLevel: number;
    maxWaterLevel: number;
    specialFunctions: {
      autoMode: boolean;
    };
  };
  manualMode: {
    motorControl: boolean;
  };
  sensors: {
    lowerTankA: boolean;
    lowerTankB: boolean;
    upperTankA: boolean;
    upperTankB: boolean;
  };
}

export interface SystemStatus {
  connected: boolean;
  lastUpdated: string;
  runtime: number;
  motorStatus: 'ON' | 'OFF';
  mode: 'auto' | 'manual';
  autoModeReasons: string[];
}

export interface WebSocketMessage {
  type: 'status' | 'settings' | 'tankData' | 'error';
  data: SystemStatus | SystemSettings | TankData | string;
}

export interface AppState {
  systemStatus: SystemStatus;
  systemSettings: SystemSettings;
  tankData: TankData;
  isConnected: boolean;
  error: string | null;
}
