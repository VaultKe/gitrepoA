import React from 'react';
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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import SettingItem from '../../../components/settings/SettingItem';
import MenuSection from '../../../components/settings/MenuSection';
import useSettingsScreen from '../../../hooks/useSettingsScreen';

const SettingsScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useSettingsScreen({ navigation });

  const {
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
  } = screen;

  const selectedSound = availableSounds.find(s => s.id === settings.notifications.notification_sound_id);

  const renderNotificationSettings = () => {
    return (
      <Card variant="outlined" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Notifications
        </Text>

        <SettingItem
          title="Push Notifications"
          description="Receive notifications on your device"
          value={settings.notifications.push}
          onValueChange={(value) => updateNotificationPreference('sound_enabled', value)}
          colors={colors}
        />

        <SettingItem
          title="Email Notifications"
          description="Receive notifications via email"
          value={settings.notifications.email}
          onValueChange={(value) => updateNotificationPreference('system_notifications', value)}
          colors={colors}
        />

        <SettingItem
          title="Chama Updates"
          description="Notifications about chama activities"
          value={settings.notifications.chama_updates}
          onValueChange={(value) => updateNotificationPreference('chama_notifications', value)}
          colors={colors}
        />

        <SettingItem
          title="Financial Alerts"
          description="Notifications about transactions and balances"
          value={settings.notifications.financial_alerts}
          onValueChange={(value) => updateNotificationPreference('transaction_notifications', value)}
          colors={colors}
        />

        <SettingItem
          title="SMS Notifications"
          description="Receive notifications via SMS"
          value={settings.notifications.sms}
          onValueChange={(value) => updateNotificationPreference('sms_notifications', value)}
          colors={colors}
        />

        {settings.notifications.push && (
          <>
            <SettingItem
              title="Sound Enabled"
              description="Play sound for notifications"
              value={settings.notifications.sound_enabled}
              onValueChange={(value) => updateNotificationPreference('sound_enabled', value)}
              colors={colors}
            />

            <SettingItem
              title="Vibration Enabled"
              description="Vibrate for notifications"
              value={settings.notifications.vibration_enabled}
              onValueChange={(value) => updateNotificationPreference('vibration_enabled', value)}
              colors={colors}
            />

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

  const renderSecuritySettings = () => (
    <Card variant="outlined" style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Security
      </Text>

      <SettingItem
        title="Two-Factor Authentication"
        description="Add an extra layer of security"
        value={settings.security.two_factor_auth}
        onValueChange={(value) => updateSecuritySetting('two_factor_auth', value)}
        colors={colors}
      />

      <SettingItem
        title="Auto Logout"
        description="Automatically logout after inactivity"
        value={settings.security.auto_logout}
        onValueChange={(value) => updateSecuritySetting('auto_logout', value)}
        colors={colors}
      />
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
        {renderSecuritySettings()}
        <MenuSection title="Account" items={accountMenuItems} colors={colors} />
        <MenuSection title="Support" items={supportMenuItems} colors={colors} />

        <Card variant="outlined" style={styles.section}>
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
    paddingBottom: spacing.xl * 2,
  },
  section: {
    margin: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
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
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  settingSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  settingAction: {
    marginLeft: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    marginBottom: spacing.md,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  appVersion: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  buildNumber: {
    fontSize: typography.fontSize.xs,
  },
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
});

export default SettingsScreen;
