import React, { useState, useEffect } from 'react';
import { Wifi, Globe, Server, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { getNetworkInfo } from '../utils/connectionTest';

interface NetworkInfoProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NetworkConnection {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NetworkDetails {
  userAgent: string;
  platform: string;
  language: string;
  online: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  currentUrl: string;
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  // Network discovery info
  localIP?: string | null;
  network?: string | null;
  gateway?: string | null;
  subnet?: string | null;
  scanRange?: string | null;
}

export const NetworkInfo: React.FC<NetworkInfoProps> = ({ isOpen, onClose }) => {
  const [networkDetails, setNetworkDetails] = useState<NetworkDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      gatherNetworkInfo();
    }
  }, [isOpen]);

  const gatherNetworkInfo = async () => {
    setIsLoading(true);
    
    try {
      // Basic browser info
      const userAgent = navigator.userAgent;
      const platform = navigator.platform;
      const language = navigator.language;
      const online = navigator.onLine;
      
      // Connection info (if available)
      const connection = (navigator as Navigator & { connection?: NetworkConnection; mozConnection?: NetworkConnection; webkitConnection?: NetworkConnection }).connection || 
                        (navigator as Navigator & { connection?: NetworkConnection; mozConnection?: NetworkConnection; webkitConnection?: NetworkConnection }).mozConnection || 
                        (navigator as Navigator & { connection?: NetworkConnection; mozConnection?: NetworkConnection; webkitConnection?: NetworkConnection }).webkitConnection;
      
      // Current URL details
      const currentUrl = window.location.href;
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port || (protocol === 'https:' ? '443' : '80');
      const pathname = window.location.pathname;

      const details: NetworkDetails = {
        userAgent,
        platform,
        language,
        online,
        currentUrl,
        protocol,
        hostname,
        port,
        pathname
      };

      // Add connection details if available
      if (connection) {
        details.connectionType = connection.type;
        details.effectiveType = connection.effectiveType;
        details.downlink = connection.downlink;
        details.rtt = connection.rtt;
        details.saveData = connection.saveData;
      }

      // Get network discovery information
      try {
        const networkInfo = await getNetworkInfo();
        details.localIP = networkInfo.localIP;
        details.network = networkInfo.network;
        details.gateway = networkInfo.gateway;
        details.subnet = networkInfo.subnet;
        details.scanRange = networkInfo.scanRange;
      } catch (error) {
        console.error('Error getting network discovery info:', error);
      }

      setNetworkDetails(details);
    } catch (error) {
      console.error('Error gathering network info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testNetworkConnectivity = async () => {
    const tests = [
      { name: 'Google DNS', url: 'https://8.8.8.8' },
      { name: 'Cloudflare DNS', url: 'https://1.1.1.1' },
      { name: 'Google', url: 'https://www.google.com' },
      { name: 'Local Network', url: 'http://192.168.1.1' }
    ];

    const results = [];
    
    for (const test of tests) {
      try {
        const startTime = Date.now();
        await fetch(test.url, { 
          method: 'HEAD', 
          mode: 'no-cors',
          cache: 'no-cache'
        });
        const endTime = Date.now();
        results.push({
          name: test.name,
          url: test.url,
          success: true,
          responseTime: endTime - startTime
        });
      } catch {
        results.push({
          name: test.name,
          url: test.url,
          success: false,
          error: 'Failed to connect'
        });
      }
    }

    return results;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Wifi className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Network Information & Diagnostics
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Gathering network information...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Connection Status */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Globe className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Connection Status
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    {networkDetails?.online ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Internet: {networkDetails?.online ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Platform: {networkDetails?.platform}
                    </span>
                  </div>
                </div>
              </div>

              {/* Current App Details */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Server className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Current App Details
                  </h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">URL:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">{networkDetails?.currentUrl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Protocol:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">{networkDetails?.protocol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Hostname:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">{networkDetails?.hostname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Port:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">{networkDetails?.port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Path:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">{networkDetails?.pathname}</span>
                  </div>
                </div>
              </div>

              {/* Network Discovery Information */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Wifi className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Network Discovery
                  </h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Local IP:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">
                      {networkDetails?.localIP || 'Not detected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Network:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">
                      {networkDetails?.network || 'Not detected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Gateway:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">
                      {networkDetails?.gateway || 'Not detected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Subnet:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">
                      {networkDetails?.subnet || 'Not detected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Scan Range:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono">
                      {networkDetails?.scanRange || 'Not detected'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Browser Information */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Info className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Browser Information
                  </h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Language:</span>
                    <span className="text-gray-800 dark:text-gray-200">{networkDetails?.language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Platform:</span>
                    <span className="text-gray-800 dark:text-gray-200">{networkDetails?.platform}</span>
                  </div>
                  {networkDetails?.connectionType && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Connection Type:</span>
                      <span className="text-gray-800 dark:text-gray-200">{networkDetails.connectionType}</span>
                    </div>
                  )}
                  {networkDetails?.effectiveType && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Effective Type:</span>
                      <span className="text-gray-800 dark:text-gray-200">{networkDetails.effectiveType}</span>
                    </div>
                  )}
                  {networkDetails?.downlink && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Downlink:</span>
                      <span className="text-gray-800 dark:text-gray-200">{networkDetails.downlink} Mbps</span>
                    </div>
                  )}
                  {networkDetails?.rtt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">RTT:</span>
                      <span className="text-gray-800 dark:text-gray-200">{networkDetails.rtt} ms</span>
                    </div>
                  )}
                </div>
              </div>

              {/* User Agent */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Info className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    User Agent
                  </h3>
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded break-all">
                  {networkDetails?.userAgent}
                </div>
              </div>

              {/* Network Test */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Wifi className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Network Connectivity Test
                  </h3>
                </div>
                <button
                  onClick={async () => {
                    const results = await testNetworkConnectivity();
                    console.log('Network test results:', results);
                    alert('Network test completed. Check console for results.');
                  }}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                >
                  Test Network Connectivity
                </button>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Click to test connectivity to various servers. Results will be shown in console.
                </p>
              </div>

              {/* ESP32 Connection Info */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Server className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    ESP32 Connection Requirements
                  </h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700 dark:text-gray-300">ESP32 must be on same network</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700 dark:text-gray-300">WebSocket server running on port 81</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700 dark:text-gray-300">No firewall blocking port 81</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700 dark:text-gray-300">ESP32 IP: 192.168.1.8 (from your logs)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
