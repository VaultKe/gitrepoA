// Centralized Application Configuration
// All values are retrieved from environment variables via process.env.
// No hardcoded values — every setting is configurable externally.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Safely retrieve an environment variable, falling back to a default.
 * In production builds, __DEV__ is false so all values must come from .env.
 */
const env = (key, fallback = '') => {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }

  const expoExtra = (Constants && (Constants.expoConfig?.extra || Constants.manifest?.extra)) || {};
  if (expoExtra[key] !== undefined) {
    return expoExtra[key];
  }

  if (fallback !== '' && typeof fallback === 'string') {
    return fallback;
  }
  return fallback;
};

/**
 * Safely retrieve a numeric environment variable.
 */
const envNum = (key, fallback = 0) => {
  const val = env(key);
  if (val === '' || val === undefined || val === null) return fallback;
  const parsed = Number(val);
  return isNaN(parsed) ? fallback : parsed;
};

/**
 * Safely retrieve a boolean environment variable.
 * Accepts: 'true', '1', 'yes' → true; everything else → false (unless forced).
 */
const envBool = (key, fallback = false) => {
  const val = env(key);
  if (val === '' || val === undefined || val === null) return fallback;
  const lower = val.toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'yes';
};

const isLocalhostHost = (host) => {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
};

const isPrivateNetworkHost = (host) => {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
};

const resolveWebBackendUrl = (backendUrl) => {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return backendUrl;
  }

  try {
    const url = new URL(backendUrl);
    if (!isLocalhostHost(url.hostname)) {
      return backendUrl;
    }

    const pageHost = window.location.hostname;
    if (pageHost && isPrivateNetworkHost(pageHost)) {
      return `${url.protocol}//${pageHost}${url.port ? `:${url.port}` : ''}${url.pathname}`.replace(/\/+$|\?$/, '');
    }

    const networkIp = env('NETWORK_IP');
    if (networkIp && networkIp.trim() !== '') {
      return `${url.protocol}//${networkIp.trim()}${url.port ? `:${url.port}` : ''}${url.pathname}`.replace(/\/+$|\?$/, '');
    }
  } catch (error) {
    // Keep original backend URL if parsing fails.
  }

  return backendUrl;
};

/**
 * Resolve API base URL.
 * Priority: BACKEND_API_URL > REACT_APP_API_URL > NEXT_PUBLIC_API_URL > fallback
 */
const resolveApiBaseUrl = () => {
  const candidates = [
    env('BACKEND_API_URL'),
    env('REACT_APP_API_URL'),
    env('NEXT_PUBLIC_API_URL'),
    env('EXPO_PUBLIC_API_URL'),
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.trim() !== '') {
      const normalized = candidate.trim().replace(/\/+$/, '');
      if (Platform.OS === 'web') {
        return resolveWebBackendUrl(normalized);
      }
      return resolveNativeBackendUrl(normalized);
    }
  }

  // Final fallback from env (no hardcoded URL)
  const fallback = env('API_BASE_URL');
  if (fallback && fallback.trim() !== '') {
    if (Platform.OS === 'web') {
      return resolveWebBackendUrl(fallback.trim().replace(/\/+$/, ''));
    }
    return resolveNativeBackendUrl(fallback.trim().replace(/\/+$/, ''));
  }

  return '';
};

const resolveNativeBackendUrl = (backendUrl) => {
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    // If running in a webview or similar, use web resolution
    return resolveWebBackendUrl(backendUrl);
  }

  try {
    const url = new URL(backendUrl);
    if (!isLocalhostHost(url.hostname)) {
      return backendUrl;
    }

    // On native devices, localhost refers to the device itself.
    // Use NETWORK_IP env var to point to the development machine.
    const networkIp = env('NETWORK_IP');
    if (networkIp && networkIp.trim() !== '') {
      return `${url.protocol}//${networkIp.trim()}${url.port ? `:${url.port}` : ''}${url.pathname}`.replace(/\/+$|\?$/, '');
    }
  } catch (error) {
    // Keep original backend URL if parsing fails.
  }

  return backendUrl;
};

const resolvedApiBaseUrl = resolveApiBaseUrl();
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.debug('[ENV] resolved API_BASE_URL =', resolvedApiBaseUrl);
}

