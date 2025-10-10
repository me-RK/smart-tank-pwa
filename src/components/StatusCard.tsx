import React from 'react';
import { Wifi, WifiOff, Clock, Zap, Settings, AlertCircle } from 'lucide-react';

interface StatusCardProps {
  connected: boolean;
  lastUpdated: string;
  runtime: number;
  motorStatus: 'ON' | 'OFF'; // Legacy compatibility
  motor1Status?: 'ON' | 'OFF'; // v3.0 Motor 1 status
  motor2Status?: 'ON' | 'OFF'; // v3.0 Motor 2 status
  motor1Enabled?: boolean; // v3.0 Motor 1 enabled
  motor2Enabled?: boolean; // v3.0 Motor 2 enabled
  motorConfig?: 'SINGLE_TANK_SINGLE_MOTOR' | 'SINGLE_TANK_DUAL_MOTOR' | 'DUAL_TANK_DUAL_MOTOR'; // v3.0 Motor configuration
  mode: 'auto' | 'manual';
  autoModeReasons: string[]; // Legacy compatibility
  autoModeReasonMotor1?: string; // v3.0 Motor 1 auto reason
  autoModeReasonMotor2?: string; // v3.0 Motor 2 auto reason
  className?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  connected,
  lastUpdated,
  runtime,
  motorStatus,
  motor1Status,
  motor2Status,
  motor1Enabled,
  motor2Enabled,
  motorConfig,
  mode,
  autoModeReasons,
  autoModeReasonMotor1,
  autoModeReasonMotor2,
  className = ''
}) => {
  const formatRuntime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700
      p-4 transition-all duration-300
      ${className}
    `}>
      {/* Compact Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
          System Status
        </h2>
      </div>

      {/* Main Status Grid - Compact Layout */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          {connected ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Connection
            </p>
            <p className={`text-sm font-semibold truncate ${connected ? 'text-green-600' : 'text-red-600'}`}>
              {connected ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        {/* System Mode */}
        <div className="flex items-center space-x-2">
          <Settings className="w-4 h-4 text-indigo-500" />
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Mode
            </p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize truncate">
              {mode}
            </p>
          </div>
        </div>

        {/* Transmitter Status */}
        <div className="flex items-center space-x-2">
          <Clock className={`w-4 h-4 ${runtime > 600 ? 'text-red-500' : runtime > 300 ? 'text-yellow-500' : 'text-green-500'}`} />
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Last Data
            </p>
            <p className={`text-sm font-semibold truncate ${runtime > 600 ? 'text-red-600' : runtime > 300 ? 'text-yellow-600' : 'text-green-600'}`}>
              {runtime > 0 ? formatRuntime(runtime) : 'Never'}
            </p>
          </div>
        </div>

        {/* Last Updated */}
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-purple-500" />
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Updated
            </p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {formatLastUpdated(lastUpdated)}
            </p>
          </div>
        </div>
      </div>

      {/* Motor Status - Compact Dual Motor Display */}
      {motor1Status !== undefined && motor2Status !== undefined ? (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Motors
              </span>
            </div>
            {motorConfig && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {motorConfig.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Motor 1 */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${motor1Status === 'ON' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Motor 1 {!motor1Enabled && '(Disabled)'}
                </p>
                <p className={`text-sm font-semibold ${motor1Status === 'ON' ? 'text-green-600' : 'text-gray-600'}`}>
                  {motor1Status}
                </p>
              </div>
            </div>

            {/* Motor 2 */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${motor2Status === 'ON' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Motor 2 {!motor2Enabled && '(Disabled)'}
                </p>
                <p className={`text-sm font-semibold ${motor2Status === 'ON' ? 'text-green-600' : 'text-gray-600'}`}>
                  {motor2Status}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Legacy Single Motor */
        <div className="mb-3">
          <div className="flex items-center space-x-2">
            <Zap className={`w-4 h-4 ${motorStatus === 'ON' ? 'text-green-500' : 'text-gray-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Motor Status
              </p>
              <p className={`text-sm font-semibold ${motorStatus === 'ON' ? 'text-green-600' : 'text-gray-600'}`}>
                {motorStatus}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transmitter Communication Warning */}
      {runtime > 600 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 mb-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">
                Transmitter Warning:
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                {runtime > 900 
                  ? `No data from upper tank sensors for ${formatRuntime(runtime)} - Check transmitter!`
                  : `No data from upper tank sensors for ${formatRuntime(runtime)} - Monitor closely!`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Auto Mode Reasons - Compact Display */}
      {mode === 'auto' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                Auto Triggers:
              </p>
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                {/* v3.0 Motor-specific reasons */}
                {autoModeReasonMotor1 && autoModeReasonMotor1 !== 'NONE' && (
                  <div className="flex items-center space-x-1">
                    <span className="w-1 h-1 bg-blue-500 rounded-full flex-shrink-0"></span>
                    <span className="truncate">M1: {autoModeReasonMotor1}</span>
                  </div>
                )}
                {autoModeReasonMotor2 && autoModeReasonMotor2 !== 'NONE' && (
                  <div className="flex items-center space-x-1">
                    <span className="w-1 h-1 bg-green-500 rounded-full flex-shrink-0"></span>
                    <span className="truncate">M2: {autoModeReasonMotor2}</span>
                  </div>
                )}
                
                {/* Legacy reasons fallback */}
                {(!autoModeReasonMotor1 || autoModeReasonMotor1 === 'NONE') && 
                 (!autoModeReasonMotor2 || autoModeReasonMotor2 === 'NONE') && 
                 autoModeReasons.length > 0 && (
                  <div className="space-y-0.5">
                    {autoModeReasons.map((reason, index) => (
                      <div key={index} className="flex items-center space-x-1">
                        <span className="w-1 h-1 bg-blue-500 rounded-full flex-shrink-0"></span>
                        <span className="truncate">{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* No active reasons */}
                {(!autoModeReasonMotor1 || autoModeReasonMotor1 === 'NONE') && 
                 (!autoModeReasonMotor2 || autoModeReasonMotor2 === 'NONE') && 
                 autoModeReasons.length === 0 && (
                  <div className="text-gray-500 dark:text-gray-400 italic">
                    No active triggers
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
