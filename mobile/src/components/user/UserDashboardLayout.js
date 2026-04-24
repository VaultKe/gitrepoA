import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import UserTabBar from '../common/UserTabBar';

/**
 * User Dashboard Layout Component
 * Provides the user dashboard footer as an overlay while allowing content to scroll freely
 * This mimics the behavior of the tab navigator but for stack screens
 */
const UserDashboardLayout = ({ children, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Main Content - can scroll freely */}
      <View style={[styles.content, { paddingBottom: 70 + insets.bottom }]}>
        {children}
      </View>

      {/* User Dashboard Footer - positioned as overlay */}
      <View style={[styles.footerContainer, { paddingBottom: insets.bottom }]}>
        <UserTabBar
          state={null} // Use shortcut mode
          descriptors={null}
          navigation={navigation}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default UserDashboardLayout;