/**
 * Resolve WebSocket URL from API base URL.
 */
const resolveWebSocketUrl = (apiUrl) => {
  if (!apiUrl || apiUrl.trim() === '') return null;
  const protocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
  return apiUrl.replace(/^https?/, protocol);
};

/**
 * Determine the current environment.
 * Priority: NODE_ENV > REACT_NATIVE_ENV > Expo config > __DEV__ → development | production | staging
 */
const getEnvironment = () => {
  const nodeEnv = env('NODE_ENV');
  if (nodeEnv === 'development' || nodeEnv === 'staging' || nodeEnv === 'production') {
    return nodeEnv;
  }

  const reactNativeEnv = env('REACT_NATIVE_ENV');
  if (reactNativeEnv === 'development' || reactNativeEnv === 'staging' || reactNativeEnv === 'production') {
    return reactNativeEnv;
  }

  const expoEnv = env('EXPO_ENV');
  if (expoEnv === 'development' || expoEnv === 'staging' || expoEnv === 'production') {
    return expoEnv;
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'development';
  }

  return 'production';
};

/**
 * Build environment-specific configuration entirely from environment variables.
 */
const buildEnvironmentConfig = (envName) => {
  const prefix = envName === 'development' ? '' : envName.toUpperCase() + '_';

  return {
    // API configuration — all from env
    API_BASE_URL: resolvedApiBaseUrl,
    WS_BASE_URL: () => resolveWebSocketUrl(resolvedApiBaseUrl),

    // Timeouts and retries — all from env
    REQUEST_TIMEOUT: envNum(prefix + 'REQUEST_TIMEOUT', envNum('REQUEST_TIMEOUT', 30000)),
    RETRY_ATTEMPTS: envNum(prefix + 'RETRY_ATTEMPTS', envNum('RETRY_ATTEMPTS', 3)),

    // Feature flags — all from env
    ENABLE_LOGGING: envBool(prefix + 'ENABLE_LOGGING', envBool('ENABLE_LOGGING', envName !== 'production')),
    ENABLE_DEBUG: envBool(prefix + 'ENABLE_DEBUG', envBool('ENABLE_DEBUG', envName !== 'production')),
    ENABLE_DEV_TOOLS: envBool(prefix + 'ENABLE_DEV_TOOLS', envBool('ENABLE_DEV_TOOLS', envName === 'development')),
    MOCK_PAYMENTS: envBool(prefix + 'MOCK_PAYMENTS', envBool('MOCK_PAYMENTS', envName === 'staging')),
    SKIP_AUTH: envBool(prefix + 'SKIP_AUTH', envBool('SKIP_AUTH', false)),
    OPENWA_ENABLED: envBool(prefix + 'OPENWA_ENABLED', envBool('OPENWA_ENABLED', true)),
    OPENWA_API_URL: env(prefix + 'OPENWA_API_URL', env('OPENWA_API_URL', '')),
    OPENWA_API_KEY: env(prefix + 'OPENWA_API_KEY', env('OPENWA_API_KEY', '')),
    OPENWA_DEFAULT_SESSION_ID: env(prefix + 'OPENWA_DEFAULT_SESSION_ID', env('OPENWA_DEFAULT_SESSION_ID', '')),
  };
};

/**
 * Additional service URLs from environment.
 * Each key must have a corresponding SERVICE_<KEY>_URL env var.
 */
const resolveServiceUrls = () => {
  const services = [
    'CHAT',
    'MEETING',
    'NOTIFICATION',
    'PAYMENT',
    'FILE',
    'ANALYTICS',
    'MAP',
    'EMAIL',
    'SMS',
  ];

  const urls = {};
  for (const service of services) {
    const url = env(`SERVICE_${service}_URL`);
    if (url && url.trim() !== '') {
      urls[`${service.toLowerCase()}_url`] = url.trim().replace(/\/+$/, '');
    }
  }

  return urls;
};

/**
 * External service credentials from environment.
 * Every credential must be set via an env var — no hardcoded fallbacks.
 */
