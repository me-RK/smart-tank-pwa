import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/useWebSocket';
import { StatusCard } from '../components/StatusCard';
import { TankLevelCard } from '../components/TankLevelCard';
import { ConnectionModal } from '../components/ConnectionModal';
import { Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { appState, sendMessage, connect, disconnect, isConnected } = useWebSocket();
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSyncData = async () => {
    setIsRefreshing(true);
    
    // Send sync request to server
    sendMessage({
      type: 'sync',
      timestamp: new Date().toISOString()
    });

    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };


  const handlePump1Toggle = () => {
    sendMessage({
      type: 'pump1Control',
      timestamp: new Date().toISOString()
    });
  };

  const handlePump2Toggle = () => {
    sendMessage({
      type: 'pump2Control',
      timestamp: new Date().toISOString()
    });
  };

  const handleSystemToggle = () => {
    sendMessage({
      type: 'systemControl',
      timestamp: new Date().toISOString()
    });
  };

  const handleConnect = () => {
    setShowConnectionModal(true);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">WT</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Smart Water Tank
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Connection Controls */}
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  className="
                    flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600
                    text-white rounded-lg transition-colors font-medium text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  "
                >
                  <Wifi className="w-4 h-4" />
                  <span>Connect</span>
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="
                    flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600
                    text-white rounded-lg transition-colors font-medium text-sm
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                  "
                >
                  <WifiOff className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
              )}

              {/* Settings Button */}
              <button
                onClick={() => navigate('/settings')}
                className="
                  p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                  hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                "
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Card */}
        <div className="mb-8">
          <StatusCard
            connected={appState.systemStatus.connected}
            lastUpdated={appState.systemStatus.lastUpdated}
            runtime={appState.systemStatus.runtime}
            motorStatus={appState.systemStatus.motorStatus}
            mode={appState.systemStatus.mode}
            autoModeReasons={appState.systemStatus.autoModeReasons}
            onSyncData={handleSyncData}
          />
        </div>

        {/* Tank Levels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TankLevelCard
            tankName="Tank A"
            upperLevel={appState.tankData.tankA.upper}
            lowerLevel={appState.tankData.tankA.lower}
            isActive={appState.systemSettings.sensors.upperTankA || appState.systemSettings.sensors.lowerTankA}
          />
          <TankLevelCard
            tankName="Tank B"
            upperLevel={appState.tankData.tankB.upper}
            lowerLevel={appState.tankData.tankB.lower}
            isActive={appState.systemSettings.sensors.upperTankB || appState.systemSettings.sensors.lowerTankB}
          />
        </div>

        {/* Pump Control */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Pump Control
          </h3>
          
          {/* System Control */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  System Control
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Enable/disable the entire system
                </p>
              </div>
              <button
                onClick={handleSystemToggle}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-colors
                  ${appState.systemStatus.connected 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
                disabled={!appState.systemStatus.connected}
              >
                {appState.systemStatus.connected ? 'System ON' : 'System OFF'}
              </button>
            </div>
          </div>

          {/* Pump Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pump 1 */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pump 1
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Primary pump control
                  </p>
                </div>
                <button
                  onClick={handlePump1Toggle}
                  className={`
                    px-3 py-1 rounded-md text-sm font-medium transition-colors
                    ${appState.systemStatus.connected 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                  disabled={!appState.systemStatus.connected}
                >
                  Toggle Pump 1
                </button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Status: {appState.systemStatus.connected ? 'Ready' : 'Disconnected'}
              </div>
            </div>

            {/* Pump 2 */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pump 2
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Secondary pump control
                  </p>
                </div>
                <button
                  onClick={handlePump2Toggle}
                  className={`
                    px-3 py-1 rounded-md text-sm font-medium transition-colors
                    ${appState.systemStatus.connected 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                  disabled={!appState.systemStatus.connected}
                >
                  Toggle Pump 2
                </button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Status: {appState.systemStatus.connected ? 'Ready' : 'Disconnected'}
              </div>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <WifiOff className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                  Not connected to ESP32 device
                </span>
              </div>
              <button
                onClick={handleConnect}
                className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded-md transition-colors"
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {appState.error && (
          <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm text-red-700 dark:text-red-300 font-medium">
                Error: {appState.error}
              </span>
            </div>
          </div>
        )}

        {/* Refresh Indicator */}
        {isRefreshing && (
          <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Syncing data...</span>
          </div>
        )}
      </main>

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnect={(host) => {
          connect(host);
          setShowConnectionModal(false);
        }}
        currentHost={localStorage.getItem('tankHost') || ''}
      />
    </div>
  );
};
