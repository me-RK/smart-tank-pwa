import React, { useState } from 'react';
import { X, Wifi, AlertCircle } from 'lucide-react';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (host: string) => void;
  currentHost?: string;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  currentHost = ''
}) => {
  const [host, setHost] = useState(currentHost);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!host.trim()) {
      setError('Please enter a valid host address');
      return;
    }

    // Basic validation for host format
    const hostPattern = /^[a-zA-Z0-9.-]+$/;
    if (!hostPattern.test(host.trim())) {
      setError('Please enter a valid host address (e.g., 192.168.1.100 or tank.local)');
      return;
    }

    setError('');
    onConnect(host.trim());
    onClose();
  };

  const handleClose = () => {
    setError('');
    setHost(currentHost);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Wifi className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Connect to Tank System
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Server Host Address
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.100 or tank.local"
              className="
                w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                placeholder-gray-500 dark:placeholder-gray-400
              "
              autoFocus
            />
            {error && (
              <div className="flex items-center space-x-2 mt-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Connection Info:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Enter the IP address or hostname of your tank system</li>
                  <li>• The system will connect to port 1337 automatically</li>
                  <li>• Make sure the tank system is running and accessible</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="
                flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600
                text-gray-700 dark:text-gray-300 rounded-lg
                hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                font-medium
              "
            >
              Cancel
            </button>
            <button
              type="submit"
              className="
                flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600
                text-white rounded-lg transition-colors font-medium
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              "
            >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
