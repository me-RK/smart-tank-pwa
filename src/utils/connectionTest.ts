/**
 * Connection Test Utility for ESP32 WebSocket Communication
 * 
 * This utility helps test and debug WebSocket connections to the ESP32 device.
 */

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  details: {
    host: string;
    port: number;
    protocol: string;
    timestamp: string;
    responseTime?: number;
  };
}

/**
 * Test WebSocket connection to ESP32 device
 */
export const testConnection = async (host: string, port: number = 81): Promise<ConnectionTestResult> => {
  const startTime = Date.now();
  const wsUrl = `ws://${host}:${port}`;
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Connection timeout after 5 seconds',
        details: {
          host,
          port,
          protocol: 'WebSocket',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      });
    }, 5000);

    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          success: true,
          details: {
            host,
            port,
            protocol: 'WebSocket',
            timestamp: new Date().toISOString(),
            responseTime: Date.now() - startTime
          }
        });
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: 'WebSocket connection failed',
          details: {
            host,
            port,
            protocol: 'WebSocket',
            timestamp: new Date().toISOString(),
            responseTime: Date.now() - startTime
          }
        });
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: `Connection closed with code ${event.code}`,
            details: {
              host,
              port,
              protocol: 'WebSocket',
              timestamp: new Date().toISOString(),
              responseTime: Date.now() - startTime
            }
          });
        }
      };
    } catch (error) {
      clearTimeout(timeout);
      resolve({
        success: false,
        error: `Failed to create WebSocket: ${error}`,
        details: {
          host,
          port,
          protocol: 'WebSocket',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      });
    }
  });
};

/**
 * Test HTTP connectivity to ESP32 (if available)
 */
export const testHttpConnection = async (host: string, port: number = 80): Promise<ConnectionTestResult> => {
  const startTime = Date.now();
  const httpUrl = `http://${host}:${port}`;
  
  try {
    const response = await fetch(httpUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    
    return {
      success: true,
      details: {
        host,
        port,
        protocol: 'HTTP',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `HTTP connection failed: ${error}`,
      details: {
        host,
        port,
        protocol: 'HTTP',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      }
    };
  }
};

/**
 * Comprehensive connection test
 */
export const runConnectionTests = async (host: string): Promise<{
  websocket: ConnectionTestResult;
  http: ConnectionTestResult;
  summary: {
    overall: boolean;
    recommendations: string[];
  };
}> => {
  const [websocket, http] = await Promise.all([
    testConnection(host, 81),
    testHttpConnection(host, 80)
  ]);

  const recommendations: string[] = [];
  
  if (!websocket.success) {
    recommendations.push('Check if ESP32 is running and WebSocket server is active');
    recommendations.push('Verify the ESP32 IP address is correct');
    recommendations.push('Ensure both devices are on the same network');
  }
  
  if (!http.success) {
    recommendations.push('ESP32 may not have HTTP server enabled (this is normal)');
  }
  
  if (websocket.success && http.success) {
    recommendations.push('All connections successful!');
  }

  return {
    websocket,
    http,
    summary: {
      overall: websocket.success,
      recommendations
    }
  };
};

/**
 * Common ESP32 IP addresses to try
 */
export const commonEsp32Ips = [
  '192.168.1.100',
  '192.168.1.101',
  '192.168.1.102',
  '192.168.4.1', // ESP32 AP mode default
  '10.0.0.1',
  '172.16.0.1'
];

/**
 * Auto-discover ESP32 devices on local network
 */
export const discoverEsp32Devices = async (): Promise<string[]> => {
  const discovered: string[] = [];
  
  // Test common IP addresses
  for (const ip of commonEsp32Ips) {
    try {
      const result = await testConnection(ip, 81);
      if (result.success) {
        discovered.push(ip);
      }
    } catch (error) {
      // Continue testing other IPs
    }
  }
  
  return discovered;
};
