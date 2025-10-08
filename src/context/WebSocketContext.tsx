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

  // Parse incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Received message from ESP32:', message);
      
      setAppState((prevState: AppState) => {
        const newState = { ...prevState };
        
        switch (message.type) {
          case 'sensorData':
            // Handle sensor data from ESP32
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
            // Reset connection attempts on successful data reception
            setReconnectAttempts(0);
            break;
          case 'status':
            // Handle status updates from ESP32
            newState.systemStatus = {
              ...prevState.systemStatus,
              connected: true,
              motorStatus: message.pump1Enabled || message.pump2Enabled ? 'ON' : 'OFF',
              lastUpdated: new Date().toISOString()
            };
            newState.isConnected = true;
            newState.error = null;
            // Reset connection attempts on successful status update
            setReconnectAttempts(0);
            break;
          case 'error':
            newState.error = message.data || 'Unknown error from ESP32';
            break;
          default:
            console.log('Unknown message type from ESP32:', message.type);
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
    console.log('WebSocket connected to ESP32');
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
    
    // Request initial data from ESP32
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('Requesting initial data from ESP32...');
        ws.send(JSON.stringify({ command: 'getData' }));
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
  }, []);

  // Connect to WebSocket
  const connect = useCallback((host: string) => {
    try {
      // Store host in localStorage for persistence
      localStorage.setItem('tankHost', host);
      
      const wsUrl = `ws://${host}:81`;
      const newWs = new WebSocket(wsUrl);
      
      newWs.onopen = handleOpen;
      newWs.onclose = (event: CloseEvent) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setAppState((prev: AppState) => ({ 
          ...prev, 
          isConnected: false,
          systemStatus: { ...prev.systemStatus, connected: false }
        }));
        
        // Attempt to reconnect if not manually disconnected and not a clean close
        if (reconnectAttempts < maxReconnectAttempts && event.code !== 1000) {
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
          setAppState((prev: AppState) => ({ 
            ...prev, 
            error: 'Failed to reconnect after multiple attempts. Please check your connection and try again.'
          }));
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

  // Send message through WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        // Convert PWA message format to ESP32 format
        let esp32Message;
        
        switch (message.type) {
          case 'motorControl':
            // Send pump control command based on motor state
            esp32Message = {
              command: 'togglePump1'
            };
            break;
          case 'pump1Control':
            esp32Message = {
              command: 'togglePump1'
            };
            break;
          case 'pump2Control':
            esp32Message = {
              command: 'togglePump2'
            };
            break;
          case 'systemControl':
            esp32Message = {
              command: 'toggleSystem'
            };
            break;
          case 'updateSettings':
            // Handle settings updates
            if (message.settings) {
              esp32Message = {
                command: 'setDelayA',
                value: 1000 // Default delay
              };
            }
            break;
          default:
            esp32Message = {
              command: 'getData'
            };
        }
        
        console.log('Sending message to ESP32:', esp32Message);
        ws.send(JSON.stringify(esp32Message));
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
    if (storedHost) {
      connect(storedHost);
    }
    
    return () => {
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [connect, reconnectInterval, ws]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [ws, reconnectInterval]);

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