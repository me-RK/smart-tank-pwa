import React, { useState, useEffect } from 'react';
import { Info, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface PWADebugInfo {
  hasServiceWorker: boolean;
  hasManifest: boolean;
  isHTTPS: boolean;
  userAgent: string;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isStandalone: boolean;
  isFullscreen: boolean;
  isMinimalUI: boolean;
  isBrowser: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;
  manifestUrl: string | null;
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  beforeInstallPromptSupported: boolean;
  appInstalledSupported: boolean;
}

export const PWADebugInfo: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<PWADebugInfo>({
    hasServiceWorker: false,
    hasManifest: false,
    isHTTPS: false,
    userAgent: '',
    isIOS: false,
    isAndroid: false,
    isMobile: false,
    isStandalone: false,
    isFullscreen: false,
    isMinimalUI: false,
    isBrowser: false,
    serviceWorkerSupported: false,
    serviceWorkerRegistered: false,
    manifestUrl: null,
    protocol: '',
    hostname: '',
    port: '',
    pathname: '',
    beforeInstallPromptSupported: false,
    appInstalledSupported: false,
  });

  useEffect(() => {
    const checkPWARequirements = (): void => {
      const info: PWADebugInfo = {
        // Basic PWA requirements
        hasServiceWorker: 'serviceWorker' in navigator,
        hasManifest: document.querySelector('link[rel="manifest"]') !== null,
        isHTTPS: location.protocol === 'https:' || location.hostname === 'localhost',
        
        // Device info
        userAgent: navigator.userAgent,
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        isAndroid: /Android/.test(navigator.userAgent),
        isMobile: /Mobi|Android/i.test(navigator.userAgent),
        
        // Display mode
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        isFullscreen: window.matchMedia('(display-mode: fullscreen)').matches,
        isMinimalUI: window.matchMedia('(display-mode: minimal-ui)').matches,
        isBrowser: window.matchMedia('(display-mode: browser)').matches,
        
        // Service worker status
        serviceWorkerSupported: 'serviceWorker' in navigator,
        serviceWorkerRegistered: false,
        
        // Manifest info
        manifestUrl: document.querySelector('link[rel="manifest"]')?.getAttribute('href') || null,
        
        // URL info
        protocol: location.protocol,
        hostname: location.hostname,
        port: location.port,
        pathname: location.pathname,
        
        // PWA events
        beforeInstallPromptSupported: 'onbeforeinstallprompt' in window,
        appInstalledSupported: 'onappinstalled' in window,
      };

      // Check service worker registration
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
          info.serviceWorkerRegistered = !!registration;
          setDebugInfo({ ...info, serviceWorkerRegistered: !!registration });
        });
      } else {
        setDebugInfo(info);
      }
    };

    checkPWARequirements();
  }, []);

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const getStatusColor = (condition: boolean) => {
    return condition ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <Info className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          PWA Debug Information
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Requirements */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 dark:text-gray-300">Basic Requirements</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.hasServiceWorker)}
              <span className={getStatusColor(debugInfo.hasServiceWorker)}>
                Service Worker Support
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.hasManifest)}
              <span className={getStatusColor(debugInfo.hasManifest)}>
                Manifest File
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.isHTTPS)}
              <span className={getStatusColor(debugInfo.isHTTPS)}>
                HTTPS/Localhost
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.serviceWorkerRegistered)}
              <span className={getStatusColor(debugInfo.serviceWorkerRegistered)}>
                Service Worker Registered
              </span>
            </div>
          </div>
        </div>

        {/* Device Info */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 dark:text-gray-300">Device Info</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.isIOS)}
              <span className="text-gray-600 dark:text-gray-400">
                iOS Device
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.isAndroid)}
              <span className="text-gray-600 dark:text-gray-400">
                Android Device
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.isMobile)}
              <span className="text-gray-600 dark:text-gray-400">
                Mobile Device
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.isStandalone)}
              <span className="text-gray-600 dark:text-gray-400">
                Standalone Mode
              </span>
            </div>
          </div>
        </div>

        {/* URL Info */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 dark:text-gray-300">URL Information</h4>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <div>Protocol: {debugInfo.protocol}</div>
            <div>Hostname: {debugInfo.hostname}</div>
            <div>Port: {debugInfo.port || 'default'}</div>
            <div>Path: {debugInfo.pathname}</div>
            <div>Manifest: {debugInfo.manifestUrl || 'Not found'}</div>
          </div>
        </div>

        {/* PWA Events */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 dark:text-gray-300">PWA Events</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.beforeInstallPromptSupported)}
              <span className={getStatusColor(debugInfo.beforeInstallPromptSupported)}>
                beforeinstallprompt
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(debugInfo.appInstalledSupported)}
              <span className={getStatusColor(debugInfo.appInstalledSupported)}>
                appinstalled
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User Agent */}
      <div className="space-y-2">
        <h4 className="font-medium text-gray-700 dark:text-gray-300">User Agent</h4>
        <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
          {debugInfo.userAgent}
        </div>
      </div>

      {/* Installation Status */}
      <div className="space-y-2">
        <h4 className="font-medium text-gray-700 dark:text-gray-300">Installation Status</h4>
        <div className="text-sm">
          {debugInfo.isStandalone ? (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>PWA is installed and running in standalone mode</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-yellow-600">
              <AlertCircle className="w-4 h-4" />
              <span>PWA is not installed or not running in standalone mode</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
