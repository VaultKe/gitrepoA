import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';

// Import the UserTabBar from UserDashboardStack
import UserTabBar from '../common/UserTabBar';

// Import all screens that should have user dashboard footer
import AIAssistantScreen from '../../screens/ai/AIAssistantScreen';
import ChatScreen from '../../screens/chat/ChatScreen';
import ChatRoomScreen from '../../screens/chat/ChatRoomScreen';
import CreatePrivateChatScreen from '../../screens/chat/CreatePrivateChatScreen';
import CreateGroupChatScreen from '../../screens/chat/CreateGroupChatScreen';
import UserSearchScreen from '../../screens/chat/UserSearchScreen';
import WalletScreen from '../../screens/wallet/WalletScreen';
import DepositScreen from '../../screens/wallet/DepositScreen';
import WithdrawScreen from '../../screens/wallet/WithdrawScreen';
import TransferScreen from '../../screens/wallet/TransferScreen';
import TransactionHistoryScreen from '../../screens/wallet/TransactionHistoryScreen';
import RequestMoneyScreen from '../../screens/wallet/RequestMoneyScreen';
import BuyAirtimeScreen from '../../screens/services/BuyAirtimeScreen';
import PayBillsScreen from '../../screens/services/PayBillsScreen';
import ProfileScreen from '../../screens/ProfileScreen';
import SettingsScreen from '../../screens/settings/SettingsScreen';
import NotificationsScreen from '../../screens/NotificationsScreen';
import MyChamasScreen from '../../screens/chama/MyChamasScreen';
import ChamaListScreen from '../../screens/chama/ChamaListScreen';
import CreateChamaScreen from '../../screens/chama/CreateChamaScreen';

// Marketplace screens removed

const Stack = createStackNavigator();

/**
 * User Layout Provider
 * Wraps screens with user dashboard footer for consistent navigation
 * Used for all screens accessible from user dashboard quick actions
 */
const UserLayoutProvider = ({ children, currentScreen = 'Home' }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  // Create mock navigation state for the footer
  const mockNavigationState = {
    index: 0,
    routes: [{ name: currentScreen, key: currentScreen }],
  };

  const mockDescriptors = {
    [currentScreen]: {
      options: {
        title: currentScreen,
        tabBarLabel: currentScreen,
      },
    },
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Main Content */}
      <View style={styles.content}>
        {children}
      </View>

      {/* User Dashboard Footer */}
      <UserTabBar
        state={mockNavigationState}
        descriptors={mockDescriptors}
        navigation={null} // Will be handled by individual screens
      />
    </View>
  );
};

/**
 * Screen wrapper that adds user dashboard footer
 */
const withUserDashboardFooter = (ScreenComponent, screenName) => {
  return (props) => (
    <UserLayoutProvider currentScreen={screenName}>
      <ScreenComponent {...props} />
    </UserLayoutProvider>
  );
};

/**
 * User Dashboard Stack with Footer
 * Contains all screens that should have the user dashboard footer
 */
