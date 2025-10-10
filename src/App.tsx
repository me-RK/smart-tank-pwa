import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { WebSocketProvider } from './context/WebSocketContext';
import { ConnectionGuard } from './components/ConnectionGuard';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationProvider } from './components/NotificationSystem';
import './App.css';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));

function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <WebSocketProvider>
          <Router basename="/smart-tank-pwa">
            <div className="App">
              <ConnectionGuard>
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Suspense>
              </ConnectionGuard>
            </div>
          </Router>
        </WebSocketProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;