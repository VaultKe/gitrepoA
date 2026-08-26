import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ChamaProvider } from '../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius } from '../utils/theme';

// Import ChamaHomeStack (Stack with ChamaDashboard + all detail screens)
import ChamaHomeStack from './ChamaHomeStack';

// Import screens for the Tab navigator (only main visible tabs)
import ChamaDashboard from '../screens/chama/dashboard/ChamaDashboard';
import ChatScreen from '../screens/chat/ChatScreen';

const Tab = createBottomTabNavigator();

/**
 * Chama Tab Bar Component
 * Custom footer for chama dashboard with shortcut navigation
 * Styled to match UserTabBar design
 */
function ChamaTabBar({ state, descriptors, navigation }) {
  const { theme, switchToUserDashboard, selectedChama } = useApp();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();

  // Smart shortcuts for chama dashboard - exactly 6 icons
  const quickShortcuts = [
    { name: 'Home', label: 'Home', icon: 'home', onPress: () => navigation.navigate('Home') },
    { name: 'Members', label: 'Members', icon: 'people', onPress: () => navigation.navigate('Home', { screen: 'ChamaMembersScreen' }) },
    { name: 'Contribute', label: 'Pay', icon: 'wallet', onPress: () => navigation.navigate('Home', { screen: 'ContributeScreen' }) },
    { name: 'Contributions', label: 'Welfare', icon: 'heart', onPress: () => navigation.navigate('Home', { screen: 'ContributionsScreen' }) },
    { name: 'Loans', label: 'Loans', icon: 'card', onPress: () => navigation.navigate('Home', { screen: 'ChamaLoansScreen' }) },
    { name: 'Exit', label: 'Exit', icon: 'exit', onPress: () => switchToUserDashboard('MyChamas') },
  ];

  // Determine current active shortcut based on navigation state
  // Checks both the current tab and any nested Stack route
  const getCurrentIndex = () => {
    if (!state?.routes) return 0;
    const currentRoute = state.routes[state.index];
    const currentRouteName = currentRoute.name;

    // If we're on the Home tab, check the nested Stack for a detail screen
    let nestedRouteName = currentRouteName;
    if (currentRouteName === 'Home' && currentRoute.state?.routes) {
      const nestedIndex = currentRoute.state.index;
      nestedRouteName = currentRoute.state.routes[nestedIndex]?.name || currentRouteName;
    }

    const shortcutIndex = quickShortcuts.findIndex(shortcut =>
      shortcut.name === currentRouteName ||
      (shortcut.name === 'Members' && nestedRouteName === 'ChamaMembersScreen') ||
      (shortcut.name === 'Contribute' && nestedRouteName === 'ContributeScreen') ||
      (shortcut.name === 'Contributions' && nestedRouteName === 'ContributionsScreen') ||
      (shortcut.name === 'Loans' && nestedRouteName === 'ChamaLoansScreen')
    );
    return shortcutIndex >= 0 ? shortcutIndex : 0;
  };

  const currentIndex = getCurrentIndex();

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border, height: 70 + insets.bottom, paddingBottom: spacing.sm + insets.bottom }]}>
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
              isExit && { backgroundColor: colors.error + '20' }
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
 * Main tab navigator for chama dashboard.
 *
 * Uses ChamaHomeStack (a Stack navigator) as the Home tab so that detail
 * screens (Members, Contribute, Loans, etc.) participate in Stack back
 * history — enabling proper goBack() navigation.
 *
 * Only two Tab routes remain: Home (Stack) and Chat.
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

            // Show back button when the current navigator can go back
            const canGoBack = navigation.canGoBack();

            return (
              <SmartHeader
                title={options.title || route.name}
                showBackButton={canGoBack}
                showProfilePic={true}
                showNotificationBell={true}
              />
            );
          },
        })}
      >
        {/* Home tab — uses ChamaHomeStack for proper Stack back history */}
        <Tab.Screen
          name="Home"
          component={ChamaHomeStack}
          options={{
            title: 'Chama Dashboard',
            headerShown: false, // Stack handles its own SmartHeader
          }}
          initialParams={{ chamaId, chamaName, chama }}
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
