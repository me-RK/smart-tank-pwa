import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Wifi, WifiOff, Droplets, Settings as SettingsIcon, Power, TrendingUp, AlertTriangle, RefreshCw, Info } from 'lucide-react';

// Types
interface Tank {
  id: number;
  name: string;
  level_cm: number;
  percentage: number;
  last_updated: number;
  height_cm: number;
  low_cm: number;
  high_cm: number;
  upper_threshold_cm?: number;
  lower_threshold_cm?: number;
}

interface DeviceInfo {
  device_id: string;
  name: string;
  fw: string;
  capabilities: string[];
  ip: string;
  port: number;
  pair_token?: string;
}

interface State {
  tanks: Tank[];
  motor: { on: boolean };
}

// Storage helpers
const storage = {
  getDevice: (): DeviceInfo | null => {
    const stored = localStorage.getItem('connected_device');
    return stored ? JSON.parse(stored) : null;
  },
  setDevice: (device: DeviceInfo) => {
    localStorage.setItem('connected_device', JSON.stringify(device));
  },
  clearDevice: () => {
    localStorage.removeItem('connected_device');
  },
  getTankConfig: () => {
    const stored = localStorage.getItem('tank_config');
    return stored ? JSON.parse(stored) : null;
  },
  setTankConfig: (config: any) => {
    localStorage.setItem('tank_config', JSON.stringify(config));
  }
};

