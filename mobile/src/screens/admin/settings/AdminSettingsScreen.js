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

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  
  const [settings, setSettings] = useState({
    // System Settings
    maintenanceMode: false,
    debugMode: false,
    apiLogging: true,
    errorReporting: true,
    autoBackup: true,
    
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
  });

  const [configValues, setConfigValues] = useState({
    systemName: 'VaultKe Admin',
    systemVersion: '1.0.0',
    supportEmail: 'support@vaultke.com',
    maxFileSize: '10',
    backupRetention: '30',
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

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('admin_settings', JSON.stringify(settings));
      await AsyncStorage.setItem('admin_config', JSON.stringify(configValues));
      
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (error) {
      console.error('Save settings error:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = async () => {
    try {
      setIsResetting(true);
      
      const defaultSettings = {
        maintenanceMode: false,
        debugMode: false,
        apiLogging: true,
        errorReporting: true,
        autoBackup: true,
        allowRegistration: true,
        requireEmailVerification: true,
        requirePhoneVerification: true,
        autoApproveUsers: false,
        allowChamaCreation: true,
        requireChamaApproval: true,
        maxChamaMembers: 50,
        minContributionAmount: 100,
        sessionTimeout: 30,
        maxLoginAttempts: 5,
        passwordMinLength: 8,
        requireStrongPassword: true,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        adminAlerts: true,
      };
      
      const defaultConfig = {
        systemName: 'VaultKe Admin',
        systemVersion: '1.0.0',
        supportEmail: 'support@vaultke.com',
        maxFileSize: '10',
        backupRetention: '30',
      };
      
      setSettings(defaultSettings);
      setConfigValues(defaultConfig);
      
      await AsyncStorage.removeItem('admin_settings');
      await AsyncStorage.removeItem('admin_config');
      
      Alert.alert('Success', 'Settings reset to defaults successfully!');
    } catch (error) {
      console.error('Reset settings error:', error);
      Alert.alert('Error', 'Failed to reset settings');
    } finally {
      setIsResetting(false);
    }
  };

  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      Alert.alert('Backup', 'System backup initiated. This may take a few minutes.');
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear the application cache?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['cached_', 'temp_', 'preview_']);
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          }
        }
      ]
    );
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Ionicons name="settings" size={28} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Settings</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Manage system configuration
          </Text>
        </View>

        {/* System Settings */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="hardware-chip" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>System Settings</Text>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Maintenance Mode</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Disable user access during maintenance
              </Text>
            </View>
            <Switch
              value={settings.maintenanceMode}
              onValueChange={() => toggleSetting('maintenanceMode')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.maintenanceMode ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Debug Mode</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Enable detailed logging
              </Text>
            </View>
            <Switch
              value={settings.debugMode}
              onValueChange={() => toggleSetting('debugMode')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.debugMode ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>API Logging</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Log all API requests
              </Text>
            </View>
            <Switch
              value={settings.apiLogging}
              onValueChange={() => toggleSetting('apiLogging')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.apiLogging ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>User Settings</Text>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Allow Registration</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Allow new user registrations
              </Text>
            </View>
            <Switch
              value={settings.allowRegistration}
              onValueChange={() => toggleSetting('allowRegistration')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.allowRegistration ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Require Email Verification</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Users must verify email before login
              </Text>
            </View>
            <Switch
              value={settings.requireEmailVerification}
              onValueChange={() => toggleSetting('requireEmailVerification')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.requireEmailVerification ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Require Phone Verification</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Users must verify phone before login
              </Text>
            </View>
            <Switch
              value={settings.requirePhoneVerification}
              onValueChange={() => toggleSetting('requirePhoneVerification')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.requirePhoneVerification ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-circle" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Chama Settings</Text>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Allow Chama Creation</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Users can create new chamas
              </Text>
            </View>
            <Switch
              value={settings.allowChamaCreation}
              onValueChange={() => toggleSetting('allowChamaCreation')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.allowChamaCreation ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Require Chama Approval</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Admin approval for new chamas
              </Text>
            </View>
            <Switch
              value={settings.requireChamaApproval}
              onValueChange={() => toggleSetting('requireChamaApproval')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.requireChamaApproval ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Max Chama Members</Text>
            </View>
            <TextInput
              style={[styles.numberInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={settings.maxChamaMembers.toString()}
              onChangeText={(text) => updateSetting('maxChamaMembers', parseInt(text) || 0)}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Security Settings</Text>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Session Timeout (minutes)</Text>
            </View>
            <TextInput
              style={[styles.numberInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={settings.sessionTimeout.toString()}
              onChangeText={(text) => updateSetting('sessionTimeout', parseInt(text) || 30)}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Max Login Attempts</Text>
            </View>
            <TextInput
              style={[styles.numberInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={settings.maxLoginAttempts.toString()}
              onChangeText={(text) => updateSetting('maxLoginAttempts', parseInt(text) || 5)}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Minimum Password Length</Text>
            </View>
            <TextInput
              style={[styles.numberInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={settings.passwordMinLength.toString()}
              onChangeText={(text) => updateSetting('passwordMinLength', parseInt(text) || 8)}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Require Strong Password</Text>
            </View>
            <Switch
              value={settings.requireStrongPassword}
              onValueChange={() => toggleSetting('requireStrongPassword')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.requireStrongPassword ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification Settings</Text>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Email Notifications</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Send email notifications to users
              </Text>
            </View>
            <Switch
              value={settings.emailNotifications}
              onValueChange={() => toggleSetting('emailNotifications')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.emailNotifications ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>SMS Notifications</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Send SMS notifications to users
              </Text>
            </View>
            <Switch
              value={settings.smsNotifications}
              onValueChange={() => toggleSetting('smsNotifications')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.smsNotifications ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Push Notifications</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Send push notifications to users
              </Text>
            </View>
            <Switch
              value={settings.pushNotifications}
              onValueChange={() => toggleSetting('pushNotifications')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.pushNotifications ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Admin Alerts</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Send alerts to administrators
              </Text>
            </View>
            <Switch
              value={settings.adminAlerts}
              onValueChange={() => toggleSetting('adminAlerts')}
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.adminAlerts ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>System Configuration</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>System Name</Text>
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={configValues.systemName}
              onChangeText={(value) => updateConfigValue('systemName', value)}
              placeholder="System name"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Support Email</Text>
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={configValues.supportEmail}
              onChangeText={(value) => updateConfigValue('supportEmail', value)}
              placeholder="support@example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Max File Size (MB)</Text>
            </View>
            <TextInput
              style={[styles.numberInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={configValues.maxFileSize}
              onChangeText={(value) => updateConfigValue('maxFileSize', value)}
              placeholder="10"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="server" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Database & Backup</Text>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleBackup}
            disabled={isBackingUp}
          >
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>
              {isBackingUp ? 'Creating Backup...' : 'Create System Backup'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.warning }]}
            onPress={handleClearCache}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Clear Application Cache</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <BorderedButton
            title="Save Settings"
            onPress={handleSaveSettings}
            loading={isSaving}
            style={[styles.saveButton, { borderColor: colors.primary }]}
          />
          <BorderedButton
            title="Reset to Defaults"
            onPress={handleResetSettings}
            loading={isResetting}
            style={[styles.resetButton, { borderColor: colors.error }]}
            textStyle={{ color: colors.error }}
          />
          <BorderedButton
            title="Clear Cache"
            onPress={handleClearCache}
            style={[styles.clearButton, { borderColor: colors.textSecondary }]}
            textStyle={{ color: colors.textSecondary }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 60,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'right',
    minWidth: 120,
  },
  numberInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'right',
    minWidth: 80,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  saveButton: {
    flex: 1,
  },
  resetButton: {
    flex: 1,
  },
  clearButton: {
    flex: 1,
  },
});