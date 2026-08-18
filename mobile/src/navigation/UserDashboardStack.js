import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

// User Dashboard Screens
import EnhancedUserDashboard from '../screens/user/userdashboard/EnhancedUserDashboard';
import ChamaMeetingsScreen from '../screens/chama/meeting/ChamaMeetingsScreen';
import MeetingSummaryScreen from '../screens/chama/meeting/MeetingSummaryScreen';
import PhysicalMeetingScreen from '../screens/chama/meeting/PhysicalMeetingScreen';
import OnlineMeetingScreen from '../screens/chama/meeting/OnlineMeetingScreen';

// Other User Screens
import ProfileScreen from '../screens/user/profile/ProfileScreen';
import SettingsScreen from '../screens/user/settings/SettingsScreen';
import SecuritySettingsScreen from '../screens/user/settings/SecuritySettingsScreen';
import NotificationToneScreen from '../screens/user/settings/NotificationToneScreen';
import ContactSupportScreen from '../screens/user/support/ContactSupportScreen';
import HelpCenterScreen from '../screens/user/settings/HelpCenterScreen';
import ChangePasswordScreen from '../screens/security/ChangePasswordScreen';
import LoginHistoryScreen from '../screens/security/LoginHistoryScreen';
import withUserFooter from '../components/common/withUserFooter';
import WhatsAppLinkScreen from '../screens/user/whatsapp/WhatsAppLinkScreen';
import AdminSupportScreen from '../screens/admin/support/AdminSupportScreen';
import AdminSupportChatScreen from '../screens/admin/support/AdminSupportChatScreen';
import UpdateSupportRequestScreen from '../screens/admin/support/UpdateSupportRequestScreen';
import PaymentMethodsScreen from '../screens/user/settings/PaymentMethodsScreen';
import NotificationsScreen from '../screens/user/notification/NotificationsScreen';


// Reminder Screen
import ReminderScreen from '../screens/user/reminders/ReminderScreen';

// Chama Screens
import InvitationsScreen from '../screens/chama/meeting/InvitationsScreen';
import MyChamasScreen from '../screens/user/chamaandgroups/MyChamasScreen';
import CreateChamaScreen from '../screens/user/chamaandgroups/CreateChamaScreen';
import ChamaDetailsScreen from '../screens/user/chamaandgroups/ChamaDetailsScreen';
import ChamaTransactionsScreen from '../screens/chama/transactions/ChamaTransactionsScreen';
import ChamaMembersScreen from '../screens/chama/chamamember/ChamaMembersScreen';
import ViewMember from '../screens/chama/chamamember/ViewMember';
import PollsVotingScreen from '../screens/chama/pollsandvoting/PollsVotingScreen';
import ApplyForLoanScreen from '../screens/chama/loans/ApplyForLoanScreen';
import AIAssistantScreen from '../screens/ai/AIAssistantScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import CreatePrivateChatScreen from '../screens/chat/CreatePrivateChatScreen';
import CreateGroupChatScreen from '../screens/chat/CreateGroupChatScreen';
import UserSearchScreen from '../screens/chat/UserSearchScreen';

// Wallet Screens
import WalletScreen from '../screens/user/wallet/WalletScreen';
import DepositScreen from '../screens/user/wallet/DepositScreen';
import WithdrawScreen from '../screens/user/wallet/WithdrawScreen';
import TransactionHistoryScreen from '../screens/user/wallet/TransactionHistoryScreen';


// Demo Screens

import { useApp } from '../context/AppContext';
import { ChamaProvider } from '../context/ChamaContext';
import { getThemeColors } from '../utils/theme';

// Import the extracted UserTabBar and HOC
import UserTabBar from '../components/common/UserTabBar';


const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// UserTabBar is now imported from components/common/UserTabBar.js