const resolveCredentials = () => {
  const creds = {};

  // Google OAuth
  const googleClientId = env('GOOGLE_CLIENT_ID') || env('BACKEND_PUBLIC_GOOGLE_CLIENT_ID');
  if (googleClientId && googleClientId.trim() !== '') {
    creds.GOOGLE_CLIENT_ID = googleClientId.trim();
  }

  // Firebase
  const firebaseProjectId = env('FIREBASE_PROJECT_ID');
  if (firebaseProjectId && firebaseProjectId.trim() !== '') {
    creds.FIREBASE_PROJECT_ID = firebaseProjectId.trim();
  }
  const firebaseApiKey = env('FIREBASE_API_KEY');
  if (firebaseApiKey && firebaseApiKey.trim() !== '') {
    creds.FIREBASE_API_KEY = firebaseApiKey.trim();
  }
  const firebaseAuthDomain = env('FIREBASE_AUTH_DOMAIN');
  if (firebaseAuthDomain && firebaseAuthDomain.trim() !== '') {
    creds.FIREBASE_AUTH_DOMAIN = firebaseAuthDomain.trim();
  }

  // M-Pesa
  const mpesaConsumerKey = env('MPESA_CONSUMER_KEY');
  if (mpesaConsumerKey && mpesaConsumerKey.trim() !== '') {
    creds.MPESA_CONSUMER_KEY = mpesaConsumerKey.trim();
  }
  const mpesaShortcode = env('MPESA_SHORTCODE');
  if (mpesaShortcode && mpesaShortcode.trim() !== '') {
    creds.MPESA_SHORTCODE = mpesaShortcode.trim();
  }

  // Add more credential mappings here as needed

  return creds;
};

/**
 * Build the final configuration object.
 * Every value is sourced from process.env — nothing is hardcoded.
 */
const buildConfig = () => {
  const currentEnv = getEnvironment();
  const baseConfig = buildEnvironmentConfig(currentEnv);
  const serviceUrls = resolveServiceUrls();
  const credentials = resolveCredentials();

  return {
    // Environment identification
    ENVIRONMENT: currentEnv,
    IS_DEVELOPMENT: currentEnv === 'development',
    IS_STAGING: currentEnv === 'staging',
    IS_PRODUCTION: currentEnv === 'production',

    // API configuration (all from env)
    ...baseConfig,

    // Service URLs (all from env)
    ...serviceUrls,

    // Credentials (all from env)
    ...credentials,

    // Platform info (from React Native Platform — not configurable via env)
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

// ── Named exports for convenient destructuring ──
export const {
  ENVIRONMENT,
  IS_DEVELOPMENT,
  IS_STAGING,
  IS_PRODUCTION,
  API_BASE_URL,
  WS_URL,
  REQUEST_TIMEOUT,
  RETRY_ATTEMPTS,
  ENABLE_LOGGING,
  ENABLE_DEBUG,
  ENABLE_DEV_TOOLS,
  MOCK_PAYMENTS,
  SKIP_AUTH,
  OPENWA_ENABLED,
  OPENWA_API_URL,
  OPENWA_API_KEY,
  OPENWA_DEFAULT_SESSION_ID,
  GOOGLE_CLIENT_ID,
  FIREBASE_PROJECT_ID,
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  MPESA_CONSUMER_KEY,
  MPESA_SHORTCODE,
  PLATFORM,
  IS_ANDROID,
  IS_IOS,
} = config;

// ── Helper functions ──
export const isDevelopment = () => config.IS_DEVELOPMENT;
export const isProduction = () => config.IS_PRODUCTION;
export const isStaging = () => config.IS_STAGING;

// ── Environment switching (for testing purposes only) ──
// Note: In production, this should only be used in development/test builds.
export const switchEnvironment = (newEnv) => {
  if (newEnv === 'development' || newEnv === 'staging' || newEnv === 'production') {
    const newBaseConfig = buildEnvironmentConfig(newEnv);
    return {
      ...config,
      ...newBaseConfig,
      ENVIRONMENT: newEnv,
      IS_DEVELOPMENT: newEnv === 'development',
      IS_STAGING: newEnv === 'staging',
      IS_PRODUCTION: newEnv === 'production',
    };
  }
  console.warn(`Unknown environment: ${newEnv}, using ${config.ENVIRONMENT}`);
  return config;
};
