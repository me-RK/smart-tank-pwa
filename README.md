# Smart Water Tank PWA

A modern, minimalistic React TypeScript Progressive Web App for monitoring and controlling smart water tank systems with real-time WebSocket connectivity.

## 🚀 Features

### Core Functionality
- **Real-time Dashboard**: Live monitoring of tank levels, motor status, and system health
- **WebSocket Integration**: Real-time communication with tank systems via `ws://host:1337`
- **Dual Tank Support**: Monitor both Tank A and Tank B with upper/lower level tracking
- **System Modes**: Auto and Manual control modes with intelligent switching
- **Settings Management**: Comprehensive configuration for sensors, dimensions, and thresholds

### PWA Features
- **Offline Capability**: Works without internet connection using service worker
- **Installable**: Can be installed as a native app on mobile and desktop
- **Push Notifications**: Real-time alerts for tank level changes and system events
- **Responsive Design**: Optimized for mobile, tablet, and desktop devices
- **Dark/Light Theme**: Automatic theme switching based on system preferences

### Technical Features
- **TypeScript**: Full type safety and better development experience
- **Modern React**: Built with React 19 and latest hooks
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **Service Worker**: Advanced caching and offline functionality
- **WebSocket Context**: Global state management for real-time data

## 📱 Pages/Views

### Dashboard
- **Server Status**: Connection indicator with real-time status
- **Tank Levels**: Visual representation of water levels for both tanks
- **Motor Control**: Manual motor toggle (Manual Mode only)
- **System Mode**: Auto/Manual mode display with active reasons
- **Sync Data**: Manual refresh button for immediate updates

### Settings
- **System Mode Selection**: Toggle between Auto and Manual modes
- **Auto Mode Settings**: Configure minimum/maximum water levels
- **Manual Mode Guidance**: Instructions for manual control
- **Tank Dimensions**: Set height, full, and empty levels for both tanks
- **Sensor Activation**: Enable/disable sensors for each tank
- **Special Functions**: Additional automation features

## 🔧 WebSocket Integration

### Connection
```typescript
// Connect to tank system
const wsUrl = `ws://${host}:1337`;
const websocket = new WebSocket(wsUrl);
```

### Message Types
- `status`: System status updates (connection, motor, runtime)
- `settings`: Configuration changes
- `tankData`: Tank level updates
- `error`: Error notifications

### Auto-reconnection
- Automatic reconnection on disconnect
- Exponential backoff for failed connections
- Graceful fallback to polling mode

## 🎨 UI/UX Design

### Design Principles
- **Minimalist**: Clean, uncluttered interface
- **Modern**: Contemporary design with smooth animations
- **Accessible**: WCAG compliant with keyboard navigation
- **Responsive**: Mobile-first design approach

### Components
- **ToggleSwitch**: Animated toggle controls with multiple sizes and colors
- **TankLevelCard**: Visual tank level display with progress bars
- **SensorCheckbox**: Styled checkboxes for sensor activation
- **StatusCard**: System status overview with connection info
- **ConnectionModal**: WebSocket connection setup

## 🏗️ Architecture

### Folder Structure
```
src/
├── components/          # Reusable UI components
│   ├── ToggleSwitch.tsx
│   ├── TankLevelCard.tsx
│   ├── SensorCheckbox.tsx
│   ├── StatusCard.tsx
│   └── ConnectionModal.tsx
├── context/             # React Context providers
│   └── WebSocketContext.tsx
├── pages/               # Main application pages
│   ├── Dashboard.tsx
│   └── Settings.tsx
├── types/               # TypeScript type definitions
│   └── index.ts
├── utils/               # Utility functions
│   └── pwa.ts
├── App.tsx              # Main app component
└── main.tsx             # Application entry point
```

### State Management
- **WebSocket Context**: Global state for real-time data
- **Local State**: Component-specific state with React hooks
- **Persistent Storage**: localStorage for connection settings

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Modern web browser with WebSocket support

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd smart-tank-pwa

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development
```bash
# Run with hot reload
npm run dev

# Type checking
npm run lint

# Build and deploy
npm run deploy
```

## 🌐 Deployment

### GitHub Pages (Recommended)
The app is configured for automatic deployment to GitHub Pages:

#### Automatic Deployment
1. **Push to main branch**: Automatic deployment via GitHub Actions
2. **Access URL**: `https://yourusername.github.io/smart-tank-pwa/`

#### Manual Deployment
```bash
# Build and deploy manually
npm run deploy
```

#### GitHub Pages Setup
1. Go to your repository **Settings**
2. Navigate to **Pages** section
3. Set **Source** to "GitHub Actions"
4. The workflow will automatically deploy on push to main

### Configuration
- **Base Path**: `/smart-tank-pwa/` (configured in `vite.config.ts`)
- **Service Worker**: Automatic registration and caching
- **PWA Manifest**: Complete manifest for app installation
- **Node.js Version**: 20 (specified in `.nvmrc`)

