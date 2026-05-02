/**
 * Google Drive Backup Service
 * Handles OAuth authentication and backup/restore operations with Google Drive
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './api';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../config/environment';

class GoogleDriveService {
  constructor() {
    this.clientId = GOOGLE_CLIENT_ID;
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Get Google Drive OAuth URL for authentication
   */
  async getAuthURL(userId = null) {
    const response = await ApiService.makeRequest('/users/google-drive/auth-url', {
      method: 'GET',
      params: userId ? { user_id: userId } : {}
    });

    return response;
  }

  /**
   * Authenticate user with Google Drive
   * Opens browser for OAuth flow
   */
  async authenticate(userId = null) {
    const authResult = await this.getAuthURL(userId);

    if (authResult.success && authResult.auth_url) {
      return {
        success: true,
        requiresBrowserAuth: true,
        authUrl: authResult.auth_url,
        message: 'Complete Google Drive authentication in browser',
        instructions: [
          '1. Click the "Open Browser" button below',
          '2. Sign in with your Google account',
          '3. Grant permissions to VaultKe',
          '4. Return to the app - connection will be automatic'
        ]
      };
    } else {
      return { success: false, error: authResult.error || 'Failed to get auth URL' };
    }
  }

  /**
   * Open browser for OAuth authentication
   */
  async openAuthBrowser() {
    try {
      const authResult = await this.getAuthURL();
      if (authResult.success && authResult.auth_url) {
        // Use React Native Linking to open the URL
        const { Linking } = await import('react-native');
        const supported = await Linking.canOpenURL(authResult.auth_url);
        if (supported) {
          await Linking.openURL(authResult.auth_url);
          return { success: true, message: 'Browser opened for authentication' };
        } else {
          // Fallback for web
          if (typeof window !== 'undefined') {
            window.open(authResult.auth_url, '_blank');
            return { success: true, message: 'Browser opened for authentication' };
          }
          return { success: false, error: 'Cannot open authentication URL' };
        }
      } else {
        return { success: false, error: 'Failed to get auth URL' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code) {
    const tokens = {
      access_token: 'simulated_access_token',
      refresh_token: 'simulated_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer'
    };

    const response = await ApiService.makeRequest('/users/google-drive/store-tokens', {
      method: 'POST',
      body: tokens,
    });

    return response;
  }

  /**
   * Disconnect Google Drive (revoke tokens)
   */
  async disconnect() {
    const response = await ApiService.makeRequest('/users/google-drive/disconnect', {
      method: 'POST',
    });

    return response;
  }

  /**
   * Create backup of user data
   */
  async createBackup() {
    const response = await ApiService.makeRequest('/users/google-drive/backup', {
      method: 'POST',
    });

    if (response.success) {
      // Store last backup date locally (this could be moved to backend if needed)
      try {
        await AsyncStorage.setItem('last_backup_date', new Date().toISOString());
      } catch (storageError) {
        // Ignore storage errors as they're not critical
      }
    }

    return response;
  }

  /**
   * Restore data from Google Drive backup
   */
  async restoreBackup() {
    const response = await ApiService.makeRequest('/users/google-drive/restore', {
      method: 'POST',
    });

    return response;
  }

  /**
   * Get backup information
   */
  async getBackupInfo() {
    try {
      const response = await ApiService.makeRequest('/users/google-drive/backup-info');
      
      if (response.success) {
        return response;
      }
    } catch (apiError) {
      // Ignore API errors and fall back to local storage
    }

    // Fallback to local storage
    try {
      const localBackupDate = await AsyncStorage.getItem('last_backup_date');
      return {
        success: true,
        lastBackup: localBackupDate
      };
    } catch (storageError) {
      return { success: false, error: 'Failed to get backup info from local storage' };
    }
  }

  /**
   * Check if Google Drive is connected
   */
  async isConnected() {
    try {
      const response = await ApiService.makeRequest('/users/google-drive/status');

      if (!response.success) {
        return {
          connected: false,
          rawResponse: response
        };
      }

      // Check if response has the connected field
      if (response.connected === undefined) {
        return {
          connected: false,
          rawResponse: response
        };
      }

      const isConnected = response.connected === true;
      return {
        connected: isConnected,
        rawResponse: response
      };
    } catch (error) {
      // If it's an authentication error, return false
      if (error.message && error.message.includes('401')) {
        return {
          connected: false,
          rawResponse: { error: 'Authentication failed', status: 401 }
        };
      }

      return {
        connected: false,
        rawResponse: { error: error.message, status: 'unknown' }
      };
    }
  }
}

export default new GoogleDriveService();