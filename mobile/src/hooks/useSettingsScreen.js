import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';

const useSettingsScreen = ({ navigation }) => {
  const { theme, user, logout } = useApp();

  const [settings, setSettings] = useState({
    notifications: {
      push: true,
      email: true,
      sms: false,
      chama_updates: true,
      financial_alerts: true,
      sound_enabled: true,
      vibration_enabled: true,
      notification_sound_id: 1,
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
    },
    preferences: {
      language: 'en',
      currency: 'KES',
      date_format: 'dd/mm/yyyy',
    },
  });

  const [availableSounds, setAvailableSounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleSettingChange = useCallback((category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value,
      },
    }));
  }, []);

  const loadUserSettings = useCallback(async () => {
    try {
      setLoading(true);

      const [notificationResponse, privacyResponse, securityResponse, preferencesResponse] = await Promise.all([
        ApiService.getNotificationPreferences(),
        ApiService.getPrivacySettings(),
        ApiService.getSecuritySettings(),
        ApiService.getUserPreferences(),
      ]);

      if (notificationResponse.success) {
        const prefs = notificationResponse.data.preferences;
        setSettings(prev => ({
          ...prev,
          notifications: {
            ...prev.notifications,
            push: prefs.sound_enabled,
            email: prefs.system_notifications,
            sms: prefs.sms_notifications,
            chama_updates: prefs.chama_notifications,
            financial_alerts: prefs.transaction_notifications,
            sound_enabled: prefs.sound_enabled,
            vibration_enabled: prefs.vibration_enabled,
            notification_sound_id: prefs.notification_sound_id,
          }
        }));
        setAvailableSounds(notificationResponse.data.available_sounds || []);
      }

      if (privacyResponse.success) {
        setSettings(prev => ({
          ...prev,
          privacy: {
            ...prev.privacy,
            ...privacyResponse.data
          }
        }));
      }

      if (securityResponse.success) {
        setSettings(prev => ({
          ...prev,
          security: {
            ...prev.security,
            ...securityResponse.data
          }
        }));
      }

      if (preferencesResponse.success) {
        setSettings(prev => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            ...preferencesResponse.data
          }
        }));
      }

    } catch (error) {
      console.error('Failed to load user settings:', error);
      Alert.alert('Error', 'Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUserSettings();
    } catch (error) {
      console.warn('SettingsScreen refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadUserSettings]);

  const updateNotificationPreference = useCallback((key, value) => {
    handleSettingChange('notifications', key, value);
    ApiService.updateNotificationPreferences({ [key]: value }).catch((error) => {
      console.error('Failed to update notification preference:', error);
      Alert.alert('Error', 'Failed to update notification preference');
    });
  }, [handleSettingChange]);

  useEffect(() => {
    loadUserSettings();
  }, [loadUserSettings]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Type "DELETE" to confirm account deletion',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', style: 'destructive', onPress: confirmDeleteAccount },
              ]
            );
          }
        },
      ]
    );
  }, []);

  const confirmDeleteAccount = useCallback(async () => {
    try {
      const response = await ApiService.deleteAccount();
      if (response.success) {
        Alert.alert('Account Deleted', 'Your account has been permanently deleted');
        logout();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account');
    }
  }, [logout]);

  const updatePrivacySetting = useCallback((key, value) => {
    handleSettingChange('privacy', key, value);
    ApiService.updatePrivacySettings({ [key]: value }).catch((error) => {
      console.error('Failed to update privacy setting:', error);
      Alert.alert('Error', 'Failed to update privacy setting');
    });
  }, [handleSettingChange]);

  const updateSecuritySetting = useCallback((key, value) => {
    handleSettingChange('security', key, value);
    ApiService.updateSecuritySettings({ [key]: value }).catch((error) => {
      console.error('Failed to update security setting:', error);
      Alert.alert('Error', 'Failed to update security setting');
    });
  }, [handleSettingChange]);

  const updatePreference = useCallback((key, value) => {
    handleSettingChange('preferences', key, value);
    ApiService.updateUserPreferences({ [key]: value }).catch((error) => {
      console.error('Failed to update preference:', error);
      Alert.alert('Error', 'Failed to update preference');
    });
  }, [handleSettingChange]);

  const showProfileVisibilityOptions = useCallback(() => {
    const options = [
      { label: 'Everyone', value: 'everyone' },
      { label: 'Chama Members Only', value: 'chama_members' },
      { label: 'Private', value: 'private' }
    ];

    Alert.alert(
      'Profile Visibility',
      'Choose who can see your profile',
      [
        ...options.map(option => ({
          text: option.label,
          onPress: () => updatePrivacySetting('profile_visibility', option.value)
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [updatePrivacySetting]);

  const showLanguageOptions = useCallback(() => {
    const options = [
      { label: 'English', value: 'en' },
      { label: 'Kiswahili', value: 'sw' },
      { label: 'Kikuyu', value: 'ki' }
    ];

    Alert.alert(
      'Language',
      'Choose your preferred language',
      [
        ...options.map(option => ({
          text: option.label,
          onPress: () => updatePreference('language', option.value)
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [updatePreference]);

  const showCurrencyOptions = useCallback(() => {
    const options = [
      { label: 'KES (Kenyan Shilling)', value: 'KES' },
      { label: 'USD (US Dollar)', value: 'USD' },
      { label: 'EUR (Euro)', value: 'EUR' }
    ];

    Alert.alert(
      'Currency',
      'Choose your preferred currency',
      [
        ...options.map(option => ({
          text: option.label,
          onPress: () => updatePreference('currency', option.value)
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [updatePreference]);

  const showDateFormatOptions = useCallback(() => {
    const options = [
      { label: 'DD/MM/YYYY', value: 'dd/mm/yyyy' },
      { label: 'MM/DD/YYYY', value: 'mm/dd/yyyy' },
      { label: 'YYYY-MM-DD', value: 'yyyy-mm-dd' }
    ];

    Alert.alert(
      'Date Format',
      'Choose how dates are displayed',
      [
        ...options.map(option => ({
          text: option.label,
          onPress: () => updatePreference('date_format', option.value)
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [updatePreference]);

  return {
    settings,
    availableSounds,
    loading,
    refreshing,
    handleSettingChange,
    loadUserSettings,
    onRefresh,
    updateNotificationPreference,
    handleDeleteAccount,
    confirmDeleteAccount,
    updatePrivacySetting,
    updateSecuritySetting,
    updatePreference,
    showProfileVisibilityOptions,
    showLanguageOptions,
    showCurrencyOptions,
    showDateFormatOptions,
  };
};

export default useSettingsScreen;
