import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/useWebSocket';
import { usePageData } from '../hooks/usePageData';
import { useTheme } from '../context/ThemeContext';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { SensorCheckbox } from '../components/SensorCheckbox';
import { ThemeToggle } from '../components/ThemeToggle';
import { ArrowLeft, Save, RotateCcw, AlertCircle, CheckCircle, Wifi, Settings as SettingsIcon, Monitor, Palette } from 'lucide-react';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { appState, sendMessage, isConnected } = useWebSocket();
  const { theme, setTheme } = useTheme();
  usePageData(); // Initialize page-specific data loading
  const [settings, setSettings] = useState(appState.systemSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Update local settings when app state changes
  useEffect(() => {
    setSettings(appState.systemSettings);
    setHasChanges(false);
  }, [appState.systemSettings]);

  // Check for changes
  useEffect(() => {
    const hasLocalChanges = JSON.stringify(settings) !== JSON.stringify(appState.systemSettings);
    setHasChanges(hasLocalChanges);
  }, [settings, appState.systemSettings]);

  const handleModeChange = (mode: 'Auto Mode' | 'Manual Mode') => {
    setSettings(prev => ({
      ...prev,
      mode
    }));
  };

  const handleAutoModeSettingsChange = (field: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      autoMode: {
        ...prev.autoMode,
        [field]: Math.max(0, Math.min(100, value))
      }
    }));
  };

  const handleSpecialFunctionChange = (functionName: string, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      autoMode: {
        ...prev.autoMode,
        specialFunctions: {
          ...prev.autoMode.specialFunctions,
          [functionName]: checked
        }
      }
    }));
  };

  const handleTankDimensionChange = (tank: string, field: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      tankDimensions: {
        ...prev.tankDimensions,
        [tank]: {
          ...prev.tankDimensions[tank as keyof typeof prev.tankDimensions],
          [field]: value
        }
      }
    }));
  };

  const handleSensorChange = (sensor: string, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      sensors: {
        ...prev.sensors,
        [sensor]: checked
      }
    }));
  };

  const handleSave = async () => {
    if (!isConnected) {
      setSaveStatus('error');
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      // Send settings update to server
      sendMessage({
        type: 'updateSettings',
        settings,
        timestamp: new Date().toISOString()
      });

      // Request updated data after a longer delay to ensure update is processed
      setTimeout(() => {
        sendMessage({
          type: 'getAllData'
        });
      }, 1000);

      // Simulate save delay
      setTimeout(() => {
        setIsSaving(false);
        setSaveStatus('success');
        setTimeout(() => {
          setSaveStatus('idle');
          // Navigate to Dashboard after success message disappears
          navigate('/dashboard');
        }, 3000);
      }, 1500);
    } catch {
      setIsSaving(false);
      setSaveStatus('error');
    }
  };

  const handleReset = () => {
    setSettings(appState.systemSettings);
    setHasChanges(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                System Settings
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              {hasChanges && (
                <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                  Unsaved changes
                </span>
              )}
              <ThemeToggle />
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || !isConnected}
                className="
                  flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm
                  transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  bg-blue-500 hover:bg-blue-600 text-white
                "
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection Status */}
        {!isConnected && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-300 font-medium">
                Not connected to server. Settings cannot be saved.
              </span>
            </div>
          </div>
        )}

        {/* Save Status */}
        {saveStatus === 'success' && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                Settings saved successfully!
              </span>
            </div>
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-300 font-medium">
                Failed to save settings. Please check your connection.
              </span>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* System Mode */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
              <SettingsIcon className="w-5 h-5" />
              <span>System Mode</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <ToggleSwitch
                  checked={settings.mode === 'Auto Mode'}
                  onChange={(checked) => handleModeChange(checked ? 'Auto Mode' : 'Manual Mode')}
                  label="Auto Mode"
                  color="blue"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  System automatically controls motors based on water levels and thresholds
                </p>
              </div>
              <div className="space-y-3">
                <ToggleSwitch
                  checked={settings.mode === 'Manual Mode'}
                  onChange={(checked) => handleModeChange(checked ? 'Manual Mode' : 'Auto Mode')}
                  label="Manual Mode"
                  color="purple"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manual control of motors and system operations
                </p>
              </div>
            </div>
          </div>

          {/* Motor Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
              <SettingsIcon className="w-5 h-5" />
              <span>Motor Configuration</span>
            </h2>
            
            {/* Motor Configuration Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Motor Configuration Type
              </label>
              <select
                value={settings.motorSettings.configuration}
                onChange={(e) => {
                  const newConfig = e.target.value as 'SINGLE_TANK_SINGLE_MOTOR' | 'SINGLE_TANK_DUAL_MOTOR' | 'DUAL_TANK_DUAL_MOTOR';
                  setSettings(prev => ({
                    ...prev,
                    motorSettings: {
                      ...prev.motorSettings,
                      configuration: newConfig
                    }
                  }));
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="SINGLE_TANK_SINGLE_MOTOR">Single Tank, Single Motor</option>
                <option value="SINGLE_TANK_DUAL_MOTOR">Single Tank, Dual Motor</option>
                <option value="DUAL_TANK_DUAL_MOTOR">Dual Tank, Dual Motor</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Configure how motors are used in your system
              </p>
            </div>

            {/* Motor Enable/Disable */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <ToggleSwitch
                  checked={settings.motorSettings.motor1Enabled}
                  onChange={(checked) => {
                    setSettings(prev => ({
                      ...prev,
                      motorSettings: {
                        ...prev.motorSettings,
                        motor1Enabled: checked
                      }
                    }));
                  }}
                  label="Motor 1 Enabled"
                  color="blue"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enable or disable Motor 1
                </p>
              </div>
              <div className="space-y-3">
                <ToggleSwitch
                  checked={settings.motorSettings.motor2Enabled}
                  onChange={(checked) => {
                    setSettings(prev => ({
                      ...prev,
                      motorSettings: {
                        ...prev.motorSettings,
                        motor2Enabled: checked
                      }
                    }));
                  }}
                  label="Motor 2 Enabled"
                  color="green"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enable or disable Motor 2
                </p>
              </div>
            </div>

            {/* Dual Motor Sync Mode (only show for SINGLE_TANK_DUAL_MOTOR) */}
            {settings.motorSettings.configuration === 'SINGLE_TANK_DUAL_MOTOR' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Dual Motor Synchronization Mode
                </label>
                <select
                  value={settings.motorSettings.dualMotorSyncMode}
                  onChange={(e) => {
                    const newMode = e.target.value as 'SIMULTANEOUS' | 'ALTERNATE' | 'PRIMARY_BACKUP';
                    setSettings(prev => ({
                      ...prev,
                      motorSettings: {
                        ...prev.motorSettings,
                        dualMotorSyncMode: newMode
                      }
                    }));
                  }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="SIMULTANEOUS">Simultaneous - Both motors run together</option>
                  <option value="ALTERNATE">Alternate - Motors switch periodically</option>
                  <option value="PRIMARY_BACKUP">Primary/Backup - Motor 1 primary, Motor 2 backup</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  How the two motors coordinate when both are enabled
                </p>
              </div>
            )}
          </div>

          {/* Tank-Specific Automation Settings */}
          {settings.mode === 'Auto Mode' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Tank-Specific Automation Settings
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tank A Automation */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                      Tank A Automation
                    </h3>
                    <ToggleSwitch
                      checked={settings.tankAAutomation.automationEnabled}
                      onChange={(checked) => {
                        setSettings(prev => ({
                          ...prev,
                          tankAAutomation: {
                            ...prev.tankAAutomation,
                            automationEnabled: checked
                          }
                        }));
                      }}
                      label="Enable"
                      color="blue"
                    />
                  </div>
                  
                  {settings.tankAAutomation.automationEnabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Minimum Water Level (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.tankAAutomation.minAutoValue}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              tankAAutomation: {
                                ...prev.tankAAutomation,
                                minAutoValue: parseFloat(e.target.value) || 0
                              }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Motor turns ON when water level drops below this value
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Maximum Water Level (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.tankAAutomation.maxAutoValue}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              tankAAutomation: {
                                ...prev.tankAAutomation,
                                maxAutoValue: parseFloat(e.target.value) || 0
                              }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Motor turns OFF when water level reaches this value
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Lower Tank Threshold (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.tankAAutomation.lowerThreshold}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              tankAAutomation: {
                                ...prev.tankAAutomation,
                                lowerThreshold: parseFloat(e.target.value) || 0
                              }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Motor stops if lower tank drops below this level
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Lower Tank Overflow Level (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.tankAAutomation.lowerOverflow}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              tankAAutomation: {
                                ...prev.tankAAutomation,
                                lowerOverflow: parseFloat(e.target.value) || 0
                              }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Emergency pump activation level
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tank B Automation */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                      Tank B Automation
                    </h3>
                    <ToggleSwitch
                      checked={settings.tankBAutomation.automationEnabled}
                      onChange={(checked) => {
                        setSettings(prev => ({
                          ...prev,
                          tankBAutomation: {
                            ...prev.tankBAutomation,
                            automationEnabled: checked
                          }
                        }));
                      }}
                      label="Enable"
                      color="green"
                    />
                  </div>
                  
                  {settings.tankBAutomation.automationEnabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Minimum Water Level (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.tankBAutomation.minAutoValue}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              tankBAutomation: {
                                ...prev.tankBAutomation,
                                minAutoValue: parseFloat(e.target.value) || 0
                              }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Motor turns ON when water level drops below this value
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Maximum Water Level (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.tankBAutomation.maxAutoValue}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              tankBAutomation: {
                                ...prev.tankBAutomation,
                                maxAutoValue: parseFloat(e.target.value) || 0
                              }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Motor turns OFF when water level reaches this value
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Lower Tank Threshold (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.tankBAutomation.lowerThreshold}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              tankBAutomation: {
                                ...prev.tankBAutomation,
                                lowerThreshold: parseFloat(e.target.value) || 0
                              }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Motor stops if lower tank drops below this level
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Lower Tank Overflow Level (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.tankBAutomation.lowerOverflow}
                          onChange={(e) => {
                            setSettings(prev => ({
                              ...prev,
                              tankBAutomation: {
                                ...prev.tankBAutomation,
                                lowerOverflow: parseFloat(e.target.value) || 0
                              }
                            }));
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Emergency pump activation level
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Legacy Auto Mode Settings (for backward compatibility) */}
          {settings.mode === 'Auto Mode' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Legacy Auto Mode Settings
              </h2>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    <p className="font-medium mb-1">Legacy Settings Notice:</p>
                    <p className="text-xs">
                      These settings are maintained for backward compatibility. 
                      The tank-specific settings above take precedence for new configurations.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Minimum Water Level (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.autoMode.minWaterLevel}
                    onChange={(e) => handleAutoModeSettingsChange('minWaterLevel', parseFloat(e.target.value) || 0)}
                    className="
                      w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    "
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Motor turns ON when water level drops below this value
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Maximum Water Level (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.autoMode.maxWaterLevel}
                    onChange={(e) => handleAutoModeSettingsChange('maxWaterLevel', parseFloat(e.target.value) || 0)}
                    className="
                      w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    "
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Motor turns OFF when water level reaches this value
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Manual Mode Settings */}
          {settings.mode === 'Manual Mode' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Manual Mode Settings
              </h2>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">Manual Control Guidance:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Use the motor toggle on the dashboard to control the pump</li>
                      <li>• Monitor tank levels carefully to prevent overflow or empty tanks</li>
                      <li>• Ensure proper sensor activation for accurate readings</li>
                      <li>• Motor control is available in the dashboard when in manual mode</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tank Dimensions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
              <Monitor className="w-5 h-5" />
              <span>Tank Dimensions</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tank A */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2">
                  Tank A
                </h3>
                
                {/* Upper Tank A */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Upper Tank A
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.upperTankA.height}
                        onChange={(e) => handleTankDimensionChange('upperTankA', 'height', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Water Full Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.upperTankA.waterFullHeight}
                        onChange={(e) => handleTankDimensionChange('upperTankA', 'waterFullHeight', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Water Empty Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.upperTankA.waterEmptyHeight}
                        onChange={(e) => handleTankDimensionChange('upperTankA', 'waterEmptyHeight', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Lower Tank A */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Lower Tank A
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.lowerTankA.height}
                        onChange={(e) => handleTankDimensionChange('lowerTankA', 'height', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Water Full Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.lowerTankA.waterFullHeight}
                        onChange={(e) => handleTankDimensionChange('lowerTankA', 'waterFullHeight', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Water Empty Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.lowerTankA.waterEmptyHeight}
                        onChange={(e) => handleTankDimensionChange('lowerTankA', 'waterEmptyHeight', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tank B */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2">
                  Tank B
                </h3>
                
                {/* Upper Tank B */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Upper Tank B
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.upperTankB.height}
                        onChange={(e) => handleTankDimensionChange('upperTankB', 'height', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Water Full Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.upperTankB.waterFullHeight}
                        onChange={(e) => handleTankDimensionChange('upperTankB', 'waterFullHeight', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Water Empty Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.upperTankB.waterEmptyHeight}
                        onChange={(e) => handleTankDimensionChange('upperTankB', 'waterEmptyHeight', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Lower Tank B */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Lower Tank B
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.lowerTankB.height}
                        onChange={(e) => handleTankDimensionChange('lowerTankB', 'height', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Water Full Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.lowerTankB.waterFullHeight}
                        onChange={(e) => handleTankDimensionChange('lowerTankB', 'waterFullHeight', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Water Empty Height (cm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.tankDimensions.lowerTankB.waterEmptyHeight}
                        onChange={(e) => handleTankDimensionChange('lowerTankB', 'waterEmptyHeight', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sensor Activation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Sensor Activation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SensorCheckbox
                checked={settings.sensors.lowerTankA}
                onChange={(checked) => handleSensorChange('lowerTankA', checked)}
                label="Lower Tank A"
                description="Monitor water level in lower tank A"
                color="blue"
              />
              <SensorCheckbox
                checked={settings.sensors.lowerTankB}
                onChange={(checked) => handleSensorChange('lowerTankB', checked)}
                label="Lower Tank B"
                description="Monitor water level in lower tank B"
                color="blue"
              />
              <SensorCheckbox
                checked={settings.sensors.upperTankA}
                onChange={(checked) => handleSensorChange('upperTankA', checked)}
                label="Upper Tank A"
                description="Monitor water level in upper tank A"
                color="green"
              />
              <SensorCheckbox
                checked={settings.sensors.upperTankB}
                onChange={(checked) => handleSensorChange('upperTankB', checked)}
                label="Upper Tank B"
                description="Monitor water level in upper tank B"
                color="green"
              />
            </div>
          </div>

          {/* Special Functions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Special Functions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SensorCheckbox
                checked={settings.autoMode.specialFunctions.upperTankOverFlowLock}
                onChange={(checked) => handleSpecialFunctionChange('upperTankOverFlowLock', checked)}
                label="Upper Tank Overflow Lock"
                description="Prevent motor operation when upper tank is overflowing"
                color="red"
              />
              <SensorCheckbox
                checked={settings.autoMode.specialFunctions.lowerTankOverFlowLock}
                onChange={(checked) => handleSpecialFunctionChange('lowerTankOverFlowLock', checked)}
                label="Lower Tank Overflow Lock"
                description="Prevent motor operation when lower tank is overflowing"
                color="red"
              />
              <SensorCheckbox
                checked={settings.autoMode.specialFunctions.syncBothTank}
                onChange={(checked) => handleSpecialFunctionChange('syncBothTank', checked)}
                label="Sync Both Tanks"
                description="Synchronize operation between both tank systems"
                color="blue"
              />
              <SensorCheckbox
                checked={settings.autoMode.specialFunctions.buzzerAlert}
                onChange={(checked) => handleSpecialFunctionChange('buzzerAlert', checked)}
                label="Buzzer Alert"
                description="Enable audible alerts for system events"
                color="green"
              />
            </div>
          </div>

          {/* WiFi Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
              <Wifi className="w-5 h-5" />
              <span>WiFi Configuration</span>
            </h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  <p className="font-medium mb-1">WiFi Configuration Notice:</p>
                  <p className="text-xs">
                    To configure WiFi settings, hold the configuration button on the ESP32 for 3 seconds during startup. 
                    The device will create a hotspot named "Smart Water Tank v2.0" with password "00000000". 
                    Connect to this hotspot and navigate to the WiFi settings page.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Access Point Mode
                </h3>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-2">Current AP Settings:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• SSID: Smart Water Tank v2.0</li>
                      <li>• Password: 00000000</li>
                      <li>• IP: 192.168.1.1</li>
                      <li>• Gateway: 192.168.1.1</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Station Mode
                </h3>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <p className="font-medium mb-2">Station Mode Features:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Connect to existing WiFi network</li>
                      <li>• Static IP configuration support</li>
                      <li>• Custom DNS settings</li>
                      <li>• Auto-reconnect capability</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
              <Monitor className="w-5 h-5" />
              <span>Dashboard Settings</span>
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Auto-Sync Interval
                </label>
                <select
                  value={localStorage.getItem('dashboardSyncInterval') || '5000'}
                  onChange={(e) => {
                    localStorage.setItem('dashboardSyncInterval', e.target.value);
                    // Trigger a custom event to notify Dashboard component
                    window.dispatchEvent(new CustomEvent('syncIntervalChanged', { 
                      detail: { interval: parseInt(e.target.value, 10) } 
                    }));
                  }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="0">Off (Manual sync only)</option>
                  <option value="2000">2 seconds</option>
                  <option value="5000">5 seconds (Default)</option>
                  <option value="10000">10 seconds</option>
                  <option value="30000">30 seconds</option>
                  <option value="60000">1 minute</option>
                  <option value="300000">5 minutes</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  How often the dashboard automatically refreshes data from the ESP32. This setting is stored locally and not sent to the device.
                </p>
              </div>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
              <Palette className="w-5 h-5" />
              <span>Theme Settings</span>
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Choose your preferred theme
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setTheme('light')}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-200
                      ${theme === 'light' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">Light</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Always light mode</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setTheme('dark')}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-200
                      ${theme === 'dark' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-gray-600 rounded-full"></div>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">Dark</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Always dark mode</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setTheme('system')}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-200
                      ${theme === 'system' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <Monitor className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200">System</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Follow system preference</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
              
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Current theme: <span className="font-medium capitalize">{theme}</span>
              </div>
            </div>
          </div>

          {/* System Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
              <SettingsIcon className="w-5 h-5" />
              <span>System Information</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Device Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">MAC Address:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">
                      {appState.systemSettings.macAddress ? 
                        appState.systemSettings.macAddress.map((byte: number) => 
                          byte.toString(16).padStart(2, '0').toUpperCase()
                        ).join(':') : 
                        'Not Available'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Connection Status:</span>
                    <span className={`font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Last Updated:</span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {new Date(appState.systemStatus.lastUpdated).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                  System Status
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Current Mode:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">
                      {appState.systemStatus.mode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Motor Status:</span>
                    <span className={`font-medium ${appState.systemStatus.motorStatus === 'ON' ? 'text-green-600' : 'text-gray-600'}`}>
                      {appState.systemStatus.motorStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Runtime:</span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {appState.systemStatus.runtime.toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-3">
              <button
                onClick={handleReset}
                disabled={!hasChanges}
                className="
                  flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600
                  text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700
                  transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
              
              <button
                onClick={() => {
                  sendMessage({ type: 'systemReset' });
                }}
                disabled={!isConnected}
                className="
                  flex items-center space-x-2 px-4 py-2 border border-red-300 dark:border-red-600
                  text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20
                  transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart System</span>
              </button>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
