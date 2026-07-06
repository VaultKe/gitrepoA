import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

/**
 * User Dashboard Tab Bar
 * Reusable footer component for user dashboard screens
 * Shows shortcut icons for quick navigation
 */
const UserTabBar = ({ state, descriptors, navigation: navProp }) => {
  const { theme, switchToAdminDashboard, switchToChamaDashboard, user } = useApp();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const userRole = user?.role || 'user';

  // Use passed navigation or hook navigation
  const nav = navProp || navigation;

  // Safety check for navigation
  if (!nav) {
    console.warn('⚠️ UserTabBar: No navigation available');
    return null;
  }

  // Get icon for each tab
  const getTabIcon = (routeName) => {
    switch (routeName) {
      case 'Home':
        return 'home';
      case 'Learn':
        return 'school';
      case 'Meetings':
        return 'calendar';
      case 'History':
        return 'time';
      case 'Chat':
        return 'chatbubbles';
      case 'AIAssistant':
        return 'sparkles';
      case 'AI Assistant':
        return 'sparkles';
      case 'Wallet':
        return 'wallet';
      case 'Profile':
        return 'person';
      case 'Settings':
        return 'settings';
      case 'Notifications':
        return 'notifications';
      case 'MyChamas':
        return 'people';
      case 'ChamaList':
        return 'list';
      case 'Admin':
        return 'shield-checkmark';
      default:
        return 'ellipse';
    }
  };

  // Quick action shortcuts for user dashboard - exactly 4 items
  const quickShortcuts = [
    {
      name: 'Home',
      label: 'Home',
      onPress: () => {
        try {
          nav.navigate('UserTabs', { screen: 'Home' });
        } catch (error) {
          nav.navigate('UserTabs');
        }
      },
    },
    {
      name: 'Wallet',
      label: 'Wallet',
      onPress: () => nav.navigate('Wallet'),
    },
    {
      name: 'Meetings',
      label: 'Meeting',
      onPress: () => nav.navigate('Meetings'),
    },
    {
      name: 'AI Assistant',
      label: 'AI',
      onPress: () => nav.navigate('AIAssistant'),
    },
    {
      name: 'Admin',
      label: 'Admin',
      onPress: () => {
        if (userRole === 'admin' || userRole === 'super_admin') {
          switchToAdminDashboard();
        } else {
        }
      },
    },
  ];

  // Filter shortcuts based on user role - only show admin button to admins
  const items = quickShortcuts.filter(shortcut => {
    if (shortcut.name === 'Admin') {
      return userRole === 'admin' || userRole === 'super_admin';
    }
    return true;
  });

  // Determine current index based on current route
  const getCurrentIndex = () => {
    if (!state?.routes) return 0;
    const currentRoute = state.routes[state.index];
    const shortcutIndex = quickShortcuts.findIndex(shortcut =>
      shortcut.name === currentRoute.name ||
      (shortcut.name === 'Home' && currentRoute.name === 'EnhancedUserDashboard') ||
      (shortcut.name === 'Chat' && currentRoute.name === 'Chat') ||
      (shortcut.name === 'Wallet' && currentRoute.name === 'Wallet') ||
      (shortcut.name === 'Profile' && currentRoute.name === 'Profile')
    );
    return shortcutIndex >= 0 ? shortcutIndex : 0;
  };

  const currentIndex = getCurrentIndex();

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border, height: 70 + insets.bottom, paddingBottom: spacing.sm + insets.bottom }]}>
      {items.map((item, index) => {
        const routeName = item.name;
        const label = item.label || (descriptors?.[item.key]?.options?.tabBarLabel) || routeName;
        const isFocused = currentIndex === index;

        const onPress = () => {
          try {
            // Always use custom onPress from quickShortcuts
            item.onPress();
          } catch (error) {
            console.warn(`⚠️ Navigation error for ${routeName}:`, error);
          }
        };

        const iconName = getTabIcon(routeName);
        const isAdminButton = routeName === 'Admin';
        const showAdminButton = !isAdminButton || (userRole === 'admin' || userRole === 'super_admin');

        // Don't render Admin button if user doesn't have admin access
        if (!showAdminButton) return null;

        return (
          <TouchableOpacity
            key={item.key || routeName}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <View style={[
              styles.tabButton,
              isFocused && { backgroundColor: colors.primary + '20' },
              isAdminButton && { backgroundColor: '#FF6B6B20' } // Special red background for Admin
            ]}>
              <Ionicons
                name={iconName}
                size={20}
                color={
                  isAdminButton
                    ? '#FF6B6B' // Red color for Admin button
                    : (isFocused ? colors.primary : colors.textSecondary)
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isAdminButton
                      ? '#FF6B6B' // Red color for Admin text
                      : (isFocused ? colors.primary : colors.textSecondary),
                  }
                ]}
              >
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

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

export default UserTabBar;
