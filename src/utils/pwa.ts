// PWA utility functions for service worker registration and notifications

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, notify main thread
              const event = new CustomEvent('sw-update-available', {
                detail: { registration, newWorker }
              });
              window.dispatchEvent(event);
              
              // Also send message to service worker
              navigator.serviceWorker.controller.postMessage({
                type: 'SW_UPDATE_AVAILABLE'
              });
            }
          });
        }
      });
      
      // Handle service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
          const customEvent = new CustomEvent('sw-update-available', {
            detail: { registration }
          });
          window.dispatchEvent(customEvent);
        }
      });
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    }
    return Notification.permission;
  }
  return 'denied';
};

export const showNotification = (title: string, options?: NotificationOptions): void => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options
    });
    
    // Use Web Vibration API if available
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
};

export const isPWA = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as { standalone?: boolean }).standalone === true ||
         document.referrer.includes('android-app://');
};

export const installPWA = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      // PWA is installable
      resolve();
    } else {
      reject(new Error('PWA not installable'));
    }
  });
};

export const getInstallPrompt = (): Promise<BeforeInstallPromptEvent | null> => {
  return new Promise((resolve) => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      resolve(e as BeforeInstallPromptEvent);
    });
  });
};

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Make it available globally
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
