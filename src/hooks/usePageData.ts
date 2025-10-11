import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useWebSocket } from '../context/useWebSocket';

export const usePageData = () => {
  const location = useLocation();
  const { sendMessage, isConnected } = useWebSocket();
  const hasLoadedInitialData = useRef(false);
  const dashboardIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get dashboard sync interval from localStorage
  const getDashboardSyncInterval = () => {
    const saved = localStorage.getItem('dashboardSyncInterval');
    return saved ? parseInt(saved, 10) : 5000; // Default 5 seconds
  };

  // Start dashboard periodic data fetching
  const startDashboardSync = () => {
    if (dashboardIntervalRef.current) {
      clearInterval(dashboardIntervalRef.current);
    }
    
    const interval = getDashboardSyncInterval();
    if (isConnected && interval > 0) {
      dashboardIntervalRef.current = setInterval(() => {
        sendMessage({ type: 'getHomeData' });
      }, interval);
    }
  };

  // Stop dashboard periodic data fetching
  const stopDashboardSync = () => {
    if (dashboardIntervalRef.current) {
      clearInterval(dashboardIntervalRef.current);
      dashboardIntervalRef.current = null;
    }
  };

  // Handle page-specific data loading
  useEffect(() => {
    if (!isConnected) {
      stopDashboardSync();
      hasLoadedInitialData.current = false;
      return;
    }

    const currentPath = location.pathname;

    if (currentPath === '/dashboard') {
      // Dashboard page - load initial data and start periodic sync
      if (!hasLoadedInitialData.current) {
        sendMessage({ type: 'getHomeData' });
        hasLoadedInitialData.current = true;
      }
      startDashboardSync();
    } else if (currentPath === '/settings') {
      // Settings page - load settings data once only
      stopDashboardSync();
      if (!hasLoadedInitialData.current) {
        sendMessage({ type: 'getSettingData' });
        hasLoadedInitialData.current = true;
      }
    } else {
      // Other pages - stop all data fetching
      stopDashboardSync();
      hasLoadedInitialData.current = false;
    }

    // Cleanup on unmount or path change
    return () => {
      if (currentPath !== '/dashboard') {
        stopDashboardSync();
      }
    };
  }, [location.pathname, isConnected, sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDashboardSync();
    };
  }, []);

  return {
    startDashboardSync,
    stopDashboardSync
  };
};