// User Tab Navigator
function UserTabNavigator() {  
  
  return (
    <Tab.Navigator
      tabBar={(props) => <UserTabBar {...props} />}
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: ({ options }) => {
          // Import SmartHeader here to avoid circular imports
          const SmartHeader = require('../components/common/SmartHeader').default;

          // Determine if back button should be shown based on navigation state
          const canGoBack = navigation.canGoBack();
          const isTabScreen = ['Home', 'Meetings', 'History', 'Chat'].includes(route.name);

          // Get navigation state for more intelligent back button logic
          const state = navigation.getState();
          const routeHistory = state?.routes || [];
          const hasNavigationHistory = routeHistory.length > 1;

          // Show back button for non-tab screens OR when we have clear navigation history
          // This ensures users can always navigate back from screens they navigated to
          const shouldShowBackButton = !isTabScreen || (canGoBack && hasNavigationHistory);

          // Enhanced header with profile pic, home icon, notification bell, and smart navigation
          return (
            <SmartHeader
              title={options.title || route.name}
              showBackButton={shouldShowBackButton}
              showHomeButton={true}
              showProfilePic={true}
              showNotificationBell={true}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={EnhancedUserDashboard}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
        }}
      />

      <Tab.Screen
        name="Meetings"
        component={ChamaMeetingsScreen}
        initialParams={{ fromUserDashboard: true }}
        options={{
          title: 'Meetings',
          tabBarLabel: 'Meetings',
        }}
      />
      <Tab.Screen
        name="ChamaMeetingsScreen"
        component={ChamaMeetingsScreen}
        options={{
          title: 'Meetings',
          tabBarButton: () => null, // Hide from tab bar
        }}
        initialParams={{ fromUserDashboard: true }}
      />
      <Tab.Screen
        name="History"
        component={MeetingSummaryScreen}
        initialParams={{ fromUserDashboard: true, showAllMeetings: true }}
        options={{
          title: 'Meeting History',
          tabBarLabel: 'History',
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: 'Messages',
          tabBarLabel: 'Chat',
        }}
      />
      <Tab.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{
          title: 'Chat Room',
          tabBarLabel: 'Room',
        }}
        initialParams={{ roomId: 'default', roomName: 'General Chat', roomType: 'group' }}
      />

      {/* Hidden Tab Screens - These have footer but don't show in tab bar */}
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          title: 'My Wallet',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="AIAssistant"
        component={AIAssistantScreen}
        options={{
          title: 'AI Assistant',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />

      <Tab.Screen
        name="MyChamas"
        component={MyChamasScreen}
        options={{
          title: 'My Chamas',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />

      <Tab.Screen
        name="CreateChama"
        component={CreateChamaScreen}
        options={{
          title: 'Create New Chama',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="ChamaDetails"
        component={ChamaDetailsScreen}
        options={{
          title: 'Chama Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="ChamaTransactionsScreen"
        options={{
          title: 'Transactions',
          tabBarButton: () => null,
        }}
        initialParams={{ fromUserDashboard: true }}
      >
        {(props) => (
          <ChamaProvider chamaId={props.route.params?.chamaId} chama={props.route.params?.chama}>
            <ChamaTransactionsScreen {...props} />
          </ChamaProvider>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="ChamaMembersScreen"
        component={ChamaMembersScreen}
        options={{
          title: 'Chama Members',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="ViewMember"
        component={ViewMember}
        options={{
          title: 'Member Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="PollsVotingScreen"
        component={PollsVotingScreen}
        options={{
          title: 'Polls & Voting',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="ApplyForLoanScreen"
        component={ApplyForLoanScreen}
        options={{
          title: 'Apply for Loan',
          tabBarButton: () => null,
        }}
      />

      {/* Wallet Screens */}
      <Tab.Screen
        name="Deposit"
        component={DepositScreen}
        options={{
          title: 'Deposit Money',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="Withdraw"
        component={WithdrawScreen}
        options={{
          title: 'Withdraw Money',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{
          title: 'Transaction History',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      
      {/* Profile & Settings Screens */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />

      {/* Additional Settings Screens */}
      <Tab.Screen
        name="SecuritySettings"
        component={SecuritySettingsScreen}
        options={{
          title: 'Security Settings',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="NotificationTone"
        component={NotificationToneScreen}
        options={{
          title: 'Notification Tones',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="ContactSupport"
        component={ContactSupportScreen}
        options={{
          title: 'Contact Support',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="HelpCenter"
        component={HelpCenterScreen}
        options={{
          title: 'Help Center',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="PaymentMethods"
        component={PaymentMethodsScreen}
        options={{
          title: 'Payment Methods',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          title: 'Change Password',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="LoginHistory"
        component={LoginHistoryScreen}
        options={{
          title: 'Login History',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="WhatsAppLink"
        component={WhatsAppLinkScreen}
        options={{
          title: 'Link WhatsApp',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="AdminSupport"
        component={AdminSupportScreen}
        options={{
          title: 'Support Management',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="AdminSupportChat"
        component={AdminSupportChatScreen}
        options={{
          title: 'Support Chat',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="UpdateSupportRequest"
        component={UpdateSupportRequestScreen}
        options={{
          title: 'Update Request',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />

           {/* Chama Screens */}
      <Tab.Screen
        name="Invitations"
        component={InvitationsScreen}
        options={{
          title: 'Invitations',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />

      {/* Reminder Screen */}
      <Tab.Screen
        name="Reminders"
        component={ReminderScreen}
        options={{
          title: 'Reminders',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="PhysicalMeeting"
        component={PhysicalMeetingScreen}
        options={{
          title: 'Physical Meeting',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="OnlineMeeting"
        component={OnlineMeetingScreen}
        options={{
          title: 'Online Meeting',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="MeetingSummary"
        component={MeetingSummaryScreen}
        options={{
          title: 'Meeting Summary',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Stack.Screen
        name="UserSearch"
        component={UserSearchScreen}
        options={{ title: 'Search Users' }}
      />

    </Tab.Navigator>
  );
}

// Main User Dashboard Stack
export default function UserDashboardStack({ navigation }) {
  const { currentDashboard, pendingUserRoute, clearPendingUserRoute } = useApp();

  useEffect(() => {
    if (currentDashboard === 'user' && pendingUserRoute) {
      navigation.navigate('UserDashboard', {
        screen: 'UserTabs',
        params: { screen: pendingUserRoute },
      });
      clearPendingUserRoute();
    }
  }, [currentDashboard, pendingUserRoute]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Temporarily disable custom headers to fix "header" text node error
      }}
    >
      <Stack.Screen
        name="UserTabs"
        component={UserTabNavigator}
      />
      
      {/* Chat Sub-screens */}
      <Stack.Screen
        name="ChatRoom"
        component={withUserFooter(ChatRoomScreen)}
        options={{ title: 'Chat Room' }}
      />
      <Stack.Screen
        name="CreatePrivateChat"
        component={withUserFooter(CreatePrivateChatScreen)}
        options={{ title: 'New Private Chat' }}
      />
      <Stack.Screen
        name="CreateGroupChat"
        component={withUserFooter(CreateGroupChatScreen)}
        options={{ title: 'New Group Chat' }}
      />  
      {/* Meeting Summary Screen */}
      <Stack.Screen
        name="MeetingSummary"
        component={withUserFooter(MeetingSummaryScreen)}
        options={{ title: 'Meeting Summary' }}
      />

     
    </Stack.Navigator>
  );
}


