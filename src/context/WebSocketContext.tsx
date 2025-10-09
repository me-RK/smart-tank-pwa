import React, { useEffect, useState, useCallback } from 'react';
import type { WebSocketMessage, AppState } from '../types';
import { initialAppState } from './WebSocketUtils';
import { WebSocketContext } from './WebSocketContextDefinition';
import type { WebSocketContextType } from './WebSocketContextDefinition';

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [reconnectInterval, setReconnectInterval] = useState<NodeJS.Timeout | null>(null);

  const maxReconnectAttempts = 10;
  const reconnectDelay = 2000;
  const reconnectBackoff = 1.5;

  // Parse incoming WebSocket messages - Enhanced for old firmware compatibility
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Received message from ESP32:', message);
      
      setAppState((prevState: AppState) => {
        const newState = { ...prevState };
        
        // Handle home data response (matching old firmware protocol)
        if (message.RTV !== undefined || message.SM !== undefined || message.MSV !== undefined) {
          // This is home data from the old firmware
          newState.systemStatus = {
            ...prevState.systemStatus,
            connected: true,
            runtime: parseFloat(message.RTV || '0'),
            mode: message.SM || 'Manual Mode',
            motorStatus: message.MSV === 'ON' || message.MSV === true ? 'ON' : 'OFF',
            autoModeReasons: message.AMR || 'NONE',
            lastUpdated: new Date().toISOString()
          };
          
          // Update tank data
          newState.tankData = {
            ...prevState.tankData,
            tankA: {
              upper: message.UTWLA || 0,
              lower: message.LTWLA || 0
            },
            tankB: {
              upper: message.UTWLB || 0,
              lower: message.LTWLB || 0
            }
          };
          
          // Update sensor enable states
          newState.systemSettings = {
            ...prevState.systemSettings,
            sensors: {
              lowerTankA: message.LAE || false,
              lowerTankB: message.LBE || false,
              upperTankA: message.UAE || false,
              upperTankB: message.UBE || false
            }
          };
          
          newState.isConnected = true;
          newState.error = null;
          setReconnectAttempts(0);
        }
        // Handle settings data response
        else if (message.UTHA !== undefined || message.MIAV !== undefined) {
          // This is settings data from the old firmware
          newState.systemSettings = {
            ...prevState.systemSettings,
            mode: message.SM || 'Manual Mode',
            autoMode: {
              minWaterLevel: message.MIAV || 50,
              maxWaterLevel: message.MAAV || 90,
              specialFunctions: {
                upperTankOverFlowLock: message.UTOFL || true,
                lowerTankOverFlowLock: message.LTOFL || true,
                syncBothTank: message.SBT || true,
                buzzerAlert: message.BA || true
              }
            },
            sensors: {
              lowerTankA: message.LAE || false,
              lowerTankB: message.LBE || false,
              upperTankA: message.UAE || false,
              upperTankB: message.UBE || false
            },
            tankDimensions: {
              upperTankA: {
                height: message.UTHA || 75,
                waterFullHeight: message.UTWFHA || 70,
                waterEmptyHeight: message.UTWEHA || 0
              },
              upperTankB: {
                height: message.UTHB || 75,
                waterFullHeight: message.UTWFHB || 70,
                waterEmptyHeight: message.UTWEHB || 0
              },
              lowerTankA: {
                height: message.LTHA || 75,
                waterFullHeight: message.LTWFHA || 70,
                waterEmptyHeight: message.LTWEHA || 0
              },
              lowerTankB: {
                height: message.LTHB || 75,
                waterFullHeight: message.LTWFHB || 70,
                waterEmptyHeight: message.LTWEHB || 0
              }
            },
            macAddress: message.BMAC
          };
          
          newState.isConnected = true;
          newState.error = null;
          setReconnectAttempts(0);
        }
        // Handle legacy message types for backward compatibility
        else {
          switch (message.type) {
            case 'sensorData':
              newState.tankData = {
                ...prevState.tankData,
                tankA: {
                  upper: message.sensorA || 0,
                  lower: message.sensorA || 0
                },
                tankB: {
                  upper: message.sensorB || 0,
                  lower: message.sensorB || 0
                }
              };
              newState.isConnected = true;
              newState.error = null;
              setReconnectAttempts(0);
              break;
            case 'status':
              newState.systemStatus = {
                ...prevState.systemStatus,
                connected: true,
                motorStatus: message.pump1Enabled || message.pump2Enabled ? 'ON' : 'OFF',
                lastUpdated: new Date().toISOString()
              };
              newState.isConnected = true;
              newState.error = null;
              setReconnectAttempts(0);
              break;
            case 'error':
              newState.error = message.data || 'Unknown error from ESP32';
              break;
            default:
              console.log('Unknown message type from ESP32:', message.type);
          }
        }
        
        return newState;
      });
    } catch (error) {
      console.error('Error parsing WebSocket message from ESP32:', error);
      setAppState((prev: AppState) => ({ ...prev, error: 'Failed to parse ESP32 message' }));
    }
  }, []);

  // Handle WebSocket connection events
  const handleOpen = useCallback(() => {
    console.log('✅ WebSocket connected to ESP32 successfully!');
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
    
    // Request initial data from ESP32 using old firmware protocol
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('📡 Requesting initial data from ESP32...');
        ws.send('getHomeData');
        ws.send('getSettingData');
      } else {
        console.warn('⚠️ WebSocket not open when trying to request data');
      }
    }, 1000);
  }, [reconnectInterval, ws]);

  const handleError = useCallback((error: Event) => {
    console.error('WebSocket error:', error);
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
      // Check if already connecting or connected
      if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        console.log('WebSocket already connecting or connected. Ignoring new connection request.');
        return;
      }
      
      // Store host in localStorage for persistence
      localStorage.setItem('tankHost', host);
      
      // Check if we're on HTTPS and provide appropriate protocol
      const isHttps = window.location.protocol === 'https:';
      const wsUrl = isHttps ? `wss://${host}:81` : `ws://${host}:81`;
      
      console.log(`Connecting to ${wsUrl} (HTTPS: ${isHttps})`);
      
      // If on HTTPS and trying to connect to local network, show helpful error
      if (isHttps && (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.'))) {
        console.warn('⚠️ HTTPS Mixed Content: Cannot connect to local network from HTTPS site');
        setAppState((prev: AppState) => ({ 
          ...prev, 
          error: 'HTTPS Mixed Content: Cannot connect to local network from HTTPS site. Please use HTTP or local development server.',
          isConnected: false
        }));
        return;
      }
      
      console.log(`🔌 Attempting WebSocket connection to ${wsUrl}...`);
      
      const newWs = new WebSocket(wsUrl);
      
      newWs.onopen = handleOpen;
      newWs.onclose = (event: CloseEvent) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setAppState((prev: AppState) => ({ 
          ...prev, 
          isConnected: false,
          systemStatus: { ...prev.systemStatus, connected: false }
        }));
        
        // Only attempt to reconnect if not manually disconnected and not a clean close
        if (reconnectAttempts < maxReconnectAttempts && event.code !== 1000 && event.code !== 1006) {
          const delay = Math.min(reconnectDelay * Math.pow(reconnectBackoff, reconnectAttempts), 30000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          const interval = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            const storedHost = localStorage.getItem('tankHost');
            if (storedHost) {
              connect(storedHost);
            }
          }, delay);
          setReconnectInterval(interval);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.log('Max reconnection attempts reached. Stopping reconnection.');
          setAppState((prev: AppState) => ({ 
            ...prev, 
            error: 'Failed to reconnect after multiple attempts. Please check your connection and try again.'
          }));
        } else {
          console.log('Connection closed cleanly or too many failures. Not reconnecting.');
        }
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

  // Send message through WebSocket - Enhanced for old firmware compatibility
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        // Handle different message types using old firmware protocol
        switch (message.type) {
          case 'motorControl':
            // Send motor control command
            if (message.motorOn) {
              ws.send('motorOn');
            } else {
              ws.send('motorOff');
            }
            break;
          case 'pump1Control':
            // Toggle pump 1 (same as motor control in old firmware)
            ws.send('motorOn');
            break;
          case 'pump2Control':
            // Toggle pump 2 (same as motor control in old firmware)
            ws.send('motorOn');
            break;
          case 'systemControl':
            // System control (same as motor control in old firmware)
            ws.send('motorOn');
            break;
          case 'updateSettings':
            // Send settings update as JSON
            if (message.settings) {
              const settingsMessage = {
                SM: message.settings.mode,
                MIAV: message.settings.autoMode.minWaterLevel,
                MAAV: message.settings.autoMode.maxWaterLevel,
                UTHA: message.settings.tankDimensions.upperTankA.height,
                UTWFHA: message.settings.tankDimensions.upperTankA.waterFullHeight,
                UTWEHA: message.settings.tankDimensions.upperTankA.waterEmptyHeight,
                LTHA: message.settings.tankDimensions.lowerTankA.height,
                LTWFHA: message.settings.tankDimensions.lowerTankA.waterFullHeight,
                LTWEHA: message.settings.tankDimensions.lowerTankA.waterEmptyHeight,
                UTHB: message.settings.tankDimensions.upperTankB.height,
                UTWFHB: message.settings.tankDimensions.upperTankB.waterFullHeight,
                UTWEHB: message.settings.tankDimensions.upperTankB.waterEmptyHeight,
                LTHB: message.settings.tankDimensions.lowerTankB.height,
                LTWFHB: message.settings.tankDimensions.lowerTankB.waterFullHeight,
                LTWEHB: message.settings.tankDimensions.lowerTankB.waterEmptyHeight,
                LAE: message.settings.sensors.lowerTankA,
                LBE: message.settings.sensors.lowerTankB,
                UAE: message.settings.sensors.upperTankA,
                UBE: message.settings.sensors.upperTankB,
                UTOFL: message.settings.autoMode.specialFunctions.upperTankOverFlowLock,
                LTOFL: message.settings.autoMode.specialFunctions.lowerTankOverFlowLock,
                SBT: message.settings.autoMode.specialFunctions.syncBothTank,
                BA: message.settings.autoMode.specialFunctions.buzzerAlert
              };
              ws.send(JSON.stringify(settingsMessage));
            }
            break;
          case 'wifiConfig':
            // Send WiFi configuration
            if (message.MODE && message.SSID && message.PASS) {
              const wifiMessage = {
                MODE: message.MODE,
                SSID: message.SSID,
                PASS: message.PASS,
                SIP: message.SIP,
                GW: message.GW,
                SNM: message.SNM,
                PDNS: message.PDNS,
                SDNS: message.SDNS
              };
              ws.send(JSON.stringify(wifiMessage));
            }
            break;
          case 'systemReset':
            ws.send('systemReset');
            break;
          default:
            // Request data
            ws.send('getHomeData');
            ws.send('getSettingData');
        }
        
        console.log('Sending message to ESP32:', message);
      } catch (error) {
        console.error('Failed to send message:', error);
        setAppState((prev: AppState) => ({ 
          ...prev, 
          error: 'Failed to send message to server'
        }));
      }
    } else {
      console.warn('WebSocket not connected');
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
      console.log('Auto-connecting to stored host:', storedHost);
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


  const value: WebSocketContextType = {
    appState,
    sendMessage,
    connect,
    disconnect,
    isConnected: appState.isConnected,
    error: appState.error
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};