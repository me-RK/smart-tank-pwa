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
    mixedContent?: boolean;
  };
}

/**
 * Test WebSocket connection to ESP32 device
 */
export const testConnection = async (host: string, port: number = 81): Promise<ConnectionTestResult> => {
  const startTime = Date.now();
  
  // Check if we're on HTTPS and provide appropriate protocol
  const isHttps = window.location.protocol === 'https:';
  const wsUrl = isHttps ? `wss://${host}:${port}` : `ws://${host}:${port}`;
  
  console.log(`Testing connection to ${wsUrl}...`);
  
  // If on HTTPS and trying to connect to local network, provide helpful error
  if (isHttps && (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.'))) {
    console.log(`⚠️ HTTPS detected - Local network connections may be blocked by Mixed Content policy`);
    return new Promise((resolve) => {
      resolve({
        success: false,
        error: 'HTTPS Mixed Content: Cannot connect to local network from HTTPS site. Try accessing via HTTP or use local development server.',
        details: {
          host,
          port,
          protocol: 'WebSocket',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime,
          mixedContent: true
        }
      });
    });
  }
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log(`❌ ${host}:${port} - Connection timeout after 5 seconds`);
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
        console.log(`✅ ${host}:${port} - WebSocket connection successful`);
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
        console.log(`❌ ${host}:${port} - WebSocket connection failed:`, error);
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
    await fetch(httpUrl, {
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
  '192.168.1.1',
  '192.168.1.2',
  '192.168.1.3',
  '192.168.1.4',
  '192.168.1.5',
  '192.168.1.6',
  '192.168.1.7',
  '192.168.1.8',  // Your ESP32 IP
  '192.168.1.9',
  '192.168.1.10',
  '192.168.1.100',
  '192.168.1.101',
  '192.168.1.102',
  '192.168.1.103',
  '192.168.1.104',
  '192.168.1.105',
  '192.168.4.1', // ESP32 AP mode default
  '192.168.4.2',
  '10.0.0.1',
  '172.16.0.1',
  '192.168.0.100',
  '192.168.0.101',
  '192.168.0.102'
];

/**
 * Auto-discover ESP32 devices on local network
 */
export const discoverEsp32Devices = async (): Promise<string[]> => {
  const discovered: string[] = [];
  
  console.log('Scanning for ESP32 devices...');
  console.log('Testing IPs:', commonEsp32Ips);
  
  // Test common IP addresses in parallel batches
  const batchSize = 3; // Reduced batch size for better reliability
  const batches = [];
  
  for (let i = 0; i < commonEsp32Ips.length; i += batchSize) {
    const batch = commonEsp32Ips.slice(i, i + batchSize);
    batches.push(batch);
  }
  
  for (const batch of batches) {
    console.log(`Testing batch:`, batch);
    const promises = batch.map(async (ip) => {
      try {
        console.log(`Testing ${ip}...`);
        const result = await testConnection(ip, 81);
        if (result.success) {
          console.log(`✅ Found ESP32 device at ${ip}`);
          return ip;
        } else {
          console.log(`❌ ${ip} failed:`, result.error);
          return null;
        }
      } catch (error) {
        console.log(`❌ ${ip} error:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    const validDevices = results.filter(ip => ip !== null) as string[];
    discovered.push(...validDevices);
    
    // If we found devices, we can stop scanning
    if (discovered.length > 0) {
      console.log(`Found devices, stopping scan.`);
      break;
    }
  }
  
  console.log(`Discovery complete. Found ${discovered.length} devices:`, discovered);
  return discovered;
};

/**
 * Enhanced ESP32 connection test with detailed diagnostics
 */
export const testEsp32Connection = async (host: string): Promise<{
  success: boolean;
  error?: string;
  diagnostics: {
    websocket: boolean;
    responseTime: number;
    timestamp: string;
    host: string;
  };
}> => {
  const startTime = Date.now();
  
  try {
    const result = await testConnection(host, 81);
    
    return {
      success: result.success,
      error: result.error,
      diagnostics: {
        websocket: result.success,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        host
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Connection test failed: ${error}`,
      diagnostics: {
        websocket: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        host
      }
    };
  }
};
