# Smart Water Tank PWA - Local Deployment Guide

## 🏠 **Intended Use: Local Network Only**

This PWA is designed to run **locally on your network** to connect to your ESP32 device. It should **NOT** be deployed to GitHub Pages or any HTTPS server.

## 🚀 **Quick Start (Recommended)**

### 1. **Run Locally**
```bash
# Clone the repository
git clone <your-repo-url>
cd smart-tank-pwa

# Install dependencies
npm install

# Start local development server
npm run dev
```

### 2. **Access the App**
- **Local access**: http://localhost:3000/smart-tank-pwa/
- **Network access**: http://YOUR_COMPUTER_IP:3000/smart-tank-pwa/

### 3. **Connect to ESP32**
- Enter your ESP32 IP address (e.g., `192.168.1.100`)
- Click "Connect"
- The app will connect via HTTP WebSocket (no HTTPS issues)

## 📱 **PWA Installation (Local)**

### **From Localhost:**
1. Open http://localhost:3000/smart-tank-pwa/
2. Look for the install button (download icon) in the top-right
3. Click "Install App"
4. The PWA will be installed and work perfectly with your ESP32

### **From Network IP:**
1. Open http://YOUR_COMPUTER_IP:3000/smart-tank-pwa/
2. Install the PWA
3. It will work locally on your network

## 🔧 **Why Local Deployment?**

### **ESP32 Connection Requirements:**
- ESP32 uses **HTTP WebSocket** (port 81)
- Browsers block HTTP from HTTPS sites (Mixed Content Policy)
- Local HTTP deployment allows direct ESP32 connection

### **Benefits of Local Use:**
- ✅ **Direct ESP32 connection** (no internet required)
- ✅ **Works offline** after initial load
- ✅ **No HTTPS mixed content issues**
- ✅ **Faster response times**
- ✅ **More secure** (stays on your network)

## 🌐 **Network Access**

### **Find Your Computer's IP:**
```bash
# Windows
ipconfig

# macOS/Linux
ifconfig
```

### **Access from Other Devices:**
- **Phone/Tablet**: http://YOUR_COMPUTER_IP:3000/smart-tank-pwa/
- **Other Computers**: Same URL
- **All devices** on your network can access the PWA

## 🚫 **What NOT to Do**

### **Don't Deploy to:**
- ❌ GitHub Pages (HTTPS)
- ❌ Netlify (HTTPS)
- ❌ Vercel (HTTPS)
- ❌ Any HTTPS hosting service

### **Why These Don't Work:**
- HTTPS sites cannot connect to HTTP ESP32 devices
- Mixed Content Policy blocks the connection
- The PWA will show connection errors

## 🔄 **Development Workflow**

### **For Development:**
```bash
npm run dev
# Access via http://localhost:3000/smart-tank-pwa/
```

### **For Production (Local Network):**
```bash
npm run build
npm run preview
# Access via http://localhost:4173/smart-tank-pwa/
```

## 📋 **Troubleshooting**

### **Connection Issues:**
1. **Check ESP32 IP**: Look at ESP32 Serial Monitor
2. **Verify Network**: Both devices on same WiFi
3. **Test Connection**: Use the "Test Connection" button
4. **Check Firewall**: Ensure port 3000 is open

### **PWA Installation Issues:**
1. **Use HTTP**: Make sure you're accessing via HTTP, not HTTPS
2. **Check Manifest**: Verify manifest.json is accessible
3. **Service Worker**: Check browser console for SW errors

## 🎯 **Summary**

**This PWA is designed for local network use only.**
- Run with `npm run dev`
- Access via HTTP (not HTTPS)
- Install as PWA locally
- Connect directly to ESP32
- Works offline after installation

**Perfect for home automation, local monitoring, and offline operation!** 🏠✨
