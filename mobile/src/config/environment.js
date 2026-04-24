// Environment Configuration for VaultKe Mobile App
// This file handles switching between development and production environments

import { Platform } from 'react-native';
import { TUNNEL_CONFIG } from '../../tunnel-config.js';

// Environment detection
const getEnvironment = () => {
  // Check for explicit environment variable
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  
  // Check for React Native environment
  if (__DEV__) {
    return 'development';
  }
  
  return 'production';
};

// Configuration for different environments
const environments = {
  development: {
    // Development API URLs
    API_BASE_URL: (() => {
      // Priority 1: Environment variable override
      if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
      }
      
      // Priority 2: Check current hostname for web
      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return 'http://localhost:8080/api/v1';
        }
      }
      
      // Priority 3: Use tunnel URL from config
      if (TUNNEL_CONFIG.BACKEND_TUNNEL_URL) {
        return `${TUNNEL_CONFIG.BACKEND_TUNNEL_URL}/api/v1`;
      }
      
      // Priority 4: Fallback to localhost
      return 'http://localhost:8080/api/v1';
    })(),
    
    // Development settings
    REQUEST_TIMEOUT: 30000, // 30 seconds for development
    RETRY_ATTEMPTS: 3,
    ENABLE_LOGGING: true,
    ENABLE_DEBUG: true,
    
    // Development features
    ENABLE_DEV_TOOLS: true,
    MOCK_PAYMENTS: false,
    SKIP_AUTH: false,
  },
  
  production: {
    // Production API URL
    API_BASE_URL: process.env.REACT_APP_PRODUCTION_API_URL || 'https://api.vaultke.com/api/v1',
    
    // Production settings
    REQUEST_TIMEOUT: 10000, // 10 seconds for production
    RETRY_ATTEMPTS: 2,
    ENABLE_LOGGING: false,
    ENABLE_DEBUG: false,
    
    // Production features
    ENABLE_DEV_TOOLS: false,
    MOCK_PAYMENTS: false,
    SKIP_AUTH: false,
  },
  
  staging: {
    // Staging API URL
    API_BASE_URL: process.env.REACT_APP_STAGING_API_URL || 'https://staging-api.vaultke.com/api/v1',
    
    // Staging settings
    REQUEST_TIMEOUT: 15000, // 15 seconds for staging
    RETRY_ATTEMPTS: 3,
    ENABLE_LOGGING: true,
    ENABLE_DEBUG: true,
    
    // Staging features
    ENABLE_DEV_TOOLS: true,
    MOCK_PAYMENTS: true,
    SKIP_AUTH: false,
  }
};

// Get current environment
const currentEnvironment = getEnvironment();

// Get configuration for current environment
const config = environments[currentEnvironment] || environments.development;

// Add environment info to config
config.ENVIRONMENT = currentEnvironment;
config.IS_DEVELOPMENT = currentEnvironment === 'development';
config.IS_PRODUCTION = currentEnvironment === 'production';
config.IS_STAGING = currentEnvironment === 'staging';

// Platform-specific adjustments
if (Platform.OS === 'android') {
  // Android-specific configurations
  if (config.API_BASE_URL.includes('localhost')) {
    // Replace localhost with 10.0.2.2 for Android emulator
    config.API_BASE_URL = config.API_BASE_URL.replace('localhost', '10.0.2.2');
  }
}

// Log configuration in development
if (config.ENABLE_LOGGING) {
}

export default config;

// Named exports for convenience
export const {
  API_BASE_URL,
  REQUEST_TIMEOUT,
  RETRY_ATTEMPTS,
  ENABLE_LOGGING,
  ENABLE_DEBUG,
  ENVIRONMENT,
  IS_DEVELOPMENT,
  IS_PRODUCTION,
  IS_STAGING
} = config;

// Helper functions
export const isDevelopment = () => config.IS_DEVELOPMENT;
export const isProduction = () => config.IS_PRODUCTION;
export const isStaging = () => config.IS_STAGING;

// Environment switching helper
export const switchEnvironment = (env) => {
  if (environments[env]) {
    return environments[env];
  }
  console.warn(`⚠️ Unknown environment: ${env}, using development`);
  return environments.development;
};
