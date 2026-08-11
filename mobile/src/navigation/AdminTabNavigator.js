import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../utils/theme';

// Import Admin Screens
import AdminHomepage from '../screens/admin/dashboard/AdminHomepage';
import UserManagementScreen from '../screens/admin/usermanagement/UserManagementScreen';
import ChamaManagementScreen from '../screens/admin/chamamanagement/ChamaManagementScreen';
import SystemAnalyticsScreen from '../screens/admin/analytics/SystemAnalyticsScreen';
import SecurityCenterScreen from '../screens/admin/security/SecurityCenterScreen';
import PaymentSystemScreen from '../screens/admin/payments/PaymentSystemScreen';
import BackupMaintenanceScreen from '../screens/admin/maintenance/BackupMaintenanceScreen';
import AdminSettingsScreen from '../screens/admin/settings/AdminSettingsScreen';
import FinancialReportsScreen from '../screens/admin/financial/FinancialReportsScreen';
import SystemHealthScreen from '../screens/admin/system/SystemHealthScreen';
import APIManagementScreen from '../screens/admin/system/APIManagementScreen';
import ContentModerationScreen from '../screens/admin/content/ContentModerationScreen';
import NotificationManagementScreen from '../screens/admin/notifications/NotificationManagementScreen';
import AuditLogsScreen from '../screens/admin/audit/AuditLogsScreen';
import NotificationsScreen from '../screens/user/notification/NotificationsScreen';
import ProfileScreen from '../screens/user/profile/ProfileScreen';

// Import additional screens that users might navigate to
import SettingsScreen from '../screens/user/settings/SettingsScreen';
import SecuritySettingsScreen from '../screens/user/settings/SecuritySettingsScreen';
import HelpCenterScreen from '../screens/user/settings/HelpCenterScreen';
import TransactionHistoryScreen from '../screens/user/wallet/TransactionHistoryScreen';
import InvitationsScreen from '../screens/chama/meeting/InvitationsScreen';
import ContactSupportScreen from '../screens/user/support/ContactSupportScreen';
import AdminSupportScreen from '../screens/admin/support/AdminSupportScreen';
import AdminSupportChatScreen from '../screens/admin/support/AdminSupportChatScreen';
import UpdateSupportRequestScreen from '../screens/admin/support/UpdateSupportRequestScreen';
import ChangePasswordScreen from '../screens/security/ChangePasswordScreen';
import LoginHistoryScreen from '../screens/security/LoginHistoryScreen';
import WhatsAppLinkScreen from '../screens/user/whatsapp/WhatsAppLinkScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import ReminderScreen from '../screens/user/reminders/ReminderScreen';
import NotificationToneScreen from '../screens/user/settings/NotificationToneScreen';

// Demo Screens

const Tab = createBottomTabNavigator();

/**
 * Admin Tab Bar Component
 * Custom footer for admin dashboard with shortcut navigation
 * Styled to match UserTabBar design
 */
