import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import { useLightningData, useOptimisticUpdate } from './useLightningData';
import ApiService from '../services/api';
import notificationService from '../services/notificationService';
import { READ_KEY, DEL_KEY, loadIdSet, saveIdSet } from '../utils/notificationReadState';

const useNotificationsScreen = ({ navigation }) => {
  const { theme, notifications: contextNotifications, user } = useApp();
  const hasRefreshedOnFocusRef = useRef(false);
  const userId = user?.id;

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

  // Hydrate persisted read / deleted IDs for this user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [read, deleted] = await Promise.all([
        loadIdSet(READ_KEY(userId)),
        loadIdSet(DEL_KEY(userId)),
      ]);
      if (cancelled) return;
      if (read.size) setPendingReadIds(prev => new Set([...prev, ...read]));
      if (deleted.size) setDeletedNotificationIds(prev => new Set([...prev, ...deleted]));
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const persistRead = useCallback((ids) => {
    setPendingReadIds(prev => {
      const next = new Set([...prev, ...ids]);
      saveIdSet(READ_KEY(userId), next);
      return next;
    });
  }, [userId]);

  const persistDeleted = useCallback((id) => {
    setDeletedNotificationIds(prev => {
      const next = new Set([...prev, id]);
      saveIdSet(DEL_KEY(userId), next);
      return next;
    });
  }, [userId]);

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
    // Do NOT clear pendingReadIds / deletedNotificationIds here — they are the
    // device's own record of what the user has read/removed and must outlive a
    // refresh regardless of what the server round-trip returns.
    try {
      await refreshNotifications();
    } catch (error) {
      console.error('Pull refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshNotifications]);

  const onMarkAsRead = useCallback(async (notificationId) => {
    persistRead([notificationId]);
    try {
      await markNotificationAsRead(notificationId);
    } catch (error) {
      // Keep the local read marker even on API failure: the user acted on it,
      // and a later successful sync will confirm it. Surfacing it as unread
      // again is the exact behaviour being complained about.
      Toast.show({ type: 'error', text1: 'Sync pending', text2: 'Marked as read on this device; will sync when possible.', position: 'bottom', visibilityTime: 2500 });
      return;
    }
    refreshNotifications().catch(() => {});
  }, [markNotificationAsRead, refreshNotifications, persistRead]);

  const markAllAsRead = useCallback(async () => {
    const unreadNotifications = displayNotifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) return;

    persistRead(unreadNotifications.map(n => n.id));

    try {
      await markAllNotificationsAsRead();
    } catch (error) {
      // Local read markers are kept (see onMarkAsRead) so the list does not
      // snap back to unread; the write retries on the next mark/refresh.
      Toast.show({ type: 'error', text1: 'Sync pending', text2: 'Marked all as read on this device; will sync when possible.', position: 'bottom', visibilityTime: 2500 });
      return;
    }

    refreshNotifications().catch(() => {});
  }, [displayNotifications, markAllNotificationsAsRead, refreshNotifications, persistRead]);

  const onDelete = useCallback(async (notificationId) => {
    persistDeleted(notificationId);
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Sync pending', text2: 'Removed on this device; will sync when possible.', position: 'bottom', visibilityTime: 2500 });
    }
  }, [deleteNotification, persistDeleted]);

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