const UserDashboardWithFooterStack = () => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        header: ({ route, options }) => {
          // Import SmartHeader here to avoid circular imports
          const SmartHeader = require('../common/SmartHeader').default;
          return (
            <SmartHeader
              title={options.title || route.name}
              showBackButton={true}
            />
          );
        },
      }}
    >
      {/* Core User Screens */}
      <Stack.Screen
        name="AIAssistant"
        component={withUserDashboardFooter(AIAssistantScreen, 'AIAssistant')}
        options={{ title: 'AI Assistant' }}
      />
      <Stack.Screen
        name="Wallet"
        component={withUserDashboardFooter(WalletScreen, 'Wallet')}
        options={{ title: 'My Wallet' }}
      />
      <Stack.Screen
        name="Profile"
        component={withUserDashboardFooter(ProfileScreen, 'Profile')}
        options={{ title: 'My Profile' }}
      />
      <Stack.Screen
        name="Settings"
        component={withUserDashboardFooter(SettingsScreen, 'Settings')}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="Notifications"
        component={withUserDashboardFooter(NotificationsScreen, 'Notifications')}
        options={{ title: 'Notifications' }}
      />

      {/* Chat Screens */}
      <Stack.Screen
        name="Chat"
        component={withUserDashboardFooter(ChatScreen, 'Chat')}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={withUserDashboardFooter(ChatRoomScreen, 'Chat')}
        options={{ title: 'Chat Room' }}
      />
      <Stack.Screen
        name="CreatePrivateChat"
        component={withUserDashboardFooter(CreatePrivateChatScreen, 'Chat')}
        options={{ title: 'New Private Chat' }}
      />
      <Stack.Screen
        name="CreateGroupChat"
        component={withUserDashboardFooter(CreateGroupChatScreen, 'Chat')}
        options={{ title: 'New Group Chat' }}
      />
      <Stack.Screen
        name="UserSearch"
        component={withUserDashboardFooter(UserSearchScreen, 'Chat')}
        options={{ title: 'Search Users' }}
      />

      {/* Wallet Screens */}
      <Stack.Screen
        name="Deposit"
        component={withUserDashboardFooter(DepositScreen, 'Wallet')}
        options={{ title: 'Deposit Money' }}
      />
      <Stack.Screen
        name="Withdraw"
        component={withUserDashboardFooter(WithdrawScreen, 'Wallet')}
        options={{ title: 'Withdraw Money' }}
      />
      <Stack.Screen
        name="Transfer"
        component={withUserDashboardFooter(TransferScreen, 'Wallet')}
        options={{ title: 'Transfer Money' }}
      />
      <Stack.Screen
        name="TransactionHistory"
        component={withUserDashboardFooter(TransactionHistoryScreen, 'Wallet')}
        options={{ title: 'Transaction History' }}
      />
      <Stack.Screen
        name="RequestMoney"
        component={withUserDashboardFooter(RequestMoneyScreen, 'Wallet')}
        options={{ title: 'Request Money' }}
      />

      {/* Service Screens */}
      <Stack.Screen
        name="BuyAirtime"
        component={withUserDashboardFooter(BuyAirtimeScreen, 'Services')}
        options={{ title: 'Buy Airtime' }}
      />
      <Stack.Screen
        name="PayBills"
        component={withUserDashboardFooter(PayBillsScreen, 'Services')}
        options={{ title: 'Pay Bills' }}
      />

      {/* Chama Screens */}
      <Stack.Screen
        name="MyChamas"
        component={withUserDashboardFooter(MyChamasScreen, 'Chamas')}
        options={{ title: 'My Chamas' }}
      />
      <Stack.Screen
        name="ChamaList"
        component={withUserDashboardFooter(ChamaListScreen, 'Chamas')}
        options={{ title: 'Browse Chamas' }}
      />
      <Stack.Screen
        name="CreateChama"
        component={withUserDashboardFooter(CreateChamaScreen, 'Chamas')}
        options={{ title: 'Create New Chama' }}
      />

      {/* Marketplace Screens */}
      <Stack.Screen
        name="AddProduct"
        component={withUserDashboardFooter(AddProductScreen, 'Marketplace')}
        options={{ title: 'Add Product' }}
      />
      <Stack.Screen
        name="ProductDetails"
        component={withUserDashboardFooter(ProductDetailsScreen, 'Marketplace')}
        options={{ title: 'Product Details' }}
      />
      <Stack.Screen
        name="Cart"
        component={withUserDashboardFooter(CartScreen, 'Marketplace')}
        options={{ title: 'Shopping Cart' }}
      />
      <Stack.Screen
        name="Checkout"
        component={withUserDashboardFooter(CheckoutScreen, 'Marketplace')}
        options={{ title: 'Checkout' }}
      />
      <Stack.Screen
        name="Wishlist"
        component={withUserDashboardFooter(WishlistScreen, 'Marketplace')}
        options={{ title: 'My Wishlist' }}
      />
      <Stack.Screen
        name="ManageOrders"
        component={withUserDashboardFooter(ManageOrdersScreen, 'Marketplace')}
        options={{ title: 'Manage Orders' }}
      />
      <Stack.Screen
        name="SellerDashboard"
        component={withUserDashboardFooter(SellerDashboardScreen, 'Marketplace')}
        options={{ title: 'Seller Dashboard' }}
      />
      <Stack.Screen
        name="BuyerDashboard"
        component={withUserDashboardFooter(BuyerDashboardScreen, 'Marketplace')}
        options={{ title: 'Buyer Dashboard' }}
      />

      <Stack.Screen
        name="OrderTracking"
        component={withUserDashboardFooter(OrderTrackingScreen, 'Marketplace')}
        options={{ title: 'Track Order' }}
      />
      <Stack.Screen
        name="DeliveryManagement"
        component={withUserDashboardFooter(DeliveryManagementScreen, 'Marketplace')}
        options={{ title: 'Delivery Management' }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default UserDashboardWithFooterStack;
export { UserLayoutProvider, withUserDashboardFooter };
