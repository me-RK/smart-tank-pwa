import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useWebSocket } from '../context/useWebSocket';

export const usePageData = () => {
  const location = useLocation();
  const { sendMessage, isConnected } = useWebSocket();
  const hasLoadedInitialData = useRef(false);
  const dashboardIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sendMessageRef = useRef(sendMessage);

  // Get dashboard sync interval from localStorage
  const getDashboardSyncInterval = () => {
    const saved = localStorage.getItem('dashboardSyncInterval');
    return saved ? parseInt(saved, 10) : 5000; // Default 5 seconds
  };

  // Update sendMessage ref when it changes
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // Start dashboard periodic data fetching
  const startDashboardSync = useCallback(() => {
    if (dashboardIntervalRef.current) {
      clearInterval(dashboardIntervalRef.current);
    }
    
    const interval = getDashboardSyncInterval();
    if (isConnected && interval > 0) {
      dashboardIntervalRef.current = setInterval(() => {
        sendMessageRef.current({ type: 'getAllData' });
      }, interval);
    }
  }, [isConnected]);

  // Stop dashboard periodic data fetching
  const stopDashboardSync = useCallback(() => {
    if (dashboardIntervalRef.current) {
      clearInterval(dashboardIntervalRef.current);
      dashboardIntervalRef.current = null;
    }
  }, []);

  // Handle page-specific data loading
  useEffect(() => {
    if (!isConnected) {
      stopDashboardSync();
      return;
    }

    const currentPath = location.pathname;

    if (currentPath === '/dashboard') {
      // Dashboard page - load initial data and start periodic sync
      if (!hasLoadedInitialData.current) {
        sendMessageRef.current({ type: 'getAllData' });
        hasLoadedInitialData.current = true;
      }
      startDashboardSync();
    } else if (currentPath === '/settings') {
      // Settings page - load all data once only (includes settings and current status)
      stopDashboardSync();
      if (!hasLoadedInitialData.current) {
        sendMessageRef.current({ type: 'getAllData' });
        hasLoadedInitialData.current = true;
      }
    } else {
      // Other pages - stop all data fetching
      stopDashboardSync();
    }

    // Cleanup on unmount or path change
    return () => {
      if (currentPath !== '/dashboard') {
        stopDashboardSync();
      }
    };
  }, [location.pathname, isConnected, startDashboardSync, stopDashboardSync]);

  // Reset hasLoadedInitialData when path changes
  useEffect(() => {
    hasLoadedInitialData.current = false;
  }, [location.pathname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDashboardSync();
    };
  }, [stopDashboardSync]);

  return {
    startDashboardSync,
    stopDashboardSync
  };
};
