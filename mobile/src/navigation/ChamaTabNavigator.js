import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ChamaProvider } from '../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius } from '../utils/theme';

// Import Chama Screens
import ChamaDashboard from '../screens/chama/dashboard/ChamaDashboard';
import ChamaMembersScreen from '../screens/chama/meeting/ChamaMembersScreen';
import ContributeScreen from '../screens/chama/contribute/ContributeScreen';
import ChamaLoansScreen from '../screens/chama/loans/ChamaLoansScreen';
import ChamaMeetingsScreen from '../screens/chama/meeting/ChamaMeetingsScreen';
import ChamaTransactionsScreen from '../screens/chama/transactions/ChamaTransactionsScreen';
import MerryGoRoundScreen from '../screens/chama/merry-go-round/MerryGoRoundScreen';
import MerryGoRoundRulesScreen from '../screens/chama/merry-go-round/MerryGoRoundRulesScreen';
import WelfareScreen from '../screens/chama/welfare/WelfareScreen';
import ChamaSettings from '../screens/chama/settings/ChamaSettings';
import LoanApplication from '../screens/chama/loans/LoanApplication';
import CreateMeeting from '../screens/chama/meeting/CreateMeeting';
import CreateMerryGoRound from '../screens/chama/merry-go-round/CreateMerryGoRound';
import InviteMembers from '../screens/chama/chamamember/InviteMembers';
import ChatScreen from '../screens/chat/ChatScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';

import PollsVotingScreen from '../screens/chama/pollsandvoting/PollsVotingScreen';
import AccountManagementScreen from '../screens/chama/accountmanagement/AccountManagementScreen';
import LoanManagementScreen from '../screens/chama/loans/LoanManagementScreen';
import WelfareDisbursementScreen from '../screens/chama/accountmanagement/WelfareDisbursementScreen';
import LoanTypeCreationScreen from '../screens/chama/accountmanagement/LoanTypeCreationScreen';
import SavingsWithdrawalScreen from '../screens/chama/accountmanagement/SavingsWithdrawalScreen';
import MaryGoRoundDisbursementScreen from '../screens/chama/accountmanagement/MaryGoRoundDisbursementScreen';
import SavingsDetails from '../screens/chama/savings/SavingsDetails';
import MaryGoRoundDetails from '../screens/chama/merry-go-round/MaryGoRoundDetails';
import WelfareDetails from '../screens/chama/welfare/WelfareDetails';
import LoanDetails from '../screens/chama/loans/LoanDetails';
import ViewMember from '../screens/chama/chamamember/ViewMember';
import PhysicalMeetingScreen from '../screens/chama/chamamember/PhysicalMeetingScreen';
import JitsiMeetScreen from '../screens/chama/meeting/JitsiMeetScreen';
import MeetingSummaryScreen from '../screens/chama/meeting/MeetingSummaryScreen';
import WelfareContributionsScreen from '../screens/chama/welfare/WelfareContributionsScreen';
import NotificationsScreen from '../screens/user/notification/NotificationsScreen';
import ProfileScreen from '../screens/user/profile/ProfileScreen';

// Import additional screens that users might navigate to
import SettingsScreen from '../screens/user/settings/SettingsScreen';
import SecuritySettingsScreen from '../screens/user/settings/SecuritySettingsScreen';
import HelpCenterScreen from '../screens/user/settings/HelpCenterScreen';
import TransactionHistoryScreen from '../screens/user/wallet/TransactionHistoryScreen';
import InvitationsScreen from '../screens/chama/chamamember/InvitationsScreen';
import ContactSupportScreen from '../screens/user/support/ContactSupportScreen';
import ChangePasswordScreen from '../screens/security/ChangePasswordScreen';
import LoginHistoryScreen from '../screens/security/LoginHistoryScreen';
import AdminSupportScreen from '../screens/admin/support/AdminSupportScreen';
import AdminSupportChatScreen from '../screens/admin/support/AdminSupportChatScreen';
import UpdateSupportRequestScreen from '../screens/admin/support/UpdateSupportRequestScreen';
import ReminderScreen from '../screens/user/reminders/ReminderScreen';
import NotificationToneScreen from '../screens/user/settings/NotificationToneScreen';

const Tab = createBottomTabNavigator();

/**
 * Chama Tab Bar Component
 * Custom footer for chama dashboard with shortcut navigation
 * Styled to match UserTabBar design
 */
