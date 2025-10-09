// Core data types for the Smart Water Tank PWA - Enhanced with old firmware compatibility

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
  mode: 'Auto Mode' | 'Manual Mode';
  autoMode: {
    minWaterLevel: number;
    maxWaterLevel: number;
    specialFunctions: {
      upperTankOverFlowLock: boolean;
      lowerTankOverFlowLock: boolean;
      syncBothTank: boolean;
      buzzerAlert: boolean;
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
  tankDimensions: {
    upperTankA: TankDimensions;
    upperTankB: TankDimensions;
    lowerTankA: TankDimensions;
    lowerTankB: TankDimensions;
  };
  macAddress?: number[];
}

export interface SystemStatus {
  connected: boolean;
  lastUpdated: string;
  runtime: number;
  motorStatus: boolean | 'ON' | 'OFF';
  mode: 'Auto Mode' | 'Manual Mode';
  autoModeReasons: string;
}

// Enhanced WebSocket message types to match old firmware protocol
export interface WebSocketMessage {
  // Home data request/response
  type?: 'homeData' | 'settingsData' | 'motorControl' | 'systemReset' | 'wifiConfig' | 'pump1Control' | 'pump2Control' | 'systemControl' | 'updateSettings';
  
  // Home data fields (matching old firmware)
  RTV?: string; // Runtime value
  SM?: string; // System mode
  MSV?: boolean | string; // Motor state value
  UTWLA?: number; // Upper tank water level A
  LTWLA?: number; // Lower tank water level A
  UTWLB?: number; // Upper tank water level B
  LTWLB?: number; // Lower tank water level B
  LAE?: boolean; // Lower sensor A enable
  LBE?: boolean; // Lower sensor B enable
  UAE?: boolean; // Upper sensor A enable
  UBE?: boolean; // Upper sensor B enable
  AMR?: string; // Auto mode reason
  
  // Settings data fields
  UTHA?: number; // Upper tank height A
  UTWFHA?: number; // Upper tank water full height A
  UTWEHA?: number; // Upper tank water empty height A
  LTHA?: number; // Lower tank height A
  LTWFHA?: number; // Lower tank water full height A
  LTWEHA?: number; // Lower tank water empty height A
  UTHB?: number; // Upper tank height B
  UTWFHB?: number; // Upper tank water full height B
  UTWEHB?: number; // Upper tank water empty height B
  LTHB?: number; // Lower tank height B
  LTWFHB?: number; // Lower tank water full height B
  LTWEHB?: number; // Lower tank water empty height B
  MIAV?: number; // Min auto value
  MAAV?: number; // Max auto value
  UTOFL?: boolean; // Upper tank overflow lock
  LTOFL?: boolean; // Lower tank overflow lock
  SBT?: boolean; // Sync both tank
  BA?: boolean; // Buzzer alert
  BMAC?: number[]; // Board MAC address
  
  // WiFi configuration fields
  MODE?: 'access_point' | 'station';
  SSID?: string;
  PASS?: string;
  SIP?: number[]; // Static IP
  GW?: number[]; // Gateway
  SNM?: number[]; // Subnet mask
  PDNS?: number[]; // Primary DNS
  SDNS?: number[]; // Secondary DNS
  
  // Legacy fields for backward compatibility
  data?: SystemStatus | SystemSettings | TankData | string;
  timestamp?: string;
  motorOn?: boolean;
  settings?: SystemSettings;
}

export interface AppState {
  systemStatus: SystemStatus;
  systemSettings: SystemSettings;
  tankData: TankData;
  isConnected: boolean;
  error: string | null;
}
