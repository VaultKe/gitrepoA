// Centralized Application Configuration
// Single source of truth for all environment variables and settings

import { Platform } from 'react-native';

/**
 * Get the current environment (development | production | staging)
 */
const getEnvironment = () => {
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  if (__DEV__) {
    return 'development';
  }
  return 'production';
};

/**
 * Resolve API base URL from environment variables
 */
const resolveApiBaseUrl = () => {
  // Priority 1: EXPO_PUBLIC_API_URL (Expo-managed public env var)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, ''); // Remove trailing slashes
  }

  // Priority 2: REACT_APP_API_URL (fallback for non-Expo setups)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/+$/, '');
  }

  // Priority 3: Local development fallback
  if (__DEV__ || process.env.NODE_ENV === 'development') {
    // Check if we're running on localhost (web) or need a dev server
    if (typeof window !== 'undefined' && window.location?.hostname?.includes('localhost')) {
      return 'http://localhost:5000/api';
    }
  }

  // No fallback - environment variable must be explicitly set
  return null;
};

/**
 * Resolve WebSocket URL from API base URL
 */
const resolveWebSocketUrl = (apiUrl) => {
  if (!apiUrl) return null;
  const protocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
  return apiUrl.replace(/^https?/, protocol);
};

/**
 * Environment-specific base configuration
 */
const environmentConfigs = {
  development: {
    // API endpoints
    API_BASE_URL: resolveApiBaseUrl(),
    WS_BASE_URL: () => resolveWebSocketUrl(resolveApiBaseUrl()),

    // Timeouts and retries (more lenient for development)
    REQUEST_TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,

    // Feature flags
    ENABLE_LOGGING: true,
    ENABLE_DEBUG: true,
    ENABLE_DEV_TOOLS: true,
    MOCK_PAYMENTS: false,
    SKIP_AUTH: false,
  },

  staging: {
    API_BASE_URL: resolveApiBaseUrl(),
    WS_BASE_URL: () => resolveWebSocketUrl(resolveApiBaseUrl()),
    REQUEST_TIMEOUT: 15000,
    RETRY_ATTEMPTS: 3,
    ENABLE_LOGGING: true,
    ENABLE_DEBUG: true,
    ENABLE_DEV_TOOLS: true,
    MOCK_PAYMENTS: true,
    SKIP_AUTH: false,
  },

  production: {
    API_BASE_URL: resolveApiBaseUrl(),
    WS_BASE_URL: () => resolveWebSocketUrl(resolveApiBaseUrl()),
    REQUEST_TIMEOUT: 10000,
    RETRY_ATTEMPTS: 2,
    ENABLE_LOGGING: false,
    ENABLE_DEBUG: false,
    ENABLE_DEV_TOOLS: false,
    MOCK_PAYMENTS: false,
    SKIP_AUTH: false,
  },
};

/**
 * Additional service URLs from environment
 */
const serviceUrls = {
  // No external service URLs currently configured
};

/**
 * External service credentials from environment
 */
const credentials = {
  GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
};

/**
 * Build final configuration object
 */
const buildConfig = () => {
  const env = getEnvironment();
  const baseConfig = environmentConfigs[env] || environmentConfigs.development;

  return {
    // Environment identification
    ENVIRONMENT: env,
    IS_DEVELOPMENT: env === 'development',
    IS_STAGING: env === 'staging',
    IS_PRODUCTION: env === 'production',

    // API configuration
    ...baseConfig,

    // External services
    ...serviceUrls,

    // Credentials
    ...credentials,

    // Platform info
    PLATFORM: Platform.OS,
    IS_ANDROID: Platform.OS === 'android',
    IS_IOS: Platform.OS === 'ios',

    // Computed WebSocket URL
    get WS_URL() {
      return baseConfig.WS_BASE_URL();
    },
  };
};

const config = buildConfig();

export default config;

// Named exports for convenient destructuring
export const {
  API_BASE_URL,
  WS_URL,
  REQUEST_TIMEOUT,
  RETRY_ATTEMPTS,
  ENABLE_LOGGING,
  ENABLE_DEBUG,
  ENVIRONMENT,
  IS_DEVELOPMENT,
  IS_PRODUCTION,
  IS_STAGING,
  GOOGLE_CLIENT_ID,
  PLATFORM,
  IS_ANDROID,
  IS_IOS,
} = config;

// Helper functions
export const isDevelopment = () => config.IS_DEVELOPMENT;
export const isProduction = () => config.IS_PRODUCTION;
export const isStaging = () => config.IS_STAGING;

// Environment switching (for testing purposes)
export const switchEnvironment = (env) => {
  if (environmentConfigs[env]) {
    return { ...config, ...environmentConfigs[env], ENVIRONMENT: env };
  }
  console.warn(`Unknown environment: ${env}, using development`);
  return config;
};
