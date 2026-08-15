import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ApiService from '../../../services/api';
import GoogleDriveService from '../../../services/GoogleDriveService';
import Toast from 'react-native-toast-message';

const SettingsScreen = ({ navigation }) => {
  const { theme, setTheme, user, userRole, logout } = useApp();
  const colors = getThemeColors(theme);

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

  // Google Drive backup state
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState(null);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [authUrl, setAuthUrl] = useState(null);
  const [showAuthLink, setShowAuthLink] = useState(false);
  const [connectionCheckAttempts, setConnectionCheckAttempts] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [lastApiResponse, setLastApiResponse] = useState(null);

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value,
      },
    }));
  };

  const handleSaveSettings = async () => {
    try {
      const response = await ApiService.updateUserSettings(settings);
      if (response.success) {
        Alert.alert('Success', 'Settings updated successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  // Load all user settings
  const loadUserSettings = async () => {
    try {
      setLoading(true);

      // Load notification preferences
      const notificationResponse = await ApiService.getNotificationPreferences();
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
            volume_level: prefs.volume_level,
          }
        }));

        setAvailableSounds(notificationResponse.data.available_sounds || []);
      }

      // Load privacy settings
      const privacyResponse = await ApiService.getPrivacySettings();
      if (privacyResponse.success) {
        setSettings(prev => ({
          ...prev,
          privacy: {
            ...prev.privacy,
            ...privacyResponse.data
          }
        }));
      }

      // Load security settings
      const securityResponse = await ApiService.getSecuritySettings();
      if (securityResponse.success) {
        setSettings(prev => ({
          ...prev,
          security: {
            ...prev.security,
            ...securityResponse.data
          }
        }));
      }

      // Load user preferences
      const preferencesResponse = await ApiService.getUserPreferences();
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
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadUserSettings(),
        checkGoogleDriveConnection(),
      ]);
    } catch (error) {
      console.warn('SettingsScreen refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Update notification preferences
  const updateNotificationPreference = async (key, value) => {
    try {
      const updateData = { [key]: value };
      const response = await ApiService.updateNotificationPreferences(updateData);

      if (response.success) {
        handleSettingChange('notifications', key, value);
      } else {
        Alert.alert('Error', 'Failed to update notification preference');
      }
    } catch (error) {
      console.error('Failed to update notification preference:', error);
      Alert.alert('Error', 'Failed to update notification preference');
    }
  };



  // Load data on component mount
  useEffect(() => {
    loadUserSettings();
    checkGoogleDriveConnection();
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      setTimeout(() => {
        checkGoogleDriveConnection();
      }, 1000);
    }, [])
  );

  const checkGoogleDriveConnection = async (forceRefresh = false) => {
    try {

      if (forceRefresh) {
        setGoogleDriveConnected(false);
        setShowAuthLink(false);
        setAuthUrl(null);
        setConnectionCheckAttempts(0);
      }

      const result = await GoogleDriveService.isConnected();
      const connected = result.connected !== undefined ? result.connected : false;
      const rawResponse = result.rawResponse || result;

      // Store debug information
      setDebugInfo({
        timestamp: new Date().toISOString(),
        connected,
        attempts: connectionCheckAttempts + 1,
        userId: user?.id,
        userRole: userRole,
        rawResponse: JSON.stringify(rawResponse, null, 2)
      });

      setLastApiResponse(rawResponse);

      setGoogleDriveConnected(connected);
      setConnectionCheckAttempts(prev => prev + 1);

      if (connected) {
        // Hide auth link if connection is successful
        setShowAuthLink(false);
        setAuthUrl(null);
        await checkLastBackup();

        // Show success message if this was a forced refresh (user manually checked)
        if (forceRefresh) {
          Alert.alert('Success', 'Google Drive connection detected! You are now connected.');
        }
      } else {

       // If we've tried multiple times and still not connected, offer manual override
        if (connectionCheckAttempts >= 3 && !forceRefresh) {
          Alert.alert(
            'Connection Check Issue',
            'Having trouble detecting your Google Drive connection. Would you like to manually verify the connection?',
            [
              { text: 'Try Again', onPress: () => checkGoogleDriveConnection(true) },
              { text: 'Manual Override', onPress: () => setGoogleDriveConnected(true) },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }
      }
    } catch (error) {
      console.error('❌ Failed to check Google Drive connection:', error);
      setGoogleDriveConnected(false);

      // If error persists after multiple attempts, offer manual override
      if (connectionCheckAttempts >= 2) {
        Alert.alert(
          'Connection Error',
          'Unable to verify Google Drive connection. Would you like to manually set the connection status?',
          [
            { text: 'Try Again', onPress: () => checkGoogleDriveConnection(true) },
            { text: 'Manual Override', onPress: () => setGoogleDriveConnected(true) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    }
  };



  const handleDeleteAccount = () => {
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
  };

  const confirmDeleteAccount = async () => {
    try {
      const response = await ApiService.deleteAccount();
      if (response.success) {
        Alert.alert('Account Deleted', 'Your account has been permanently deleted');
        logout();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account');
    }
  };

  // Privacy settings helpers
  const updatePrivacySetting = async (key, value) => {
    try {
      const updateData = { [key]: value };
      const response = await ApiService.updatePrivacySettings(updateData);

      if (response.success) {
        handleSettingChange('privacy', key, value);
      } else {
        Alert.alert('Error', 'Failed to update privacy setting');
      }
    } catch (error) {
      console.error('Failed to update privacy setting:', error);
      Alert.alert('Error', 'Failed to update privacy setting');
    }
  };

  // Security settings helpers
  const updateSecuritySetting = async (key, value) => {
    try {
      const updateData = { [key]: value };
      const response = await ApiService.updateSecuritySettings(updateData);

      if (response.success) {
        handleSettingChange('security', key, value);
      } else {
        Alert.alert('Error', 'Failed to update security setting');
      }
    } catch (error) {
      console.error('Failed to update security setting:', error);
      Alert.alert('Error', 'Failed to update security setting');
    }
  };

  // Preferences helpers
  const updatePreference = async (key, value) => {
    try {
      const updateData = { [key]: value };
      const response = await ApiService.updateUserPreferences(updateData);

      if (response.success) {
        handleSettingChange('preferences', key, value);
      } else {
        Alert.alert('Error', 'Failed to update preference');
      }
    } catch (error) {
      console.error('Failed to update preference:', error);
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  // Option selection functions
  const showProfileVisibilityOptions = () => {
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
  };

  const showLanguageOptions = () => {
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
  };

  const showCurrencyOptions = () => {
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
  };

  const showDateFormatOptions = () => {
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
  };

  const showVolumeOptions = () => {
    const options = [
      { label: 'Low (25%)', value: 25 },
      { label: 'Medium (50%)', value: 50 },
      { label: 'High (75%)', value: 75 },
      { label: 'Maximum (100%)', value: 100 }
    ];

    Alert.alert(
      'Volume Level',
      'Choose notification volume level',
      [
        ...options.map(option => ({
          text: option.label,
          onPress: () => updateNotificationPreference('volume_level', option.value)
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Google Drive backup functions
  const connectGoogleDrive = async () => {
    try {
      setLoading(true);

      // Start OAuth flow with user ID
      const authResult = await GoogleDriveService.authenticate(user?.id);

      if (authResult.success && authResult.requiresBrowserAuth) {
        // Store the auth URL and show the authentication link
        setAuthUrl(authResult.authUrl);
        setShowAuthLink(true);

        Alert.alert(
          'Connect Google Drive',
          'To complete the connection, you need to authenticate with Google Drive. Click the "Authenticate with Google" button below to continue.',
          [
            { text: 'OK', style: 'default' }
          ]
        );
      } else if (authResult.success) {
        setGoogleDriveConnected(true);
        Alert.alert('Success', 'Google Drive connected successfully!');
        await checkLastBackup();
      } else {
        Alert.alert('Error', authResult.error || 'Failed to connect to Google Drive');
      }
    } catch (error) {
      console.error('Google Drive connection error:', error);
      Alert.alert('Error', 'Failed to connect to Google Drive');
    } finally {
      setLoading(false);
    }
  };

  // Handle opening the authentication URL
  const handleAuthenticateWithGoogle = async () => {
    try {
      if (authUrl) {
        // Open the authentication URL in the browser
        const supported = await Linking.canOpenURL(authUrl);
        if (supported) {
          await Linking.openURL(authUrl);

          // Show instructions to user with multiple check options
          Alert.alert(
            'Authentication Started',
            'Complete the authentication in your browser, then return to the app.\n\nThe connection status will be automatically checked, but you can also manually refresh it.',
            [
              {
                text: 'Check Now',
                onPress: () => {
                  // Immediate check
                  checkGoogleDriveConnection(true);
                }
              },
              {
                text: 'Auto Check',
                onPress: () => {
                  // Delayed check to give user time to complete auth
                  setTimeout(() => {
                    checkGoogleDriveConnection(true);
                  }, 3000);
                }
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert('Error', 'Cannot open authentication URL');
        }
      }
    } catch (error) {
      console.error('Failed to open authentication URL:', error);
      Alert.alert('Error', 'Failed to open authentication URL');
    }
  };

  const disconnectGoogleDrive = async () => {
    Alert.alert(
      'Disconnect Google Drive',
      'Are you sure you want to disconnect Google Drive? This will stop automatic backups.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await GoogleDriveService.disconnect();
              setGoogleDriveConnected(false);
              setLastBackupDate(null);
              setAuthUrl(null);
              setShowAuthLink(false);
              Alert.alert('Success', 'Google Drive disconnected');
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect Google Drive');
            }
          }
        }
      ]
    );
  };

  const performBackup = async () => {
    try {
      setBackupInProgress(true);

      const result = await GoogleDriveService.createBackup();

      if (result.success) {
        setLastBackupDate(new Date().toISOString());
        Alert.alert('Success', 'Backup completed successfully!');
      } else {
        Alert.alert('Error', result.error || 'Backup failed');
      }
    } catch (error) {
      console.error('Backup error:', error);
      Alert.alert('Error', 'Failed to create backup');
    } finally {
      setBackupInProgress(false);
    }
  };

  const performRestore = async () => {
    Alert.alert(
      'Restore from Backup',
      'This will replace your current data with the backup from Google Drive. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              setRestoreInProgress(true);

              const result = await GoogleDriveService.restoreBackup();

              if (result.success) {
                Alert.alert('Success', 'Data restored successfully! Please restart the app.');
              } else {
                Alert.alert('Error', result.error || 'Restore failed');
              }
            } catch (error) {
              console.error('Restore error:', error);
              Alert.alert('Error', 'Failed to restore backup');
            } finally {
              setRestoreInProgress(false);
            }
          }
        }
      ]
    );
  };

  const checkLastBackup = async () => {
    try {
      const backupInfo = await GoogleDriveService.getBackupInfo();
      if (backupInfo.success && backupInfo.lastBackup) {
        setLastBackupDate(backupInfo.lastBackup);
      }
    } catch (error) {
      console.error('Failed to check last backup:', error);
    }
  };



  const renderSettingItem = (title, description, value, onValueChange, type = 'switch') => (
    <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>
          {title}
        </Text>
        {description && (
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>

      {type === 'switch' ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      ) : (
        <TouchableOpacity onPress={onValueChange}>
          <View style={styles.settingValue}>
            <Text style={[styles.settingValueText, { color: colors.textSecondary }]}>
              {value}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderMenuSection = (title, items) => (
    <Card variant="outlined" style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {title}
      </Text>

      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.menuItem,
            { borderBottomColor: colors.border },
            index === items.length - 1 && styles.lastMenuItem
          ]}
          onPress={item.onPress}
          activeOpacity={0.7}
          delayPressIn={0}
        >
          <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
            <Ionicons name={item.icon} size={20} color={item.color} />
          </View>

          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            {item.subtitle && (
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                {item.subtitle}
              </Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </Card>
  );

  const renderNotificationSettings = () => {
    const selectedSound = availableSounds.find(s => s.id === settings.notifications.notification_sound_id);

    return (
      <Card variant="outlined" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Notifications
        </Text>

        {renderSettingItem(
          'Push Notifications',
          'Receive notifications on your device',
          settings.notifications.push,
          (value) => updateNotificationPreference('sound_enabled', value)
        )}

        {renderSettingItem(
          'Email Notifications',
          'Receive notifications via email',
          settings.notifications.email,
          (value) => updateNotificationPreference('system_notifications', value)
        )}

        {renderSettingItem(
          'Chama Updates',
          'Notifications about chama activities',
          settings.notifications.chama_updates,
          (value) => updateNotificationPreference('chama_notifications', value)
        )}

        {renderSettingItem(
          'Financial Alerts',
          'Notifications about transactions and balances',
          settings.notifications.financial_alerts,
          (value) => updateNotificationPreference('transaction_notifications', value)
        )}

        {renderSettingItem(
          'SMS Notifications',
          'Receive notifications via SMS',
          settings.notifications.sms,
          (value) => updateNotificationPreference('sms_notifications', value)
        )}

        {/* Sound and Vibration Settings */}
        {settings.notifications.push && (
          <>
            {renderSettingItem(
              'Sound Enabled',
              'Play sound for notifications',
              settings.notifications.sound_enabled,
              (value) => updateNotificationPreference('sound_enabled', value)
            )}

            {renderSettingItem(
              'Vibration Enabled',
              'Vibrate for notifications',
              settings.notifications.vibration_enabled,
              (value) => updateNotificationPreference('vibration_enabled', value)
            )}

            {/* Volume Level Setting */}
            {settings.notifications.sound_enabled && (
              <TouchableOpacity
                style={[styles.settingRow, { borderBottomColor: colors.border }]}
                onPress={() => showVolumeOptions()}
                activeOpacity={0.7}
              >
                <View style={styles.settingContent}>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>
                      Volume Level
                    </Text>
                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                      {settings.notifications.volume_level}%
                    </Text>
                  </View>
                  <View style={styles.settingAction}>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Notification Tone Selection */}
            {settings.notifications.sound_enabled && (
              <TouchableOpacity
                style={[styles.settingRow, { borderBottomColor: colors.border }]}
                onPress={() => navigation.navigate('NotificationTone')}
                activeOpacity={0.7}
              >
                <View style={styles.settingContent}>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>
                      Notification Tone
                    </Text>
                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                      {selectedSound?.name || 'Default Ring'}
                    </Text>
                  </View>
                  <View style={styles.settingAction}>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </>
        )}


      </Card>
    );
  };

  const renderPrivacySettings = () => (
    <Card variant="outlined" style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Privacy
      </Text>

      {renderSettingItem(
        'Profile Visibility',
        'Who can see your profile information',
        settings.privacy.profile_visibility,
        () => showProfileVisibilityOptions(),
        'button'
      )}

      {renderSettingItem(
        'Transaction Privacy',
        'Hide transaction details from other members',
        settings.privacy.transaction_privacy,
        (value) => updatePrivacySetting('transaction_privacy', value)
      )}

      {renderSettingItem(
        'Location Sharing',
        'Share your location with chama members',
        settings.privacy.location_sharing,
        (value) => updatePrivacySetting('location_sharing', value)
      )}
    </Card>
  );

  const renderSecuritySettings = () => (
    <Card variant="outlined" style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Security
      </Text>


      {renderSettingItem(
        'Two-Factor Authentication',
        'Add an extra layer of security',
        settings.security.two_factor_auth,
        (value) => updateSecuritySetting('two_factor_auth', value)
      )}

      {renderSettingItem(
        'Auto Logout',
        'Automatically logout after inactivity',
        settings.security.auto_logout,
        (value) => updateSecuritySetting('auto_logout', value)
      )}
    </Card>
  );

  const renderPreferencesSettings = () => (
    <Card variant="outlined" style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Preferences
      </Text>

      {renderSettingItem(
        'Language',
        'Choose your preferred language',
        settings.preferences.language === 'en' ? 'English' : settings.preferences.language,
        () => showLanguageOptions(),
        'button'
      )}

      {renderSettingItem(
        'Currency',
        'Default currency for transactions',
        settings.preferences.currency,
        () => showCurrencyOptions(),
        'button'
      )}

      {renderSettingItem(
        'Date Format',
        'How dates are displayed',
        settings.preferences.date_format,
        () => showDateFormatOptions(),
        'button'
      )}
    </Card>
  );

  const renderGoogleDriveBackupSettings = () => (
    <Card variant="outlined" style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        📁 Google Drive Backup
      </Text>

      {/* Connection Status */}
      <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            Connection Status
          </Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            {googleDriveConnected ? 'Connected to Google Drive' : 'Not connected'}
          </Text>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: googleDriveConnected ? colors.success + '20' : colors.error + '20'
        }]}>
          <Text style={[styles.statusText, {
            color: googleDriveConnected ? colors.success : colors.error
          }]}>
            {googleDriveConnected ? '✅ Connected' : '❌ Disconnected'}
          </Text>
        </View>
      </View>

      {/* Connect/Disconnect Button */}
      <TouchableOpacity
        style={[styles.settingRow, { borderBottomColor: colors.border }]}
        onPress={googleDriveConnected ? disconnectGoogleDrive : connectGoogleDrive}
        activeOpacity={0.7}
        disabled={loading}
      >
        <View style={styles.settingContent}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              {googleDriveConnected ? 'Disconnect Google Drive' : 'Connect Google Drive'}
            </Text>
            <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
              {googleDriveConnected
                ? 'Stop automatic backups'
                : 'Enable automatic backups to your Google Drive'
              }
            </Text>
          </View>
          <View style={styles.settingAction}>
            <Ionicons
              name={googleDriveConnected ? "unlink" : "link"}
              size={20}
              color={googleDriveConnected ? colors.error : colors.primary}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Generate Test Tokens Button - For Development */}
      {!googleDriveConnected && (
        <TouchableOpacity
          style={[styles.settingRow, { borderBottomColor: colors.border }]}
          onPress={async () => {
            try {
              setLoading(true);
              const response = await ApiService.makeRequest('/users/google-drive/generate-test-tokens', {
                method: 'POST',
              });

              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Test Tokens Generated',
                  text2: 'Google Drive test tokens have been created',
                  position: 'bottom',
                  visibilityTime: 3000,
                });

                // Refresh connection status after a short delay
                setTimeout(() => {
                  checkGoogleDriveConnection(true);
                }, 1000);
              } else {
                throw new Error(response.error || 'Failed to generate test tokens');
              }
            } catch (error) {
              console.error('❌ Failed to generate test tokens:', error);
              Toast.show({
                type: 'error',
                text1: 'Token Generation Failed',
                text2: error.message || 'Could not generate test tokens',
                position: 'bottom',
                visibilityTime: 4000,
              });
            } finally {
              setLoading(false);
            }
          }}
          activeOpacity={0.7}
          disabled={loading}
        >
          <View style={styles.settingContent}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Generate Test Tokens
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                Create test Google Drive tokens for development
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Ionicons
                name="key"
                size={20}
                color={loading ? colors.textSecondary : colors.warning}
              />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Force Refresh Connection Status Button - Always show */}
      <TouchableOpacity
        style={[styles.settingRow, { borderBottomColor: colors.border }]}
        onPress={() => checkGoogleDriveConnection(true)}
        activeOpacity={0.7}
        disabled={loading}
      >
        <View style={styles.settingContent}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              {googleDriveConnected ? 'Refresh Connection Status' : 'Check Connection Status'}
            </Text>
            <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
              {googleDriveConnected
                ? 'Verify current connection status'
                : 'Check if Google Drive connection was established'
              }
            </Text>
          </View>
          <View style={styles.settingAction}>
            <Ionicons
              name="refresh"
              size={20}
              color={loading ? colors.textSecondary : colors.primary}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Manual Connection Override - Show when connection check attempts exceed threshold */}
      {connectionCheckAttempts >= 2 && (
        <TouchableOpacity
          style={[styles.settingRow, { borderBottomColor: colors.border }]}
          onPress={() => {
            Alert.alert(
              'Manual Connection Override',
              'If you know your Google Drive is connected but the app cannot detect it, you can manually set the connection status. This is a temporary workaround.',
              [
                {
                  text: 'Set as Connected',
                  onPress: () => {
                    setGoogleDriveConnected(true);
                    Alert.alert('Success', 'Connection status manually set to connected.');
                  }
                },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingContent}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Manual Connection Override
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                Manually set connection status if automatic detection fails
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Ionicons
                name="settings"
                size={20}
                color={colors.warning}
              />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Authentication Link - Show when auth URL is available */}
      {showAuthLink && authUrl && !googleDriveConnected && (
        <View style={styles.authLinkContainer}>
          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: colors.primary }]}
            onPress={handleAuthenticateWithGoogle}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color={colors.white} />
            <Text style={[styles.authButtonText, { color: colors.white }]}>
              Authenticate with Google
            </Text>
            <Ionicons name="open-outline" size={16} color={colors.white} />
          </TouchableOpacity>

          <Text style={[styles.authInstructions, { color: colors.textSecondary }]}>
            Click above to complete Google Drive authentication in your browser
          </Text>
        </View>
      )}

      {googleDriveConnected && (
        <>
          {/* Last Backup Date */}
          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Last Backup
              </Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {lastBackupDate
                  ? new Date(lastBackupDate).toLocaleString('en-KE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'No backup yet'
                }
              </Text>
            </View>
          </View>

          {/* Backup Actions */}
          <View style={styles.backupActions}>
            <TouchableOpacity
              style={[styles.backupButton, { backgroundColor: colors.primary }]}
              onPress={performBackup}
              disabled={backupInProgress}
            >
              <Ionicons
                name={backupInProgress ? "hourglass" : "cloud-upload"}
                size={20}
                color={colors.white}
              />
              <Text style={[styles.backupButtonText, { color: colors.white }]}>
                {backupInProgress ? 'Backing up...' : 'Backup Now'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.backupButton, { backgroundColor: colors.secondary }]}
              onPress={performRestore}
              disabled={restoreInProgress}
            >
              <Ionicons
                name={restoreInProgress ? "hourglass" : "cloud-download"}
                size={20}
                color={colors.white}
              />
              <Text style={[styles.backupButtonText, { color: colors.white }]}>
                {restoreInProgress ? 'Restoring...' : 'Restore'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Backup Info */}
          <View style={styles.backupInfo}>
            <Text style={[styles.backupInfoText, { color: colors.textSecondary }]}>
              💡 Your data is backed up to a private folder in your Google Drive.
              Only you can access this backup.
            </Text>
          </View>

          {/* Debug Information Toggle */}
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomColor: colors.border }]}
            onPress={() => setShowDebugInfo(!showDebugInfo)}
            activeOpacity={0.7}
          >
            <View style={styles.settingContent}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Debug Information
                </Text>
                <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                  Show technical details for troubleshooting
                </Text>
              </View>
              <View style={styles.settingAction}>
                <Ionicons
                  name={showDebugInfo ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* Debug Information */}
          {showDebugInfo && debugInfo && (
            <View style={styles.debugInfo}>
              <Text style={[styles.debugTitle, { color: colors.text }]}>
                Connection Debug Info
              </Text>
              <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                Status: {debugInfo.connected ? 'Connected' : 'Not Connected'}
              </Text>
              <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                Attempts: {debugInfo.attempts}
              </Text>
              <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                User ID: {debugInfo.userId || 'Not available'}
              </Text>
              <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                User Role: {debugInfo.userRole || 'Not available'}
              </Text>
              <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                Last Check: {new Date(debugInfo.timestamp).toLocaleString()}
              </Text>

              {debugInfo.rawResponse && (
                <>
                  <Text style={[styles.debugTitle, { color: colors.text, marginTop: spacing.md }]}>
                    Raw API Response
                  </Text>
                  <Text style={[styles.debugText, { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 11 }]}>
                    {debugInfo.rawResponse}
                  </Text>
                </>
              )}
            </View>
          )}
        </>
      )}
    </Card>
  );

  const accountMenuItems = [
    {
      title: 'Profile',
      subtitle: 'Manage your personal information',
      icon: 'person',
      color: colors.primary,
      onPress: () => navigation.navigate('Profile'),
    },
    {
      title: 'Security Settings',
      subtitle: 'Password, PIN, and security options',
      icon: 'shield-checkmark',
      color: colors.info,
      onPress: () => navigation.navigate('SecuritySettings'),
    },
    {
      title: 'Payment Methods',
      subtitle: 'Manage your payment options',
      icon: 'card',
      color: colors.secondary,
      onPress: () => navigation.navigate('PaymentMethods'),
    },
   {
      title: 'Notification Manager',
      subtitle: 'Manage your notifications',
      icon: 'notifications',
      color: colors.secondary,
      onPress: () => navigation.navigate('Reminders'),
    },
  ];

  const supportMenuItems = [
    {
      title: 'Help Center',
      subtitle: 'FAQs and support articles',
      icon: 'help-circle',
      color: colors.warning,
      onPress: () => navigation.navigate('HelpCenter'),
    },
    {
      title: 'Contact Support',
      subtitle: 'Get help from our team',
      icon: 'chatbubble',
      color: colors.info,
      onPress: () => navigation.navigate('ContactSupport'),
    },
  ];

   return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          bounces={true}
          alwaysBounceVertical={false}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
        {loading && (
          <View style={styles.inlineLoadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.inlineLoadingText, { color: colors.textSecondary }]}>
              Loading settings...
            </Text>
          </View>
        )}
        {renderNotificationSettings()}
        {renderPrivacySettings()}
        {renderSecuritySettings()}
        {renderPreferencesSettings()}
        {renderGoogleDriveBackupSettings()}
        {renderMenuSection('Account', accountMenuItems)}
        {renderMenuSection('Support', supportMenuItems)}

        <Card variant="outlined" style={styles.section}>
          <Button
            title="Save Settings"
            onPress={handleSaveSettings}
            style={styles.saveButton}
          />

          <Button
            title="Delete Account"
            variant="outline"
            onPress={handleDeleteAccount}
            style={[styles.deleteButton, { borderColor: colors.error }]}
            textStyle={{ color: colors.error }}
          />
        </Card>

        <View style={styles.appInfo}>
          <Text style={[styles.appVersion, { color: colors.textTertiary }]}>
            VaultKe v1.0.0
          </Text>
          <Text style={[styles.buildNumber, { color: colors.textTertiary }]}>
            Build 2024.1.0
          </Text>
        </View>
      </ScrollView>
      <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl * 2, // Extra padding at bottom for easy scrolling
  },
  section: {
    margin: spacing.md,
    marginBottom: spacing.lg, // More space between sections
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg, // Increased touch area
    paddingHorizontal: spacing.sm, // Added horizontal padding
    borderBottomWidth: 1,
    minHeight: 60, // Minimum touch target size
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: typography.fontSize.sm,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    fontSize: typography.fontSize.base,
    marginRight: spacing.sm,
  },
  themeContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  themeText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  adminButtonText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  adminButtonTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  adminButtonSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg, // Increased touch area
    paddingHorizontal: spacing.sm, // Added horizontal padding
    borderBottomWidth: 1,
    minHeight: 64, // Larger touch target for menu items
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  menuSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  saveButton: {
    marginBottom: spacing.md,
  },

  deleteButton: {
    marginBottom: spacing.md,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg, // Extra space before app info
    marginBottom: spacing.xl, // Extra space at bottom
  },
  appVersion: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  buildNumber: {
    fontSize: typography.fontSize.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingAction: {
    marginLeft: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingSubtitle: {
    fontSize: typography.fontSize.sm,
  },

  // Status badge styles
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },

  // Loading styles
  inlineLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  inlineLoadingText: {
    fontSize: typography.fontSize.sm,
  },

  // Google Drive backup styles
  backupActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  backupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 8,
    gap: spacing.xs,
  },
  backupButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  backupInfo: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 6,
  },
  backupInfoText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
    textAlign: 'center',
  },

  // Authentication link styles
  authLinkContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 8,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  authButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  authInstructions: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },

  // Debug information styles
  debugInfo: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  debugTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  debugText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
    marginBottom: spacing.xs,
    fontFamily: 'monospace',
  },

});

export default SettingsScreen;
