import React from 'react';
import { AlertTriangle, Wifi, Monitor } from 'lucide-react';

interface HTTPSConnectionHelpProps {
  isVisible: boolean;
  onClose: () => void;
}

export const HTTPSConnectionHelp: React.FC<HTTPSConnectionHelpProps> = ({ 
  isVisible, 
  onClose 
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                HTTPS Connection Issue
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Problem Explanation */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h3 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                Why This Happens
              </h3>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                This PWA is designed to run <strong>locally on your network</strong> to connect to your ESP32 device. 
                You're currently accessing it from GitHub Pages (HTTPS), but it should be running locally 
                on your computer/network for proper ESP32 connectivity.
              </p>
            </div>

            {/* Solutions */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-800 dark:text-gray-200">
                Solutions
              </h3>

              {/* Solution 1: Local Development - PRIMARY SOLUTION */}
              <div className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Monitor className="w-5 h-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                      ✅ RECOMMENDED: Run Locally on Your Network
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                      This is the intended way to use this PWA. Run it locally to connect to your ESP32:
                    </p>
                    <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 text-sm font-mono text-gray-800 dark:text-gray-200">
                      npm run dev
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      Then access via http://localhost:3000/smart-tank-pwa/ or your computer's IP address
                    </p>
                    <div className="mt-3 p-2 bg-green-100 dark:bg-green-800/30 rounded text-xs text-green-700 dark:text-green-300">
                      <strong>Benefits:</strong> Direct connection to ESP32, no internet required, works offline
                    </div>
                  </div>
                </div>
              </div>

              {/* Alternative Solutions */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Wifi className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                      Alternative: Configure ESP32 for HTTPS (Advanced)
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      If you need to use the PWA from HTTPS, you can modify ESP32 to support WSS:
                    </p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                      <li>• Add SSL/TLS support to ESP32 firmware</li>
                      <li>• Configure WebSocket server with WSS</li>
                      <li>• Add SSL certificates</li>
                    </ul>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      <strong>Note:</strong> This is complex and not recommended. Local use is much simpler.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Status */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                Current Status
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div>• PWA Source: HTTPS (GitHub Pages) ❌</div>
                <div>• Intended Use: Local Network ✅</div>
                <div>• ESP32 Protocol: HTTP WebSocket ✅</div>
                <div>• Connection: Failed (wrong deployment method)</div>
              </div>
              <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-800/30 rounded text-xs text-blue-700 dark:text-blue-300">
                <strong>Solution:</strong> Run locally with <code>npm run dev</code> for proper ESP32 connectivity
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
