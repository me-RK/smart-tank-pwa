import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../context/useWebSocket';
import { ConnectionModal } from './ConnectionModal';
import { TroubleshootingGuide } from './TroubleshootingGuide';
import { NetworkInfo } from './NetworkInfo';
import { DeviceNotFoundScreen } from './DeviceNotFoundScreen';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Settings, HelpCircle, Info } from 'lucide-react';
import { testConnection, discoverEsp32Devices } from '../utils/connectionTest';

interface ConnectionGuardProps {
  children: React.ReactNode;
}

export const ConnectionGuard: React.FC<ConnectionGuardProps> = ({ children }) => {
  const { isConnected, appState, connect, disconnect } = useWebSocket();
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<string[]>([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [showNetworkInfo, setShowNetworkInfo] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [isFirstConnection, setIsFirstConnection] = useState(true);
  const [autoReconnectAttempts, setAutoReconnectAttempts] = useState(0);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(false);
  const [showDeviceNotFound, setShowDeviceNotFound] = useState(false);
  const [backgroundReconnectTimeout, setBackgroundReconnectTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isBackgroundReconnecting, setIsBackgroundReconnecting] = useState(false);

  const maxConnectionAttempts = 3;
  const maxAutoReconnectAttempts = 5;

  // Cleanup function to stop background reconnection
  const stopBackgroundReconnection = useCallback(() => {
    if (backgroundReconnectTimeout) {
      console.log('ConnectionGuard: Stopping background reconnection');
      clearTimeout(backgroundReconnectTimeout);
      setBackgroundReconnectTimeout(null);
    }
    setIsBackgroundReconnecting(false);
  }, [backgroundReconnectTimeout]);

  const handleScanForDevices = useCallback(async () => {
    setIsScanning(true);
    setLastError(null);
    setConnectionStatus('Scanning for ESP32 devices...');
    
    try {
      const devices = await discoverEsp32Devices();
      setDiscoveredDevices(devices);
      
      if (devices.length > 0) {
        // Try to connect to the first discovered device
        const firstDevice = devices[0];
        console.log(`Found ESP32 device at ${firstDevice}, attempting connection...`);
        setConnectionStatus(`Found device at ${firstDevice}. Connecting...`);
        setIsConnecting(true);
        connect(firstDevice);
        setConnectionAttempts(prev => prev + 1);
      } else {
        setLastError('No ESP32 devices found on the network. Please check your device and try again.');
        setConnectionStatus('No devices found');
      }
    } catch (error) {
      console.error('Device scan failed:', error);
      setLastError('Failed to scan for devices. Please check your network connection.');
      setConnectionStatus('Scan failed');
    } finally {
      setIsScanning(false);
    }
  }, [connect]);

  // Check if this is first connection on mount
  useEffect(() => {
    const hasConnectedBefore = localStorage.getItem('hasConnectedBefore');
    if (hasConnectedBefore) {
      setIsFirstConnection(false);
    }
  }, []);


  // Listen for connection modal requests from Dashboard
  useEffect(() => {
    const handleOpenConnectionModal = () => {
      setShowConnectionModal(true);
    };

    window.addEventListener('openConnectionModal', handleOpenConnectionModal);
    return () => {
      window.removeEventListener('openConnectionModal', handleOpenConnectionModal);
    };
  }, []);

  // Auto-scan for devices on first load only
  useEffect(() => {
    if (!isConnected && connectionAttempts === 0 && isFirstConnection) {
      handleScanForDevices();
    }
  }, [isConnected, connectionAttempts, isFirstConnection, handleScanForDevices]);

  // Monitor connection status changes
  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('Connected successfully!');
      setIsConnecting(false);
      setIsScanning(false);
      setIsAutoReconnecting(false);
      setAutoReconnectAttempts(0);
      setShowDeviceNotFound(false); // Hide device not found screen
      stopBackgroundReconnection(); // Stop background reconnection
      // Clear reconnection status
      window.dispatchEvent(new CustomEvent('reconnectionStatus', { 
        detail: { 
          status: '',
          isReconnecting: false,
          attempt: 0,
          maxAttempts: 0
        } 
      }));
      // Mark that we've connected before
      localStorage.setItem('hasConnectedBefore', 'true');
      setIsFirstConnection(false);
    } else if (appState.error && isFirstConnection) {
      setConnectionStatus(`Connection failed: ${appState.error}`);
      setIsConnecting(false);
    }
  }, [isConnected, appState.error, isFirstConnection, stopBackgroundReconnection]);

  // Auto-reconnection function
  const handleAutoReconnect = useCallback(async () => {
    const storedHost = localStorage.getItem('tankHost');
    console.log('ConnectionGuard: handleAutoReconnect called', { storedHost, isAutoReconnecting });
    
    if (!storedHost || isAutoReconnecting) {
      console.log('ConnectionGuard: Skipping auto-reconnect - no stored host or already reconnecting');
      return;
    }

    console.log('ConnectionGuard: Starting auto-reconnection process');
    setIsAutoReconnecting(true);
    setAutoReconnectAttempts(prev => prev + 1);
    const statusMessage = `Attempting to reconnect... (${autoReconnectAttempts + 1}/${maxAutoReconnectAttempts})`;
    setConnectionStatus(statusMessage);
    
    // Send reconnection status to Dashboard
    window.dispatchEvent(new CustomEvent('reconnectionStatus', { 
      detail: { 
        status: statusMessage,
        isReconnecting: true,
        attempt: autoReconnectAttempts + 1,
        maxAttempts: maxAutoReconnectAttempts
      } 
    }));

    // Wait a bit before attempting reconnection with exponential backoff
    const delay = Math.min(2000 * Math.pow(1.5, autoReconnectAttempts), 10000); // Max 10 seconds
    console.log(`ConnectionGuard: Waiting ${delay}ms before reconnecting to ${storedHost}`);
    setTimeout(() => {
      console.log(`ConnectionGuard: Attempting reconnection to ${storedHost} (attempt ${autoReconnectAttempts + 1}/${maxAutoReconnectAttempts})`);
      connect(storedHost);
      setIsAutoReconnecting(false);
    }, delay);
  }, [connect, autoReconnectAttempts, isAutoReconnecting]);

  // Background reconnection function
  const startBackgroundReconnection = useCallback(() => {
    const storedHost = localStorage.getItem('tankHost');
    if (!storedHost || isBackgroundReconnecting) return;

    // Stop any existing background reconnection
    stopBackgroundReconnection();

    console.log('ConnectionGuard: Starting background reconnection');
    setIsBackgroundReconnecting(true);
    
    const backgroundReconnect = () => {
      // Check if we're still in device not found state and not connected
      if (!showDeviceNotFound || isConnected) {
        console.log('ConnectionGuard: Background reconnection no longer needed');
        setBackgroundReconnectTimeout(null);
        setIsBackgroundReconnecting(false);
        return;
      }

      console.log('ConnectionGuard: Background reconnection attempt');
      connect(storedHost);
      
      // Schedule next attempt only if still needed
      if (showDeviceNotFound && !isConnected) {
        const timeout = setTimeout(backgroundReconnect, 30000);
        setBackgroundReconnectTimeout(timeout);
      } else {
        setIsBackgroundReconnecting(false);
      }
    };

    // Start first attempt after 5 seconds
    const initialTimeout = setTimeout(backgroundReconnect, 5000);
    setBackgroundReconnectTimeout(initialTimeout);
  }, [connect, isConnected, showDeviceNotFound, stopBackgroundReconnection, isBackgroundReconnecting]);

  // Handle auto-reconnection when connection is lost
  useEffect(() => {
    console.log('ConnectionGuard: Checking auto-reconnection conditions:', {
      isConnected,
      hasError: !!appState.error,
      error: appState.error,
      isFirstConnection,
      isConnecting,
      autoReconnectAttempts,
      maxAutoReconnectAttempts
    });

        if (!isConnected && appState.error && !isFirstConnection && !isConnecting && !isBackgroundReconnecting) {
          console.log('ConnectionGuard: Connection lost, starting auto-reconnection process');
          setConnectionStatus(`Connection lost: ${appState.error}`);
          setIsConnecting(false);
          
          // Start auto-reconnection process
          if (autoReconnectAttempts < maxAutoReconnectAttempts) {
            console.log(`ConnectionGuard: Starting auto-reconnection attempt ${autoReconnectAttempts + 1}/${maxAutoReconnectAttempts}`);
            handleAutoReconnect();
          } else {
            console.log('ConnectionGuard: Max auto-reconnection attempts reached, showing device not found screen');
            // Show device not found screen and start background reconnection
            setShowDeviceNotFound(true);
            setLastError(`Unable to reconnect after ${maxAutoReconnectAttempts} attempts. Please check your connection.`);
            // Clear reconnection status
            window.dispatchEvent(new CustomEvent('reconnectionStatus', { 
              detail: { 
                status: '',
                isReconnecting: false,
                attempt: 0,
                maxAttempts: 0
              } 
            }));
            // Start background reconnection
            startBackgroundReconnection();
          }
        }
  }, [isConnected, appState.error, isFirstConnection, isConnecting, autoReconnectAttempts, handleAutoReconnect, isBackgroundReconnecting, startBackgroundReconnection]);

  // Cleanup effect to stop background reconnection on unmount
  useEffect(() => {
    return () => {
      stopBackgroundReconnection();
    };
  }, [stopBackgroundReconnection]);

  const handleManualConnect = (host: string) => {
    setLastError(null);
    setConnectionStatus(`Connecting to ${host}...`);
    setIsConnecting(true);
    setAutoReconnectAttempts(0); // Reset auto-reconnect attempts
    setIsAutoReconnecting(false); // Stop any ongoing auto-reconnection
    // Clear reconnection status
    window.dispatchEvent(new CustomEvent('reconnectionStatus', { 
      detail: { 
        status: '',
        isReconnecting: false,
        attempt: 0,
        maxAttempts: 0
      } 
    }));
    connect(host);
    setConnectionAttempts(prev => prev + 1);
    setShowConnectionModal(false);
  };

  const handleRetryConnection = () => {
    if (connectionAttempts < maxConnectionAttempts) {
      const storedHost = localStorage.getItem('tankHost');
      if (storedHost) {
        connect(storedHost);
        setConnectionAttempts(prev => prev + 1);
      } else {
        setShowConnectionModal(true);
      }
    } else {
      setLastError('Maximum connection attempts reached. Please check your ESP32 device and network settings.');
    }
  };

  const handleResetConnection = () => {
    console.log('Resetting connection...');
    disconnect();
    setConnectionAttempts(0);
    setAutoReconnectAttempts(0);
    setIsAutoReconnecting(false);
    setLastError(null);
    setConnectionStatus('');
    setIsConnecting(false);
    setIsScanning(false);
    setDiscoveredDevices([]);
    setShowDeviceNotFound(false);
    stopBackgroundReconnection(); // Stop background reconnection
    // Clear stored host to prevent auto-reconnect
    localStorage.removeItem('tankHost');
  };

  // Handlers for device not found screen
  const handleRetryFromDeviceNotFound = () => {
    const storedHost = localStorage.getItem('tankHost');
    if (storedHost) {
      handleManualConnect(storedHost);
    }
  };

  const handleOpenConnectionSettingsFromDeviceNotFound = () => {
    setShowConnectionModal(true);
  };

  // Show connection screen only on first connection
  if (!isConnected && isFirstConnection) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wifi className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              Smart Water Tank
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Connect to your ESP32 device to continue
            </p>
          </div>

          {/* Connection Status */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {isScanning ? (
                  <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                ) : isConnecting ? (
                  <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />
                ) : isConnected ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {isScanning ? 'Scanning for devices...' : 
                   isConnecting ? 'Connecting...' : 
                   isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm text-gray-500">
                  Attempt {connectionAttempts + 1}/{maxConnectionAttempts}
                </div>
                <button
                  onClick={() => setShowNetworkInfo(true)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="View Network Information"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Connection Status */}
            {connectionStatus && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  {isConnecting ? (
                    <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : isConnected ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-500" />
                  )}
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {connectionStatus}
                  </span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {lastError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {lastError}
                  </div>
                </div>
              </div>
            )}

            {/* HTTPS Mixed Content Warning */}
            {window.location.protocol === 'https:' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 dark:text-yellow-200 font-medium">HTTPS Mixed Content Issue</p>
                    <p className="text-yellow-600 dark:text-yellow-300 text-sm mb-2">
                      You're accessing this app over HTTPS, but ESP32 devices typically use HTTP/WebSocket connections. 
                      This creates a security restriction that blocks local network connections.
                    </p>
                    <div className="text-xs text-yellow-600 dark:text-yellow-300 space-y-1">
                      <p><strong>Solutions:</strong></p>
                      <p>• Use local development server: <code>npm run dev</code></p>
                      <p>• Access via HTTP: <code>http://localhost:5173</code></p>
                      <p>• Use ESP32 with HTTPS support (advanced)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* App State Error */}
            {appState.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {appState.error}
                  </div>
                </div>
              </div>
            )}

            {/* Discovered Devices */}
            {discoveredDevices.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Found Devices:
                </h3>
                <div className="space-y-2">
                  {discoveredDevices.map((device, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        <Wifi className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          {device}
                        </span>
                      </div>
                      <button
                        onClick={() => handleManualConnect(device)}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md transition-colors"
                      >
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleScanForDevices}
                disabled={isScanning}
                className="
                  w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300
                  text-white rounded-lg transition-colors font-medium
                  flex items-center justify-center space-x-2
                "
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>Scan for ESP32 Devices</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowConnectionModal(true)}
                className="
                  w-full px-4 py-3 border border-gray-300 dark:border-gray-600
                  text-gray-700 dark:text-gray-300 rounded-lg
                  hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                  font-medium flex items-center justify-center space-x-2
                "
              >
                <Settings className="w-4 h-4" />
                <span>Manual Connection</span>
              </button>

              <button
                onClick={handleResetConnection}
                className="
                  w-full px-4 py-3 bg-red-500 hover:bg-red-600
                  text-white rounded-lg transition-colors font-medium
                  flex items-center justify-center space-x-2
                "
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset Connection</span>
              </button>

              {connectionAttempts > 0 && connectionAttempts < maxConnectionAttempts && (
                <button
                  onClick={handleRetryConnection}
                  className="
                    w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-600
                    text-white rounded-lg transition-colors font-medium
                    flex items-center justify-center space-x-2
                  "
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Connection</span>
                </button>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => setShowTroubleshooting(true)}
                  className="
                    px-4 py-3 border border-blue-300 dark:border-blue-600
                    text-blue-700 dark:text-blue-300 rounded-lg
                    hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors
                    font-medium flex items-center justify-center space-x-2
                  "
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Advanced Troubleshooting</span>
                </button>

                <button
                  onClick={() => setShowNetworkInfo(true)}
                  className="
                    px-4 py-3 border border-green-300 dark:border-green-600
                    text-green-700 dark:text-green-300 rounded-lg
                    hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors
                    font-medium flex items-center justify-center space-x-2
                  "
                >
                  <Info className="w-4 h-4" />
                  <span>Network Information</span>
                </button>
              </div>
            </div>
          </div>

          {/* Troubleshooting Guide */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-2">Troubleshooting Tips:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Ensure ESP32 is powered on and connected to WiFi</li>
                  <li>• Check that both devices are on the same network</li>
                  <li>• Verify ESP32 IP address in Serial Monitor</li>
                  <li>• Try restarting the ESP32 device</li>
                  <li>• Check firewall settings on your device</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Modal */}
        <ConnectionModal
          isOpen={showConnectionModal}
          onClose={() => setShowConnectionModal(false)}
          onConnect={handleManualConnect}
          currentHost={localStorage.getItem('tankHost') || ''}
        />

        {/* Troubleshooting Guide */}
        <TroubleshootingGuide
          isOpen={showTroubleshooting}
          onClose={() => setShowTroubleshooting(false)}
          currentHost={localStorage.getItem('tankHost') || ''}
          onTestConnection={async (host: string) => {
            try {
              const result = await testConnection(host, 81);
              return result.success;
            } catch {
              return false;
            }
          }}
        />

        {/* Network Information */}
        <NetworkInfo
          isOpen={showNetworkInfo}
          onClose={() => setShowNetworkInfo(false)}
        />
      </div>
    );
  }

  // Show device not found screen if connection failed after max attempts
  if (showDeviceNotFound) {
    return (
      <>
        <DeviceNotFoundScreen
          onOpenConnectionSettings={handleOpenConnectionSettingsFromDeviceNotFound}
          onRetryConnection={handleRetryFromDeviceNotFound}
          isRetrying={isConnecting}
          lastError={lastError}
        />
        <ConnectionModal
          isOpen={showConnectionModal}
          onClose={() => setShowConnectionModal(false)}
          onConnect={(host) => {
            handleManualConnect(host);
            setAutoReconnectAttempts(0); // Reset auto-reconnect attempts
          }}
          currentHost={localStorage.getItem('tankHost') || ''}
        />
      </>
    );
  }

  // Show dashboard if connected, or show connection modal for subsequent disconnections
  return (
    <>
      {children}
      
      {/* Connection Modal for non-first connection disconnections */}
      {!isConnected && !isFirstConnection && !showDeviceNotFound && (
        <ConnectionModal
          isOpen={showConnectionModal}
          onClose={() => setShowConnectionModal(false)}
          onConnect={(host) => {
            handleManualConnect(host);
            setAutoReconnectAttempts(0); // Reset auto-reconnect attempts
          }}
          currentHost={localStorage.getItem('tankHost') || ''}
        />
      )}
      
      {/* Network Info Modal */}
      <NetworkInfo
        isOpen={showNetworkInfo}
        onClose={() => setShowNetworkInfo(false)}
      />
      
      {/* Troubleshooting Guide Modal */}
      <TroubleshootingGuide
        isOpen={showTroubleshooting}
        onClose={() => setShowTroubleshooting(false)}
        onTestConnection={async (host: string) => {
          try {
            const result = await testConnection(host);
            return result.success;
          } catch {
            return false;
          }
        }}
      />
    </>
  );
};