function AdminTabBar({ state, descriptors, navigation }) {
  const { theme, switchToUserDashboard } = useApp();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();

  // Smart shortcuts for admin dashboard
  const quickShortcuts = [
    { name: 'Dashboard', label: 'Dashboard', icon: 'home', onPress: () => navigation.navigate('AdminHomepage') },
    { name: 'Users', label: 'Users', icon: 'people', onPress: () => navigation.navigate('UserManagementScreen') },
    { name: 'Chamas', label: 'Chamas', icon: 'business', onPress: () => navigation.navigate('ChamaManagementScreen') },
    { name: 'Analytics', label: 'Analytics', icon: 'analytics', onPress: () => navigation.navigate('SystemAnalyticsScreen') },
    { name: 'WhatsApp', label: 'WhatsApp', icon: 'logo-whatsapp', onPress: () => navigation.navigate('WhatsAppLink') },
    { name: 'User', label: 'User', icon: 'person', onPress: () => switchToUserDashboard() },
  ];

  // Determine current active tab based on navigation state
  const getCurrentIndex = () => {
    if (!state?.routes) return 0;
    const currentRoute = state.routes[state.index];
    const shortcutIndex = quickShortcuts.findIndex(shortcut =>
      shortcut.name === currentRoute.name ||
      (shortcut.name === 'Dashboard' && currentRoute.name === 'AdminHomepage') ||
      (shortcut.name === 'Users' && currentRoute.name === 'UserManagementScreen') ||
      (shortcut.name === 'Chamas' && currentRoute.name === 'ChamaManagementScreen') ||
      (shortcut.name === 'Analytics' && currentRoute.name === 'SystemAnalyticsScreen') ||
      (shortcut.name === 'WhatsApp' && currentRoute.name === 'WhatsAppLink')
    );
    return shortcutIndex >= 0 ? shortcutIndex : 0;
  };

  const currentIndex = getCurrentIndex();

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border, height: 70 + insets.bottom, paddingBottom: spacing.sm + insets.bottom }]}>
      {/* Smart Footer Icons - Always show exactly 6 */}
      {quickShortcuts.map((item, index) => {
        const isUser = item.name === 'User';
        const isFocused = currentIndex === index;
        const iconColor = isUser ? colors.success : (isFocused ? colors.primary : colors.textSecondary);

        return (
          <TouchableOpacity
            key={item.name}
            style={styles.tabItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={[
              styles.tabButton,
              isFocused && { backgroundColor: colors.primary + '20' },
              isUser && { backgroundColor: colors.success + '20' } // Special green background for User
            ]}>
              <Ionicons
                name={item.icon}
                size={20}
                color={iconColor}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: iconColor }
                ]}
              >
                {item.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Admin Tab Navigator
 * Main tab navigator for admin dashboard with all admin screens
 */
function AdminTabNavigator({ route }) {
  const routeParams = route?.params || {};
  return (
    <Tab.Navigator
      tabBar={(props) => <AdminTabBar {...props} />}
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: ({ options }) => {
          // Import SmartHeader here to avoid circular imports
          const SmartHeader = require('../components/common/SmartHeader').default;

          // Determine if back button should be shown based on navigation state
          const canGoBack = navigation.canGoBack();
          const isMainAdminScreen = [
            'AdminHomepage', 'UserManagementScreen', 'ChamaManagementScreen','SystemAnalyticsScreen'
          ].includes(route.name);

          // Get navigation state for more intelligent back button logic
          const state = navigation.getState();
          const routeHistory = state?.routes || [];
          const hasNavigationHistory = routeHistory.length > 1;

          // Only show back button if we can actually go back
          // Don't show it just because it's not a main screen - that leads to confusing UX
          const shouldShowBackButton = canGoBack && hasNavigationHistory;

          // Enhanced header with profile pic, admin home icon, notification bell, and smart navigation
          return (
            <SmartHeader
              title={options.title || route.name}
              showBackButton={shouldShowBackButton}
              showHomeButton={true}
              showProfilePic={true}
              showNotificationBell={true}
              onHomePress={() => navigation.navigate('AdminHomepage')} // Admin-specific home
            />
          );
        },
      })}
    >
      {/* Main Visible Tabs */}
      <Tab.Screen
        name="AdminHomepage"
        component={AdminHomepage}
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="UserManagementScreen"
        component={UserManagementScreen}
        options={{
          title: 'User Management',
          tabBarLabel: 'Users',
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="ChamaManagementScreen"
        component={ChamaManagementScreen}
        options={{
          title: 'Chama Management',
          tabBarLabel: 'Chamas',
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="SystemAnalyticsScreen"
        component={SystemAnalyticsScreen}
        options={{
          title: 'System Analytics',
          tabBarLabel: 'Analytics',
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="AdminSettingsScreen"
        component={AdminSettingsScreen}
        options={{
          title: 'Admin Settings',
          tabBarLabel: 'Settings',
        }}
        initialParams={routeParams}
      />

      {/* Hidden Tab Screens - These have footer but don't show in tab bar */}
      <Tab.Screen
        name="SecurityCenterScreen"
        component={SecurityCenterScreen}
        options={{
          title: 'Security Center',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="PaymentSystemScreen"
        component={PaymentSystemScreen}
        options={{
          title: 'Payment System',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="BackupMaintenanceScreen"
        component={BackupMaintenanceScreen}
        options={{
          title: 'Backup & Maintenance',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
       {/* New Admin Screens */}
      <Tab.Screen
        name="FinancialReportsScreen"
        component={FinancialReportsScreen}
        options={{
          title: 'Financial Reports',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="SystemHealthScreen"
        component={SystemHealthScreen}
        options={{
          title: 'System Health',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="APIManagementScreen"
        component={APIManagementScreen}
        options={{
          title: 'API Management',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="ContentModerationScreen"
        component={ContentModerationScreen}
        options={{
          title: 'Content Moderation',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="NotificationManagementScreen"
        component={NotificationManagementScreen}
        options={{
          title: 'Notification Management',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="AuditLogsScreen"
        component={AuditLogsScreen}
        options={{
          title: 'Audit Logs',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />

      {/* Notifications Screen */}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />

      {/* Profile Screen */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />

      {/* Additional Screens for Cross-Navigator Access */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="SecuritySettings"
        component={SecuritySettingsScreen}
        options={{
          title: 'Security Settings',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="HelpCenter"
        component={HelpCenterScreen}
        options={{
          title: 'Help Center',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{
          title: 'Transaction History',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="Invitations"
        component={InvitationsScreen}
        options={{
          title: 'Invitations',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="ContactSupport"
        component={ContactSupportScreen}
        options={{
          title: 'Contact Support',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="AdminSupport"
        component={AdminSupportScreen}
        options={{
          title: 'Support Management',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="AdminSupportChat"
        component={AdminSupportChatScreen}
        options={({ route }) => ({
          title: route.params?.supportRequest?.subject || 'Support Chat',
        })}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="UpdateSupportRequest"
        component={UpdateSupportRequestScreen}
        options={({ route }) => ({
          title: 'Update Request',
          tabBarButton: () => null, // Hide from tab bar
        })}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          title: 'Change Password',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="LoginHistory"
        component={LoginHistoryScreen}
        options={{
          title: 'Login History',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="WhatsAppLink"
        component={WhatsAppLinkScreen}
        options={{
          title: 'Link WhatsApp',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />

      {/* Additional Common Screens */}
      <Tab.Screen
        name="Reminders"
        component={ReminderScreen}
        options={{
          title: 'Reminders',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />
      <Tab.Screen
        name="NotificationTone"
        component={NotificationToneScreen}
        options={{
          title: 'Notification Tones',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={routeParams}
      />


    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 70,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    elevation: 8,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  exitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    marginHorizontal: 4,
  },
  exitText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default AdminTabNavigator;
