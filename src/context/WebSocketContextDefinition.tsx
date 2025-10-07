import { createContext } from 'react';
import type { AppState, WebSocketMessage } from '../types';

interface WebSocketContextType {
  appState: AppState;
  sendMessage: (message: WebSocketMessage) => void;
  connect: (host: string) => void;
  disconnect: () => void;
  isConnected: boolean;
  error: string | null;
}

export const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);
