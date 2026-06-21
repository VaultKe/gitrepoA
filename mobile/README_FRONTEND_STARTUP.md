# 🚀 VaultKe Frontend Startup Guide

> **Quick Start**: [Prerequisites](#prerequisites) | [Installation](#installation) | [Running the App](#running-the-app) | [Troubleshooting](#troubleshooting)

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Development Platforms](#development-platforms)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Environment Setup](#environment-setup)
- [Troubleshooting](#troubleshooting)
- [Development Tips](#development-tips)

## 🔧 Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   # Check version
   node --version
   
   # Install from https://nodejs.org/
   # Or use nvm (recommended)
   nvm install 18
   nvm use 18
   ```

2. **npm or yarn** (Package Manager)
   ```bash
   # Check npm version
   npm --version
   
   # Or install yarn
   npm install -g yarn
   ```

3. **Expo CLI** (Global Installation)
   ```bash
   # Install Expo CLI globally
   npm install -g @expo/cli
   
   # Verify installation
   expo --version
   ```

### Platform-Specific Requirements

#### For iOS Development (macOS only)
- **Xcode** (latest version from App Store)
- **iOS Simulator** (included with Xcode)
- **CocoaPods** (for iOS dependencies)
  ```bash
  sudo gem install cocoapods
  ```

#### For Android Development
- **Android Studio** (download from developer.android.com)
- **Android SDK** (installed via Android Studio)
- **Android Emulator** (configured in Android Studio)
- **Java Development Kit (JDK)** 11 or higher

#### For Web Development
- **Modern Web Browser** (Chrome, Firefox, Safari, Edge)

## 📦 Installation

### Step 1: Navigate to Frontend Directory
```bash
cd apps/mobile
```

### Step 2: Install Dependencies
```bash
# Using npm
npm install

# Or using yarn
yarn install
```

### Step 3: Verify Installation
```bash
# Check if all dependencies are installed
npm list --depth=0

# Or with yarn
yarn list --depth=0
```

## 🚀 Running the App

### Quick Start (Recommended)
```bash
# Start the development server
npm start

# Or with yarn
yarn start
```

This will:
- ✅ Start the Expo development server
- ✅ Open Expo DevTools in your browser
- ✅ Generate QR code for mobile testing
- ✅ Provide options to run on different platforms

### Platform-Specific Commands

#### 🌐 Web Development
```bash
# Run on web browser
npm run web

# Or with yarn
yarn web
```
- Opens at: `http://localhost:19006`
- Best for rapid UI development
- Hot reload enabled

#### 📱 iOS Development
```bash
# Run on iOS simulator
npm run ios

# Or with yarn
yarn ios
```
- Requires macOS and Xcode
- Opens iOS Simulator automatically
- Hot reload enabled

#### 🤖 Android Development
```bash
# Run on Android emulator
npm run android

# Or with yarn
yarn android
```
- Requires Android Studio setup
- Opens Android Emulator automatically
- Hot reload enabled

#### 📲 Physical Device Testing

1. **Install Expo Go App**:
   - iOS: Download from App Store
   - Android: Download from Google Play Store

2. **Scan QR Code**:
   - Run `npm start` or `yarn start`
   - Scan QR code with Expo Go app
   - App will load on your device

## 🖥️ Development Platforms

### Option 1: Web Browser (Fastest)
- **Best for**: UI development, layout testing
- **Pros**: Fastest reload, easy debugging
- **Cons**: Limited native features
- **URL**: http://localhost:19006

### Option 2: iOS Simulator (macOS only)
- **Best for**: iOS-specific testing
- **Pros**: Native iOS behavior, full feature access
- **Cons**: Requires macOS and Xcode
- **Setup**: Install Xcode from App Store

### Option 3: Android Emulator
- **Best for**: Android-specific testing
- **Pros**: Native Android behavior, full feature access
- **Cons**: Requires Android Studio setup
- **Setup**: Install Android Studio and create AVD

### Option 4: Physical Device (Recommended)
- **Best for**: Real-world testing, performance testing
- **Pros**: True user experience, all sensors available
- **Cons**: Requires Expo Go app installation
- **Setup**: Install Expo Go, scan QR code

## 📁 Project Structure

```
apps/mobile/
├── App.js                 # Main app entry point
├── EnhancedApp.js         # Enhanced app with context
├── package.json           # Dependencies and scripts
├── app.json              # Expo configuration
├── assets/               # Images, icons, fonts
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── common/       # Common components
│   │   └── wallet/       # Wallet-specific components
│   ├── context/          # React Context providers
│   │   └── AppContext.js # Global app state
│   ├── screens/          # App screens/pages
│   │   ├── auth/         # Authentication screens
│   │   ├── user/         # User dashboard screens
│   │   ├── chama/        # Chama management screens
│   │   ├── marketplace/  # Marketplace screens
│   │   ├── chat/         # Chat screens
│   │   ├── wallet/       # Wallet screens
│   │   ├── settings/     # Settings screens
│   │   └── admin/        # Admin screens
│   ├── services/         # API and external services
│   │   ├── api.js        # API service layer
│   │   ├── database.js   # Local database (SQLite)
│   │   └── syncService.js # Data synchronization
│   ├── theme/            # App theming
│   │   └── theme.js      # Theme configuration
│   └── utils/            # Utility functions
│       └── theme.js      # Theme utilities
└── README_FRONTEND_STARTUP.md # This file
```

## 📜 Available Scripts

### Development Scripts
```bash
# Start development server
npm start / yarn start

# Run on web
npm run web / yarn web

# Run on iOS
npm run ios / yarn ios

# Run on Android
npm run android / yarn android
```

### Build Scripts
```bash
# Build for production
expo build

# Build for web
expo build:web

# Build for iOS
expo build:ios

# Build for Android
expo build:android
```

### Utility Scripts
```bash
# Clear cache
expo start --clear

# Reset Metro bundler cache
expo start --reset-cache

# Install iOS dependencies
cd ios && pod install

# Check for issues
expo doctor
```

## 🔧 Environment Setup

### Backend Connection

The frontend connects to the backend API. Ensure the backend is running:

1. **Start Backend Server**:
   ```bash
   # In another terminal
   cd apps/backend
   go run main.go
   ```

2. **Verify Backend**:
   ```bash
   curl http://localhost:8085/health
   ```

3. **Update API URL** (if needed):
   ```javascript
   // In src/services/api.js
   const BASE_URL = 'http://localhost:8085/api/v1';
   ```

### Environment Variables

Create `.env` file in `apps/mobile/` (if needed):
```env
BACKEND_API_URL=http://localhost:8085/api/v1
EXPO_PUBLIC_WS_URL=ws://https://dqtl6f-ip-41-139-130-223.tunnelmole.net/ws
EXPO_PUBLIC_ENV=development
```

## 🐛 Troubleshooting

### Common Issues

#### Issue 1: "Metro bundler failed to start"
```bash
# Solution: Clear cache and restart
expo start --clear
```

#### Issue 2: "Unable to resolve module"
```bash
# Solution: Reinstall dependencies
rm -rf node_modules
npm install
# or
yarn install
```

#### Issue 3: "Expo CLI not found"
```bash
# Solution: Install Expo CLI globally
npm install -g @expo/cli
```

#### Issue 4: "Android emulator not starting"
```bash
# Solution: Check Android Studio setup
# 1. Open Android Studio
# 2. Go to AVD Manager
# 3. Create/start virtual device
```

#### Issue 5: "iOS simulator not opening"
```bash
# Solution: Check Xcode installation
# 1. Install Xcode from App Store
# 2. Open Xcode and accept license
# 3. Install additional components
```

#### Issue 6: "Network request failed"
```bash
# Solution: Check backend connection
# 1. Ensure backend is running
# 2. Check API URL in src/services/api.js
# 3. Verify network connectivity
```

### Debug Mode

Enable debug mode for detailed logging:
```bash
# Set debug environment
export DEBUG=expo:*

# Start with debug
expo start --dev-client
```

### Performance Issues

If the app is slow:
```bash
# Clear all caches
expo start --clear --reset-cache

# Check for memory leaks
# Use React DevTools
# Monitor network requests
```

## 💡 Development Tips

### Hot Reload
- **Enabled by default** in development
- **Save any file** to see changes instantly
- **Shake device** or press `Cmd+D` (iOS) / `Cmd+M` (Android) for dev menu

### Debugging
- **React DevTools**: Install browser extension
- **Flipper**: Advanced debugging tool
- **Console logs**: Use `console.log()` for debugging
- **Network inspector**: Monitor API calls

### Testing on Multiple Platforms
```bash
# Test on all platforms simultaneously
npm start

# Then open:
# - Web: http://localhost:19006
# - iOS: Press 'i' in terminal
# - Android: Press 'a' in terminal
# - Device: Scan QR code with Expo Go
```

### Code Organization
- **Components**: Keep reusable components in `src/components/`
- **Screens**: Page-level components in `src/screens/`
- **Services**: API and external services in `src/services/`
- **Utils**: Helper functions in `src/utils/`

### Theme Customization
```javascript
// Edit src/theme/theme.js
export const VaultKeTheme = {
  colors: {
    primary: '#6366F1',    // Customize primary color
    background: '#0D1117', // Dark background
    // ... other colors
  }
};
```

---

## 🎉 You're Ready!

### Quick Start Checklist
- [ ] Node.js installed
- [ ] Expo CLI installed
- [ ] Dependencies installed (`npm install`)
- [ ] Backend server running
- [ ] Development server started (`npm start`)
- [ ] App running on preferred platform

### Next Steps
1. **Explore the app** on your preferred platform
2. **Make changes** to see hot reload in action
3. **Test features** like authentication, wallet, marketplace
4. **Check backend integration** by testing API calls
5. **Customize theme** and UI components as needed

**Happy Coding! 🚀**
