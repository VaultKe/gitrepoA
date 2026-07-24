import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Text,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing } from '../../utils/theme';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import ThemeToggle from '../common/ThemeToggle';

const { width } = Dimensions.get('window');

export default function AdminLayout({
  children,
  currentPage = 'home',
  navigation,
  activeRoute = 'dashboard',
  onRouteChange,
  title,
  showBackButton = false,
  onBackPress,
  rightComponent
}) {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const colors = getThemeColors(theme);
  const nav = navigation || useNavigation();
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const sidebarItems = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: 'home',
      route: 'AdminHomepage',
      description: 'Admin overview and quick actions'
    },
    {
      id: 'users',
      title: 'User Management',
      icon: 'people',
      route: 'UserManagement',
      description: 'Manage users and permissions'
    },
    {
      id: 'chamas',
      title: 'Chama Management',
      icon: 'business',
      route: 'ChamaManagement',
      description: 'Oversee all chamas'
    },
    {
      id: 'analytics',
      title: 'System Analytics',
      icon: 'analytics',
      route: 'SystemAnalytics',
      description: 'Performance and usage analytics'
    },
    {
      id: 'security',
      title: 'Security Center',
      icon: 'shield-checkmark',
      route: 'SecurityCenter',
      description: 'Security monitoring and controls'
    },
    {
      id: 'payments',
      title: 'Payment System',
      icon: 'card',
      route: 'PaymentSystem',
      description: 'Payment configuration and monitoring'
    },
    {
      id: 'backup',
      title: 'Backup & Maintenance',
      icon: 'server',
      route: 'BackupMaintenance',
      description: 'System backup and maintenance'
    },
    {
      id: 'settings',
      title: 'Admin Settings',
      icon: 'settings',
      route: 'AdminSettings',
      description: 'Administrative configuration'
    },
  ];

  // Bottom navigation items (main admin pages)
  const bottomNavItems = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: 'home',
      iconFocused: 'home',
    },
    {
      id: 'users',
      title: 'Users',
      icon: 'people-outline',
      iconFocused: 'people',
    },
    {
      id: 'chamas',
      title: 'Chamas',
      icon: 'business-outline',
      iconFocused: 'business',
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: 'analytics-outline',
      iconFocused: 'analytics',
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings-outline',
      iconFocused: 'settings',
    },
  ];

  const handleSidebarItemPress = (item) => {
    setSidebarVisible(false);
    if (onRouteChange) {
      onRouteChange(item.id, item.route);
    } else {
      console.log('No onRouteChange handler provided for sidebar navigation');
    }
  };

  const handleBottomNavPress = (item) => {
    if (onRouteChange) {
      onRouteChange(item.id, item.title);
    } else {
      console.log('No onRouteChange handler provided for admin navigation');
    }
  };

  const renderBottomNavItem = (item) => {
    const isActive = activeRoute === item.id;
    const iconName = isActive ? item.iconFocused : item.icon;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.bottomNavItem}
        onPress={() => handleBottomNavPress(item)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={iconName}
          size={24}
          color={isActive ? colors.primary : colors.textTertiary}
        />
        <Text
          style={[
            styles.bottomNavText,
            {
              color: isActive ? colors.primary : colors.textTertiary,
              fontWeight: isActive ? '600' : '400',
            },
          ]}
        >
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Admin Header */}
      <View style={[styles.adminHeader, { backgroundColor: colors.surface }]}>
        {showBackButton ? (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={onBackPress}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setSidebarVisible(true)}
          >
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
          {title || 'Admin Dashboard'}
        </Text>
        <View style={styles.headerSpacer} />
        <ThemeToggle size={22} style={styles.themeToggle} />
        {rightComponent && (
          <View style={styles.rightComponent}>
            {rightComponent}
          </View>
        )}
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: colors.surface, height: 70 + insets.bottom, paddingBottom: spacing.sm + insets.bottom }]}>
        {bottomNavItems.map(renderBottomNavItem)}
      </View>

      {/* Sidebar Modal */}
      <Modal
        visible={sidebarVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSidebarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
          <View style={[styles.sidebarContainer, { backgroundColor: colors.surface }]}>
            <AdminSidebar
              items={sidebarItems}
              currentPage={currentPage}
              onItemPress={handleSidebarItemPress}
              onClose={() => setSidebarVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarContainer: {
    width: width * 0.8,
    maxWidth: 320,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  bottomNavText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    minWidth: 0,
  },
  headerSpacer: {
    flex: 1,
  },
  themeToggle: {
    marginRight: 8,
  },
  rightComponent: {
    marginLeft: 8,
  },
});
