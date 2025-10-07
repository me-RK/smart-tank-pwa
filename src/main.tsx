import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker, requestNotificationPermission } from './utils/pwa';

// Register service worker for PWA functionality
registerServiceWorker().then((registration) => {
  if (registration) {
    console.log('PWA: Service Worker registered');
  }
});

// Request notification permission
requestNotificationPermission().then((permission) => {
  console.log('PWA: Notification permission:', permission);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);