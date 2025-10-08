import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../context/useWebSocket';
import { ConnectionModal } from './ConnectionModal';
import { TroubleshootingGuide } from './TroubleshootingGuide';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Settings, HelpCircle } from 'lucide-react';
import { testConnection, discoverEsp32Devices } from '../utils/connectionTest';

interface ConnectionGuardProps {
  children: React.ReactNode;
}

export const ConnectionGuard: React.FC<ConnectionGuardProps> = ({ children }) => {
  const { isConnected, appState, connect } = useWebSocket();
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<string[]>([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  const maxConnectionAttempts = 3;

  const handleScanForDevices = useCallback(async () => {
    setIsScanning(true);
    setLastError(null);
    
    try {
      const devices = await discoverEsp32Devices();
      setDiscoveredDevices(devices);
      
      if (devices.length > 0) {
        // Try to connect to the first discovered device
        const firstDevice = devices[0];
        console.log(`Found ESP32 device at ${firstDevice}, attempting connection...`);
        connect(firstDevice);
        setConnectionAttempts(prev => prev + 1);
      } else {
        setLastError('No ESP32 devices found on the network. Please check your device and try again.');
      }
    } catch (error) {
      console.error('Device scan failed:', error);
      setLastError('Failed to scan for devices. Please check your network connection.');
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Auto-scan for devices on first load
  useEffect(() => {
    if (!isConnected && connectionAttempts === 0) {
      handleScanForDevices();
    }
  }, [isConnected, connectionAttempts, handleScanForDevices]);

  const handleManualConnect = (host: string) => {
    setLastError(null);
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


  // Show connection screen if not connected
  if (!isConnected) {
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
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {isScanning ? 'Scanning for devices...' : 'Not Connected'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Attempt {connectionAttempts + 1}/{maxConnectionAttempts}
              </div>
            </div>

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

              <button
                onClick={() => setShowTroubleshooting(true)}
                className="
                  w-full px-4 py-3 border border-blue-300 dark:border-blue-600
                  text-blue-700 dark:text-blue-300 rounded-lg
                  hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors
                  font-medium flex items-center justify-center space-x-2
                "
              >
                <HelpCircle className="w-4 h-4" />
                <span>Advanced Troubleshooting</span>
              </button>
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
      </div>
    );
  }

  // Show dashboard if connected
  return <>{children}</>;
};
