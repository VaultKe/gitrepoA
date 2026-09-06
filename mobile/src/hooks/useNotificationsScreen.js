import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import { useLightningData, useOptimisticUpdate } from './useLightningData';
import ApiService from '../services/api';
import notificationService from '../services/notificationService';

const useNotificationsScreen = ({ navigation }) => {
  const { theme, notifications: contextNotifications } = useApp();
  const hasRefreshedOnFocusRef = useRef(false);

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
    const financial = displayNotifications.filter(n => n.type === 'financial' || n.type.includes('contribution') || n.type.includes('loan') || n.type.includes('welfare') || n.type === 'guarantor_request' || n.type === 'referee_request').length;
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

  // Refresh only on subsequent focus events to avoid a redundant forced
  // refresh on initial mount (useLightningData already loads data once).
  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        try {
          await refreshNotifications();
        } catch (error) {
          console.error('Focus refresh failed:', error);
        }
      };

      if (!hasRefreshedOnFocusRef.current) {
        hasRefreshedOnFocusRef.current = true;
        return;
      }

      refreshData();
    }, [refreshNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setDeletedNotificationIds(new Set());
    setPendingReadIds(new Set());
    try {
      await refreshNotifications();
    } catch (error) {
      console.error('Pull refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshNotifications]);

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
        filtered = displayNotifications.filter(n => n.type === 'financial' || n.type.includes('contribution') || n.type.includes('loan') || n.type.includes('welfare') || n.type === 'guarantor_request' || n.type === 'referee_request');
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

  return {
    theme,
    loading,
    refreshing,
    selectedFilter,
    setSelectedFilter,
    invitationsCount,
    displayNotifications,
    filterCounts,
    filters,
    smartNavigate,
    onRefresh,
    onMarkAsRead,
    markAllAsRead,
    onDelete,
    getFilteredNotifications,
    // Unread count is derived from notifications data to avoid a separate
    // /notifications/unread-count request and its in-flight hits.
    unreadCount: filterCounts.unread,
  };
};

export default useNotificationsScreen;
