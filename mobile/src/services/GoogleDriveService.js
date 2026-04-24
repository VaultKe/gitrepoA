/**
 * Google Drive Backup Service
 * Handles OAuth authentication and backup/restore operations with Google Drive
 */

// Note: expo-auth-session might need to be installed first
// Run: npx expo install expo-auth-session expo-web-browser
// import * as AuthSession from 'expo-auth-session';
// import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import ApiService from './api';

// Complete the auth session (commented out until expo-auth-session is properly installed)
// WebBrowser.maybeCompleteAuthSession();

class GoogleDriveService {
  constructor() {
    this.clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '700521271518-apj801tf38k25daiisnqt70f8m7j2o43.apps.googleusercontent.com';
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://https://dqtl6f-ip-41-139-130-223.tunnelmole.net';
  }

  /**
   * Get Google Drive OAuth URL for authentication
   */
  async getAuthURL(userId = null) {
    try {
      // Get current user ID if not provided
      if (!userId) {
        // Try to get from AsyncStorage or context
        try {
          const userData = await AsyncStorage.getItem('userData');
          if (userData) {
            const user = JSON.parse(userData);
            userId = user.id;
          }
        } catch (storageError) {
          console.warn('Could not get user ID from storage:', storageError);
        }
      }

      const response = await ApiService.makeRequest('/users/google-drive/auth-url', {
        method: 'GET',
        // Pass user ID as query parameter to be included in OAuth state
        params: userId ? { user_id: userId } : {}
      });

      // If we have a user ID, modify the auth URL to include it in the state parameter
      if (response.success && response.auth_url && userId) {
        const url = new URL(response.auth_url);
        url.searchParams.set('state', userId);
        response.auth_url = url.toString();
        console.log('🔗 Modified auth URL with user ID in state:', userId);
      }

      return response;
    } catch (error) {
      console.error('Failed to get Google Drive auth URL:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Authenticate user with Google Drive
   * Opens browser for OAuth flow
   */
  async authenticate(userId = null) {
    try {
      console.log('🔐 Starting Google Drive authentication...', userId ? `for user: ${userId}` : '');

      // Get auth URL from backend (authenticated endpoint) with user ID
      const authResult = await this.getAuthURL(userId);

      if (authResult.success && authResult.auth_url) {
        console.log('🔗 Auth URL:', authResult.auth_url);

        // In a real mobile app, this would open WebBrowser
        // For now, provide the URL for manual completion
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

    } catch (error) {
      console.error('Google Drive authentication error:', error);
      return { success: false, error: error.message };
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
      console.error('Failed to open auth browser:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code) {
    try {
      // This would normally exchange the code for tokens
      // For now, we'll simulate storing tokens
      const tokens = {
        access_token: 'simulated_access_token',
        refresh_token: 'simulated_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      // Store tokens on backend
      const response = await ApiService.makeRequest('/users/google-drive/store-tokens', {
        method: 'POST',
        body: tokens,
      });

      return response;
    } catch (error) {
      console.error('Token exchange error:', error);
      return { success: false, error: error.message };
    }
  }

  // OAuth token exchange methods removed for now
  // Will be implemented once expo-auth-session is properly configured

  /**
   * Disconnect Google Drive (revoke tokens)
   */
  async disconnect() {
    try {
      const response = await ApiService.makeRequest('/users/google-drive/disconnect', {
        method: 'POST',
      });

      return response;
    } catch (error) {
      console.error('Failed to disconnect Google Drive:', error);
      throw error;
    }
  }

  /**
   * Create backup of user data
   */
  async createBackup() {
    try {
      console.log('📦 Creating Google Drive backup...');

      const response = await ApiService.makeRequest('/users/google-drive/backup', {
        method: 'POST',
      });

      if (response.success) {
        console.log('✅ Backup created successfully');
        
        // Store last backup date locally
        await AsyncStorage.setItem('last_backup_date', new Date().toISOString());
      }

      return response;
    } catch (error) {
      console.error('Backup creation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore data from Google Drive backup
   */
  async restoreBackup() {
    try {
      console.log('📥 Restoring from Google Drive backup...');

      const response = await ApiService.makeRequest('/users/google-drive/restore', {
        method: 'POST',
      });

      if (response.success) {
        console.log('✅ Restore completed successfully');
      }

      return response;
    } catch (error) {
      console.error('Restore error:', error);
      return { success: false, error: error.message };
    }
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

      // Fallback to local storage
      const localBackupDate = await AsyncStorage.getItem('last_backup_date');
      return {
        success: true,
        lastBackup: localBackupDate
      };
    } catch (error) {
      console.error('Failed to get backup info:', error);
      
      // Fallback to local storage
      try {
        const localBackupDate = await AsyncStorage.getItem('last_backup_date');
        return {
          success: true,
          lastBackup: localBackupDate
        };
      } catch (localError) {
        return { success: false, error: error.message };
      }
    }
  }

  /**
   * Check if Google Drive is connected
   */
  async isConnected() {
    try {
      console.log('🔍 Checking Google Drive connection status...');

      // Make sure we have authentication token
      const response = await ApiService.makeRequest('/users/google-drive/status');
      console.log('🔗 Google Drive status response:', JSON.stringify(response, null, 2));

      if (!response.success) {
        console.log('❌ Status check failed - response not successful');
        console.log('❌ Response error:', response.error);
        return {
          connected: false,
          rawResponse: response
        };
      }

      // Check if response has the connected field
      if (response.connected === undefined) {
        console.log('❌ Status check failed - no connected field in response');
        console.log('❌ Response data:', response.data);
        return {
          connected: false,
          rawResponse: response
        };
      }

      const isConnected = response.connected === true;
      console.log('🔗 Google Drive connection status:', isConnected ? 'CONNECTED' : 'NOT CONNECTED');

      return {
        connected: isConnected,
        rawResponse: response
      };
    } catch (error) {
      console.error('❌ Failed to check Google Drive status:', error);
      console.error('❌ Status check error details:', error.message);
      console.error('❌ Full error object:', error);

      // If it's an authentication error, return false
      if (error.message && error.message.includes('401')) {
        console.log('🔐 Authentication error - user not logged in');
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
