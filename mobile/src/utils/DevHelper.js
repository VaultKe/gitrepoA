import { Platform } from 'react-native';

class DevHelper {
  constructor() {
    this.isDevelopment = __DEV__;
    this.isWeb = Platform.OS === 'web';
    this.hotReloadEnabled = this.isDevelopment;
  }

  // Enable fast refresh for React components
  enableFastRefresh() {
    if (this.isDevelopment && !this.isWeb) {
      // Enable React Fast Refresh
      if (module.hot) {
        module.hot.accept();
      }
    }
  }

  // Log development info
  log(message, data = null) {
    if (this.isDevelopment) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`🔧 [DEV ${timestamp}] ${message}`, data || '');
    }
  }

  // Performance monitoring for development
  measurePerformance(name, fn) {
    if (this.isDevelopment) {
      const start = Date.now();
      const result = fn();
      const end = Date.now();
      this.log(`⚡ Performance: ${name} took ${end - start}ms`);
      return result;
    }
    return fn();
  }

  // Hot reload notification
  onHotReload(componentName) {
    if (this.isDevelopment) {
    }
  }

  // Development shortcuts
  getDevInfo() {
    if (this.isDevelopment) {
      return {
        platform: Platform.OS,
        version: Platform.Version,
        isDev: this.isDevelopment,
        hotReload: this.hotReloadEnabled,
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }
}

export default new DevHelper();
