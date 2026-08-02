import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../utils/theme';
import SmartBackButton from './SmartBackButton';
import useSmartNavigation from '../../hooks/useSmartNavigation';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import apiService from '../../services/api';

/**
 * Enhanced Smart Header Component
 * Universal header with profile pic, home icon, smart navigation, and centered title
 * Layout: [Home Icon] [Back Button] [Title (Center)] [Notification Bell] [Profile Pic]
 */
const SmartHeader = ({
  title,
  subtitle,
  showBackButton = true,
  showHomeButton = true,
  showProfilePic = true,
  showNotificationBell = true,
  rightComponent,
  leftComponent,
  style,
  titleStyle,
  backgroundColor,
  onBackPress,
  onHomePress,
  onProfilePress,
}) => {
  const { theme, user, getCachedAvatarData } = useApp();
  const insets = useSafeAreaInsets();
  const colors = getThemeColors(theme);
  const { navigateTo, getCurrentContext } = useSmartNavigation();
  const [avatarData, setAvatarData] = useState(null);
  const [avatarError, setAvatarError] = useState(false);

  const headerBackgroundColor = backgroundColor || colors.surface;

  // Resolve avatar URL — handle relative paths like /uploads/avatars/xxx.jpg
  const resolveAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    if (url.startsWith('/')) {
      const base = apiService.uploadBaseUrl || apiService.baseURL || '';
      return `${base}${url}`;
    }
    const base = apiService.uploadBaseUrl || apiService.baseURL || '';
    return `${base}/${url}`;
  };

  // Handle home navigation

  // Handle home navigation
  const handleHomePress = () => {
    if (onHomePress) {
      onHomePress();
    } else {
      // Navigate to user dashboard home
      navigateTo('UserTabs', { screen: 'Home' });
    }
  };

  // Handle profile navigation
  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      // Navigate to user profile/settings
      navigateTo('Profile');
    }
  };

  // Load cached avatar data if user has placeholder URL
  useEffect(() => {
    const loadAvatarData = async () => {
      if (user?.avatar === 'avatar://cached-base64-image') {
        const cachedData = await getCachedAvatarData();
        if (cachedData) {
          setAvatarData(cachedData);
        }
      } else {
        setAvatarData(null);
      }
    };

    loadAvatarData();
  }, [user?.avatar, getCachedAvatarData]);

  // Get user initials for profile pic fallback
  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: headerBackgroundColor, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: headerBackgroundColor }, style]}>
        {/* Left Section: Home Icon + Back Button */}
        <View style={styles.leftSection}>
          {leftComponent || (
            <View style={styles.leftButtons}>
              {/* Smart Back Button */}
              {showBackButton && (
                <SmartBackButton
                  iconColor={colors.text}
                  onPress={onBackPress}
                  style={styles.backButtonSpacing}
                />
              )}
            </View>
          )}
        </View>

        {/* Center Section: Title */}
        <View style={styles.centerSection}>
          <Text style={[styles.title, { color: colors.text }, titleStyle]} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Section: Theme Toggle, Notification Bell & Profile Pic */}
        <View style={styles.rightSection}>
          {rightComponent || (
            <View style={styles.rightComponents}>
              {/* Notification Bell */}
              <ThemeToggle size={22} />

              {showNotificationBell && (
                <NotificationBell
                  navigation={navigateTo}
                  size={24}
                  showBadge={true}
                />
              )}

                  {/* Profile Picture */}
              {showProfilePic && (
                <TouchableOpacity
                  style={styles.profileContainer}
                  onPress={handleProfilePress}
                  activeOpacity={0.8}
                >
                  {(!avatarError && (user?.avatar && user.avatar !== 'avatar://cached-base64-image')) || avatarData ? (
                    <Image
                      source={{ uri: avatarData || resolveAvatarUrl(user.avatar) }}
                      style={[styles.profilePic, { borderColor: colors.primary }]}
                      resizeMode="cover"
                      onError={() => {
                        setAvatarError(true);
                      }}
                    />
                  ) : (
                    <View style={[styles.profilePicFallback, {
                      backgroundColor: colors.primary + '20',
                      borderColor: colors.primary
                    }]}>
                      <Text style={[styles.profileInitials, { color: colors.primary }]}>
                        {getUserInitials()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    zIndex: 1000,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 60,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  leftSection: {
    flex: 0,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftSectionWithTitle: {
    flexDirection: 'row',
  },
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.sm,
  },
  centerSection: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  rightSection: {
    flex: 0,
    minWidth: 152,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rightComponents: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.xs,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    marginRight: spacing.xs,
  },
  backButtonSpacing: {
    marginLeft: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    maxWidth: '100%',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: '100%',
  },
  profileContainer: {
    padding: spacing.xs,
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  profilePicFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
});

export default SmartHeader;
