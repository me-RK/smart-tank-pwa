import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { isPWA } from '../utils/pwa';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallButtonProps {
  className?: string;
  showLabel?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '', 
  showLabel = false 
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed
    const installed = isPWA();
    setIsInstalled(installed);
    console.log('PWA: Is already installed?', installed);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA: beforeinstallprompt event received');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log('PWA: appinstalled event received');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if iOS and not installed
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    
    console.log('PWA: Device info', { isIOS, isInStandaloneMode, userAgent: navigator.userAgent });
    
    if (isIOS && !isInStandaloneMode) {
      console.log('PWA: iOS device detected, showing install button');
      setIsInstallable(true);
    }

    // Check PWA criteria
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
    const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
    
    console.log('PWA: Requirements check', { 
      hasServiceWorker, 
      hasManifest, 
      isHTTPS,
      isInstallable: !installed && (hasServiceWorker && hasManifest && isHTTPS)
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    try {
      if (deferredPrompt) {
        console.log('PWA: Showing install prompt...');
        
        // Show the install prompt
        await deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('PWA: User accepted the install prompt');
          // The appinstalled event will handle the state update
        } else {
          console.log('PWA: User dismissed the install prompt');
          // Clear the deferredPrompt but keep installable true for future attempts
          setDeferredPrompt(null);
        }
      } else {
        // iOS - show instructions
        console.log('PWA: Showing iOS instructions');
        setShowIOSInstructions(true);
      }
    } catch (error) {
      console.error('PWA: Install prompt failed:', error);
      // Fallback to iOS instructions if prompt fails
      setShowIOSInstructions(true);
    }
  };

  const handleIOSInstructionsClose = () => {
    setShowIOSInstructions(false);
  };

  // Don't show if already installed
  if (isInstalled) {
    console.log('PWA: Not showing install button - already installed');
    return null;
  }

  // Don't show if not installable
  if (!isInstallable) {
    console.log('PWA: Not showing install button - not installable');
    return null;
  }

  console.log('PWA: Showing install button', { deferredPrompt: !!deferredPrompt, isInstallable });

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={`
          flex items-center space-x-2 px-3 py-2 rounded-lg
          text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
          hover:bg-gray-100 dark:hover:bg-gray-700 
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          dark:focus:ring-offset-gray-800
          ${className}
        `}
        title="Install App"
        aria-label="Install Smart Water Tank app"
      >
        <div className="flex items-center justify-center w-5 h-5">
          <Download className="w-4 h-4" />
        </div>
        {showLabel && (
          <span className="text-sm font-medium">
            Install App
          </span>
        )}
      </button>

      {/* iOS Installation Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Install App on iOS
              </h3>
              <button
                onClick={handleIOSInstructionsClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Tap the <strong>Share</strong> button at the bottom of your Safari browser
                </p>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </p>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Tap <strong>"Add"</strong> to install the app on your home screen
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleIOSInstructionsClose}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
