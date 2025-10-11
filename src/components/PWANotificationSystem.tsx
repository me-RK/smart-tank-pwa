import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, RefreshCw, Wifi, WifiOff, Bell } from 'lucide-react';
import { showNotification } from '../utils/pwa';

interface PWANotificationSystemProps {
  className?: string;
}

interface NotificationState {
  id: string;
  type: 'update' | 'install' | 'offline' | 'online' | 'connection' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  autoHide?: boolean;
  duration?: number;
}

export const PWANotificationSystem: React.FC<PWANotificationSystemProps> = ({ className = '' }) => {
  const [notifications, setNotifications] = useState<NotificationState[]>([]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const addNotification = useCallback((notification: NotificationState) => {
    setNotifications(prev => {
      // Remove existing notification with same id
      const filtered = prev.filter(n => n.id !== notification.id);
      return [...filtered, notification];
    });

    // Auto-hide if specified
    if (notification.autoHide && notification.duration) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration);
    }

    // Show browser notification if permission granted
    if (notification.type === 'connection' || notification.type === 'offline') {
      showNotification(notification.title, {
        body: notification.message,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    }
  }, []);

  useEffect(() => {
    // Network status monitoring
    const handleOnline = () => {
      addNotification({
        id: 'network-online',
        type: 'online',
        title: 'Connection Restored',
        message: 'You are back online',
        autoHide: true,
        duration: 3000
      });
    };

    const handleOffline = () => {
      addNotification({
        id: 'network-offline',
        type: 'offline',
        title: 'Connection Lost',
        message: 'You are currently offline',
        dismissible: true
      });
    };

    // Service Worker update detection
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
          addNotification({
            id: 'sw-update',
            type: 'update',
            title: 'App Update Available',
            message: 'A new version of the app is available',
            action: {
              label: 'Update',
              onClick: () => {
                window.location.reload();
              }
            },
            dismissible: true
          });
        }
      });
    }

    // Install prompt handling
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      addNotification({
        id: 'install-prompt',
        type: 'install',
        title: 'Install App',
        message: 'Install this app for a better experience',
        action: {
          label: 'Install',
          onClick: () => {
            // This will be handled by the PWAInstallButton component
            const installEvent = new CustomEvent('pwa-install-requested');
            window.dispatchEvent(installEvent);
          }
        },
        dismissible: true
      });
    };

    // App installed detection
    const handleAppInstalled = () => {
      addNotification({
        id: 'app-installed',
        type: 'install',
        title: 'App Installed',
        message: 'Smart Water Tank has been installed successfully!',
        autoHide: true,
        duration: 5000
      });
    };

    // Event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [addNotification]);

  const getNotificationIcon = (type: NotificationState['type']) => {
    switch (type) {
      case 'update':
        return <RefreshCw className="w-5 h-5" />;
      case 'install':
        return <Download className="w-5 h-5" />;
      case 'online':
        return <Wifi className="w-5 h-5" />;
      case 'offline':
        return <WifiOff className="w-5 h-5" />;
      case 'connection':
        return <Wifi className="w-5 h-5" />;
      case 'info':
        return <Bell className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getNotificationStyles = (type: NotificationState['type']) => {
    switch (type) {
      case 'update':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300';
      case 'install':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300';
      case 'online':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300';
      case 'offline':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';
      case 'connection':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300';
      case 'info':
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full ${className}`}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            p-4 rounded-lg border shadow-lg backdrop-blur-sm
            ${getNotificationStyles(notification.type)}
            animate-in slide-in-from-right-full duration-300
          `}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium">
                {notification.title}
              </h4>
              <p className="text-sm mt-1">
                {notification.message}
              </p>
              
              {notification.action && (
                <button
                  onClick={notification.action.onClick}
                  className="mt-2 text-sm font-medium underline hover:no-underline"
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            
            {notification.dismissible && (
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
