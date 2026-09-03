import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SmartHeader from '../components/common/SmartHeader';

// User screens that should participate in Stack back history
import EnhancedUserDashboard from '../screens/user/userdashboard/EnhancedUserDashboard';
import ChamaMeetingsScreen from '../screens/chama/meeting/ChamaMeetingsScreen';
import MeetingSummaryScreen from '../screens/chama/meeting/MeetingSummaryScreen';
import PhysicalMeetingScreen from '../screens/chama/meeting/PhysicalMeetingScreen';
import OnlineMeetingScreen from '../screens/chama/meeting/OnlineMeetingScreen';
import DocumentViewerScreen from '../screens/common/DocumentViewerScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import ProfileScreen from '../screens/user/profile/ProfileScreen';
import SettingsScreen from '../screens/user/settings/SettingsScreen';
import NotificationsScreen from '../screens/user/notification/NotificationsScreen';
import WalletScreen from '../screens/user/wallet/WalletScreen';
import DepositScreen from '../screens/user/wallet/DepositScreen';
import WithdrawScreen from '../screens/user/wallet/WithdrawScreen';
import TransactionHistoryScreen from '../screens/user/wallet/TransactionHistoryScreen';
import MyChamasScreen from '../screens/user/chamaandgroups/MyChamasScreen';
import CreateChamaScreen from '../screens/user/chamaandgroups/CreateChamaScreen';
import ChamaDetailsScreen from '../screens/user/chamaandgroups/ChamaDetailsScreen';

const Stack = createStackNavigator();

const screenOptions = ({ route: screenRoute, navigation }) => {
  const canGoBack = navigation.canGoBack();
  const isInitial = screenRoute.name === 'EnhancedUserDashboard';
  const shouldShowBackButton = !isInitial && canGoBack;

  return {
    headerShown: true,
    header: ({ options }) => (
      <SmartHeader
        title={options.title || screenRoute.name}
        showBackButton={shouldShowBackButton}
        showProfilePic={true}
        showNotificationBell={true}
      />
    ),
  };
};

const UserHomeStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="EnhancedUserDashboard"
        component={EnhancedUserDashboard}
        options={{ title: 'Home' }}
      />

      {/* Meetings */}
      <Stack.Screen name="ChamaMeetingsScreen" component={ChamaMeetingsScreen} options={{ title: 'Meetings' }} />
      <Stack.Screen name="MeetingSummary" component={MeetingSummaryScreen} options={{ title: 'Meeting Summary' }} />
      <Stack.Screen name="PhysicalMeeting" component={PhysicalMeetingScreen} options={{ title: 'Physical Meeting' }} />
      <Stack.Screen name="OnlineMeeting" component={OnlineMeetingScreen} options={{ title: 'Online Meeting' }} />

      {/* Shared / Utility screens */}
      <Stack.Screen name="DocumentViewer" component={DocumentViewerScreen} options={{ title: 'View Document' }} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: 'Chat Room' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />

      {/* Wallet */}
      <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'My Wallet' }} />
      <Stack.Screen name="Deposit" component={DepositScreen} options={{ title: 'Deposit Money' }} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} options={{ title: 'Withdraw Money' }} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={{ title: 'Transaction History' }} />

      {/* Chamas */}
      <Stack.Screen name="MyChamas" component={MyChamasScreen} options={{ title: 'My Chamas' }} />
      <Stack.Screen name="CreateChama" component={CreateChamaScreen} options={{ title: 'Create New Chama' }} />
      <Stack.Screen name="ChamaDetails" component={ChamaDetailsScreen} options={{ title: 'Chama Details' }} />
    </Stack.Navigator>
  );
};

export default UserHomeStack;
