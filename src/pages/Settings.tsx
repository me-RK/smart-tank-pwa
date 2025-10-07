import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../context/WebSocketContext';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { SensorCheckbox } from '../components/SensorCheckbox';
import { ArrowLeft, Save, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { appState, sendMessage, isConnected } = useWebSocket();
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

  const handleModeChange = (mode: 'auto' | 'manual') => {
    setSettings(prev => ({
      ...prev,
      mode,
      autoMode: mode === 'auto' ? prev.autoMode : {
        minWaterLevel: 20,
        maxWaterLevel: 80,
        specialFunctions: { autoMode: true }
      },
      manualMode: mode === 'manual' ? prev.manualMode : {
        motorControl: false
      }
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

  const handleSpecialFunctionChange = (checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      autoMode: {
        ...prev.autoMode,
        specialFunctions: {
          ...prev.autoMode.specialFunctions,
          autoMode: checked
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

      // Simulate save delay
      setTimeout(() => {
        setIsSaving(false);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }, 1000);
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
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              System Mode
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <ToggleSwitch
                  checked={settings.mode === 'auto'}
                  onChange={(checked) => handleModeChange(checked ? 'auto' : 'manual')}
                  label="Auto Mode"
                  color="blue"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  System automatically controls motor based on water levels
                </p>
              </div>
              <div className="space-y-3">
                <ToggleSwitch
                  checked={settings.mode === 'manual'}
                  onChange={(checked) => handleModeChange(checked ? 'manual' : 'auto')}
                  label="Manual Mode"
                  color="purple"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manual control of motor and system operations
                </p>
              </div>
            </div>
          </div>

          {/* Auto Mode Settings */}
          {settings.mode === 'auto' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Auto Mode Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Minimum Water Level (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.autoMode.minWaterLevel}
                    onChange={(e) => handleAutoModeSettingsChange('minWaterLevel', parseInt(e.target.value) || 0)}
                    className="
                      w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    "
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Maximum Water Level (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.autoMode.maxWaterLevel}
                    onChange={(e) => handleAutoModeSettingsChange('maxWaterLevel', parseInt(e.target.value) || 0)}
                    className="
                      w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    "
                  />
                </div>
              </div>
            </div>
          )}

          {/* Manual Mode Settings */}
          {settings.mode === 'manual' && (
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
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tank Dimensions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Tank Dimensions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Upper Tank
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      min="0"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Lower Tank
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      min="0"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
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
          {settings.mode === 'auto' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Special Functions
              </h2>
              <SensorCheckbox
                checked={settings.autoMode.specialFunctions.autoMode}
                onChange={handleSpecialFunctionChange}
                label="Auto Mode"
                description="Enable automatic system control"
                color="purple"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
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

            <div className="text-sm text-gray-500 dark:text-gray-400">
              {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
