import { useContext } from 'react';
import { WebSocketContext } from './WebSocketContextDefinition';
import type { AppState, WebSocketMessage } from '../types';

interface WebSocketContextType {
  appState: AppState;
  sendMessage: (message: WebSocketMessage) => void;
  connect: (host: string) => void;
  disconnect: () => void;
  isConnected: boolean;
  error: string | null;
}

// Custom hook to use WebSocket context
export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
