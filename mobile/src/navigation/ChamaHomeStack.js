import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmartHeader from '../components/common/SmartHeader';
import { useApp } from '../context/AppContext';
import { getThemeColors } from '../utils/theme';

// Import all chama screens that should participate in Stack back history
import ChamaDashboard from '../screens/chama/dashboard/ChamaDashboard';
import ChamaMembersScreen from '../screens/chama/chamamember/ChamaMembersScreen';
import ContributeScreen from '../screens/chama/contribute/ContributeScreen';
import ChamaLoansScreen from '../screens/chama/loans/ChamaLoansScreen';
import ChamaMeetingsScreen from '../screens/chama/meeting/ChamaMeetingsScreen';
import ChamaTransactionsScreen from '../screens/chama/transactions/ChamaTransactionsScreen';
import MerryGoRoundScreen from '../screens/chama/merry-go-round/MerryGoRoundScreen';
import DocumentViewerScreen from '../screens/common/DocumentViewerScreen';
import MerryGoRoundRulesScreen from '../screens/chama/merry-go-round/MerryGoRoundRulesScreen';
import WelfareScreen from '../screens/chama/welfare/WelfareScreen';
import ChamaSettings from '../screens/chama/settings/ChamaSettings';
import ApplyForLoanScreen from '../screens/chama/loans/ApplyForLoanScreen';
import CreateMeeting from '../screens/chama/meeting/CreateMeeting';
import CreateMerryGoRound from '../screens/chama/merry-go-round/CreateMerryGoRound';
import InviteMembers from '../screens/chama/meeting/InviteMembers';
import PollsVotingScreen from '../screens/chama/pollsandvoting/PollsVotingScreen';
import AccountManagementScreen from '../screens/chama/accountmanagement/AccountManagementScreen';
import SubscriptionManagementScreen from '../screens/chama/accountmanagement/SubscriptionManagementScreen';
import LoanManagementScreen from '../screens/chama/loans/LoanManagementScreen';
import WelfareDisbursementScreen from '../screens/chama/accountmanagement/WelfareDisbursementScreen';
import LoanTypeCreationScreen from '../screens/chama/accountmanagement/LoanTypeCreationScreen';
import SavingsWithdrawalScreen from '../screens/chama/accountmanagement/SavingsWithdrawalScreen';
import MaryGoRoundDisbursementScreen from '../screens/chama/accountmanagement/MaryGoRoundDisbursementScreen';
import SavingsOverviewScreen from '../screens/chama/savings/SavingsOverviewScreen';
import SavingsDetails from '../screens/chama/savings/SavingsDetails';
import SharesScreen from '../screens/chama/accountmanagement/SharesScreen';
import DividendsScreen from '../screens/chama/accountmanagement/DividendsScreen';
import SharesManagementScreen from '../screens/chama/accountmanagement/SharesManagementScreen';
import DividendsManagementScreen from '../screens/chama/accountmanagement/DividendsManagementScreen';
import MaryGoRoundDetails from '../screens/chama/merry-go-round/MaryGoRoundDetails';
import WelfareDetails from '../screens/chama/welfare/WelfareDetails';
import LoanDetails from '../screens/chama/loans/LoanDetails';
import ViewMember from '../screens/chama/chamamember/ViewMember';
import PhysicalMeetingScreen from '../screens/chama/meeting/PhysicalMeetingScreen';
import OnlineMeetingScreen from '../screens/chama/meeting/OnlineMeetingScreen';
import MeetingSummaryScreen from '../screens/chama/meeting/MeetingSummaryScreen';
import WelfareContributionsScreen from '../screens/chama/welfare/WelfareContributionsScreen';

