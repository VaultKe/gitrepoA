import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import ApiService from '../../services/api';
import ThemeToggle from '../common/ThemeToggle';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75; // 75% of screen width

const ChamaLayout = ({
  children,
  navigation,
  chamaId,
  chamaName,
  activeRoute,
  onRouteChange
}) => {
  const { theme, user } = useApp();
  const insets = useSafeAreaInsets();
  const colors = getThemeColors(theme);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAnimation] = useState(new Animated.Value(0));
  const [chamaFeatures, setChamaFeatures] = useState({
    allowMerryGoRound: true,
    allowWelfare: true,
  });

  const sidebarItems = [
    {
      id: 'overview',
      title: 'Overview',
      icon: 'home',
      route: 'ChamaDashboard',
      description: 'Dashboard overview'
    },
    {
      id: 'members',
      title: 'Members',
      icon: 'people',
      route: 'ChamaMembersScreen',
      description: 'Manage chama members'
    },
    {
      id: 'contributions',
      title: 'Contributions',
      icon: 'wallet',
      route: 'ContributeScreen',
      description: 'Make and view contributions'
    },
    {
      id: 'transactions',
      title: 'Transactions',
      icon: 'receipt',
      route: 'ChamaTransactionsScreen',
      description: 'Transaction history'
    },
    {
      id: 'loans',
      title: 'Loans',
      icon: 'card',
      route: 'ChamaLoansScreen',
      description: 'Loan applications and management'
    },
    {
      id: 'meetings',
      title: 'Meetings',
      icon: 'calendar',
      route: 'ChamaMeetingsScreen',
      description: 'Schedule and join meetings'
    },
    {
      id: 'merry-go-round',
      title: 'Merry-Go-Round',
      icon: 'refresh-circle',
      route: 'MerryGoRoundScreen',
      description: 'Rotating savings groups'
    },
    {
      id: 'welfare',
      title: 'Welfare',
      icon: 'heart',
      route: 'WelfareScreen',
      description: 'Community support and welfare'
    },
    {
      id: 'chat',
      title: 'Group Chat',
      icon: 'chatbubbles',
      route: 'ChatRoom',
      description: 'Group discussions'
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings',
      route: 'ChamaSettings',
      description: 'Chama configuration'
    },
  ];

  // Load chama features on mount
  useEffect(() => {
    const loadChamaFeatures = async () => {
      try {
        if (!chamaId) return;

        const response = await ApiService.makeRequest(`/chamas/${chamaId}`);
        if (response.success && response.data) {
          const chama = response.data;
          setChamaFeatures({
            allowMerryGoRound: chama.permissions?.allowMerryGoRound ?? true,
            allowWelfare: chama.permissions?.allowWelfare ?? true,
          });
        }
      } catch (error) {
        console.error('Failed to load chama features:', error);
        // Keep default features on error
      }
    };

    loadChamaFeatures();
  }, [chamaId]);

  // Filter sidebar items based on feature toggles
  const filteredSidebarItems = sidebarItems.filter(item => {
    switch (item.id) {
      case 'merry-go-round':
        return chamaFeatures.allowMerryGoRound;
      case 'welfare':
        return chamaFeatures.allowWelfare;
      default:
        return true; // Show all other items
    }
  });

  const bottomNavItems = [
    { id: 'overview', icon: 'home', title: 'Home' },
    { id: 'members', icon: 'people', title: 'Members' },
    { id: 'contributions', icon: 'wallet', title: 'Contribute' },
    { id: 'loans', icon: 'card', title: 'Loans' },
    { id: 'meetings', icon: 'calendar', title: 'Meetings' },
  ];

  const handleSidebarItemPress = (item) => {
    setSidebarVisible(false);
    if (onRouteChange) {
      onRouteChange(item.id, item.route);
    } else {
      navigation.navigate(item.route, { chamaId });
    }
  };

  const handleBottomNavPress = (item) => {
    if (onRouteChange) {
      onRouteChange(item.id, sidebarItems.find(s => s.id === item.id)?.route);
    }
  };

  const toggleSearch = () => {
    const toValue = searchVisible ? 0 : 1;
    setSearchVisible(!searchVisible);

    Animated.timing(searchAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();

    if (!searchVisible) {
      setSearchQuery('');
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const renderSidebarItem = (item) => {
    const isActive = activeRoute === item.id;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.sidebarItem,
          {
            backgroundColor: isActive ? colors.primary + '20' : 'transparent',
            borderLeftColor: isActive ? colors.primary : 'transparent',
          }
        ]}
        onPress={() => handleSidebarItemPress(item)}
      >
        <View style={styles.sidebarItemContent}>
          <Ionicons
            name={item.icon}
            size={24}
            color={isActive ? colors.primary : colors.text}
          />
          <View style={styles.sidebarItemText}>
            <Text style={[
              styles.sidebarItemTitle,
              { color: isActive ? colors.primary : colors.text }
            ]}>
              {item.title}
            </Text>
            <Text style={[
              styles.sidebarItemDescription,
              { color: isActive ? colors.primary : colors.textSecondary }
            ]}>
              {item.description}
            </Text>
          </View>
        </View>
        {isActive && (
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const renderBottomNavItem = (item) => {
    const isActive = activeRoute === item.id;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.bottomNavItem}
        onPress={() => handleBottomNavPress(item)}
      >
        <Ionicons
          name={item.icon}
          size={24}
          color={isActive ? colors.primary : colors.textSecondary}
        />
        <Text style={[
          styles.bottomNavText,
          { color: isActive ? colors.primary : colors.textSecondary }
        ]}>
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setSidebarVisible(true)}
        >
          <Ionicons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            try {
              navigation.navigate('UserTabs');
            } catch (error) {
              // Use dashboard switching if available
              const { switchToUserDashboard } = require('../../context/AppContext').useApp();
              if (switchToUserDashboard) {
                switchToUserDashboard();
              }
            }
          }}
          title="Go to Home"
        >
          <Ionicons name="home" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerSpacer} />

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggleSearch}
          >
            <Ionicons
              name={searchVisible ? "close" : "search"}
              size={24}
              color={searchVisible ? colors.primary : colors.text}
            />
          </TouchableOpacity>

          <ThemeToggle size={22} style={styles.themeToggle} />

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.profileInitials, { color: colors.white }]}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Animated Search Bar */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            height: searchAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 60],
            }),
            opacity: searchAnimation,
          },
        ]}
      >
        {searchVisible && (
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search members, transactions, meetings..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus={searchVisible}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      {/* Main Content */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: colors.surface, height: 70 + insets.bottom, paddingBottom: spacing.sm + insets.bottom }]}>
        {bottomNavItems.map(renderBottomNavItem)}
      </View>

      {/* Sidebar Overlay */}
      {sidebarVisible && (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayBackground}
            onPress={() => setSidebarVisible(false)}
          />

          <View style={[styles.sidebar, { backgroundColor: colors.surface }]}>
            {/* Sidebar Header */}
            <View style={[styles.sidebarHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.sidebarHeaderContent}>
                <View style={[styles.chamaAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.chamaInitials, { color: colors.white }]}>
                    {chamaName?.[0] || 'C'}
                  </Text>
                </View>
                <View style={styles.sidebarHeaderText}>
                  <Text style={[styles.sidebarChamaName, { color: colors.text }]}>
                    {chamaName || 'Chama'}
                  </Text>
                  <Text style={[styles.sidebarUserRole, { color: colors.textSecondary }]}>
                    {user?.role || 'Member'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSidebarVisible(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Sidebar Items */}
            <ScrollView style={styles.sidebarContent} showsVerticalScrollIndicator={false}>
              {filteredSidebarItems.map(renderSidebarItem)}
            </ScrollView>

            {/* Sidebar Footer */}
            <View style={[styles.sidebarFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => {
                  setSidebarVisible(false);
                  navigation.navigate('ChamaList');
                }}
              >
                <Ionicons name="list" size={20} color={colors.primary} />
                <Text style={[styles.logoutText, { color: colors.primary, marginLeft: spacing.sm }]}>
                  Browse Chamas
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.logoutButton, { marginTop: spacing.sm }]}
                onPress={() => {
                  setSidebarVisible(false);
                  try {
                    navigation.navigate('UserTabs');
                  } catch (error) {
                    // Use dashboard switching if available
                    const { switchToUserDashboard } = require('../../context/AppContext').useApp();
                    if (switchToUserDashboard) {
                      switchToUserDashboard();
                    }
                  }
                }}
              >
                <Ionicons name="exit" size={20} color={colors.error} />
                <Text style={[styles.logoutText, { color: colors.error, marginLeft: spacing.sm }]}>
                  Exit Chama
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    ...shadows.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    minWidth: 0, // Allow text to shrink
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    maxWidth: '100%',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  headerButton: {
    padding: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  themeToggle: {
    marginRight: spacing.xs,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    ...shadows.sm,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  bottomNavText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    ...shadows.lg,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  sidebarHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chamaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  chamaInitials: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  sidebarHeaderText: {
    flex: 1,
  },
  sidebarChamaName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  sidebarUserRole: {
    fontSize: typography.fontSize.sm,
  },
  closeButton: {
    padding: spacing.sm,
  },
  sidebarContent: {
    flex: 1,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderLeftWidth: 3,
  },
  sidebarItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sidebarItemText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  sidebarItemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  sidebarItemDescription: {
    fontSize: typography.fontSize.sm,
  },
  sidebarFooter: {
    borderTopWidth: 1,
    padding: spacing.lg,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  // Search Styles
  searchContainer: {
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  clearSearchButton: {
    padding: spacing.xs,
  },
});

export default ChamaLayout;
