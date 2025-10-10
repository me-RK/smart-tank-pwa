import React from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

interface DeviceNotFoundScreenProps {
  onOpenConnectionSettings: () => void;
  onRetryConnection: () => void;
  isRetrying: boolean;
  lastError?: string | null;
}

export const DeviceNotFoundScreen: React.FC<DeviceNotFoundScreenProps> = ({
  onOpenConnectionSettings,
  onRetryConnection,
  isRetrying,
  lastError
}) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation Bar */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">WT</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                Smart Water Tank
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              {/* Retry Connection Button */}
              <button
                onClick={onRetryConnection}
                disabled={isRetrying}
                className="
                  flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600
                  text-white rounded-lg transition-colors font-medium text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry Connection</span>
                  </>
                )}
              </button>

              {/* Connection Settings Button */}
              <button
                onClick={onOpenConnectionSettings}
                className="
                  flex items-center space-x-2 px-4 py-2 bg-gray-500 hover:bg-gray-600
                  text-white rounded-lg transition-colors font-medium text-sm
                  focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                "
              >
                <Wifi className="w-4 h-4" />
                <span>Connection Settings</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          {/* Icon */}
          <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <WifiOff className="w-12 h-12 text-orange-500" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Device Not Found
          </h1>

          {/* Description */}
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Unable to connect to your Smart Water Tank device. The system is still trying to reconnect in the background.
          </p>

          {/* Error Details */}
          {lastError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    Connection Error
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {lastError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
            <div className="flex items-center space-x-3">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              <div className="text-left">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Background Reconnection Active
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  The system is automatically trying to reconnect to your device. You can continue using the app while this happens.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onRetryConnection}
              disabled={isRetrying}
              className="
                flex items-center justify-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600
                text-white rounded-lg transition-colors font-medium
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Retrying Connection...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>Try Again</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenConnectionSettings}
              className="
                flex items-center justify-center space-x-2 px-6 py-3 bg-gray-500 hover:bg-gray-600
                text-white rounded-lg transition-colors font-medium
                focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
              "
            >
              <Wifi className="w-5 h-5" />
              <span>Connection Settings</span>
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-12 text-sm text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Troubleshooting Tips:</h3>
            <ul className="space-y-2 text-left">
              <li>• Ensure your ESP32 device is powered on and connected to WiFi</li>
              <li>• Check that both devices are on the same network</li>
              <li>• Verify the ESP32 IP address in the Serial Monitor</li>
              <li>• Try restarting the ESP32 device</li>
              <li>• Check firewall settings on your device</li>
              <li>• Use the Connection Settings to scan for devices or enter a different IP address</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};