// Connection Manager Hook
const useDeviceConnection = () => {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<State>({ tanks: [], motor: { on: false } });
  const [alerts, setAlerts] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>(1000);
  const pollingRef = useRef<number | null>(null);

  const connectWebSocket = useCallback((deviceInfo: DeviceInfo) => {
    if (!deviceInfo.pair_token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${deviceInfo.ip}:${deviceInfo.port}/ws?token=${deviceInfo.pair_token}`;

    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectTimeoutRef.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'state') {
            setState(data.payload);
          } else if (data.type === 'alert') {
            setAlerts(prev => [...prev, { ...data.payload, timestamp: Date.now() }]);
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Tank Alert', {
                body: `Tank ${data.payload.tank_id}: ${data.payload.reason}`,
                icon: '/icon-192.png'
              });
            }
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        console.error('WebSocket error');
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket closed, attempting reconnect...');
        setConnected(false);
        wsRef.current = null;
        
        setTimeout(() => {
          reconnectTimeoutRef.current = Math.min(reconnectTimeoutRef.current * 2, 30000);
          if (device) connectWebSocket(device);
        }, reconnectTimeoutRef.current);
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      startPolling(deviceInfo);
    }
  }, [device]);

  const startPolling = (deviceInfo: DeviceInfo) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    const poll = async () => {
      try {
        const response = await fetch(`http://${deviceInfo.ip}:${deviceInfo.port}/state`);
        if (response.ok) {
          const data = await response.json();
          setState(data);
          setConnected(true);
        }
      } catch (e) {
        setConnected(false);
      }
    };

    poll();
    pollingRef.current = window.setInterval(poll, 5000);
  };

  const sendCommand = useCallback((cmd: string, payload: any = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'command',
        payload: { cmd, ...payload, nonce: Date.now().toString() }
      }));
    }
  }, []);

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setConnected(false);
    setDevice(null);
    storage.clearDevice();
  };

  useEffect(() => {
    const storedDevice = storage.getDevice();
    if (storedDevice && storedDevice.pair_token) {
      setDevice(storedDevice);
      connectWebSocket(storedDevice);
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [connectWebSocket]);

  return { device, setDevice, connected, state, alerts, sendCommand, disconnect, connectWebSocket };
};

// Discovery Screen
const DiscoveryScreen = ({ onDeviceSelected }: { onDeviceSelected: (device: DeviceInfo) => void }) => {
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('8080');
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(false);

  const testConnection = async (ip: string, port: string) => {
    try {
      const response = await fetch(`http://${ip}:${port}/info`);
      if (!response.ok) throw new Error('Device not responding');
      
      const info = await response.json();
      
      const pairResponse = await fetch(`http://${ip}:${port}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: `app-${Date.now()}` })
      });
      
      if (!pairResponse.ok) throw new Error('Pairing failed');
      const pairData = await pairResponse.json();
      
      const device: DeviceInfo = {
        ...info,
        ip,
        port: parseInt(port),
        pair_token: pairData.pair_token
      };
      
      storage.setDevice(device);
      onDeviceSelected(device);
    } catch (e: any) {
      setError(e.message || 'Connection failed');
      throw e;
    }
  };

  const handleManualConnect = async () => {
    setError('');
    setDiscovering(true);
    try {
      await testConnection(manualIp, manualPort);
    } catch (e) {
      console.error(e);
    } finally {
      setDiscovering(false);
    }
  };

  const handleQrScan = () => {
    setShowQr(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <Droplets className="w-16 h-16 mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Smart Water Tank</h1>
          <p className="text-gray-600">Connect to your ESP32 device</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Device IP Address</label>
            <input
              type="text"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
              placeholder="192.168.1.100"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Port</label>
            <input
              type="text"
              value={manualPort}
              onChange={(e) => setManualPort(e.target.value)}
              placeholder="8080"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleManualConnect}
            disabled={discovering || !manualIp}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {discovering ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wifi className="w-5 h-5" />
                Connect
              </>
            )}
          </button>

          <button
            onClick={handleQrScan}
            className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Scan QR Code
          </button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Troubleshooting:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Ensure device and phone are on same Wi-Fi</li>
                <li>Check firewall settings</li>
                <li>Verify ESP32 is powered on</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Tank Card Component
const TankCard = ({ tank, onAlert }: { tank: Tank; onAlert: boolean }) => {
  const percentage = Math.round(tank.percentage);
  const getColor = () => {
    if (percentage < 20) return 'text-red-600';
    if (percentage < 50) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${onAlert ? 'ring-2 ring-red-500 animate-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{tank.name}</h3>
        <Droplets className={`w-6 h-6 ${getColor()}`} />
      </div>

      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-4xl font-bold ${getColor()}`}>{percentage}%</span>
          <span className="text-gray-500 text-sm">{tank.level_cm} cm</span>
        </div>
        
        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full transition-all duration-500 ${
              percentage < 20 ? 'bg-red-500' : percentage < 50 ? 'bg-orange-500' : 'bg-green-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Height:</span>
          <span className="ml-2 font-medium">{tank.height_cm} cm</span>
        </div>
        <div>
          <span className="text-gray-500">Low:</span>
          <span className="ml-2 font-medium">{tank.low_cm} cm</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">Last updated:</span>
          <span className="ml-2 font-medium">{new Date(tank.last_updated).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

// Dashboard
const Dashboard = ({ device, state, connected, sendCommand, onSettingsClick, onDisconnect }: any) => {
  const [motorConfirm, setMotorConfirm] = useState(false);

  const handleMotorToggle = () => {
    if (!connected) return;
    if (!motorConfirm) {
      setMotorConfirm(true);
      setTimeout(() => setMotorConfirm(false), 3000);
      return;
    }
    sendCommand(state.motor.on ? 'motor_off' : 'motor_on');
    setMotorConfirm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Droplets className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Water Tank Monitor</h1>
              <p className="text-xs text-gray-500">{device?.name || 'Unknown Device'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {connected ? (
                <Wifi className="w-5 h-5 text-green-600" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-600" />
              )}
            </div>
            <button onClick={onSettingsClick} className="p-2 hover:bg-gray-100 rounded-lg">
              <SettingsIcon className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {state.tanks.map((tank: Tank) => (
            <TankCard key={tank.id} tank={tank} onAlert={tank.level_cm < tank.low_cm} />
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Motor Control</h3>
          <button
            onClick={handleMotorToggle}
            disabled={!connected}
            className={`w-full py-4 rounded-lg font-medium flex items-center justify-center gap-3 transition-colors ${
              state.motor.on
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Power className="w-6 h-6" />
            {motorConfirm ? 'Confirm Action' : state.motor.on ? 'Turn Motor OFF' : 'Turn Motor ON'}
          </button>
          {!connected && (
            <p className="text-center text-sm text-red-600 mt-2">Offline - Cannot control motor</p>
          )}
        </div>
      </main>
    </div>
  );
};

// Settings Screen
const SettingsScreen = ({ device, onBack, onDisconnect }: any) => {
  const [config, setConfig] = useState(storage.getTankConfig() || {
    tanks: [
      { id: 1, name: 'Tank 1', height_cm: 150, low_cm: 20, high_cm: 140 },
      { id: 2, name: 'Tank 2', height_cm: 150, low_cm: 20, high_cm: 140 },
      { id: 3, name: 'Tank 3', height_cm: 100, low_cm: 15, high_cm: 90 },
      { id: 4, name: 'Tank 4', height_cm: 100, low_cm: 15, high_cm: 90 }
    ]
  });

  const handleSave = async () => {
    storage.setTankConfig(config);
    
    if (device) {
      try {
        await fetch(`http://${device.ip}:${device.port}/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
      } catch (e) {
        console.error('Failed to sync settings to device:', e);
      }
    }
    
    alert('Settings saved!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
            <button onClick={onBack} className="text-blue-600 font-medium">Done</button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Tank Configuration</h3>
              {config.tanks.map((tank: any, idx: number) => (
                <div key={tank.id} className="mb-6 p-4 border border-gray-200 rounded-lg">
                  <input
                    type="text"
                    value={tank.name}
                    onChange={(e) => {
                      const newConfig = { ...config };
                      newConfig.tanks[idx].name = e.target.value;
                      setConfig(newConfig);
                    }}
                    className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg font-medium"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Height (cm)</label>
                      <input
                        type="number"
                        value={tank.height_cm}
                        onChange={(e) => {
                          const newConfig = { ...config };
                          newConfig.tanks[idx].height_cm = parseInt(e.target.value);
                          setConfig(newConfig);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Low (cm)</label>
                      <input
                        type="number"
                        value={tank.low_cm}
                        onChange={(e) => {
                          const newConfig = { ...config };
                          newConfig.tanks[idx].low_cm = parseInt(e.target.value);
                          setConfig(newConfig);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">High (cm)</label>
                      <input
                        type="number"
                        value={tank.high_cm}
                        onChange={(e) => {
                          const newConfig = { ...config };
                          newConfig.tanks[idx].high_cm = parseInt(e.target.value);
                          setConfig(newConfig);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Device</h3>
              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <p className="text-sm text-gray-600">Connected to:</p>
                <p className="font-medium">{device?.ip}:{device?.port}</p>
                <p className="text-sm text-gray-500 mt-1">{device?.device_id}</p>
              </div>
              <button
                onClick={onDisconnect}
                className="w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                Forget Device
              </button>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App
export default function App() {
  const { device, setDevice, connected, state, alerts, sendCommand, disconnect, connectWebSocket } = useDeviceConnection();
  const [showSettings, setShowSettings] = useState(false);

  const handleDeviceSelected = (selectedDevice: DeviceInfo) => {
    setDevice(selectedDevice);
    connectWebSocket(selectedDevice);
  };

  const handleDisconnect = () => {
    disconnect();
    setShowSettings(false);
  };

  if (!device) {
    return <DiscoveryScreen onDeviceSelected={handleDeviceSelected} />;
  }

  if (showSettings) {
    return <SettingsScreen device={device} onBack={() => setShowSettings(false)} onDisconnect={handleDisconnect} />;
  }

  return (
    <Dashboard
      device={device}
      state={state}
      connected={connected}
      sendCommand={sendCommand}
      onSettingsClick={() => setShowSettings(true)}
      onDisconnect={handleDisconnect}
    />
  );
}