import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { WebSocketMessage, AppState } from '../types';
import { initialAppState } from './WebSocketUtils';
import { WebSocketContext } from './WebSocketContextDefinition';
import type { WebSocketContextType } from './WebSocketContextDefinition';

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [reconnectInterval, setReconnectInterval] = useState<NodeJS.Timeout | null>(null);


  // Parse incoming WebSocket messages - Enhanced for v3.0 firmware protocol
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      
      setAppState((prevState: AppState) => {
        const newState = { ...prevState };
        
        // Handle v3.0 message types
        switch (message.type) {
          case 'homeData': {
            // v3.0 Home data response
            newState.systemStatus = {
              ...prevState.systemStatus,
              connected: true,
              runtime: parseFloat(message.lastUpdate || '0'),
              mode: (message.systemMode as 'Auto Mode' | 'Manual Mode') || prevState.systemStatus.mode,
              motor1Status: message.motor1State || 'OFF',
              motor2Status: message.motor2State || 'OFF',
              motor1Enabled: message.motor1Enabled !== undefined ? message.motor1Enabled : prevState.systemStatus.motor1Enabled,
              motor2Enabled: message.motor2Enabled !== undefined ? message.motor2Enabled : prevState.systemStatus.motor2Enabled,
              motorStatus: message.motor1State === 'ON' || message.motor2State === 'ON' ? 'ON' : 'OFF', // Legacy compatibility
              autoModeReasonMotor1: message.autoReasonMotor1 || 'NONE',
              autoModeReasonMotor2: message.autoReasonMotor2 || 'NONE',
              autoModeReasons: message.autoReasonMotor1 || 'NONE', // Legacy compatibility
              motorConfig: message.motorConfig || 'SINGLE_TANK_SINGLE_MOTOR',
              lastUpdated: new Date().toISOString()
            };
            
            // Update tank data
            newState.tankData = {
              ...prevState.tankData,
              tankA: {
                upper: message.upperTankA !== undefined ? message.upperTankA : prevState.tankData.tankA.upper,
                lower: message.lowerTankA !== undefined ? message.lowerTankA : prevState.tankData.tankA.lower
              },
              tankB: {
                upper: message.upperTankB !== undefined ? message.upperTankB : prevState.tankData.tankB.upper,
                lower: message.lowerTankB !== undefined ? message.lowerTankB : prevState.tankData.tankB.lower
              }
            };
            
            // Update sensor enable states
            newState.systemSettings = {
              ...prevState.systemSettings,
              sensors: {
                lowerTankA: message.lowerSensorAEnabled !== undefined ? message.lowerSensorAEnabled : prevState.systemSettings.sensors.lowerTankA,
                lowerTankB: message.lowerSensorBEnabled !== undefined ? message.lowerSensorBEnabled : prevState.systemSettings.sensors.lowerTankB,
                upperTankA: message.upperSensorAEnabled !== undefined ? message.upperSensorAEnabled : prevState.systemSettings.sensors.upperTankA,
                upperTankB: message.upperSensorBEnabled !== undefined ? message.upperSensorBEnabled : prevState.systemSettings.sensors.upperTankB
              }
            };
            
            newState.isConnected = true;
            newState.error = null;
            setReconnectAttempts(0);
            break;
          }
            
          case 'settingData': {
            // v3.0 Settings data response
            const mode = message.systemMode || 'Manual Mode';
            
            newState.systemSettings = {
              ...prevState.systemSettings,
              mode: mode as 'Auto Mode' | 'Manual Mode',
              motorSettings: {
                configuration: message.motorConfig || 'SINGLE_TANK_SINGLE_MOTOR',
                motor1Enabled: message.motor1Enabled !== undefined ? message.motor1Enabled : prevState.systemSettings.motorSettings.motor1Enabled,
                motor2Enabled: message.motor2Enabled !== undefined ? message.motor2Enabled : prevState.systemSettings.motorSettings.motor2Enabled,
                dualMotorSyncMode: message.dualMotorSyncMode || 'SIMULTANEOUS',
                motorAlternateInterval: 3600000 // Default 1 hour
              },
              tankAAutomation: {
                minAutoValue: message.minAutoValueA || 50,
                maxAutoValue: message.maxAutoValueA || 90,
                lowerThreshold: message.lowerThresholdA || 30,
                lowerOverflow: message.lowerOverflowA || 95,
                automationEnabled: message.tankAAutomationEnabled !== undefined ? message.tankAAutomationEnabled : prevState.systemSettings.tankAAutomation.automationEnabled
              },
              tankBAutomation: {
                minAutoValue: message.minAutoValueB || 50,
                maxAutoValue: message.maxAutoValueB || 90,
                lowerThreshold: message.lowerThresholdB || 30,
                lowerOverflow: message.lowerOverflowB || 95,
                automationEnabled: message.tankBAutomationEnabled !== undefined ? message.tankBAutomationEnabled : prevState.systemSettings.tankBAutomation.automationEnabled
              },
              // Legacy auto mode settings (for backward compatibility)
              autoMode: {
                minWaterLevel: message.minAutoValueA || 50,
                maxWaterLevel: message.maxAutoValueA || 90,
                specialFunctions: {
                  upperTankOverFlowLock: message.upperTankOverFlowLock !== undefined ? message.upperTankOverFlowLock : prevState.systemSettings.autoMode.specialFunctions.upperTankOverFlowLock,
                  lowerTankOverFlowLock: message.lowerTankOverFlowLock !== undefined ? message.lowerTankOverFlowLock : prevState.systemSettings.autoMode.specialFunctions.lowerTankOverFlowLock,
                  syncBothTank: message.syncBothTank !== undefined ? message.syncBothTank : prevState.systemSettings.autoMode.specialFunctions.syncBothTank,
                  buzzerAlert: message.buzzerAlert !== undefined ? message.buzzerAlert : prevState.systemSettings.autoMode.specialFunctions.buzzerAlert
                }
              },
              sensors: {
                lowerTankA: message.lowerSensorAEnabled !== undefined ? message.lowerSensorAEnabled : prevState.systemSettings.sensors.lowerTankA,
                lowerTankB: message.lowerSensorBEnabled !== undefined ? message.lowerSensorBEnabled : prevState.systemSettings.sensors.lowerTankB,
                upperTankA: message.upperSensorAEnabled !== undefined ? message.upperSensorAEnabled : prevState.systemSettings.sensors.upperTankA,
                upperTankB: message.upperSensorBEnabled !== undefined ? message.upperSensorBEnabled : prevState.systemSettings.sensors.upperTankB
              },
              tankDimensions: {
                upperTankA: {
                  height: message.upperTankHeightA || 75,
                  waterFullHeight: message.upperWaterFullHeightA || 5,    // Distance when full
                  waterEmptyHeight: message.upperWaterEmptyHeightA || 70  // Distance when empty
                },
                upperTankB: {
                  height: message.upperTankHeightB || 75,
                  waterFullHeight: message.upperWaterFullHeightB || 5,    // Distance when full
                  waterEmptyHeight: message.upperWaterEmptyHeightB || 70  // Distance when empty
                },
                lowerTankA: {
                  height: message.lowerTankHeightA || 75,
                  waterFullHeight: message.lowerWaterFullHeightA || 5,    // Distance when full
                  waterEmptyHeight: message.lowerWaterEmptyHeightA || 70  // Distance when empty
                },
                lowerTankB: {
                  height: message.lowerTankHeightB || 75,
                  waterFullHeight: message.lowerWaterFullHeightB || 5,    // Distance when full
                  waterEmptyHeight: message.lowerWaterEmptyHeightB || 70  // Distance when empty
                }
              },
              sensorCalibration: {
                upperTankA: message.upperSensorOffsetA || 0,
                lowerTankA: message.lowerSensorOffsetA || 0,
                upperTankB: message.upperSensorOffsetB || 0,
                lowerTankB: message.lowerSensorOffsetB || 0
              },
              sensorLimits: {
                minReading: message.minSensorReading || 20,
                maxReading: message.maxSensorReading || 4000
              },
              macAddress: message.macAddress || prevState.systemSettings.macAddress
            };
            
            // Update system status mode to match settings
            newState.systemStatus = {
              ...prevState.systemStatus,
              mode: mode as 'Auto Mode' | 'Manual Mode',
              connected: true,
              motorConfig: message.motorConfig || 'SINGLE_TANK_SINGLE_MOTOR',
              motor1Enabled: message.motor1Enabled !== undefined ? message.motor1Enabled : prevState.systemStatus.motor1Enabled,
              motor2Enabled: message.motor2Enabled !== undefined ? message.motor2Enabled : prevState.systemStatus.motor2Enabled
            };
            
            newState.isConnected = true;
            newState.error = null;
            setReconnectAttempts(0);
            break;
          }
            
          case 'motorState': {
            // v3.0 Motor state update
            if (message.motor === 1) {
              newState.systemStatus = {
                ...prevState.systemStatus,
                motor1Status: message.state || 'OFF',
                motorStatus: message.state === 'ON' ? 'ON' : (newState.systemStatus.motor2Status === 'ON' ? 'ON' : 'OFF'), // Legacy compatibility
                lastUpdated: new Date().toISOString()
              };
            } else if (message.motor === 2) {
              newState.systemStatus = {
                ...prevState.systemStatus,
                motor2Status: message.state || 'OFF',
                motorStatus: message.state === 'ON' ? 'ON' : (newState.systemStatus.motor1Status === 'ON' ? 'ON' : 'OFF'), // Legacy compatibility
                lastUpdated: new Date().toISOString()
              };
            }
            newState.isConnected = true;
            setReconnectAttempts(0);
            break;
          }
            
          case 'sensorData': {
            // v3.0 Sensor data response
            newState.tankData = {
              ...prevState.tankData,
              tankA: {
                upper: message.upperTankAPercent !== undefined ? message.upperTankAPercent : prevState.tankData.tankA.upper,
                lower: message.lowerTankAPercent !== undefined ? message.lowerTankAPercent : prevState.tankData.tankA.lower
              },
              tankB: {
                upper: message.upperTankBPercent !== undefined ? message.upperTankBPercent : prevState.tankData.tankB.upper,
                lower: message.lowerTankBPercent !== undefined ? message.lowerTankBPercent : prevState.tankData.tankB.lower
              }
            };
            newState.isConnected = true;
            newState.error = null;
            setReconnectAttempts(0);
            break;
          }
            
          case 'allData': {
            // v3.0 Unified data response - combines home, settings, and sensor data
            console.log('WebSocket - Received allData:', message);
            const mode = message.systemMode || 'Manual Mode';
            
            // Update system status
            newState.systemStatus = {
              ...prevState.systemStatus,
              connected: true,
              runtime: parseFloat(message.lastUpdate || '0'),
              mode: mode as 'Auto Mode' | 'Manual Mode',
              motor1Status: message.motor1State || 'OFF',
              motor2Status: message.motor2State || 'OFF',
              motor1Enabled: message.motor1Enabled !== undefined ? message.motor1Enabled : prevState.systemStatus.motor1Enabled,
              motor2Enabled: message.motor2Enabled !== undefined ? message.motor2Enabled : prevState.systemStatus.motor2Enabled,
              motorStatus: message.motor1State === 'ON' || message.motor2State === 'ON' ? 'ON' : 'OFF',
              autoModeReasonMotor1: message.autoReasonMotor1 || 'NONE',
              autoModeReasonMotor2: message.autoReasonMotor2 || 'NONE',
              autoModeReasons: message.autoReasonMotor1 || 'NONE',
              motorConfig: message.motorConfig || 'SINGLE_TANK_SINGLE_MOTOR',
              lastUpdated: new Date().toISOString()
            };
            
            // Update tank data
            newState.tankData = {
              ...prevState.tankData,
              tankA: {
                upper: message.upperTankA !== undefined ? message.upperTankA : (message.upperTankAPercent !== undefined ? message.upperTankAPercent : prevState.tankData.tankA.upper),
                lower: message.lowerTankA !== undefined ? message.lowerTankA : (message.lowerTankAPercent !== undefined ? message.lowerTankAPercent : prevState.tankData.tankA.lower)
              },
              tankB: {
                upper: message.upperTankB !== undefined ? message.upperTankB : (message.upperTankBPercent !== undefined ? message.upperTankBPercent : prevState.tankData.tankB.upper),
                lower: message.lowerTankB !== undefined ? message.lowerTankB : (message.lowerTankBPercent !== undefined ? message.lowerTankBPercent : prevState.tankData.tankB.lower)
              }
            };
            
            // Update system settings
            newState.systemSettings = {
              ...prevState.systemSettings,
              mode: mode as 'Auto Mode' | 'Manual Mode',
              motorSettings: {
                configuration: message.motorConfig || 'SINGLE_TANK_SINGLE_MOTOR',
                motor1Enabled: message.motor1Enabled !== undefined ? message.motor1Enabled : prevState.systemSettings.motorSettings.motor1Enabled,
                motor2Enabled: message.motor2Enabled !== undefined ? message.motor2Enabled : prevState.systemSettings.motorSettings.motor2Enabled,
                dualMotorSyncMode: message.dualMotorSyncMode || 'SIMULTANEOUS',
                motorAlternateInterval: 3600000
              },
              tankAAutomation: {
                minAutoValue: message.minAutoValueA || 50,
                maxAutoValue: message.maxAutoValueA || 90,
                lowerThreshold: message.lowerThresholdA || 30,
                lowerOverflow: message.lowerOverflowA || 95,
                automationEnabled: message.tankAAutomationEnabled !== undefined ? message.tankAAutomationEnabled : prevState.systemSettings.tankAAutomation.automationEnabled
              },
              tankBAutomation: {
                minAutoValue: message.minAutoValueB || 50,
                maxAutoValue: message.maxAutoValueB || 90,
                lowerThreshold: message.lowerThresholdB || 30,
                lowerOverflow: message.lowerOverflowB || 95,
                automationEnabled: message.tankBAutomationEnabled !== undefined ? message.tankBAutomationEnabled : prevState.systemSettings.tankBAutomation.automationEnabled
              },
              autoMode: {
                minWaterLevel: message.minAutoValueA || 50,
                maxWaterLevel: message.maxAutoValueA || 90,
                specialFunctions: {
                  upperTankOverFlowLock: message.upperTankOverFlowLock !== undefined ? message.upperTankOverFlowLock : prevState.systemSettings.autoMode.specialFunctions.upperTankOverFlowLock,
                  lowerTankOverFlowLock: message.lowerTankOverFlowLock !== undefined ? message.lowerTankOverFlowLock : prevState.systemSettings.autoMode.specialFunctions.lowerTankOverFlowLock,
                  syncBothTank: message.syncBothTank !== undefined ? message.syncBothTank : prevState.systemSettings.autoMode.specialFunctions.syncBothTank,
                  buzzerAlert: message.buzzerAlert !== undefined ? message.buzzerAlert : prevState.systemSettings.autoMode.specialFunctions.buzzerAlert
                }
              },
              sensors: {
                lowerTankA: message.lowerSensorAEnabled !== undefined ? message.lowerSensorAEnabled : prevState.systemSettings.sensors.lowerTankA,
                lowerTankB: message.lowerSensorBEnabled !== undefined ? message.lowerSensorBEnabled : prevState.systemSettings.sensors.lowerTankB,
                upperTankA: message.upperSensorAEnabled !== undefined ? message.upperSensorAEnabled : prevState.systemSettings.sensors.upperTankA,
                upperTankB: message.upperSensorBEnabled !== undefined ? message.upperSensorBEnabled : prevState.systemSettings.sensors.upperTankB
              },
              tankDimensions: {
                upperTankA: {
                  height: message.upperTankHeightA || 75,
                  waterFullHeight: message.upperWaterFullHeightA || 5,
                  waterEmptyHeight: message.upperWaterEmptyHeightA || 70
                },
                upperTankB: {
                  height: message.upperTankHeightB || 75,
                  waterFullHeight: message.upperWaterFullHeightB || 5,
                  waterEmptyHeight: message.upperWaterEmptyHeightB || 70
                },
                lowerTankA: {
                  height: message.lowerTankHeightA || 75,
                  waterFullHeight: message.lowerWaterFullHeightA || 5,
                  waterEmptyHeight: message.lowerWaterEmptyHeightA || 70
                },
                lowerTankB: {
                  height: message.lowerTankHeightB || 75,
                  waterFullHeight: message.lowerWaterFullHeightB || 5,
                  waterEmptyHeight: message.lowerWaterEmptyHeightB || 70
                }
              },
              sensorCalibration: {
                upperTankA: message.upperSensorOffsetA || 0,
                lowerTankA: message.lowerSensorOffsetA || 0,
                upperTankB: message.upperSensorOffsetB || 0,
                lowerTankB: message.lowerSensorOffsetB || 0
              },
              sensorLimits: {
                minReading: message.minSensorReading || 20,
                maxReading: message.maxSensorReading || 4000
              },
              macAddress: message.macAddress || prevState.systemSettings.macAddress
            };
            
            newState.isConnected = true;
            newState.error = null;
            setReconnectAttempts(0);
            
            // Debug logging for sensor states
            console.log('WebSocket - Updated sensor states:', newState.systemSettings.sensors);
            console.log('WebSocket - Updated tank data:', newState.tankData);
            break;
          }
            
          case 'configUpdate':
          case 'wifiConfigUpdate': {
            // Configuration update acknowledgment
            newState.isConnected = true;
            newState.error = null;
            setReconnectAttempts(0);
            break;
          }
            
          case 'systemReset': {
            // System reset acknowledgment
            newState.isConnected = false;
            break;
          }
            
          default: {
            // Handle legacy message types for backward compatibility
        if (message.MSV !== undefined && message.RTV === undefined && message.SM === undefined) {
              // Legacy motor status acknowledgment
          newState.systemStatus = {
            ...prevState.systemStatus,
            motorStatus: message.MSV === 'ON' || message.MSV === true ? 'ON' : 'OFF',
            lastUpdated: new Date().toISOString()
          };
          newState.isConnected = true;
          setReconnectAttempts(0);
            } else if (message.RTV !== undefined || message.SM !== undefined || message.MSV !== undefined) {
              // Legacy home data response
          newState.systemStatus = {
            ...prevState.systemStatus,
            connected: true,
            runtime: parseFloat(message.RTV || '0'),
            mode: message.SM || prevState.systemStatus.mode,
            motorStatus: message.MSV === 'ON' || message.MSV === true ? 'ON' : 'OFF',
            autoModeReasons: message.AMR || 'NONE',
            lastUpdated: new Date().toISOString()
          };
          
          // Update tank data only if provided
          if (message.UTWLA !== undefined || message.LTWLA !== undefined) {
            newState.tankData = {
              ...prevState.tankData,
              tankA: {
                upper: message.UTWLA || prevState.tankData.tankA.upper,
                lower: message.LTWLA || prevState.tankData.tankA.lower
              },
              tankB: {
                upper: message.UTWLB || prevState.tankData.tankB.upper,
                lower: message.LTWLB || prevState.tankData.tankB.lower
              }
            };
          }
          
              newState.isConnected = true;
              newState.error = null;
              setReconnectAttempts(0);
            }
          }
        }
        
        return newState;
      });
    } catch {
      setAppState((prev: AppState) => ({ ...prev, error: 'Failed to parse ESP32 message' }));
    }
  }, []);

  // Handle WebSocket connection events
  const handleOpen = useCallback(() => {
    setAppState((prev: AppState) => ({ 
      ...prev, 
      isConnected: true, 
      error: null,
      systemStatus: { ...prev.systemStatus, connected: true }
    }));
    setReconnectAttempts(0);
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      setReconnectInterval(null);
    }
    
    // Note: Initial data loading is now handled by DataLoader component
    // This ensures proper loading sequence and user feedback
    // Periodic data refresh is now handled by individual pages based on their needs

  }, [reconnectInterval]);

  const handleError = useCallback(() => {
    setAppState((prev: AppState) => ({ 
      ...prev, 
      error: 'Connection error occurred',
      isConnected: false
    }));
    // Stop reconnection attempts on error
    if (reconnectInterval) {
      clearTimeout(reconnectInterval);
      setReconnectInterval(null);
    }
  }, [reconnectInterval]);

  // Connect to WebSocket
  const connect = useCallback((host: string) => {
    try {
      // Clean up any existing connection first
      if (ws) {
        ws.close();
        setWs(null);
      }
      
      // Clear any existing reconnection intervals
      if (reconnectInterval) {
        clearTimeout(reconnectInterval);
        setReconnectInterval(null);
      }
      
      // Reset reconnection attempts
      setReconnectAttempts(0);
      
      // Store host in localStorage for persistence
      localStorage.setItem('tankHost', host);
      
      // Check if we're on HTTPS and provide appropriate protocol
      const isHttps = window.location.protocol === 'https:';
      const wsUrl = isHttps ? `wss://${host}:81` : `ws://${host}:81`;
      
      
      // If on HTTPS and trying to connect to local network, show helpful error
      if (isHttps && (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.'))) {
        setAppState((prev: AppState) => ({ 
          ...prev, 
          error: 'HTTPS Mixed Content: Cannot connect to local network from HTTPS site. Please use HTTP or local development server.',
          isConnected: false
        }));
        return;
      }
      
      
      const newWs = new WebSocket(wsUrl);
      
      newWs.onopen = handleOpen;
      newWs.onclose = (event: CloseEvent) => {
        setAppState((prev: AppState) => ({ 
          ...prev, 
          isConnected: false,
          systemStatus: { ...prev.systemStatus, connected: false },
          error: event.code !== 1000 ? `Connection lost (code: ${event.code})` : null
        }));
        
        // Let ConnectionGuard handle reconnection logic
        console.log(`WebSocket closed with code ${event.code}. ConnectionGuard will handle reconnection.`);
      };
      newWs.onerror = handleError;
      newWs.onmessage = handleMessage;
      
      setWs(newWs);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setAppState((prev: AppState) => ({ 
        ...prev, 
        error: 'Failed to create WebSocket connection'
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleOpen, handleError, handleMessage, reconnectAttempts]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      setReconnectInterval(null);
    }
    if (ws) {
      ws.close();
      setWs(null);
    }
    setAppState((prev: AppState) => ({ 
      ...prev, 
      isConnected: false,
      systemStatus: { ...prev.systemStatus, connected: false }
    }));
  }, [ws, reconnectInterval]);

  // Send message through WebSocket - Enhanced for v3.0 firmware protocol
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        // Handle different message types using v3.0 protocol
        switch (message.type as string) {
          case 'motor1On':
            ws.send('motor1On');
            break;
          case 'motor1Off':
            ws.send('motor1Off');
            break;
          case 'motor2On':
            ws.send('motor2On');
            break;
          case 'motor2Off':
            ws.send('motor2Off');
            break;
          case 'motorControl':
            // Legacy motor control - default to motor 1
            if (message.motorOn) {
              ws.send('motor1On');
            } else {
              ws.send('motor1Off');
            }
            break;
          case 'updateSettings':
            // Send v3.0 settings update as JSON
            if (message.settings) {
              const settingsMessage = {
                systemMode: message.settings.mode,
                motorConfig: message.settings.motorSettings.configuration,
                motor1Enabled: message.settings.motorSettings.motor1Enabled,
                motor2Enabled: message.settings.motorSettings.motor2Enabled,
                dualMotorSyncMode: message.settings.motorSettings.dualMotorSyncMode,
                minAutoValueA: message.settings.tankAAutomation.minAutoValue,
                maxAutoValueA: message.settings.tankAAutomation.maxAutoValue,
                lowerThresholdA: message.settings.tankAAutomation.lowerThreshold,
                lowerOverflowA: message.settings.tankAAutomation.lowerOverflow,
                minAutoValueB: message.settings.tankBAutomation.minAutoValue,
                maxAutoValueB: message.settings.tankBAutomation.maxAutoValue,
                lowerThresholdB: message.settings.tankBAutomation.lowerThreshold,
                lowerOverflowB: message.settings.tankBAutomation.lowerOverflow,
                upperTankHeightA: message.settings.tankDimensions.upperTankA.height,
                upperWaterFullHeightA: message.settings.tankDimensions.upperTankA.waterFullHeight,
                upperWaterEmptyHeightA: message.settings.tankDimensions.upperTankA.waterEmptyHeight,
                lowerTankHeightA: message.settings.tankDimensions.lowerTankA.height,
                lowerWaterFullHeightA: message.settings.tankDimensions.lowerTankA.waterFullHeight,
                lowerWaterEmptyHeightA: message.settings.tankDimensions.lowerTankA.waterEmptyHeight,
                upperTankHeightB: message.settings.tankDimensions.upperTankB.height,
                upperWaterFullHeightB: message.settings.tankDimensions.upperTankB.waterFullHeight,
                upperWaterEmptyHeightB: message.settings.tankDimensions.upperTankB.waterEmptyHeight,
                lowerTankHeightB: message.settings.tankDimensions.lowerTankB.height,
                lowerWaterFullHeightB: message.settings.tankDimensions.lowerTankB.waterFullHeight,
                lowerWaterEmptyHeightB: message.settings.tankDimensions.lowerTankB.waterEmptyHeight,
                lowerSensorAEnable: message.settings.sensors.lowerTankA,
                lowerSensorBEnable: message.settings.sensors.lowerTankB,
                upperSensorAEnable: message.settings.sensors.upperTankA,
                upperSensorBEnable: message.settings.sensors.upperTankB,
                upperTankOverFlowLock: message.settings.autoMode.specialFunctions.upperTankOverFlowLock,
                lowerTankOverFlowLock: message.settings.autoMode.specialFunctions.lowerTankOverFlowLock,
                syncBothTank: message.settings.autoMode.specialFunctions.syncBothTank,
                buzzerAlert: message.settings.autoMode.specialFunctions.buzzerAlert,
                tankAAutomationEnabled: message.settings.tankAAutomation.automationEnabled,
                tankBAutomationEnabled: message.settings.tankBAutomation.automationEnabled
              };
              ws.send(JSON.stringify(settingsMessage));
            }
            break;
          case 'wifiConfig':
            // Send v3.0 WiFi configuration
            if (message.MODE && message.SSID && message.PASS) {
              const wifiMessage = {
                MODE: message.MODE,
                SSID: message.SSID,
                PASS: message.PASS,
                SIP0: message.SIP0,
                SIP1: message.SIP1,
                SIP2: message.SIP2,
                SIP3: message.SIP3,
                SG0: message.SG0,
                SG1: message.SG1,
                SG2: message.SG2,
                SG3: message.SG3,
                SS0: message.SS0,
                SS1: message.SS1,
                SS2: message.SS2,
                SS3: message.SS3,
                SPD0: message.SPD0,
                SPD1: message.SPD1,
                SPD2: message.SPD2,
                SPD3: message.SPD3
              };
              ws.send(JSON.stringify(wifiMessage));
            }
            break;
          case 'systemReset':
            ws.send('systemReset');
            break;
          case 'getHomeData':
            ws.send('getHomeData');
            break;
          case 'getSettingData':
            ws.send('getSettingData');
            break;
          case 'getSensorData':
            ws.send('getSensorData');
            break;
          case 'getAllData':
            // Unified request for all data - more efficient than multiple separate requests
            ws.send('getAllData');
            break;
          case 'getWiFiConfig':
            ws.send('getWiFiConfig');
            break;
          case 'homeData':
            // Request home data
            ws.send('getHomeData');
            break;
          case 'settingsData':
            // Request settings data
            ws.send('getSettingData');
            break;
          default:
            // Default: request both home and settings data
            ws.send('getHomeData');
            ws.send('getSettingData');
        }
        
      } catch {
        setAppState((prev: AppState) => ({ 
          ...prev, 
          error: 'Failed to send message to server'
        }));
      }
    } else {
      setAppState((prev: AppState) => ({ 
        ...prev, 
        error: 'Not connected to server'
      }));
    }
  }, [ws]);


  // Auto-connect on mount if host is stored
  useEffect(() => {
    const storedHost = localStorage.getItem('tankHost');
    if (storedHost && !appState.isConnected) {
      connect(storedHost);
    }
    
    return () => {
      if (reconnectInterval) {
        clearTimeout(reconnectInterval);
      }
      if (ws) {
        ws.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove dependencies to prevent re-triggering


  // Memoize the context value to prevent unnecessary re-renders
  const value: WebSocketContextType = useMemo(() => ({
    appState,
    sendMessage,
    connect,
    disconnect,
    isConnected: appState.isConnected,
    error: appState.error
  }), [appState, sendMessage, connect, disconnect]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};