// Shared screens (also used by other navigators)
import NotificationsScreen from '../screens/user/notification/NotificationsScreen';
import ProfileScreen from '../screens/user/profile/ProfileScreen';
import SettingsScreen from '../screens/user/settings/SettingsScreen';
import SecuritySettingsScreen from '../screens/user/settings/SecuritySettingsScreen';
import TransactionHistoryScreen from '../screens/user/wallet/TransactionHistoryScreen';
import InvitationsScreen from '../screens/chama/meeting/InvitationsScreen';
import ContactSupportScreen from '../screens/user/support/ContactSupportScreen';
import ChangePasswordScreen from '../screens/security/ChangePasswordScreen';
import LoginHistoryScreen from '../screens/security/LoginHistoryScreen';
import AdminSupportScreen from '../screens/admin/support/AdminSupportScreen';
import AdminSupportChatScreen from '../screens/admin/support/AdminSupportChatScreen';
import UpdateSupportRequestScreen from '../screens/admin/support/UpdateSupportRequestScreen';
import ReminderScreen from '../screens/user/reminders/ReminderScreen';
import NotificationToneScreen from '../screens/user/settings/NotificationToneScreen';
import WhatsAppLinkScreen from '../screens/user/whatsapp/WhatsAppLinkScreen';

import ChatScreen from '../screens/chat/ChatScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';

const Stack = createStackNavigator();

/**
 * ChamaHomeStack
 *
 * A Stack navigator nested inside the ChamaTabBar Home tab.
 * Contains the ChamaDashboard (initial route) and ALL detail screens.
 *
 * By placing detail screens in a Stack (not as Tab routes), we get
 * proper back history:
 *   ChamaDashboard → ChamaMembersScreen → ViewMember → Back → ChamaMembersScreen → Back → ChamaDashboard
 *
 * The ChamaTabBar remains visible because this Stack lives inside the
 * "Home" tab of the ChamaTabNavigator (Tab navigators keep their tabBar
 * visible for all nested screens).
 */
