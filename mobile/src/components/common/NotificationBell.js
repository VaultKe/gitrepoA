import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing } from '../../utils/theme';
import { READ_KEY, DEL_KEY, loadIdSet, countUnread } from '../../utils/notificationReadState';

/**
 * Notification bell + badge.
 *
 * The badge count is derived from the SAME data and the SAME device-local
 * read/deleted state that the notifications screen uses, so the two never
 * disagree. It does NOT play a sound — that is owned solely by AppContext's
 * new-notification detector, so there is exactly one, id-based sound trigger.
 */
const NotificationBell = ({ navigation, size = 24, showBadge = true }) => {
  const { theme, user, notifications, refreshSpecificData } = useApp();
  const colors = getThemeColors(theme);

  const [unreadCount, setUnreadCount] = useState(0);
  const busyRef = useRef(false);

  const recomputeBadge = useCallback(async () => {
    try {
      const list = Array.isArray(notifications) ? notifications : [];
      const [readSet, delSet] = await Promise.all([
        loadIdSet(READ_KEY(user?.id)),
        loadIdSet(DEL_KEY(user?.id)),
      ]);
      setUnreadCount(countUnread(list, readSet, delSet));
    } catch {
      setUnreadCount(0);
    }
  }, [notifications, user?.id]);

  // Keep the badge in sync with context notifications + local read state.
  useEffect(() => { recomputeBadge(); }, [recomputeBadge]);

  // Pull fresh notifications into context on a slow heartbeat and whenever the
  // bell's screen regains focus. AppContext's effect turns any genuinely new
  // one into a single tone.
  const pull = useCallback(async () => {
    if (!user?.id || busyRef.current) return;
    busyRef.current = true;
    try {
      await refreshSpecificData?.('notifications');
    } catch {} finally {
      busyRef.current = false;
      recomputeBadge();
    }
  }, [user?.id, refreshSpecificData, recomputeBadge]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const interval = setInterval(pull, 30000);
    return () => clearInterval(interval);
  }, [user?.id, pull]);

  useFocusEffect(useCallback(() => { pull(); }, [pull]));

  // Handle notification press
  const handlePress = () => {
    setUnreadCount(0);

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