### Troubleshooting Deployment
If deployment fails:
1. Check GitHub Actions logs for specific errors
2. Ensure all dependencies are properly specified in `package.json`
3. Verify the base path matches your repository name
4. Check that GitHub Pages is enabled in repository settings

## 📱 PWA Installation

### Mobile (iOS/Android)
1. Open the app URL in mobile browser
2. Look for "Add to Home Screen" option
3. Tap to install as native app

### Desktop (Chrome/Edge)
1. Open the app URL in browser
2. Look for install icon in address bar
3. Click to install as desktop app

## 🔌 WebSocket Protocol

### Connection Setup
```javascript
// Connect to tank system
const ws = new WebSocket('ws://192.168.1.100:1337');

// Handle messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update UI based on message type
};
```

### Message Format
```typescript
interface WebSocketMessage {
  type: 'status' | 'settings' | 'tankData' | 'error';
  data: SystemStatus | SystemSettings | TankData | string;
}
```

## 🎯 Usage

### Connecting to Tank System
1. Open the app in your browser
2. Click "Connect" button in header
3. Enter tank system IP address (e.g., `192.168.1.100`)
4. App will automatically connect to port 1337

### Monitoring Tank Levels
- **Real-time Updates**: Tank levels update automatically
- **Visual Indicators**: Color-coded level bars (red/orange/green)
- **Percentage Display**: Exact water level percentages
- **Last Updated**: Timestamp of last data refresh

### Controlling Motor
- **Auto Mode**: Motor controlled automatically based on water levels
- **Manual Mode**: Toggle motor on/off manually
- **Safety Features**: Confirmation required for motor control

### Configuring Settings
- **System Mode**: Switch between Auto and Manual modes
- **Water Levels**: Set minimum and maximum thresholds
- **Tank Dimensions**: Configure physical tank measurements
- **Sensor Settings**: Enable/disable individual sensors

## 🛠️ Customization

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Custom CSS**: Additional styles in `src/index.css`
- **Dark Mode**: Automatic theme switching
- **Responsive**: Mobile-first design

### WebSocket Configuration
- **Host Storage**: IP addresses stored in localStorage
- **Auto-reconnect**: Configurable reconnection settings
- **Error Handling**: Graceful error recovery

## 📊 Performance

### Optimization Features
- **Service Worker**: Advanced caching strategies
- **Code Splitting**: Lazy loading of components
- **Image Optimization**: SVG icons for scalability
- **Bundle Size**: Minimal JavaScript bundle

### Caching Strategy
- **Static Assets**: Cached for offline use
- **Dynamic Content**: Network-first with cache fallback
- **WebSocket Data**: Real-time updates without caching

## 🔒 Security

### Data Protection
- **Local Storage**: Sensitive data stored locally only
- **WebSocket Security**: Connection validation and error handling
- **Input Validation**: All user inputs validated and sanitized

### Privacy
- **No Tracking**: No analytics or user tracking
- **Local Data**: All data stored locally on device
- **Secure Connections**: HTTPS for production deployment

## 🐛 Troubleshooting

### Common Issues

#### Connection Problems
- **Check IP Address**: Ensure correct tank system IP
- **Firewall Settings**: Allow WebSocket connections on port 1337
- **Network Access**: Ensure device and tank system are on same network

#### PWA Installation Issues
- **HTTPS Required**: PWA requires secure connection
- **Service Worker**: Check browser console for errors
- **Manifest**: Verify manifest.json is accessible

#### Performance Issues
- **Clear Cache**: Clear browser cache and reload
- **Service Worker**: Update service worker in browser settings
- **Network**: Check network connectivity and speed

### Debug Mode
```javascript
// Enable debug logging
localStorage.setItem('debug', 'true');

// Check service worker status
navigator.serviceWorker.getRegistrations().then(console.log);
```

## 📈 Future Enhancements

### Planned Features
- **Historical Data**: Tank level history and trends
- **Charts**: Visual data representation
- **Multiple Systems**: Support for multiple tank systems
- **Advanced Alerts**: Customizable notification settings
- **Data Export**: Export tank data to CSV/JSON

### Technical Improvements
- **Offline Sync**: Queue changes for when connection restored
- **Push Notifications**: Server-sent notifications
- **Advanced Caching**: Intelligent cache management
- **Performance Monitoring**: Real-time performance metrics

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test thoroughly
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open Pull Request

### Code Standards
- **TypeScript**: Full type safety required
- **ESLint**: Follow configured linting rules
- **Prettier**: Consistent code formatting
- **Testing**: Unit tests for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Team**: For the amazing React framework
- **Vite Team**: For the fast build tool
- **Tailwind CSS**: For the utility-first CSS framework
- **Lucide React**: For the beautiful icon set

---

**Smart Water Tank PWA** - Modern water tank monitoring made simple! 💧