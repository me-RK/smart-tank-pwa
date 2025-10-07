import React, { useEffect, useState, useCallback } from 'react';
import type { SystemStatus, SystemSettings, TankData, WebSocketMessage } from '../types';
import { initialAppState } from './WebSocketUtils';
import { WebSocketContext } from './WebSocketContextDefinition';


export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [reconnectInterval, setReconnectInterval] = useState<NodeJS.Timeout | null>(null);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  // Parse incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      setAppState(prevState => {
        const newState = { ...prevState };
        
        switch (message.type) {
          case 'status':
            newState.systemStatus = { ...message.data as SystemStatus, connected: true };
            newState.isConnected = true;
            newState.error = null;
            break;
          case 'settings':
            newState.systemSettings = message.data as SystemSettings;
            break;
          case 'tankData':
            newState.tankData = message.data as TankData;
            break;
          case 'error':
            newState.error = message.data as string;
            break;
        }
        
        return newState;
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      setAppState(prev => ({ ...prev, error: 'Failed to parse server message' }));
    }
  }, []);

  // Handle WebSocket connection events
  const handleOpen = useCallback(() => {
    console.log('WebSocket connected');
    setAppState(prev => ({ 
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
  }, [reconnectInterval]);

  const handleClose = useCallback(() => {
    console.log('WebSocket disconnected');
    setAppState(prev => ({ 
      ...prev, 
      isConnected: false,
      systemStatus: { ...prev.systemStatus, connected: false }
    }));
    
    // Attempt to reconnect if not manually disconnected
    if (reconnectAttempts < maxReconnectAttempts) {
      const interval = setTimeout(() => {
        setReconnectAttempts(prev => prev + 1);
        if (ws) {
          ws.close();
        }
      }, reconnectDelay);
      setReconnectInterval(interval);
    }
  }, [reconnectAttempts, ws]);

  const handleError = useCallback((error: Event) => {
    console.error('WebSocket error:', error);
    setAppState(prev => ({ 
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
      
      const wsUrl = `ws://${host}:1337`;
      const newWs = new WebSocket(wsUrl);
      
      newWs.onopen = handleOpen;
      newWs.onclose = handleClose;
      newWs.onerror = handleError;
      newWs.onmessage = handleMessage;
      
      setWs(newWs);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setAppState(prev => ({ 
        ...prev, 
        error: 'Failed to create WebSocket connection'
      }));
    }
  }, [handleOpen, handleClose, handleError, handleMessage]);

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
    setAppState(prev => ({ 
      ...prev, 
      isConnected: false,
      systemStatus: { ...prev.systemStatus, connected: false }
    }));
  }, [ws, reconnectInterval]);

  // Send message through WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message:', error);
        setAppState(prev => ({ 
          ...prev, 
          error: 'Failed to send message to server'
        }));
      }
    } else {
      console.warn('WebSocket not connected');
      setAppState(prev => ({ 
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

