import React from 'react';
import { Wifi, WifiOff, Clock, Zap, Settings, AlertCircle } from 'lucide-react';

interface StatusCardProps {
  connected: boolean;
  lastUpdated: string;
  runtime: number;
  motorStatus: 'ON' | 'OFF';
  mode: 'auto' | 'manual';
  autoModeReasons: string[];
  onSyncData: () => void;
  className?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  connected,
  lastUpdated,
  runtime,
  motorStatus,
  mode,
  autoModeReasons,
  onSyncData,
  className = ''
}) => {
  const formatRuntime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700
      p-6 transition-all duration-300
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
          System Status
        </h2>
        <button
          onClick={onSyncData}
          className="
            px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg
            transition-colors duration-200 font-medium text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          "
        >
          Sync Data
        </button>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center space-x-3">
          {connected ? (
            <Wifi className="w-5 h-5 text-green-500" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-500" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Server Status
            </p>
            <p className={`text-lg font-bold ${connected ? 'text-green-600' : 'text-red-600'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Zap className={`w-5 h-5 ${motorStatus === 'ON' ? 'text-green-500' : 'text-gray-400'}`} />
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Motor Status
            </p>
            <p className={`text-lg font-bold ${motorStatus === 'ON' ? 'text-green-600' : 'text-gray-600'}`}>
              {motorStatus}
            </p>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <Clock className="w-5 h-5 text-blue-500" />
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Last Updated
            </p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
              {formatLastUpdated(lastUpdated)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Settings className="w-5 h-5 text-purple-500" />
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Runtime
            </p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
              {formatRuntime(runtime)}
            </p>
          </div>
        </div>
      </div>

      {/* System Mode */}
      <div className="mb-4">
        <div className="flex items-center space-x-3 mb-3">
          <Settings className="w-5 h-5 text-indigo-500" />
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              System Mode
            </p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200 capitalize">
              {mode} Mode
            </p>
          </div>
        </div>

        {/* Auto Mode Reasons */}
        {mode === 'auto' && autoModeReasons.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Active Reasons:
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  {autoModeReasons.map((reason, index) => (
                    <li key={index} className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
