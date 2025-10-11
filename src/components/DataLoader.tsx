import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../context/useWebSocket';
import { LoadingSpinner } from './LoadingSpinner';
import { useNotificationHelpers } from '../hooks/useNotifications';
import { CheckCircle, AlertTriangle, Wifi, Settings, Droplets } from 'lucide-react';

interface DataLoaderProps {
  children: React.ReactNode;
}

interface LoadingStep {
  id: string;
  name: string;
  icon: React.ReactNode;
  completed: boolean;
  error?: string;
}

export const DataLoader: React.FC<DataLoaderProps> = ({ children }) => {
  const { appState, sendMessage, isConnected } = useWebSocket();
  const { showError } = useNotificationHelpers();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    {
      id: 'connection',
      name: 'Establishing Connection',
      icon: <Wifi className="w-5 h-5" />,
      completed: false
    },
    {
      id: 'homeData',
      name: 'Loading System Data',
      icon: <Settings className="w-5 h-5" />,
      completed: false
    },
    {
      id: 'settingsData',
      name: 'Loading Configuration',
      icon: <Settings className="w-5 h-5" />,
      completed: false
    },
    {
      id: 'sensorData',
      name: 'Loading Tank Data',
      icon: <Droplets className="w-5 h-5" />,
      completed: false
    }
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Update loading steps
  const updateStep = useCallback((stepId: string, completed: boolean, error?: string) => {
    setLoadingSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, completed, error }
        : step
    ));
  }, []);

  // Check if all steps are completed (for future use)
  // const allStepsCompleted = loadingSteps.every(step => step.completed);

  // Load data sequence - Updated to use unified getAllData approach
  const loadData = useCallback(async () => {
    if (!isConnected) {
      setLoadingError('Not connected to ESP32 device');
      return;
    }

    setIsLoading(true);
    setLoadingError(null);
    setCurrentStep(0);

    try {
      // Step 1: Connection check
      updateStep('connection', true);
      setCurrentStep(1);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX

      // Step 2-4: Load all data in one unified request
      updateStep('homeData', false);
      updateStep('settingsData', false);
      updateStep('sensorData', false);
      
      // Send unified data request
      sendMessage({ type: 'getAllData' });
      
      // Wait for unified data response
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Data request timeout'));
        }, 8000); // Increased timeout for unified request

        const checkAllData = () => {
          // Check if we have all the essential data from the unified response
          if (appState.systemStatus.connected && 
              appState.systemStatus.lastUpdated &&
              appState.systemSettings.mode && 
              appState.systemSettings.sensors &&
              appState.tankData.tankA.upper !== undefined && 
              appState.tankData.tankA.lower !== undefined) {
            clearTimeout(timeout);
            // Mark all steps as completed
            updateStep('homeData', true);
            updateStep('settingsData', true);
            updateStep('sensorData', true);
            resolve(true);
          } else {
            setTimeout(checkAllData, 100);
          }
        };
        checkAllData();
      });

      setCurrentStep(4);

      // All data loaded successfully
      setIsLoading(false);
      // Removed initial notification to avoid irritation
      // showInfo('Data Loaded', 'All system data has been loaded successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      setLoadingError(errorMessage);
      updateStep(loadingSteps[currentStep]?.id || 'unknown', false, errorMessage);
      
      if (retryCount < maxRetries) {
        // Show brief retry notification (non-persistent, shorter duration)
        showError('Loading Failed', `Retrying... (${retryCount + 1}/${maxRetries})`, {
          persistent: false,
          duration: 2000
        });
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadData();
        }, 2000);
      } else {
        // Only show final error notification if all retries failed
        showError('Loading Failed', 'Failed to load data after multiple attempts. Please check your connection.');
        setIsLoading(false);
      }
    }
  }, [isConnected, sendMessage, appState, updateStep, currentStep, loadingSteps, retryCount, maxRetries, showError]);

  // Start loading when connected (only once)
  useEffect(() => {
    if (isConnected && isLoading) {
      // Just mark as loaded immediately - let pages handle their own data fetching
      setIsLoading(false);
    }
  }, [isConnected, isLoading]);

  // Reset loading state when connection is lost
  useEffect(() => {
    if (!isConnected) {
      setIsLoading(true);
      setLoadingSteps(prev => prev.map(step => ({ ...step, completed: false, error: undefined })));
      setCurrentStep(0);
      setRetryCount(0);
    }
  }, [isConnected]);

  // Show loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <LoadingSpinner size="lg" text="" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              Loading System Data
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Fetching current values from ESP32 device...
            </p>
          </div>

          {/* Loading Steps */}
          <div className="space-y-4">
            {loadingSteps.map((step, index) => (
              <div
                key={step.id}
                className={`
                  flex items-center space-x-3 p-3 rounded-lg transition-all duration-300
                  ${step.completed 
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                    : step.error
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : index === currentStep
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }
                `}
              >
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                  ${step.completed 
                    ? 'bg-green-500 text-white' 
                    : step.error
                    ? 'bg-red-500 text-white'
                    : index === currentStep
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                  }
                `}>
                  {step.completed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : step.error ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : index === currentStep ? (
                    <LoadingSpinner size="sm" text="" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`
                    text-sm font-medium
                    ${step.completed 
                      ? 'text-green-800 dark:text-green-200' 
                      : step.error
                      ? 'text-red-800 dark:text-red-200'
                      : index === currentStep
                      ? 'text-blue-800 dark:text-blue-200'
                      : 'text-gray-600 dark:text-gray-400'
                    }
                  `}>
                    {step.name}
                  </p>
                  {step.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {step.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {loadingError && retryCount >= maxRetries && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Loading Failed
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {loadingError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Retry Button */}
          {loadingError && retryCount >= maxRetries && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setRetryCount(0);
                  setLoadingError(null);
                  loadData();
                }}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
              >
                Retry Loading
              </button>
            </div>
          )}

          {/* Progress Indicator */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span>Progress</span>
              <span>{currentStep}/{loadingSteps.length}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(currentStep / loadingSteps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show children (dashboard) when loading is complete
  return <>{children}</>;
};
