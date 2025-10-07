import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WebSocketProvider } from './context/WebSocketContext';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import './App.css';

function App() {
  return (
    <WebSocketProvider>
      <Router basename="/smart-tank-pwa">
        <div className="App">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </Router>
    </WebSocketProvider>
  );
}

export default App;