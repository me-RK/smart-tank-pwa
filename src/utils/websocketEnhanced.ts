// Enhanced WebSocket utility with PWA background operation support

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: string;
}

export interface WebSocketStatus {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastConnected: Date | null;
  isBackground: boolean;
}

export class EnhancedWebSocket {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private status: WebSocketStatus;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private heartbeatTimeoutId: NodeJS.Timeout | null = null;
  private messageQueue: string[] = [];
  private isDestroyed = false;
  private visibilityChangeHandler: (() => void) | null = null;

  // Event handlers
  public onOpen: (() => void) | null = null;
  public onClose: (() => void) | null = null;
  public onMessage: ((data: string) => void) | null = null;
  public onError: ((error: Event) => void) | null = null;
  public onStatusChange: ((status: WebSocketStatus) => void) | null = null;

  constructor(config: WebSocketConfig) {
    this.config = {
      protocols: [],
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      heartbeatMessage: 'ping',
      ...config
    };

    this.status = {
      connected: false,
      connecting: false,
      reconnecting: false,
      error: null,
      reconnectAttempts: 0,
      lastConnected: null,
      isBackground: false
    };

    this.setupVisibilityChangeHandler();
  }

  private setupVisibilityChangeHandler() {
    this.visibilityChangeHandler = () => {
      const isBackground = document.visibilityState === 'hidden';
      this.status.isBackground = isBackground;
      this.notifyStatusChange();

      if (isBackground) {
        // App went to background - keep connection alive but reduce heartbeat
        this.adjustHeartbeatForBackground();
      } else {
        // App came to foreground - restore normal heartbeat and check connection
        this.adjustHeartbeatForForeground();
        this.checkConnection();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  private adjustHeartbeatForBackground() {
    // Reduce heartbeat frequency in background to save battery
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }
    
    if (this.status.connected) {
      this.heartbeatTimeoutId = setTimeout(() => {
        this.sendHeartbeat();
      }, this.config.heartbeatInterval * 2); // Double the interval in background
    }
  }

  private adjustHeartbeatForForeground() {
    // Restore normal heartbeat frequency in foreground
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }
    
    if (this.status.connected) {
      this.startHeartbeat();
    }
  }

  private checkConnection() {
    // Check if connection is still alive when returning to foreground
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send a quick ping to verify connection
      this.sendHeartbeat();
    } else if (!this.status.connecting && !this.status.reconnecting) {
      // Connection is dead, try to reconnect
      this.connect();
    }
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isDestroyed) {
        reject(new Error('WebSocket instance has been destroyed'));
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        resolve();
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.status.connecting = true;
      this.status.error = null;
      this.notifyStatusChange();

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);

        this.ws.onopen = () => {
          this.status.connected = true;
          this.status.connecting = false;
          this.status.reconnecting = false;
          this.status.reconnectAttempts = 0;
          this.status.lastConnected = new Date();
          this.status.error = null;
          this.notifyStatusChange();

          // Send queued messages
          this.flushMessageQueue();

          // Start heartbeat
          this.startHeartbeat();

          if (this.onOpen) {
            this.onOpen();
          }

          resolve();
        };

        this.ws.onclose = (event) => {
          this.status.connected = false;
          this.status.connecting = false;
          this.status.error = `Connection closed: ${event.code} - ${event.reason}`;
          this.notifyStatusChange();

          this.stopHeartbeat();

          if (this.onClose) {
            this.onClose();
          }

          // Attempt to reconnect if not destroyed and not a clean close
          if (!this.isDestroyed && event.code !== 1000) {
            this.scheduleReconnect();
          }
        };

        this.ws.onmessage = (event) => {
          if (this.onMessage) {
            this.onMessage(event.data);
          }
        };

        this.ws.onerror = (error) => {
          this.status.error = 'WebSocket error occurred';
          this.notifyStatusChange();

          if (this.onError) {
            this.onError(error);
          }

          reject(error);
        };

      } catch (error) {
        this.status.connecting = false;
        this.status.error = 'Failed to create WebSocket connection';
        this.notifyStatusChange();
        reject(error);
      }
    });
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimeoutId) {
      return;
    }

    if (this.status.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.status.error = 'Max reconnection attempts reached';
      this.notifyStatusChange();
      return;
    }

    this.status.reconnecting = true;
    this.status.reconnectAttempts++;
    this.notifyStatusChange();

    // Exponential backoff with jitter
    const baseDelay = this.config.reconnectInterval;
    const exponentialDelay = baseDelay * Math.pow(2, this.status.reconnectAttempts - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect().catch(() => {
        // Reconnection failed, will be handled by onclose
      });
    }, delay);
  }

  private startHeartbeat() {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }

    this.heartbeatTimeoutId = setTimeout(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }

  private sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(this.config.heartbeatMessage);
      this.startHeartbeat(); // Schedule next heartbeat
    }
  }

  public send(data: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    } else {
      // Queue message for later sending
      this.messageQueue.push(data);
      return false;
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(message);
      }
    }
  }

  public disconnect(): void {
    this.isDestroyed = true;
    this.stopHeartbeat();

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    this.status.connected = false;
    this.status.connecting = false;
    this.status.reconnecting = false;
    this.notifyStatusChange();
  }

  public getStatus(): WebSocketStatus {
    return { ...this.status };
  }

  private notifyStatusChange() {
    if (this.onStatusChange) {
      this.onStatusChange({ ...this.status });
    }
  }

  // Network status monitoring
  public static setupNetworkMonitoring(onOnline: () => void, onOffline: () => void) {
    const handleOnline = () => {
      console.log('Network: Online');
      onOnline();
    };

    const handleOffline = () => {
      console.log('Network: Offline');
      onOffline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}
