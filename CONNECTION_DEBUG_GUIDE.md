# Connection Debug Guide - Key Code Lines

## 🔍 **Critical Connection Code Lines**

### **1. WebSocket Connection Creation**
**File:** `src/context/WebSocketContext.tsx`
**Lines:** 107-113

```typescript
const connect = useCallback((host: string) => {
  try {
    // Store host in localStorage for persistence
    localStorage.setItem('tankHost', host);
    
    const wsUrl = `ws://${host}:81`;  // ← KEY LINE: WebSocket URL
    const newWs = new WebSocket(wsUrl);  // ← KEY LINE: WebSocket creation
```

**🔧 Debug Points:**
- Check if `host` parameter is correct (e.g., "192.168.1.100")
- Verify port 81 is correct
- Check if WebSocket constructor succeeds

### **2. WebSocket Event Handlers**
**File:** `src/context/WebSocketContext.tsx`
**Lines:** 115-144

```typescript
newWs.onopen = handleOpen;  // ← Connection success handler
newWs.onclose = (event: CloseEvent) => {  // ← Connection close handler
  console.log('WebSocket disconnected:', event.code, event.reason);
  // ... reconnection logic
};
newWs.onerror = handleError;  // ← Error handler
newWs.onmessage = handleMessage;  // ← Message handler
```

**🔧 Debug Points:**
- Check if `onopen` fires (connection successful)
- Check `onclose` event codes (1000 = normal, others = error)
- Check `onerror` for connection failures

### **3. Auto-Discovery Logic**
**File:** `src/components/ConnectionGuard.tsx`
**Lines:** 23-46

```typescript
const handleScanForDevices = useCallback(async () => {
  setIsScanning(true);
  setLastError(null);
  
  try {
    const devices = await discoverEsp32Devices();  // ← KEY LINE: Device discovery
    setDiscoveredDevices(devices);
    
    if (devices.length > 0) {
      const firstDevice = devices[0];
      console.log(`Found ESP32 device at ${firstDevice}, attempting connection...`);
      connect(firstDevice);  // ← KEY LINE: Auto-connect to found device
      setConnectionAttempts(prev => prev + 1);
    }
  } catch (error) {
    console.error('Device scan failed:', error);
    setLastError('Failed to scan for devices. Please check your network connection.');
  }
}, []);
```

**🔧 Debug Points:**
- Check if `discoverEsp32Devices()` returns any devices
- Check if `connect()` is called with correct IP
- Check console for "Found ESP32 device at..." message

### **4. Device Discovery Implementation**
**File:** `src/utils/connectionTest.ts`
**Lines:** 210-250

```typescript
export const discoverEsp32Devices = async (): Promise<string[]> => {
  const discovered: string[] = [];
  
  console.log('Scanning for ESP32 devices...');  // ← Debug line
  
  // Test common IP addresses in parallel batches
  const batchSize = 5;
  const batches = [];
  
  for (let i = 0; i < commonEsp32Ips.length; i += batchSize) {
    const batch = commonEsp32Ips.slice(i, i + batchSize);
    batches.push(batch);
  }
  
  for (const batch of batches) {
    const promises = batch.map(async (ip) => {
      try {
        const result = await testConnection(ip, 81);  // ← KEY LINE: Test each IP
        if (result.success) {
          console.log(`Found ESP32 device at ${ip}`);  // ← Debug line
          return ip;
        }
        return null;
      } catch {
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    const validDevices = results.filter(ip => ip !== null) as string[];
    discovered.push(...validDevices);
    
    // If we found devices, we can stop scanning
    if (discovered.length > 0) {
      break;
    }
  }
  
  console.log(`Discovery complete. Found ${discovered.length} devices:`, discovered);  // ← Debug line
  return discovered;
};
```

**🔧 Debug Points:**
- Check console for "Scanning for ESP32 devices..."
- Check console for "Found ESP32 device at..." messages
- Check final discovery results

### **5. Connection Test Implementation**
**File:** `src/utils/connectionTest.ts`
**Lines:** 22-80

```typescript
export const testConnection = async (host: string, port: number = 81): Promise<ConnectionTestResult> => {
  const startTime = Date.now();
  const wsUrl = `ws://${host}:${port}`;  // ← KEY LINE: WebSocket URL
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Connection timeout after 5 seconds',  // ← Timeout error
        // ...
      });
    }, 5000);  // ← 5-second timeout

    try {
      const ws = new WebSocket(wsUrl);  // ← KEY LINE: WebSocket creation
      
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          success: true,  // ← Success response
          // ...
        });
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: 'WebSocket connection failed',  // ← Connection error
          // ...
        });
      };
```

**🔧 Debug Points:**
- Check if WebSocket opens within 5 seconds
- Check for timeout vs connection errors
- Verify correct host and port

## 🚨 **Common Connection Issues & Solutions**

### **Issue 1: Auto-Discovery Not Working**
**Check These Lines:**
- `src/components/ConnectionGuard.tsx:28` - `discoverEsp32Devices()` call
- `src/utils/connectionTest.ts:210-250` - Discovery implementation
- `src/utils/connectionTest.ts:191-205` - Common IP addresses list

**Solutions:**
1. Check if ESP32 is on same network
2. Verify ESP32 IP is in common IPs list
3. Check firewall settings
4. Try manual connection

### **Issue 2: WebSocket Connection Fails**
**Check These Lines:**
- `src/context/WebSocketContext.tsx:112` - WebSocket URL construction
- `src/context/WebSocketContext.tsx:113` - WebSocket creation
- `src/context/WebSocketContext.tsx:115-144` - Event handlers

**Solutions:**
1. Verify ESP32 is running and accessible
2. Check port 81 is not blocked
3. Verify IP address is correct
4. Check ESP32 Serial Monitor for errors

### **Issue 3: Connection Timeout**
**Check These Lines:**
- `src/utils/connectionTest.ts:27-39` - 5-second timeout
- `src/context/WebSocketContext.tsx:125-142` - Reconnection logic

**Solutions:**
1. Check network connectivity
2. Verify ESP32 is responding
3. Try different network
4. Check ESP32 power and status

## 🔧 **Debug Steps**

### **Step 1: Check Browser Console**
Open browser console and look for:
```
Scanning for ESP32 devices...
Found ESP32 device at 192.168.1.100
WebSocket connected to ESP32
Received message from ESP32: {...}
```

### **Step 2: Check ESP32 Serial Monitor**
Look for:
```
WiFi connected successfully!
IP address: 192.168.1.100
WebSocket server running on: ws://192.168.1.100:81
System initialized!
[0] Client connected from 192.168.1.50
```

### **Step 3: Test Manual Connection**
1. Get ESP32 IP from Serial Monitor
2. Use manual connection in PWA
3. Test connection before connecting
4. Check for error messages

### **Step 4: Network Verification**
1. Ping ESP32 IP from computer
2. Check both devices on same network
3. Verify no firewall blocking port 81
4. Try mobile hotspot for testing

## 📍 **Key Debug Lines to Monitor**

1. **`src/context/WebSocketContext.tsx:112`** - WebSocket URL
2. **`src/context/WebSocketContext.tsx:113`** - WebSocket creation
3. **`src/components/ConnectionGuard.tsx:28`** - Device discovery
4. **`src/utils/connectionTest.ts:42`** - Connection test
5. **`src/utils/connectionTest.ts:44`** - Connection success
6. **`src/utils/connectionTest.ts:59`** - Connection error

These are the exact lines responsible for the connection process. Check each one for errors or issues!
