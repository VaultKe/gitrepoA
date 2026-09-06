import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing } from '../../utils/theme';
import ApiService from '../../services/api';
import notificationService from '../../services/notificationService';

/**
 * Real-time Notification Bell Component
 * Shows notification count and handles navigation to notifications screen
 */
const NotificationBell = ({ navigation, size = 24, showBadge = true }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Baseline for the 30s poll — starts null so the first fetch is silent.
  const prevCountRef = useRef(null);

  // Fetch unread notification count
  const fetchUnreadCount = async () => {
    if (!user?.id || loading) return;

    try {
      setLoading(true);
      const response = await ApiService.getUnreadNotificationCount();
      if (response.success && response.data) {
        const count = response.data.count || 0;
        setUnreadCount(count);
        if (prevCountRef.current !== null && count > prevCountRef.current) {
          notificationService.playNotificationSound().catch(() => {});
        }
        prevCountRef.current = count;
      } else {
        console.warn('Invalid response format for notification count:', response);
        setUnreadCount(0);
      }
    } catch (error) {
      console.warn('Failed to fetch notification count:', error.message || error);
      // Don't show error to user, just silently fail and show no badge
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Real-time updates - fetch count on mount and set up interval
  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount();
      
      // Set up real-time polling every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // Handle notification press
  const handlePress = () => {
    // Reset unread count immediately for better UX
    setUnreadCount(0);
    prevCountRef.current = 0;

    // Navigate to notifications screen
    if (navigation) {
      // Check if navigation is a function (from useSmartNavigation)
      if (typeof navigation === 'function') {
        navigation('Notifications');
      } else {
        // Standard navigation object
        navigation.navigate('Notifications');
      }
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { padding: spacing.sm }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name={unreadCount > 0 ? "notifications" : "notifications-outline"} 
          size={size} 
          color={unreadCount > 0 ? colors.primary : colors.text} 
        />
        
        {showBadge && unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={[styles.badgeText, { color: colors.white }]}>
              {unreadCount > 99 ? '99+' : unreadCount.toString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default NotificationBell;
