import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useLightningData, useOptimisticUpdate } from '../../../hooks/useLightningData';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import { getTimeAgo } from '../../../utils/dateUtils';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';
import notificationService from '../../../services/notificationService';
import Toast from 'react-native-toast-message';
import NotificationCard from './NotificationCard';
import NotificationHeader from './NotificationHeader';
import PageRefreshButton from '../../../components/common/PageRefreshButton';

const { width: screenWidth } = Dimensions.get('window');

const NotificationsScreen = ({ navigation }) => {
  const { theme, notifications: contextNotifications, loadLocalData } = useApp();
  const colors = getThemeColors(theme);

  const smartNavigate = useCallback((screenName) => {
    try {
      navigation.navigate(screenName);
      return true;
    } catch {
      try {
        const parent = navigation.getParent();
        if (parent) {
          parent.navigate(screenName);
          return true;
        }
      } catch {}
      try {
        navigation.navigate('UserTabs', { screen: screenName });
        return true;
      } catch {}
      console.error(`SMART NAV: All navigation attempts failed for ${screenName}`);
      return false;
    }
  }, [navigation]);

  const {
    data: notifications,
    loading,
    refresh: refreshNotifications,
  } = useLightningData('notifications');

  const {
    data: unreadCount,
    refresh: refreshUnreadCount,
  } = useLightningData('unread-count');

  const { markNotificationAsRead, deleteNotification, markAllNotificationsAsRead } = useOptimisticUpdate();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [invitationsCount, setInvitationsCount] = useState(0);
  const [pendingReadIds, setPendingReadIds] = useState(new Set());
  const [deletedNotificationIds, setDeletedNotificationIds] = useState(() => new Set());

  const baseNotifications = notifications || contextNotifications || [];

  const displayNotifications = useMemo(() => {
    return baseNotifications
      .filter(n => !deletedNotificationIds.has(n.id))
      .map(n => {
        const hasReadFlag = n.isRead === true || n.is_read === true;
        const isPendingRead = pendingReadIds.has(n.id);
        return { ...n, isRead: isPendingRead ? true : hasReadFlag };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [baseNotifications, deletedNotificationIds, pendingReadIds]);

  const filterCounts = useMemo(() => {
    const all = displayNotifications.length;
    const unread = displayNotifications.filter(n => !n.isRead).length;
    const chama = displayNotifications.filter(n => n.type === 'chama' || n.type === 'chama_invitation' || n.type === 'member_joined').length;
    const financial = displayNotifications.filter(n => n.type === 'financial' || n.type.includes('contribution') || n.type.includes('loan') || n.type.includes('welfare') || n.type === 'guarantor_request').length;
    const support = displayNotifications.filter(n => n.type === 'support_update' || n.type === 'new_support_request').length;
    const system = displayNotifications.filter(n => n.type === 'system').length;
    return { all, unread, chama, financial, support, system };
  }, [displayNotifications]);

  const filters = [
    { id: 'all', name: 'All', count: filterCounts.all },
    { id: 'unread', name: 'Unread', count: filterCounts.unread },
    { id: 'chama', name: 'Chama', count: filterCounts.chama },
    { id: 'financial', name: 'Financial', count: filterCounts.financial },
    { id: 'support', name: 'Support', count: filterCounts.support },
    { id: 'system', name: 'System', count: filterCounts.system },
  ];

  // Force a fresh API load on mount so stale persistent cache cannot
  // show outdated read status after an app reload.
  useEffect(() => {
    refreshNotifications().catch(() => {});
  }, [refreshNotifications]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        try {
          await Promise.all([refreshNotifications(), refreshUnreadCount()]);
        } catch (error) {
          console.error('Focus refresh failed:', error);
        }
      };
      refreshData();
    }, [refreshNotifications, refreshUnreadCount])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setDeletedNotificationIds(new Set());
    setPendingReadIds(new Set());
    try {
      await Promise.all([refreshNotifications(), refreshUnreadCount()]);
    } catch (error) {
      console.error('Pull refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshNotifications, refreshUnreadCount]);

  const onMarkAsRead = useCallback(async (notificationId) => {
    setPendingReadIds(prev => new Set([...prev, notificationId]));
    try {
      await markNotificationAsRead(notificationId);
    } catch (error) {
      setPendingReadIds(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Could not mark notification as read.', position: 'bottom', visibilityTime: 3000 });
      return;
    }
    refreshNotifications().catch(() => {});
  }, [markNotificationAsRead, refreshNotifications]);

  const markAllAsRead = useCallback(async () => {
    const unreadNotifications = displayNotifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) return;

    setPendingReadIds(prev => {
      const next = new Set(prev);
      unreadNotifications.forEach(n => next.add(n.id));
      return next;
    });

    try {
      await markAllNotificationsAsRead();
    } catch (error) {
      setPendingReadIds(prev => {
        const next = new Set(prev);
        unreadNotifications.forEach(n => next.delete(n.id));
        return next;
      });
      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Could not mark all notifications as read.', position: 'bottom', visibilityTime: 3000 });
      return;
    }

    refreshNotifications().catch(() => {});
  }, [displayNotifications, markAllNotificationsAsRead, refreshNotifications]);

  const onDelete = useCallback(async (notificationId) => {
    setDeletedNotificationIds(prev => new Set([...prev, notificationId]));
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      setDeletedNotificationIds(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
      Toast.show({ type: 'error', text1: 'Delete Failed', text2: 'Could not delete the notification.', position: 'bottom', visibilityTime: 3000 });
    }
  }, [deleteNotification]);

  const loadInvitationsCount = useCallback(async () => {
    try {
      const response = await ApiService.getUserInvitations();
      if (response.success) {
        setInvitationsCount(response.count || 0);
      }
    } catch (error) {
      setInvitationsCount(0);
    }
  }, []);

  useEffect(() => {
    loadInvitationsCount();
    notificationService.initialize().catch(() => {});
  }, [loadInvitationsCount]);

  const getFilteredNotifications = useCallback(() => {
    let filtered = displayNotifications;
    switch (selectedFilter) {
      case 'unread':
        filtered = displayNotifications.filter(n => !n.isRead);
        break;
      case 'chama':
        filtered = displayNotifications.filter(n => n.type === 'chama' || n.type === 'chama_invitation' || n.type === 'member_joined');
        break;
      case 'financial':
        filtered = displayNotifications.filter(n => n.type === 'financial' || n.type.includes('contribution') || n.type.includes('loan') || n.type.includes('welfare') || n.type === 'guarantor_request');
        break;
      case 'system':
        filtered = displayNotifications.filter(n => n.type === 'system');
        break;
      case 'support':
        filtered = displayNotifications.filter(n => n.type === 'support_update' || n.type === 'new_support_request');
        break;
    }
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [displayNotifications, selectedFilter]);

  const renderHeader = () => (
    <NotificationHeader
      colors={colors}
      screenWidth={screenWidth}
      filters={filters}
      selectedFilter={selectedFilter}
      setSelectedFilter={setSelectedFilter}
      invitationsCount={invitationsCount}
      smartNavigate={smartNavigate}
      displayNotifications={displayNotifications}
      markAllAsRead={markAllAsRead}
    />
  );

  const renderNotification = useCallback(({ item }) => {
    return (
      <NotificationCard
        item={item}
        colors={colors}
        screenWidth={screenWidth}
        onMarkAsRead={onMarkAsRead}
        onDelete={onDelete}
        smartNavigate={smartNavigate}
      />
    );
  }, [colors, screenWidth, onMarkAsRead, onDelete, smartNavigate]);

  const filteredNotifications = getFilteredNotifications();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        {renderHeader()}

        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.notificationsList,
            filteredNotifications.length === 0 && styles.emptyListContainer
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={!loading && (
            <View style={styles.emptyState}>
              <Ionicons
                name={selectedFilter === 'unread' ? 'checkmark-circle-outline' : 'notifications-outline'}
                size={64}
                color={colors.textTertiary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {selectedFilter === 'unread' ? 'All caught up!' : 'No notifications'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {selectedFilter === 'unread'
                  ? 'You have no unread notifications'
                  : 'You\'ll see notifications here when they arrive'}
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
        />

        <PageRefreshButton
          onRefresh={onRefresh}
          refreshing={refreshing}
          color={colors.primary}
          bottom={64}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  notificationsList: { padding: spacing.md, paddingBottom: spacing.xl },
  emptyListContainer: { flexGrow: 1, justifyContent: 'center', minHeight: 500 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg, minHeight: 400 },
  emptyTitle: { fontSize: screenWidth < 350 ? 24 : 28, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.lg, textAlign: 'center', letterSpacing: 0.5 },
  emptySubtitle: { fontSize: screenWidth < 350 ? 16 : 18, textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.sm, marginTop: spacing.md, opacity: 0.8 },
});

export default NotificationsScreen;
