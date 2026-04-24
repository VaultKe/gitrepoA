// API Configuration for VaultKe Mobile App
// Handles dynamic API URL resolution for different environments

/**
 * Get the appropriate API base URL based on current environment
 * Priority: Environment variable > Current hostname detection > Default
 */
export const getApiBaseUrl = () => {
  // Check for environment variable override
  if (process.env.REACT_NATIVE_API_URL) {
    return process.env.REACT_NATIVE_API_URL;
  }

  // Detect current environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;    
    // If accessing via localhost/127.0.0.1, use localhost backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://https://dqtl6f-ip-41-139-130-223.tunnelmole.net/api/v1';
    }
    
    // If accessing via network IP, use network backend
    if (hostname.match(/^192\.168\.|^10\.|^172\./)) {
      return `http://${hostname.replace(/:\d+$/, '')}:808/api/v1`;
    }
    
    // If accessing via tunnelmole, use dedicated backend tunnel
    if (hostname.includes('tunnelmole.net')) {
      return 'https://jhkvn8-ip-41-72-200-10.tunnelmole.net/api/v1';
    }
    
    // If accessing via other tunnel services
    if (hostname.includes('ngrok.io') || hostname.includes('localtunnel.me') || hostname.includes('localhost.run')) {
      return `${protocol}//${hostname}/api/v1`;
    }
  }

  // Default fallback - current backend tunnel
  return 'https://jhkvn8-ip-41-72-200-10.tunnelmole.net/api/v1';
};

/**
 * API Configuration object
 */
export const API_CONFIG = {
  // Base URL
  BASE_URL: getApiBaseUrl(),
  
  // Timeout settings (adjusted for tunnel latency)
  TIMEOUT: {
    DEFAULT: 15000, // 15 seconds
    UPLOAD: 30000,  // 30 seconds for file uploads
    DOWNLOAD: 60000, // 60 seconds for downloads
  },
  
  // Retry settings
  RETRY: {
    ATTEMPTS: 3,
    DELAY: 1000, // 1 second base delay
    BACKOFF: 2,  // Exponential backoff multiplier
  },
  
  // Cache settings
  CACHE: {
    DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
    LONG_TTL: 30 * 60 * 1000,   // 30 minutes
    SHORT_TTL: 1 * 60 * 1000,   // 1 minute
  }
};

/**
 * Check if current environment is using tunnels
 */
export const isTunnelEnvironment = () => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  return hostname.includes('tunnelmole.net') || 
         hostname.includes('ngrok.io') || 
         hostname.includes('localtunnel.me') || 
         hostname.includes('localhost.run');
};

/**
 * Get optimized timeout based on environment
 */
export const getOptimizedTimeout = (operation = 'default') => {
  const baseTimeout = API_CONFIG.TIMEOUT[operation.toUpperCase()] || API_CONFIG.TIMEOUT.DEFAULT;
  
  // Increase timeout for tunnel environments
  if (isTunnelEnvironment()) {
    return Math.floor(baseTimeout * 1.5); // 50% increase for tunnels
  }
  
  return baseTimeout;
};

/**
 * Log current API configuration for debugging
 */
export const logApiConfig = () => {
};
