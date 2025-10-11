import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { WebSocketProvider } from './context/WebSocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConnectionGuard } from './components/ConnectionGuard';
import { DataLoader } from './components/DataLoader';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationProvider } from './components/NotificationSystem';
import { PWANotificationSystem } from './components/PWANotificationSystem';
import './App.css';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <WebSocketProvider>
            <Router basename="/smart-tank-pwa">
              <div className="App">
                <ConnectionGuard>
                  <DataLoader>
                    <Suspense fallback={<LoadingSpinner />}>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/settings" element={<Settings />} />
                      </Routes>
                    </Suspense>
                  </DataLoader>
                </ConnectionGuard>
                <PWANotificationSystem />
              </div>
            </Router>
          </WebSocketProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;