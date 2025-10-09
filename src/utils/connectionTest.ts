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
 * Get local IP address using WebRTC
 */
export const getLocalIP = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    pc.createDataChannel('');
    pc.createOffer().then(offer => pc.setLocalDescription(offer));
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate;
        const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
        if (ipMatch) {
          const ip = ipMatch[1];
          // Filter out public IPs and localhost
          if (!ip.startsWith('127.') && !ip.startsWith('169.254.') && 
              (ip.startsWith('192.168.') || ip.startsWith('10.') || 
               (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31))) {
            pc.close();
            resolve(ip);
            return;
          }
        }
      }
    };
    
    // Timeout after 3 seconds
    setTimeout(() => {
      pc.close();
      resolve(null);
    }, 3000);
  });
};

/**
 * Get current network configuration
 */
export const getNetworkConfig = async (): Promise<{ gateway: string; subnet: string; network: string } | null> => {
  try {
    // First try to get local IP using WebRTC
    const localIP = await getLocalIP();
    
    if (localIP) {
      console.log(`Detected local IP: ${localIP}`);
      const ipParts = localIP.split('.').map(Number);
      const [a, b, c] = ipParts;
      
      // Determine network class and common gateway
      let gateway: string;
      let subnet: string;
      let network: string;
      
      if (a === 192 && b === 168) {
        // 192.168.x.x network
        gateway = `${a}.${b}.${c}.1`;
        subnet = '255.255.255.0';
        network = `${a}.${b}.${c}.0`;
      } else if (a === 10) {
        // 10.x.x.x network
        gateway = `${a}.${b}.${c}.1`;
        subnet = '255.255.255.0';
        network = `${a}.${b}.${c}.0`;
      } else if (a === 172 && b >= 16 && b <= 31) {
        // 172.16.x.x - 172.31.x.x network
        gateway = `${a}.${b}.${c}.1`;
        subnet = '255.255.255.0';
        network = `${a}.${b}.${c}.0`;
      } else {
        // Default to /24 subnet
        gateway = `${a}.${b}.${c}.1`;
        subnet = '255.255.255.0';
        network = `${a}.${b}.${c}.0`;
      }
      
      return { gateway, subnet, network };
    }
    
    // Fallback: Get current page URL to determine network
    const currentUrl = new URL(window.location.href);
    const hostname = currentUrl.hostname;
    
    // If we're on localhost or IP, we can detect the network
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // For localhost, we'll use common network ranges
      return {
        gateway: '192.168.1.1',
        subnet: '255.255.255.0',
        network: '192.168.1.0'
      };
    }
    
    // If we're on an IP address, extract network info
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b, c] = ipMatch.map(Number);
      
      // Determine network class and common gateway
      let gateway: string;
      let subnet: string;
      let network: string;
      
      if (a === 192 && b === 168) {
        // 192.168.x.x network
        gateway = `${a}.${b}.${c}.1`;
        subnet = '255.255.255.0';
        network = `${a}.${b}.${c}.0`;
      } else if (a === 10) {
        // 10.x.x.x network
        gateway = `${a}.${b}.${c}.1`;
        subnet = '255.255.255.0';
        network = `${a}.${b}.${c}.0`;
      } else if (a === 172 && b >= 16 && b <= 31) {
        // 172.16.x.x - 172.31.x.x network
        gateway = `${a}.${b}.${c}.1`;
        subnet = '255.255.255.0';
        network = `${a}.${b}.${c}.0`;
      } else {
        // Default to /24 subnet
        gateway = `${a}.${b}.${c}.1`;
        subnet = '255.255.255.0';
        network = `${a}.${b}.${c}.0`;
      }
      
      return { gateway, subnet, network };
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting network config:', error);
    return null;
  }
};

/**
 * Generate IP addresses to scan based on network configuration
 */
export const generateIpList = async (): Promise<string[]> => {
  const networkConfig = await getNetworkConfig();
  const ips: string[] = [];
  
  if (networkConfig) {
    const { gateway, network } = networkConfig;
    
    // Extract base network (e.g., 192.168.1 from 192.168.1.0)
    const baseNetwork = network.split('.').slice(0, 3).join('.');
    
    // Add common ESP32 IPs first (gateway, common router IPs, etc.)
    ips.push(gateway);
    ips.push(`${baseNetwork}.2`);
    ips.push(`${baseNetwork}.3`);
    ips.push(`${baseNetwork}.4`);
    ips.push(`${baseNetwork}.5`);
    
    // Add some common ESP32 IPs in the middle range
    for (let i = 10; i <= 20; i++) {
      ips.push(`${baseNetwork}.${i}`);
    }
    
    // Add some common ESP32 IPs in the higher range
    for (let i = 100; i <= 110; i++) {
      ips.push(`${baseNetwork}.${i}`);
    }
    
    // Add some common ESP32 IPs in the very high range
    for (let i = 200; i <= 254; i++) {
      ips.push(`${baseNetwork}.${i}`);
    }
    
    console.log(`Generated ${ips.length} IPs to scan for network ${baseNetwork}.x`);
  } else {
    // Fallback to common IPs if network detection fails
    console.log('Network detection failed, using fallback IP list');
    ips.push(
      '192.168.1.1', '192.168.1.2', '192.168.1.3', '192.168.1.4', '192.168.1.5',
      '192.168.179.250', '192.168.179.1', '192.168.179.2', '192.168.179.3',
      '192.168.4.1', '192.168.4.2',
      '10.0.0.1', '172.16.0.1'
    );
  }
  
  return ips;
};

/**
 * Auto-discover ESP32 devices on local network
 */
export const discoverEsp32Devices = async (): Promise<string[]> => {
  const discovered: string[] = [];
  
  console.log('Scanning for ESP32 devices...');
  
  // Generate IP list dynamically based on network configuration
  const commonEsp32Ips = await generateIpList();
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
 * Get network information for display
 */
export const getNetworkInfo = async (): Promise<{
  localIP: string | null;
  network: string | null;
  gateway: string | null;
  subnet: string | null;
  scanRange: string | null;
}> => {
  try {
    const localIP = await getLocalIP();
    const networkConfig = await getNetworkConfig();
    
    if (networkConfig) {
      return {
        localIP,
        network: networkConfig.network,
        gateway: networkConfig.gateway,
        subnet: networkConfig.subnet,
        scanRange: `${networkConfig.network.split('.').slice(0, 3).join('.')}.x`
      };
    }
    
    return {
      localIP,
      network: null,
      gateway: null,
      subnet: null,
      scanRange: null
    };
  } catch (error) {
    console.error('Error getting network info:', error);
    return {
      localIP: null,
      network: null,
      gateway: null,
      subnet: null,
      scanRange: null
    };
  }
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
