import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/useWebSocket';
import { usePageData } from '../hooks/usePageData';
import { StatusCard } from '../components/StatusCard';
import { IndividualTankCard } from '../components/IndividualTankCard';
import { AnimatedCard, FadeIn, SlideIn } from '../components/AnimatedCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { Settings, Wifi, WifiOff, RefreshCw, Loader2, WifiIcon } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { appState, sendMessage, connect, disconnect, isConnected } = useWebSocket();
  const { startDashboardSync, stopDashboardSync } = usePageData();

  // Debug logging for tank data and sensor states
  useEffect(() => {
    console.log('Dashboard - Tank Data:', appState.tankData);
    console.log('Dashboard - Sensor States:', appState.systemSettings.sensors);
    console.log('Dashboard - System Status:', appState.systemStatus);
  }, [appState.tankData, appState.systemSettings.sensors, appState.systemStatus]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectionStatus, setReconnectionStatus] = useState<string>('');
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(false);
  
  // Auto-sync functionality
  const [syncInterval, setSyncInterval] = useState<number>(() => {
    const saved = localStorage.getItem('dashboardSyncInterval');
    return saved ? parseInt(saved, 10) : 5000; // Default 5 seconds
  });

  const handleSyncData = useCallback(async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    
    // Send unified data request - gets all necessary data in one call
    sendMessage({
      type: 'getAllData'
    });

    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, [isConnected, sendMessage]);

  const updateSyncInterval = useCallback((newInterval: number) => {
    setSyncInterval(newInterval);
    localStorage.setItem('dashboardSyncInterval', newInterval.toString());
    
    // Restart auto-sync with new interval
    if (isConnected) {
      startDashboardSync();
    }
  }, [isConnected, startDashboardSync]);

  // Connection handling functions
  const handleConnect = async () => {
    const lastHost = localStorage.getItem('tankHost');
    if (!lastHost) {
      // Trigger connection modal through ConnectionGuard
      window.dispatchEvent(new CustomEvent('openConnectionModal'));
      return;
    }

    setIsConnecting(true);
    try {
      await connect(lastHost);
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleConnectionSettings = () => {
    // Trigger connection modal through ConnectionGuard
    window.dispatchEvent(new CustomEvent('openConnectionModal'));
  };


  // Effect to manage auto-sync based on connection status and sync interval changes
  // Note: This is now handled by usePageData hook, so we don't need to start/stop here
  // The usePageData hook will handle page-specific data fetching
  useEffect(() => {
    // Only stop dashboard sync when disconnected
    if (!isConnected) {
      stopDashboardSync();
    }

    // Cleanup on unmount
    return () => {
      stopDashboardSync();
    };
  }, [isConnected, stopDashboardSync]);

  // Listen for sync interval changes from Settings page
  useEffect(() => {
    const handleSyncIntervalChange = (event: CustomEvent) => {
      const newInterval = event.detail.interval;
      updateSyncInterval(newInterval);
    };

    window.addEventListener('syncIntervalChanged', handleSyncIntervalChange as EventListener);
    
    return () => {
      window.removeEventListener('syncIntervalChanged', handleSyncIntervalChange as EventListener);
    };
  }, [updateSyncInterval]);

  // Listen for reconnection status updates from ConnectionGuard
  useEffect(() => {
    const handleReconnectionStatus = (event: CustomEvent) => {
      setReconnectionStatus(event.detail.status);
      setIsAutoReconnecting(event.detail.status !== '');
    };

    window.addEventListener('reconnectionStatus', handleReconnectionStatus as EventListener);
    return () => {
      window.removeEventListener('reconnectionStatus', handleReconnectionStatus as EventListener);
    };
  }, []);


  const handleMotorToggle = (motorNumber: 1 | 2) => {
    const currentMotorState = motorNumber === 1 ? appState.systemStatus.motor1Status : appState.systemStatus.motor2Status;
    const isMotorCurrentlyOn = currentMotorState === 'ON';
    const newMotorState = !isMotorCurrentlyOn;
    
    sendMessage({
      type: newMotorState ? `motor${motorNumber}On` : `motor${motorNumber}Off`
    });
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

            <div className="flex items-center space-x-3">
              {/* Connect/Disconnect Button with Settings */}
              <div className="relative">
                <button
                  onClick={isConnected ? handleDisconnect : handleConnect}
                  onMouseDown={(e) => {
                    if (!isConnected && !isAutoReconnecting) {
                      e.preventDefault();
                      const timer = setTimeout(() => {
                        handleConnectionSettings();
                      }, 500); // Long press after 500ms
                      
                      const handleMouseUp = () => {
                        clearTimeout(timer);
                        document.removeEventListener('mouseup', handleMouseUp);
                      };
                      
                      document.addEventListener('mouseup', handleMouseUp);
                    }
                  }}
                  disabled={isConnecting || isAutoReconnecting}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${isConnected 
                      ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500' 
                      : isAutoReconnecting
                      ? 'bg-orange-500 text-white focus:ring-orange-500'
                      : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500'
                    }
                    ${(isConnecting || isAutoReconnecting) ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : isAutoReconnecting ? (
                    <>
                      <Wifi className="w-4 h-4 animate-pulse" />
                      <span>Reconnecting...</span>
                    </>
                  ) : isConnected ? (
                    <>
                      <WifiOff className="w-4 h-4" />
                      <span>Disconnect</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4" />
                      <span>Connect</span>
                    </>
                  )}
                </button>
                
                {/* Settings Icon Overlay for Connect Button */}
                {!isConnected && !isConnecting && !isAutoReconnecting && (
                  <button
                    onClick={handleConnectionSettings}
                    className="
                      absolute -top-1 -right-1 w-5 h-5 bg-gray-600 hover:bg-gray-700
                      text-white rounded-full flex items-center justify-center
                      transition-colors text-xs
                    "
                    title="Connection Settings"
                  >
                    <WifiIcon className="w-3 h-3" />
                  </button>
                )}
              </div>



              {/* Theme Toggle */}
              <ThemeToggle />

              {/* PWA Install Button */}
              <PWAInstallButton />

              {/* Settings Button */}
              <button
                onClick={() => navigate('/settings')}
                className="
                  p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                  hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                "
                title="System Settings"
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
        <FadeIn delay={100}>
          <div className="mb-8">
            <AnimatedCard direction="up" delay={100}>
              <StatusCard
                connected={appState.systemStatus.connected}
                lastUpdated={appState.systemStatus.lastUpdated}
                runtime={appState.systemStatus.runtime}
                motorStatus={appState.systemStatus.motorStatus === 'ON' ? 'ON' : 'OFF'}
                motor1Status={appState.systemStatus.motor1Status}
                motor2Status={appState.systemStatus.motor2Status}
                motor1Enabled={appState.systemStatus.motor1Enabled}
                motor2Enabled={appState.systemStatus.motor2Enabled}
                motorConfig={appState.systemStatus.motorConfig}
                mode={appState.systemStatus.mode === 'Auto Mode' ? 'auto' : 'manual'}
                autoModeReasons={appState.systemStatus.autoModeReasons ? [appState.systemStatus.autoModeReasons] : []}
                autoModeReasonMotor1={appState.systemStatus.autoModeReasonMotor1}
                autoModeReasonMotor2={appState.systemStatus.autoModeReasonMotor2}
              />
            </AnimatedCard>
          </div>
        </FadeIn>

        {/* Tank Monitoring */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              Tank Monitoring
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  Auto-sync:
                </label>
                <select
                  value={syncInterval}
                  onChange={(e) => updateSyncInterval(parseInt(e.target.value, 10))}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={0}>Off</option>
                  <option value={2000}>2s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={30000}>30s</option>
                  <option value={60000}>1m</option>
                </select>
              </div>
              <button
                onClick={handleSyncData}
                disabled={!isConnected || isRefreshing}
                className={`
                  px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center space-x-1
                  ${isConnected && !isRefreshing
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            </div>
          </div>
          
          {/* Individual Tank Cards - Only show active sensors */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Tank A Upper */}
            {appState.systemSettings.sensors.upperTankA && (
              <AnimatedCard direction="left" delay={200}>
                <IndividualTankCard
                  tankName="Tank A"
                  tankType="upper"
                  level={appState.tankData.tankA.upper}
                  isActive={appState.systemSettings.sensors.upperTankA}
                />
              </AnimatedCard>
            )}
            
            {/* Tank A Lower */}
            {appState.systemSettings.sensors.lowerTankA && (
              <AnimatedCard direction="left" delay={250}>
                <IndividualTankCard
                  tankName="Tank A"
                  tankType="lower"
                  level={appState.tankData.tankA.lower}
                  isActive={appState.systemSettings.sensors.lowerTankA}
                />
              </AnimatedCard>
            )}
            
            {/* Tank B Upper */}
            {appState.systemSettings.sensors.upperTankB && (
              <AnimatedCard direction="right" delay={300}>
                <IndividualTankCard
                  tankName="Tank B"
                  tankType="upper"
                  level={appState.tankData.tankB.upper}
                  isActive={appState.systemSettings.sensors.upperTankB}
                />
              </AnimatedCard>
            )}
            
            {/* Tank B Lower */}
            {appState.systemSettings.sensors.lowerTankB && (
              <AnimatedCard direction="right" delay={350}>
                <IndividualTankCard
                  tankName="Tank B"
                  tankType="lower"
                  level={appState.tankData.tankB.lower}
                  isActive={appState.systemSettings.sensors.lowerTankB}
                />
              </AnimatedCard>
            )}
          </div>
          
          {/* Show message if no tanks are enabled */}
          {!(appState.systemSettings.sensors.upperTankA || appState.systemSettings.sensors.lowerTankA || 
             appState.systemSettings.sensors.upperTankB || appState.systemSettings.sensors.lowerTankB) && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <div className="text-gray-500 dark:text-gray-400">
                <p className="text-sm font-medium mb-2">No Tank Sensors Enabled</p>
                <p className="text-xs">
                  Enable tank sensors in Settings to monitor tank levels
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Debug Panel - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Debug Info</h3>
            <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
              <div><strong>Sensor States:</strong> {JSON.stringify(appState.systemSettings.sensors)}</div>
              <div><strong>Tank Data:</strong> {JSON.stringify(appState.tankData)}</div>
              <div><strong>Connected:</strong> {appState.isConnected ? 'Yes' : 'No'}</div>
              <div><strong>System Mode:</strong> {appState.systemStatus.mode}</div>
            </div>
          </div>
        )}

        {/* Auto Mode Reason Display */}
        {appState.systemStatus.mode === 'Auto Mode' && appState.systemStatus.autoModeReasons && appState.systemStatus.autoModeReasons !== 'NONE' && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Auto Mode Reason: {appState.systemStatus.autoModeReasons}
              </span>
            </div>
          </div>
        )}


        {/* Motor Control */}
        <SlideIn direction="up" delay={400}>
          <AnimatedCard direction="up" delay={400}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Motor Control
          </h3>
          
          {/* Motor Configuration Info */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Motor Configuration: {appState.systemStatus.motorConfig}
            </h4>
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <div>Motor 1: {appState.systemStatus.motor1Enabled ? 'Enabled' : 'Disabled'} - Status: {appState.systemStatus.motor1Status}</div>
              <div>Motor 2: {appState.systemStatus.motor2Enabled ? 'Enabled' : 'Disabled'} - Status: {appState.systemStatus.motor2Status}</div>
            </div>
          </div>

          {/* Manual Mode Motor Control */}
          {appState.systemStatus.mode === 'Manual Mode' && (
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-4">
                Manual Motor Control
              </h4>
              
              {/* Motor 1 Control */}
              {appState.systemStatus.motor1Enabled && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Motor 1 Control
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Status: {appState.systemStatus.motor1Status}
                      </p>
                    </div>
                    <button
                      onClick={() => handleMotorToggle(1)}
                      className={`
                        px-4 py-2 rounded-lg font-medium transition-colors text-sm
                        ${appState.systemStatus.connected 
                          ? (appState.systemStatus.motor1Status === 'ON' 
                              ? 'bg-red-500 hover:bg-red-600 text-white' 
                              : 'bg-green-500 hover:bg-green-600 text-white')
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }
                      `}
                      disabled={!appState.systemStatus.connected}
                    >
                      {appState.systemStatus.motor1Status === 'ON' ? 'Turn OFF Motor 1' : 'Turn ON Motor 1'}
                    </button>
                  </div>
                </div>
              )}

              {/* Motor 2 Control */}
              {appState.systemStatus.motor2Enabled && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Motor 2 Control
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Status: {appState.systemStatus.motor2Status}
                      </p>
                    </div>
                    <button
                      onClick={() => handleMotorToggle(2)}
                      className={`
                        px-4 py-2 rounded-lg font-medium transition-colors text-sm
                        ${appState.systemStatus.connected 
                          ? (appState.systemStatus.motor2Status === 'ON' 
                              ? 'bg-red-500 hover:bg-red-600 text-white' 
                              : 'bg-green-500 hover:bg-green-600 text-white')
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }
                      `}
                      disabled={!appState.systemStatus.connected}
                    >
                      {appState.systemStatus.motor2Status === 'ON' ? 'Turn OFF Motor 2' : 'Turn ON Motor 2'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Auto Mode Information */}
          {appState.systemStatus.mode === 'Auto Mode' && (
            <div className="mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Auto Mode Active
                  </span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                  Motors are automatically controlled based on tank levels and system settings.
                </p>
                
                {/* Motor 1 Automation Reason */}
                {appState.systemStatus.motor1Enabled && (
                  <div className="mb-2">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      <strong>Motor 1:</strong> {appState.systemStatus.motor1Status} - {appState.systemStatus.autoModeReasonMotor1}
                    </p>
                  </div>
                )}
                
                {/* Motor 2 Automation Reason */}
                {appState.systemStatus.motor2Enabled && (
                  <div className="mb-2">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      <strong>Motor 2:</strong> {appState.systemStatus.motor2Status} - {appState.systemStatus.autoModeReasonMotor2}
                    </p>
                  </div>
                )}
                
                {/* Legacy Motor Status */}
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  <strong>Overall Status:</strong> {appState.systemStatus.motorStatus}
                </p>
              </div>
            </div>
          )}

          {/* System Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* System Mode */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    System Mode
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Current operation mode
                  </p>
                </div>
                <div className={`
                  px-3 py-1 rounded-md text-sm font-medium
                  ${appState.systemStatus.mode === 'Auto Mode' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }
                `}>
                  {appState.systemStatus.mode}
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {appState.systemStatus.mode === 'Auto Mode' 
                  ? 'Automated control based on tank levels' 
                  : 'Manual control required'
                }
              </div>
            </div>

            {/* Motor Status */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Motor Status
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Current motor state
                  </p>
                </div>
                <div className={`
                  px-3 py-1 rounded-md text-sm font-medium
                  ${appState.systemStatus.motorStatus === 'ON' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                  }
                `}>
                  {appState.systemStatus.motorStatus}
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {appState.systemStatus.connected ? 'Connected to ESP32' : 'Disconnected'}
              </div>
            </div>
          </div>
            </div>
          </AnimatedCard>
        </SlideIn>



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

        {/* Reconnection Status Indicator */}
        {reconnectionStatus && (
          <div className="fixed bottom-4 left-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">{reconnectionStatus}</span>
          </div>
        )}
      </main>

    </div>
  );
};