function ChamaTabBar({ state, descriptors, navigation }) {
  const { theme, switchToUserDashboard, selectedChama } = useApp();
  const colors = getThemeColors(theme);

  // Smart shortcuts for chama dashboard - exactly 6 icons
  const quickShortcuts = [
    { name: 'Home', label: 'Home', icon: 'home', onPress: () => navigation.navigate('Home') },
    { name: 'Members', label: 'Members', icon: 'people', onPress: () => navigation.navigate('ChamaMembersScreen') },
    { name: 'Contribute', label: 'Contribute', icon: 'wallet', onPress: () => navigation.navigate('ContributeScreen') },
    { name: 'Contributions', label: 'Contributions', icon: 'heart', onPress: () => navigation.navigate('ContributionsScreen') },
    { name: 'Loans', label: 'Loans', icon: 'card', onPress: () => navigation.navigate('ChamaLoansScreen') },
    { name: 'Exit', label: 'Exit', icon: 'exit', onPress: () => switchToUserDashboard() },
  ];

  // Determine current active tab based on navigation state
  const getCurrentIndex = () => {
    if (!state?.routes) return 0;
    const currentRoute = state.routes[state.index];
    const shortcutIndex = quickShortcuts.findIndex(shortcut =>
      shortcut.name === currentRoute.name ||
      (shortcut.name === 'Home' && currentRoute.name === 'Home') ||
      (shortcut.name === 'Members' && currentRoute.name === 'ChamaMembersScreen') ||
      (shortcut.name === 'Contribute' && currentRoute.name === 'ContributeScreen') ||
      (shortcut.name === 'Contributions' && currentRoute.name === 'ContributionsScreen') ||
      (shortcut.name === 'Loans' && currentRoute.name === 'ChamaLoansScreen')
    );
    return shortcutIndex >= 0 ? shortcutIndex : 0;
  };

  const currentIndex = getCurrentIndex();

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {/* Smart Footer Icons - Always show exactly 6 */}
      {quickShortcuts.map((item, index) => {
        const isExit = item.name === 'Exit';
        const isFocused = currentIndex === index;
        const iconColor = isExit ? colors.error : (isFocused ? colors.primary : colors.textSecondary);

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
              isExit && { backgroundColor: colors.error + '20' } // Special red background for Exit
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
 * Chama Tab Navigator
 * Main tab navigator for chama dashboard with all chama screens
 */
function ChamaTabNavigator({ route }) {
  const { chamaId, chamaName, chama } = route?.params || {};

  return (
    <ChamaProvider chamaId={chamaId} chama={chama}>
      <Tab.Navigator
      tabBar={(props) => <ChamaTabBar {...props} />}
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: ({ options }) => {
          // Import SmartHeader here to avoid circular imports
          const SmartHeader = require('../components/common/SmartHeader').default;

          // Determine if back button should be shown based on navigation state
          const canGoBack = navigation.canGoBack();
          const isChamaTabScreen = ['Home', 'ChamaMembersScreen', 'ContributeScreen', 'ChamaLoansScreen', 'ChamaMeetingsScreen', 'ContributionsScreen', 'Chat'].includes(route.name);

          // Get navigation state for more intelligent back button logic
          const state = navigation.getState();
          const routeHistory = state?.routes || [];
          const hasNavigationHistory = routeHistory.length > 1;

          // Only show back button if we can actually go back
          // Don't show it just because it's not a tab screen - that leads to confusing UX
          const shouldShowBackButton = canGoBack && hasNavigationHistory;

          // Enhanced header with profile pic, home icon, notification bell, and smart navigation
          return (
            <SmartHeader
              title={options.title || route.name}
              showBackButton={shouldShowBackButton}
              showHomeButton={true}
              showProfilePic={true}
              showNotificationBell={true}
              onHomePress={() => navigation.navigate('Home')} // Chama-specific home
            />
          );
        },
      })}
    >
      {/* Main Visible Tabs */}
      <Tab.Screen
        name="Home"
        component={ChamaDashboard}
        options={{
          title: 'Chama Dashboard',
          tabBarLabel: 'Home',
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ChamaMembersScreen"
        component={ChamaMembersScreen}
        options={{
          title: 'Chama Members',
          tabBarLabel: 'Members',
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ContributeScreen"
        component={ContributeScreen}
        options={{
          title: 'Contribute',
          tabBarLabel: 'Contribute',
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ChamaLoansScreen"
        component={ChamaLoansScreen}
        options={{
          title: 'Chama Loans',
          tabBarLabel: 'Loans',
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ChamaMeetingsScreen"
        component={ChamaMeetingsScreen}
        options={{
          title: 'Meetings',
          tabBarLabel: 'Meetings',
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ContributionsScreen"
        component={WelfareScreen}
        options={{
          title: 'Contributions',
          tabBarLabel: 'Contributions',
        }}
        initialParams={{ chamaId, chamaName, chama, defaultTab: 'contributions' }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: 'Messages',
          tabBarLabel: 'Chat',
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />

      {/* Hidden Tab Screens - These have footer but don't show in tab bar */}
      <Tab.Screen
        name="ChamaTransactionsScreen"
        component={ChamaTransactionsScreen}
        options={{
          title: 'Transactions',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="MerryGoRoundScreen"
        component={MerryGoRoundScreen}
        options={{
          title: 'Merry-Go-Round',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="MerryGoRoundRulesScreen"
        component={MerryGoRoundRulesScreen}
        options={{
          title: 'Merry-Go-Round Rules',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="WelfareScreen"
        component={WelfareScreen}
        options={{
          title: 'Welfare',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ChamaSettings"
        component={ChamaSettings}
        options={{
          title: 'Settings',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="LoanApplication"
        component={LoanApplication}
        options={{
          title: 'Apply for Loan',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="CreateMeeting"
        component={CreateMeeting}
        options={{
          title: 'Create Meeting',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="CreateMerryGoRound"
        component={CreateMerryGoRound}
        options={{
          title: 'Create Merry-Go-Round',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="InviteMembers"
        component={InviteMembers}
        options={{
          title: 'Invite Members',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{
          title: 'Chat Room',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />

      <Tab.Screen
        name="PollsVotingScreen"
        component={PollsVotingScreen}
        options={{
          title: 'Polls & Voting',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="AccountManagementScreen"
        component={AccountManagementScreen}
        options={{
          title: 'Account Management',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="LoanManagement"
        component={LoanManagementScreen}
        options={{
          title: 'Loan Management',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="WelfareDisbursement"
        component={WelfareDisbursementScreen}
        options={{
          title: 'Welfare Disbursement',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="LoanTypeCreation"
        component={LoanTypeCreationScreen}
        options={{
          title: 'Loan Type Creation',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="SavingsWithdrawal"
        component={SavingsWithdrawalScreen}
        options={{
          title: 'Savings Withdrawal',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="MaryGoRoundDisbursement"
        component={MaryGoRoundDisbursementScreen}
        options={{
          title: 'Merry Go Round Disbursement',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="SavingsDetails"
        component={SavingsDetails}
        options={{
          title: 'Savings Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="MaryGoRoundDetails"
        component={MaryGoRoundDetails}
        options={{
          title: 'Merry Go Round Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="WelfareDetails"
        component={WelfareDetails}
        options={{
          title: 'Welfare Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="WelfareContributions"
        component={WelfareContributionsScreen}
        options={{
          title: 'Welfare Contributions',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="LoanDetails"
        component={LoanDetails}
        options={{
          title: 'Loan Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ViewMember"
        component={ViewMember}
        options={{
          title: 'Member Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="PhysicalMeeting"
        component={PhysicalMeetingScreen}
        options={{
          title: 'Physical Meeting',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="OnlineMeeting"
        component={JitsiMeetScreen}
        options={{
          title: 'Online Meeting',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="MeetingSummary"
        component={MeetingSummaryScreen}
        options={{
          title: 'Meeting Summary',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />

      {/* Notifications Screen */}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />

      {/* Profile Screen */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />

      {/* Additional Screens for Cross-Navigator Access */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="SecuritySettings"
        component={SecuritySettingsScreen}
        options={{
          title: 'Security Settings',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="HelpCenter"
        component={HelpCenterScreen}
        options={{
          title: 'Help Center',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{
          title: 'Transaction History',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="Invitations"
        component={InvitationsScreen}
        options={{
          title: 'Invitations',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ContactSupport"
        component={ContactSupportScreen}
        options={{
          title: 'Contact Support',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          title: 'Change Password',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="LoginHistory"
        component={LoginHistoryScreen}
        options={{
          title: 'Login History',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="AdminSupport"
        component={AdminSupportScreen}
        options={{
          title: 'Support Management',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="AdminSupportChat"
        component={AdminSupportChatScreen}
        options={{
          title: 'Support Chat',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      <Tab.Screen
        name="UpdateSupportRequest"
        component={UpdateSupportRequestScreen}
        options={{
          title: 'Update Request',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />

      {/* Reminders Screen */}
      <Tab.Screen
        name="Reminders"
        component={ReminderScreen}
        options={{
          title: 'Reminders',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />

      {/* Notification Tone Screen */}
      <Tab.Screen
        name="NotificationTone"
        component={NotificationToneScreen}
        options={{
          title: 'Notification Tones',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ chamaId, chamaName, chama }}
      />
    </Tab.Navigator>
    </ChamaProvider>
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

export default ChamaTabNavigator;
