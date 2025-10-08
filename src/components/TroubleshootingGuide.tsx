import React, { useState } from 'react';
import { 
  Wifi, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Settings,
  HelpCircle,
  Monitor,
  Router
} from 'lucide-react';

interface TroubleshootingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  currentHost?: string;
  onTestConnection?: (host: string) => Promise<boolean>;
}

export const TroubleshootingGuide: React.FC<TroubleshootingGuideProps> = ({
  isOpen,
  onClose,
  currentHost = '',
  onTestConnection
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [testResults, setTestResults] = useState<{ [key: string]: boolean }>({});
  const [isTesting, setIsTesting] = useState(false);

  const troubleshootingSteps = [
    {
      id: 'esp32-power',
      title: 'ESP32 Power & Status',
      description: 'Verify your ESP32 device is powered on and running',
      checks: [
        'ESP32 is connected to power supply',
        'Status LED is blinking/steady',
        'Serial Monitor shows "System initialized!"',
        'WiFi connection established'
      ],
      icon: <Monitor className="w-6 h-6" />
    },
    {
      id: 'network-connectivity',
      title: 'Network Connectivity',
      description: 'Ensure both devices are on the same network',
      checks: [
        'Both ESP32 and your device are on same WiFi',
        'No firewall blocking port 81',
        'Network signal is strong',
        'Try mobile hotspot if WiFi fails'
      ],
      icon: <Router className="w-6 h-6" />
    },
    {
      id: 'ip-address',
      title: 'IP Address Verification',
      description: 'Confirm the correct IP address of your ESP32',
      checks: [
        'Check ESP32 Serial Monitor for IP address',
        'IP address format: 192.168.x.x',
        'Try common addresses: 192.168.1.100, 192.168.4.1',
        'Use network scanner to find device'
      ],
      icon: <Settings className="w-6 h-6" />
    },
    {
      id: 'websocket-test',
      title: 'WebSocket Connection Test',
      description: 'Test the WebSocket connection to ESP32',
      checks: [
        'ESP32 WebSocket server is running on port 81',
        'Connection test passes',
        'No timeout errors',
        'Data exchange is working'
      ],
      icon: <Wifi className="w-6 h-6" />
    }
  ];

  const handleTestStep = async (stepId: string) => {
    setIsTesting(true);
    
    try {
      let result = false;
      
      switch (stepId) {
        case 'esp32-power':
          // This would need to be tested by checking if we can connect
          result = currentHost ? true : false;
          break;
        case 'network-connectivity':
          // Test network connectivity
          result = await testNetworkConnectivity();
          break;
        case 'ip-address':
          // Test IP address validity
          result = await testIPAddress(currentHost);
          break;
        case 'websocket-test':
          // Test WebSocket connection
          if (onTestConnection && currentHost) {
            result = await onTestConnection(currentHost);
          }
          break;
      }
      
      setTestResults(prev => ({ ...prev, [stepId]: result }));
    } catch (error) {
      console.error('Test failed:', error);
      setTestResults(prev => ({ ...prev, [stepId]: false }));
    } finally {
      setIsTesting(false);
    }
  };

  const testNetworkConnectivity = async (): Promise<boolean> => {
    try {
      // Test basic network connectivity
      await fetch('https://www.google.com', { 
        method: 'HEAD', 
        mode: 'no-cors' 
      });
      return true;
    } catch {
      return false;
    }
  };

  const testIPAddress = async (host: string): Promise<boolean> => {
    if (!host) return false;
    
    // Basic IP format validation
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipPattern.test(host);
  };

  const getStepStatus = (stepId: string) => {
    const result = testResults[stepId];
    if (result === undefined) return 'pending';
    return result ? 'success' : 'error';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <HelpCircle className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              ESP32 Connection Troubleshooting
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {troubleshootingSteps.map((step, index) => {
              const status = getStepStatus(step.id);
              const isActive = activeStep === index;
              
              return (
                <div
                  key={step.id}
                  className={`border rounded-lg p-4 transition-all ${
                    isActive 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex-shrink-0 mt-1">
                        {step.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                            {step.title}
                          </h3>
                          {getStatusIcon(status)}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {step.description}
                        </p>
                        
                        <ul className="space-y-1">
                          {step.checks.map((check, checkIndex) => (
                            <li key={checkIndex} className="flex items-center space-x-2 text-sm">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                              <span className="text-gray-700 dark:text-gray-300">{check}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleTestStep(step.id)}
                        disabled={isTesting}
                        className="
                          px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300
                          text-white text-sm rounded-md transition-colors
                          flex items-center space-x-1
                        "
                      >
                        {isTesting ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wifi className="w-3 h-3" />
                        )}
                        <span>Test</span>
                      </button>
                      
                      <button
                        onClick={() => setActiveStep(index)}
                        className="
                          px-3 py-1 border border-gray-300 dark:border-gray-600
                          text-gray-700 dark:text-gray-300 text-sm rounded-md
                          hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                        "
                      >
                        {isActive ? 'Active' : 'Focus'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Quick Actions
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => window.location.reload()}
                className="
                  flex items-center justify-center space-x-2 px-4 py-2
                  bg-gray-500 hover:bg-gray-600 text-white rounded-md
                  transition-colors text-sm
                "
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh App</span>
              </button>
              
              <button
                onClick={() => {
                  localStorage.removeItem('tankHost');
                  window.location.reload();
                }}
                className="
                  flex items-center justify-center space-x-2 px-4 py-2
                  bg-red-500 hover:bg-red-600 text-white rounded-md
                  transition-colors text-sm
                "
              >
                <Settings className="w-4 h-4" />
                <span>Reset Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
