/**
 * Mock Settings Service
 * Provides mock data and functionality for user settings until backend is ready
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

class MockSettingsService {
  constructor() {
    this.STORAGE_KEYS = {
      NOTIFICATION_PREFERENCES: 'notification_preferences',
      PRIVACY_SETTINGS: 'privacy_settings',
      SECURITY_SETTINGS: 'security_settings',
      USER_PREFERENCES: 'user_preferences',
    };

    // Default settings
    this.defaultSettings = {
      notifications: {
        sound_enabled: true,
        system_notifications: true,
        sms_notifications: false,
        chama_notifications: true,
        transaction_notifications: true,
        marketing_notifications: false,
        vibration_enabled: true,
        notification_sound_id: 1,
        volume_level: 80,
      },
      privacy: {
        profile_visibility: 'chama_members',
        transaction_privacy: true,
        location_sharing: false,
      },
      security: {
        biometric_login: false,
        two_factor_auth: false,
        auto_logout: true,
        login_notifications: true,
        suspicious_activity_alerts: true,
        device_management: true,
      },
      preferences: {
        language: 'en',
        currency: 'KES',
        date_format: 'dd/mm/yyyy',
      }
    };

    this.availableSounds = [
      {
        id: 1,
        name: 'Default Ring',
        file_path: 'default_ring.mp3',
        duration_seconds: 2.5,
        is_default: true
      },
      {
        id: 2,
        name: 'Chime',
        file_path: 'chime.mp3',
        duration_seconds: 1.8,
        is_default: false
      },
      {
        id: 3,
        name: 'Bell',
        file_path: 'bell.mp3',
        duration_seconds: 2.2,
        is_default: false
      },
      {
        id: 4,
        name: 'Ding',
        file_path: 'ding.mp3',
        duration_seconds: 1.5,
        is_default: false
      }
    ];
  }

  // Notification preferences
  async getNotificationPreferences() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.NOTIFICATION_PREFERENCES);
      const preferences = stored ? JSON.parse(stored) : this.defaultSettings.notifications;

      return {
        success: true,
        data: {
          preferences,
          available_sounds: this.availableSounds
        }
      };
    } catch (error) {
      console.error('Mock: Failed to get notification preferences:', error);
      return {
        success: false,
        error: 'Failed to load notification preferences'
      };
    }
  }

  async updateNotificationPreferences(preferences) {
    try {
      const current = await this.getNotificationPreferences();
      const updated = { ...current.data.preferences, ...preferences };
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.NOTIFICATION_PREFERENCES, 
        JSON.stringify(updated)
      );

      return {
        success: true,
        message: 'Notification preferences updated successfully'
      };
    } catch (error) {
      console.error('Mock: Failed to update notification preferences:', error);
      return {
        success: false,
        error: 'Failed to update notification preferences'
      };
    }
  }

  // Privacy settings
  async getPrivacySettings() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.PRIVACY_SETTINGS);
      const settings = stored ? JSON.parse(stored) : this.defaultSettings.privacy;

      return {
        success: true,
        data: settings
      };
    } catch (error) {
      console.error('Mock: Failed to get privacy settings:', error);
      return {
        success: false,
        error: 'Failed to load privacy settings'
      };
    }
  }

  async updatePrivacySettings(settings) {
    try {
      const current = await this.getPrivacySettings();
      const updated = { ...current.data, ...settings };
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PRIVACY_SETTINGS, 
        JSON.stringify(updated)
      );

      return {
        success: true,
        message: 'Privacy settings updated successfully'
      };
    } catch (error) {
      console.error('Mock: Failed to update privacy settings:', error);
      return {
        success: false,
        error: 'Failed to update privacy settings'
      };
    }
  }

  // Security settings
  async getSecuritySettings() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.SECURITY_SETTINGS);
      const settings = stored ? JSON.parse(stored) : this.defaultSettings.security;

      return {
        success: true,
        data: settings
      };
    } catch (error) {
      console.error('Mock: Failed to get security settings:', error);
      return {
        success: false,
        error: 'Failed to load security settings'
      };
    }
  }

  async updateSecuritySettings(settings) {
    try {
      const current = await this.getSecuritySettings();
      const updated = { ...current.data, ...settings };
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.SECURITY_SETTINGS, 
        JSON.stringify(updated)
      );

      return {
        success: true,
        message: 'Security settings updated successfully'
      };
    } catch (error) {
      console.error('Mock: Failed to update security settings:', error);
      return {
        success: false,
        error: 'Failed to update security settings'
      };
    }
  }

  // User preferences
  async getUserPreferences() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_PREFERENCES);
      const preferences = stored ? JSON.parse(stored) : this.defaultSettings.preferences;

      return {
        success: true,
        data: preferences
      };
    } catch (error) {
      console.error('Mock: Failed to get user preferences:', error);
      return {
        success: false,
        error: 'Failed to load user preferences'
      };
    }
  }

  async updateUserPreferences(preferences) {
    try {
      const current = await this.getUserPreferences();
      const updated = { ...current.data, ...preferences };
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.USER_PREFERENCES, 
        JSON.stringify(updated)
      );

      return {
        success: true,
        message: 'User preferences updated successfully'
      };
    } catch (error) {
      console.error('Mock: Failed to update user preferences:', error);
      return {
        success: false,
        error: 'Failed to update user preferences'
      };
    }
  }

  // Account management
  async deleteAccount() {
    try {
      // Clear all stored settings
      await AsyncStorage.multiRemove([
        this.STORAGE_KEYS.NOTIFICATION_PREFERENCES,
        this.STORAGE_KEYS.PRIVACY_SETTINGS,
        this.STORAGE_KEYS.SECURITY_SETTINGS,
        this.STORAGE_KEYS.USER_PREFERENCES,
      ]);

      return {
        success: true,
        message: 'Account deleted successfully'
      };
    } catch (error) {
      console.error('Mock: Failed to delete account:', error);
      return {
        success: false,
        error: 'Failed to delete account'
      };
    }
  }

  async exportUserData() {
    try {
      const notifications = await this.getNotificationPreferences();
      const privacy = await this.getPrivacySettings();
      const security = await this.getSecuritySettings();
      const preferences = await this.getUserPreferences();

      const exportData = {
        notifications: notifications.data,
        privacy: privacy.data,
        security: security.data,
        preferences: preferences.data,
        exported_at: new Date().toISOString()
      };

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      console.error('Mock: Failed to export user data:', error);
      return {
        success: false,
        error: 'Failed to export user data'
      };
    }
  }
}

export default new MockSettingsService();
