import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import BorderedButton from '../../../components/BorderedButton';
import { ButtonRow } from '../../../components/ButtonGroup';

export default function AdminSettingsScreen() {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // WhatsApp Group Management State
  const [whatsappGroups, setWhatsappGroups] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [chamaGroupMappings, setChamaGroupMappings] = useState([]);
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected');

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [settings, setSettings] = useState({
    // System Settings
    maintenanceMode: false,
    debugMode: false,
    apiLogging: true,
    errorReporting: true,
    
    // User Settings
    allowRegistration: true,
    requireEmailVerification: true,
    requirePhoneVerification: true,
    autoApproveUsers: false,
    
    // Chama Settings
    allowChamaCreation: true,
    requireChamaApproval: true,
    maxChamaMembers: 50,
    minContributionAmount: 100,
    
    // Security Settings
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    requireStrongPassword: true,
    
    // Notification Settings
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    adminAlerts: true,

    // WhatsApp Group Notifications
    whatsappNotifications: false,
    whatsappAutoNotify: true,
    whatsappAnonymousSupport: true,
  });

  const [configValues, setConfigValues] = useState({
    systemName: 'VaultKe Admin',
    systemVersion: '1.0.0',
    supportEmail: 'support@vaultke.com',
    maxFileSize: '10',
    backupRetention: '30',
    whatsappBotUrl: 'http://localhost:3002',
    whatsappBotStatus: 'disconnected',
  });

  const toggleSetting = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateConfigValue = (key, value) => {
    setConfigValues(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveSettings = () => {
    Alert.alert(
      'Save Settings',
      'Are you sure you want to save these settings? Some changes may require a system restart.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            try {
              await saveAllSettings();
            } catch (error) {
              console.error('Failed to save settings:', error);
              Alert.alert('Error', 'Failed to save settings. Please try again.');
            }
          },
        },
      ]
    );
  };

  const saveAllSettings = async () => {
    setIsSaving(true);
    try {
      // Save system configuration
      const systemConfigResponse = await fetch('/api/admin/system-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configValues)
      });

      // Save admin settings
      const adminSettingsResponse = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      // Save WhatsApp settings if enabled
      if (settings.whatsappNotifications) {
        const whatsappResponse = await fetch('/api/admin/whatsapp-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: settings.whatsappNotifications,
            autoNotify: settings.whatsappAutoNotify,
            anonymousSupport: settings.whatsappAnonymousSupport,
            botUrl: configValues.whatsappBotUrl
          })
        });
      }

      // Store settings locally as backup
      await AsyncStorage.setItem('admin_settings', JSON.stringify(settings));
      await AsyncStorage.setItem('admin_config', JSON.stringify(configValues));

      Alert.alert('Success', 'All settings saved successfully!');

    } catch (error) {
      console.error('Save settings error:', error);

      // Fallback: Save to local storage only
      try {
        await AsyncStorage.setItem('admin_settings', JSON.stringify(settings));
        await AsyncStorage.setItem('admin_config', JSON.stringify(configValues));
        Alert.alert('Success', 'Settings saved locally (server unavailable)');
      } catch (localError) {
        throw new Error('Failed to save settings both remotely and locally');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'This will reset all settings to their default values. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetToDefaults();
            } catch (error) {
              console.error('Failed to reset settings:', error);
              Alert.alert('Error', 'Failed to reset settings. Please try again.');
            }
          },
        },
      ]
    );
  };

  const resetToDefaults = async () => {
    setIsResetting(true);
    try {
      // Default settings
      const defaultSettings = {
        // System Settings
        maintenanceMode: false,
        debugMode: false,
        autoBackup: true,
        dataRetention: 365,

        // Security Settings
        twoFactorRequired: false,
        sessionTimeout: 30,
        passwordComplexity: true,
        loginAttempts: 5,

        // Notification Settings
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        adminAlerts: true,

        // WhatsApp Group Notifications
        whatsappNotifications: false,
        whatsappAutoNotify: true,
        whatsappAnonymousSupport: true,
      };

      const defaultConfig = {
        systemName: 'VaultKe Admin',
        systemVersion: '1.0.0',
        supportEmail: 'support@vaultke.com',
        maxFileSize: '10',
        backupRetention: '30',
        whatsappBotUrl: 'http://localhost:3002',
        whatsappBotStatus: 'disconnected',
      };

      // Reset state
      setSettings(defaultSettings);
      setConfigValues(defaultConfig);

      // Clear stored settings
      await AsyncStorage.removeItem('admin_settings');
      await AsyncStorage.removeItem('admin_config');

      // Try to reset on server
      try {
        await fetch('/api/admin/reset-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (serverError) {
      }

      Alert.alert('Success', 'Settings reset to defaults successfully!');

    } catch (error) {
      console.error('Reset settings error:', error);
      throw error;
    } finally {
      setIsResetting(false);
    }
  };

  // WhatsApp Group Management Functions
  const checkWhatsAppStatus = async () => {
    try {
      const response = await fetch(`${configValues.whatsappBotUrl}/health`);
      const data = await response.json();
      setWhatsappStatus(data.whatsapp_connected ? 'connected' : 'disconnected');
      setConfigValues(prev => ({
        ...prev,
        whatsappBotStatus: data.whatsapp_connected ? 'connected' : 'disconnected'
      }));
    } catch (error) {
      console.error('WhatsApp status check failed:', error);
      setWhatsappStatus('error');
    }
  };

  const loadWhatsAppGroups = async () => {
    try {
      const response = await fetch(`${configValues.whatsappBotUrl}/groups`);
      const data = await response.json();
      if (data.success) {
        setWhatsappGroups(data.data);
      }
    } catch (error) {
      console.error('Failed to load WhatsApp groups:', error);
      Alert.alert('Error', 'Failed to load WhatsApp groups');
    }
  };

  const registerGroupForChama = async (chamaId, groupId, groupName) => {
    try {
      const response = await fetch(`${configValues.whatsappBotUrl}/register-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chama_id: chamaId, group_name: groupName })
      });

      const data = await response.json();
      if (data.success) {
        setChamaGroupMappings(prev => [...prev, { chamaId, groupId, groupName }]);
        Alert.alert('Success', `Group "${groupName}" registered successfully`);
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      console.error('Failed to register group:', error);
      Alert.alert('Error', 'Failed to register group');
    }
  };

  const sendTestNotification = async (groupName) => {
    try {
      const testTransaction = {
        id: 'test-' + Date.now(),
        type: 'contribution',
        amount: 5000,
        member_name: 'Test User',
        status: 'completed',
        createdAt: new Date().toISOString(),
        description: 'Test transaction notification'
      };

      const response = await fetch(`${configValues.whatsappBotUrl}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: testTransaction,
          group_id: selectedGroup?.id
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Test notification sent successfully!');
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  // Load saved settings on component mount
  useEffect(() => {
    loadSavedSettings();
  }, []);

  // Load WhatsApp data when WhatsApp notifications are enabled
  useEffect(() => {
    if (settings.whatsappNotifications) {
      checkWhatsAppStatus();
      loadWhatsAppGroups();
    }
  }, [settings.whatsappNotifications]);

  const loadSavedSettings = async () => {
    try {
      // Load saved admin settings
      const savedSettings = await AsyncStorage.getItem('admin_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }

      // Load saved config values
      const savedConfig = await AsyncStorage.getItem('admin_config');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        setConfigValues(prev => ({ ...prev, ...parsedConfig }));
      }
    } catch (error) {
      console.error('Failed to load saved settings:', error);
    }
  };

  const renderSettingToggle = (key, title, description, section = null) => (
    <View key={key} style={[styles.settingItem, { borderBottomColor: colors.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={settings[key]}
        onValueChange={() => toggleSetting(key)}
        trackColor={{ false: colors.border, true: colors.primary + '50' }}
        thumbColor={settings[key] ? colors.primary : colors.textSecondary}
      />
    </View>
  );

  const renderConfigInput = (key, title, placeholder, keyboardType = 'default') => (
    <View key={key} style={[styles.configItem, { borderBottomColor: colors.border }]}>
      <Text style={[styles.configLabel, { color: colors.text }]}>
        {title}
      </Text>
      <TextInput
        style={[
          styles.configInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          }
        ]}
        value={configValues[key]}
        onChangeText={(value) => updateConfigValue(key, value)}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.background }]}>


        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* System Configuration */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              System Configuration
            </Text>
            <View style={[styles.configCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderConfigInput('systemName', 'System Name', 'Enter system name')}
              {renderConfigInput('systemVersion', 'System Version', 'Enter version')}
              {renderConfigInput('supportEmail', 'Support Email', 'Enter support email', 'email-address')}
              {renderConfigInput('maxFileSize', 'Max File Size (MB)', 'Enter max file size', 'numeric')}
              {renderConfigInput('backupRetention', 'Backup Retention (Days)', 'Enter retention days', 'numeric')}
            </View>
          </View>

          {/* System Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              System Settings
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderSettingToggle(
                'maintenanceMode',
                'Maintenance Mode',
                'Enable maintenance mode to restrict access'
              )}
              {renderSettingToggle(
                'debugMode',
                'Debug Mode',
                'Enable debug mode for development'
              )}
              {renderSettingToggle(
                'apiLogging',
                'API Logging',
                'Log all API requests and responses'
              )}
              {renderSettingToggle(
                'errorReporting',
                'Error Reporting',
                'Automatically report system errors'
              )}
            </View>
          </View>

          {/* User Management */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              User Management
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderSettingToggle(
                'allowRegistration',
                'Allow Registration',
                'Allow new users to register'
              )}
              {renderSettingToggle(
                'requireEmailVerification',
                'Email Verification',
                'Require email verification for new users'
              )}
              {renderSettingToggle(
                'requirePhoneVerification',
                'Phone Verification',
                'Require phone verification for new users'
              )}
              {renderSettingToggle(
                'autoApproveUsers',
                'Auto Approve Users',
                'Automatically approve new user accounts'
              )}
            </View>
          </View>

          {/* Chama Management */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Chama Management
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderSettingToggle(
                'allowChamaCreation',
                'Allow Chama Creation',
                'Allow users to create new chamas'
              )}
              {renderSettingToggle(
                'requireChamaApproval',
                'Require Chama Approval',
                'Require admin approval for new chamas'
              )}
            </View>
          </View>

          {/* Security Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Security Settings
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderSettingToggle(
                'requireStrongPassword',
                'Strong Password Policy',
                'Enforce strong password requirements'
              )}
            </View>
          </View>

          {/* Notification Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Notification Settings
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderSettingToggle(
                'emailNotifications',
                'Email Notifications',
                'Send notifications via email'
              )}
              {renderSettingToggle(
                'smsNotifications',
                'SMS Notifications',
                'Send notifications via SMS'
              )}
              {renderSettingToggle(
                'pushNotifications',
                'Push Notifications',
                'Send push notifications to mobile apps'
              )}
              {renderSettingToggle(
                'adminAlerts',
                'Admin Alerts',
                'Send alerts to administrators'
              )}
            </View>
          </View>

          {/* WhatsApp Group Notifications */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              📱 WhatsApp Group Notifications
            </Text>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderSettingToggle(
                'whatsappNotifications',
                'Enable WhatsApp Notifications',
                'Send transaction notifications to WhatsApp groups'
              )}

              {settings.whatsappNotifications && (
                <>
                  {renderSettingToggle(
                    'whatsappAutoNotify',
                    'Auto-notify Transactions',
                    'Automatically send notifications for all transactions'
                  )}
                  {renderSettingToggle(
                    'whatsappAnonymousSupport',
                    'Anonymous Contribution Support',
                    'Handle anonymous contributions in notifications'
                  )}

                  {/* WhatsApp Bot Status */}
                  <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingTitle, { color: colors.text }]}>
                        Bot Status
                      </Text>
                      <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                        WhatsApp bot connection status
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, {
                      backgroundColor: whatsappStatus === 'connected' ? colors.success + '20' : colors.error + '20'
                    }]}>
                      <Text style={[styles.statusText, {
                        color: whatsappStatus === 'connected' ? colors.success : colors.error
                      }]}>
                        {whatsappStatus === 'connected' ? '✅ Connected' : '❌ Disconnected'}
                      </Text>
                    </View>
                  </View>

                  {/* WhatsApp Groups Management */}
                  <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingTitle, { color: colors.text }]}>
                        Manage Groups
                      </Text>
                      <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                        Configure WhatsApp groups for chama notifications
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.manageButton, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        loadWhatsAppGroups();
                        setShowGroupModal(true);
                      }}
                    >
                      <Text style={[styles.manageButtonText, { color: colors.white }]}>
                        Manage
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bot URL Configuration */}
                  <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingTitle, { color: colors.text }]}>
                        Bot Service URL
                      </Text>
                      <TextInput
                        style={[styles.configInput, {
                          color: colors.text,
                          borderColor: colors.border,
                          backgroundColor: colors.background
                        }]}
                        value={configValues.whatsappBotUrl}
                        onChangeText={(value) => updateConfigValue('whatsappBotUrl', value)}
                        placeholder="http://localhost:3002"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.testButton, { backgroundColor: colors.secondary }]}
                      onPress={checkWhatsAppStatus}
                    >
                      <Text style={[styles.testButtonText, { color: colors.white }]}>
                        Test
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <ButtonRow spacing={8} justify="space-between">
              <BorderedButton
                title={isSaving ? "Saving..." : "Save Settings"}
                icon={isSaving ? "hourglass" : "checkmark"}
                variant="success"
                size="medium"
                onPress={handleSaveSettings}
                disabled={isSaving}
                theme={theme}
                style={styles.actionButtonBordered}
              />
              <BorderedButton
                title={isResetting ? "Resetting..." : "Reset Defaults"}
                icon={isResetting ? "hourglass" : "refresh"}
                variant="danger"
                size="medium"
                onPress={handleResetSettings}
                disabled={isResetting}
                theme={theme}
                style={styles.actionButtonBordered}
              />
            </ButtonRow>
          </View>
        </ScrollView>

        {/* WhatsApp Groups Management Modal */}
        <Modal
          visible={showGroupModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                📱 WhatsApp Groups
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowGroupModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                Select a WhatsApp group to configure for chama notifications:
              </Text>

              <FlatList
                data={whatsappGroups}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.groupItem, {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: selectedGroup?.id === item.id ? 2 : 1,
                      borderColor: selectedGroup?.id === item.id ? colors.primary : colors.border
                    }]}
                    onPress={() => setSelectedGroup(item)}
                  >
                    <View style={styles.groupInfo}>
                      <Text style={[styles.groupName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.groupMembers, { color: colors.textSecondary }]}>
                        {item.participants_count} members
                      </Text>
                    </View>
                    {selectedGroup?.id === item.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
                style={styles.groupsList}
                showsVerticalScrollIndicator={false}
              />

              {selectedGroup && (
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={() => sendTestNotification(selectedGroup.name)}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.white }]}>
                      Send Test Message
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.success }]}
                    onPress={() => {
                      Alert.prompt(
                        'Register Group',
                        'Enter the Chama ID for this group:',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Register',
                            onPress: (chamaId) => {
                              if (chamaId) {
                                registerGroupForChama(chamaId, selectedGroup.id, selectedGroup.name);
                                setShowGroupModal(false);
                              }
                            }
                          }
                        ],
                        'plain-text',
                        'chama-123'
                      );
                    }}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.white }]}>
                      Register for Chama
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  configCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  configItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  configLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  configInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  settingsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionSection: {
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // BorderedButton styles - RESPONSIVE
  actionButtonBordered: {
    flex: 1,
    maxWidth: 180,
  },

  // WhatsApp-specific styles
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  manageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  testButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  groupsList: {
    flex: 1,
    marginBottom: 16,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 12,
  },
  modalActions: {
    gap: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
