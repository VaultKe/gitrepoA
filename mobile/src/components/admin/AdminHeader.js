import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import ThemeToggle from '../common/ThemeToggle';

export default function AdminHeader({ onMenuPress, currentPage = 'home' }) {
  const { theme, user, setCurrentDashboard } = useApp();
  const colors = getThemeColors(theme);
  const navigation = useNavigation();

  const getPageTitle = () => {
    const titles = {
      home: 'Admin Dashboard',
      users: 'User Management',
      chamas: 'Chama Management',
      analytics: 'System Analytics',
      security: 'Security Center',
      payments: 'Payment System',
      backup: 'Backup & Maintenance',
      settings: 'Admin Settings',
    };
    return titles[currentPage] || 'Admin Dashboard';
  };

  const handleDashboardSwitch = () => {
    Alert.alert(
      'Switch Dashboard',
      'Choose which dashboard to navigate to:',
      [
        {
          text: 'User Dashboard',
          onPress: () => {
            switchToUserDashboard();
          },
        },
        {
          text: 'Chama Dashboard',
          onPress: () => {
            switchToChamaDashboard();
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      <View style={styles.leftSection}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={onMenuPress}
        >
          <Ionicons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {getPageTitle()}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Administrative Control Panel
          </Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <ThemeToggle size={22} style={styles.themeToggle} />

        <TouchableOpacity
          style={[styles.switchButton, { backgroundColor: colors.primary }]}
          onPress={handleDashboardSwitch}
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.background} />
        </TouchableOpacity>

        {/* Admin Profile */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={[styles.profileIcon, { backgroundColor: colors.warning }]}>
            <Ionicons name="person" size={20} color={colors.background} />
          </View>
          <View style={styles.adminBadge}>
            <Text style={[styles.adminBadgeText, { color: colors.background }]}>
              ADMIN
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuButton: {
    padding: 8,
    marginRight: 12,
  },
  titleSection: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 168,
  },
  switchButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  themeToggle: {
    marginRight: 8,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#DA3633',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
  },
  adminBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
});