const ChamaHomeStack = ({ route }) => {
  const { chamaId, chamaName, chama } = route?.params || {};

  // Shared screen options: SmartHeader with back button logic
  const screenOptions = ({ route: screenRoute, navigation }) => {
    const canGoBack = navigation.canGoBack();
    const isInitial = screenRoute.name === 'ChamaDashboard';
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

  // All detail screens to register in the Stack.
  // Each receives the chama context via initialParams.
  const detailScreens = [
    // Chama core
    { name: 'ChamaMembersScreen', component: ChamaMembersScreen, title: 'Chama Members' },
    { name: 'ContributeScreen', component: ContributeScreen, title: 'Contribute' },
    { name: 'ChamaLoansScreen', component: ChamaLoansScreen, title: 'Chama Loans' },
    { name: 'ChamaMeetingsScreen', component: ChamaMeetingsScreen, title: 'Meetings' },
    { name: 'ChamaTransactionsScreen', component: ChamaTransactionsScreen, title: 'Transactions' },
    { name: 'MerryGoRoundScreen', component: MerryGoRoundScreen, title: 'Merry-Go-Round' },
    { name: 'MerryGoRoundRulesScreen', component: MerryGoRoundRulesScreen, title: 'Merry-Go-Round Rules' },
    { name: 'WelfareScreen', component: WelfareScreen, title: 'Welfare' },
    { name: 'ContributionsScreen', component: WelfareScreen, title: 'Contributions', extraParams: { defaultTab: 'contributions' } },
    { name: 'ChamaSettings', component: ChamaSettings, title: 'Settings' },
    { name: 'ApplyForLoanScreen', component: ApplyForLoanScreen, title: 'Apply for Loan' },
    { name: 'CreateMeeting', component: CreateMeeting, title: 'Create Meeting' },
    { name: 'CreateMerryGoRound', component: CreateMerryGoRound, title: 'Create Merry-Go-Round' },
    { name: 'InviteMembers', component: InviteMembers, title: 'Invite Members' },
    { name: 'PollsVotingScreen', component: PollsVotingScreen, title: 'Polls & Voting' },
    // Account management
    { name: 'AccountManagementScreen', component: AccountManagementScreen, title: 'Account Management' },
    { name: 'SubscriptionManagementScreen', component: SubscriptionManagementScreen, title: 'Subscriptions' },
    { name: 'LoanManagement', component: LoanManagementScreen, title: 'Loan Management' },
    { name: 'WelfareDisbursement', component: WelfareDisbursementScreen, title: 'Welfare Disbursement' },
    { name: 'LoanTypeCreation', component: LoanTypeCreationScreen, title: 'Loan Type Creation' },
    { name: 'SavingsWithdrawal', component: SavingsWithdrawalScreen, title: 'Savings Withdrawal' },
    { name: 'MaryGoRoundDisbursement', component: MaryGoRoundDisbursementScreen, title: 'MGR Disbursement' },
    // Savings
    { name: 'SavingsOverview', component: SavingsOverviewScreen, title: 'Savings Overview' },
    { name: 'SavingsDetails', component: SavingsDetails, title: 'Savings Details' },
    // Shares & Dividends
    { name: 'SharesScreen', component: SharesScreen, title: 'Shares' },
    { name: 'DividendsScreen', component: DividendsScreen, title: 'Dividends' },
    { name: 'SharesManagement', component: SharesManagementScreen, title: 'Shares Management' },
    { name: 'DividendsManagement', component: DividendsManagementScreen, title: 'Dividends Management' },
    // Details
    { name: 'MaryGoRoundDetails', component: MaryGoRoundDetails, title: 'Merry-Go-Round Details' },
    { name: 'WelfareDetails', component: WelfareDetails, title: 'Welfare Details' },
    { name: 'LoanDetails', component: LoanDetails, title: 'Loan Details' },
    { name: 'ViewMember', component: ViewMember, title: 'Member Details' },
    // Meetings
    { name: 'PhysicalMeeting', component: PhysicalMeetingScreen, title: 'Physical Meeting' },
    { name: 'OnlineMeeting', component: OnlineMeetingScreen, title: 'Online Meeting' },
    { name: 'MeetingSummary', component: MeetingSummaryScreen, title: 'Meeting Summary' },
    { name: 'DocumentViewer', component: DocumentViewerScreen, title: 'View Document' },
    { name: 'WelfareContributions', component: WelfareContributionsScreen, title: 'Welfare Contributions' },
    // Shared screens
    { name: 'Notifications', component: NotificationsScreen, title: 'Notifications' },
    { name: 'Profile', component: ProfileScreen, title: 'My Profile' },
    { name: 'Settings', component: SettingsScreen, title: 'Settings' },
    { name: 'SecuritySettings', component: SecuritySettingsScreen, title: 'Security Settings' },
    { name: 'TransactionHistory', component: TransactionHistoryScreen, title: 'Transaction History' },
    { name: 'Invitations', component: InvitationsScreen, title: 'Invitations' },
    { name: 'ContactSupport', component: ContactSupportScreen, title: 'Contact Support' },
    { name: 'ChangePassword', component: ChangePasswordScreen, title: 'Change Password' },
    { name: 'LoginHistory', component: LoginHistoryScreen, title: 'Login History' },
    { name: 'AdminSupport', component: AdminSupportScreen, title: 'Support Management' },
    { name: 'AdminSupportChat', component: AdminSupportChatScreen, title: 'Support Chat' },
    { name: 'UpdateSupportRequest', component: UpdateSupportRequestScreen, title: 'Update Request' },
    { name: 'Reminders', component: ReminderScreen, title: 'Reminders' },
    { name: 'NotificationTone', component: NotificationToneScreen, title: 'Notification Tones' },
    { name: 'WhatsAppLink', component: WhatsAppLinkScreen, title: 'Link WhatsApp' },
    { name: 'ChatRoom', component: ChatRoomScreen, title: 'Chat Room' },
  ];

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ChamaDashboard"
        component={ChamaDashboard}
        options={{ title: 'Chama Dashboard' }}
        initialParams={{ chamaId, chamaName, chama }}
      />
      {detailScreens.map(({ name, component, title, extraParams }) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          options={{ title }}
          initialParams={{ chamaId, chamaName, chama, ...extraParams }}
        />
      ))}
    </Stack.Navigator>
  );
};

export default ChamaHomeStack;
