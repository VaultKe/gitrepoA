import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import useSecuritySettingsScreen from '../../../hooks/useSecuritySettingsScreen';

const SecuritySettingsScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    theme: _theme,
    user: _user,
    securitySettings,
    handleSettingChange,
    handleChangePassword,
    handleViewLoginHistory,
    handleWhatsAppLink,
  } = useSecuritySettingsScreen({ navigation });

  const renderSecuritySetting = (key, title, description, requiresConfirmation = false) => (
    <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={securitySettings[key]}
        onValueChange={(value) => {
          if (requiresConfirmation && value) {
            Alert.alert(
              'Confirm',
              `Are you sure you want to enable ${title}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Enable', onPress: () => handleSettingChange(key, value) },
              ]
            );
          } else {
            handleSettingChange(key, value);
          }
        }}
        trackColor={{ false: colors.border, true: colors.primary + '40' }}
        thumbColor={securitySettings[key] ? colors.primary : colors.textSecondary}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Security Settings
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Manage your account security and privacy
          </Text>
        </View>

        {/* Authentication Settings */}
        <Card variant="outlined" style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Authentication
          </Text>
          {renderSecuritySetting(
            'two_factor_auth',
            'Two-Factor Authentication',
            'Add an extra layer of security to your account',
            true
          )}
          {renderSecuritySetting(
            'auto_logout',
            'Auto Logout',
            'Automatically log out after period of inactivity'
          )}
        </Card>

        {/* Security Monitoring */}
        <Card variant="outlined" style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Security Monitoring
          </Text>
          {renderSecuritySetting(
            'login_notifications',
            'Login Notifications',
            'Get notified when someone logs into your account'
          )}
          {renderSecuritySetting(
            'suspicious_activity_alerts',
            'Suspicious Activity Alerts',
            'Receive alerts for unusual account activity'
          )}
          {renderSecuritySetting(
            'device_management',
            'Device Management',
            'Monitor and manage devices that access your account'
          )}
        </Card>

        {/* Security Actions */}
        <Card variant="outlined" style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Security Actions
          </Text>
          
          <TouchableOpacity
            style={[styles.actionItem, { borderBottomColor: colors.border }]}
            onPress={handleChangePassword}
          >
            <View style={styles.actionContent}>
              <Ionicons name="key" size={24} color={colors.warning} />
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Change Password
                </Text>
                <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                  Update your account password
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, { borderBottomWidth: 0 }]}
            onPress={handleViewLoginHistory}
          >
            <View style={styles.actionContent}>
              <Ionicons name="time" size={24} color={colors.info} />
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Login History
                </Text>
                <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                  View recent login activity
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, { borderBottomWidth: 0 }]}
            onPress={handleWhatsAppLink}
          >
            <View style={styles.actionContent}>
              <Ionicons name="logo-whatsapp" size={24} color={colors.success || '#25D366'} />
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Link WhatsApp
                </Text>
                <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
                  Connect your WhatsApp account
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  settingContent: {
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
    lineHeight: 18,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  actionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  actionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  actionDescription: {
    fontSize: typography.fontSize.sm,
  },
});

export default SecuritySettingsScreen;
