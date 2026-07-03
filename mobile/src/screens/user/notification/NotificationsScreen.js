import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

const { width: screenWidth } = Dimensions.get('window');

const NotificationsScreen = ({ navigation }) => {
  const { theme, notifications: contextNotifications, loadLocalData, getCachedData } = useApp();
  const colors = getThemeColors(theme);

  // Smart navigation helper that can handle cross-navigator navigation
  const smartNavigate = (screenName) => {
    try {
      // First, try direct navigation within current navigator
      navigation.navigate(screenName);
      return true;
    } catch (error) {
      try {
        // Try navigating to the parent navigator first, then to the screen
        const parent = navigation.getParent();
        if (parent) {
          parent.navigate(screenName);
          return true;
        }
      } catch (parentError) {
      }

      try {
        // Try navigating through the root navigator
        navigation.navigate('UserTabs', { screen: screenName });
        return true;
      } catch (rootError) {
      }

      console.error(`❌ SMART NAV: All navigation attempts failed for ${screenName}:`, error);
      return false;
    }
  };

  // Lightning data hooks for instant notifications
  const {
    data: notifications,
    loading,
    refresh: refreshNotifications,
    isInstant: notificationsInstant,
  } = useLightningData('notifications');

  const {
    data: unreadCount,
    refresh: refreshUnreadCount,
  } = useLightningData('unread-count');

  // Optimistic updates for notification operations
  const { markNotificationAsRead, deleteNotification, markAllNotificationsAsRead } = useOptimisticUpdate();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  // Removed unused forceUpdate state to avoid unnecessary renders
  const [invitationsCount, setInvitationsCount] = useState(0);

  // Local state for immediate UI updates (optimistic updates)
  const [localNotifications, setLocalNotifications] = useState([]);
  const [deletedNotificationIds, setDeletedNotificationIds] = useState(() => new Set());
  const [hasLocalState, setHasLocalState] = useState(false);

  // Track processed notifications to prevent duplicate tone playback (persisted across renders)
  const processedNotificationIds = useRef(new Set());

  // Debounce mechanism to prevent rapid re-renders
  const [updateTimeout, setUpdateTimeout] = useState(null);

  // Debounced update function to prevent rapid re-renders
  const debouncedUpdate = useCallback((updateFn) => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    const timeout = setTimeout(() => {
      updateFn();
      setUpdateTimeout(null);
    }, 50); // 50ms debounce
    setUpdateTimeout(timeout);
  }, [updateTimeout]);

// Use local notifications if available, otherwise fall back to lightning data
  const baseNotifications = notifications || contextNotifications || [];
  const displayNotifications = hasLocalState ? localNotifications : baseNotifications;

  // Update local notifications when base notifications change (only once, no loop)
  useEffect(() => {
    if (baseNotifications.length > 0 && !hasLocalState) {
      const filteredNotifications = baseNotifications.filter(
        notification => !deletedNotificationIds.has(notification.id)
      );
      setLocalNotifications(filteredNotifications);
      setHasLocalState(true);
    }
  }, [baseNotifications, deletedNotificationIds, hasLocalState]);

  // Detect new notifications and play notification tone automatically
  useEffect(() => {
    if (baseNotifications.length > 0) {
      const currentIds = new Set(baseNotifications.map(n => n.id));
      const trulyNewNotificationIds = [...currentIds].filter(id => !processedNotificationIds.current.has(id));

      if (trulyNewNotificationIds.length > 0) {
        // Play notification tone for new notifications (only if they haven't been read)
        const newUnreadNotifications = baseNotifications.filter(
          n => trulyNewNotificationIds.includes(n.id) && !n.isRead
        );

        if (newUnreadNotifications.length > 0) {
          // Use the notification service to handle sound and vibration (fire and forget)
          notificationService.handleNotificationAlert({
            request: {
              content: {
                title: newUnreadNotifications[0].title,
                body: newUnreadNotifications[0].message,
                data: newUnreadNotifications[0].data || {}
              }
            }
          }).catch(() => {});
        }

        // Mark these notifications as processed to prevent duplicate playback
        trulyNewNotificationIds.forEach(id => processedNotificationIds.current.add(id));
      }
    }
  }, [baseNotifications]);

  // Removed artificial re-render trigger; counts derive from state/memo and will re-render naturally

  // Log when notifications change for debugging
  useEffect(() => {
  }, [notifications, contextNotifications, unreadCount]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Refresh both notifications and unread count when screen comes into focus
      const refreshData = async () => {
        try {
          await Promise.all([
            refreshNotifications(),
            refreshUnreadCount()
          ]);
        } catch (error) {
          console.error('❌ Focus refresh failed:', error);
        }
      };

      refreshData();
    }, [refreshNotifications, refreshUnreadCount])
  );

// Calculate filter counts - memoized to prevent recalculation on every render
  const filterCounts = useMemo(() => {
    const all = displayNotifications.length;
    const unread = displayNotifications.filter(n => !n.isRead).length;
    const chama = displayNotifications.filter(n =>
      n.type === 'chama' || n.type === 'chama_invitation' || n.type === 'member_joined'
    ).length;
    const financial = displayNotifications.filter(n =>
      n.type === 'financial' || n.type.includes('contribution') ||
      n.type.includes('loan') || n.type.includes('welfare') || n.type === 'guarantor_request'
    ).length;
    const support = displayNotifications.filter(n =>
      n.type === 'support_update' || n.type === 'new_support_request'
    ).length;
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

  

    useEffect(() => {
  }, [displayNotifications]);

  useEffect(() => {
    loadNotifications();
    loadInvitationsCount();

    // Initialize notification service for automatic tone playback
    const initializeNotificationService = async () => {
      try {
        const initialized = await notificationService.initialize();
        if (initialized) {
        } else {
          console.warn('⚠️ Notification service initialization failed');
        }
      } catch (error) {
        console.error('❌ Failed to initialize notification service:', error);
      }
    };

    initializeNotificationService();

    // Cleanup on unmount
    return () => {
      // Note: Don't cleanup the notification service here as it might be used elsewhere
      // Clear any pending debounced updates
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
    };
  }, []);

  const loadInvitationsCount = async () => {
    try {
      const response = await ApiService.getUserInvitations();
      if (response.success) {
        setInvitationsCount(response.count || 0);
      }
    } catch (error) {
      setInvitationsCount(0);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await ApiService.getNotifications();
      if (response.success) {
        await loadLocalData();
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      // Reset local state to sync with fresh data
      setLocalNotifications([]);
      setDeletedNotificationIds(new Set());
      setHasLocalState(false);

      // Use lightning data refresh for better performance and consistency
      await Promise.all([
        refreshNotifications(),
        refreshUnreadCount(),
        loadInvitationsCount()
      ]);

      // Natural state updates will re-render; no manual trigger needed

    } catch (error) {
      console.error('❌ PULL REFRESH: Pull-to-refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };



  const markAllAsRead = async () => {
    try {
      // Count unread notifications before marking as read
      const unreadNotifications = displayNotifications.filter(n => !n.isRead);

      // IMMEDIATE UI UPDATE - Mark all notifications as read in local state
      setLocalNotifications(prev =>
        prev.map(notification => ({
          ...notification,
          isRead: true
        }))
      );
      setHasLocalState(true);

      // Use optimistic update for backend sync
      const markAllResult = await markAllNotificationsAsRead();

      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'All Marked as Read',
        text2: `${unreadNotifications.length} notifications marked as read`,
        position: 'bottom',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Mark all as read error:', error);

      // REVERT UI UPDATE on error
      setLocalNotifications(prev =>
        prev.map(notification => ({
          ...notification,
          isRead: false
        }))
      );

      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Could not mark all notifications as read. Please try again.',
        position: 'bottom',
        visibilityTime: 3000,
      });
    }
  };



  const handleNotificationPress = async (notification) => {
    // Handle read status
    if (!notification.isRead) {
      await markNotificationAsRead(notification.id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'chama_invitation':
        // Show invitation response dialog
        showInvitationDialog(notification);
        break;
      case 'guarantor_request':
        // Show guarantor response dialog
        showGuarantorDialog(notification);
        break;
      case 'chama':
        if (notification.data?.chamaId || notification.metadata?.chama_id) {
          navigation.navigate('ChamaDetails', {
            chamaId: notification.data?.chamaId || notification.metadata?.chama_id
          });
        }
        break;
      case 'meeting_scheduled':
      case 'meeting_started':
      case 'meeting_created':
        if (notification.data?.chamaId) {
          navigation.navigate('ChamaMeetings', {
            chamaId: notification.data.chamaId,
            meetingId: notification.data.meetingId
          });
        }
        break;
      case 'loan_application_submitted':
      case 'loan_approved':
      case 'loan_disbursed':
      case 'loan_rejected':
      case 'loan_application_new':
      case 'loan_approved_member':
        if (notification.data?.chamaId) {
          navigation.navigate('ChamaLoans', {
            chamaId: notification.data.chamaId,
            loanId: notification.data.loanId
          });
        }
        break;
      case 'welfare_request_created':
      case 'welfare_approved':
      case 'welfare_rejected':
      case 'welfare_request_new':
      case 'welfare_approved_member':
        if (notification.data?.chamaId) {
          navigation.navigate('ChamaWelfare', {
            chamaId: notification.data.chamaId,
            welfareId: notification.data.welfareId
          });
        }
        break;
      case 'contribution_recorded':
      case 'welfare_contribution_recorded':
      case 'loan_payment_recorded':
      case 'member_contribution':
      case 'member_welfare_contribution':
        if (notification.data?.chamaId) {
          navigation.navigate('ChamaContributions', {
            chamaId: notification.data.chamaId,
            transactionId: notification.data.transactionId
          });
        }
        break;
      case 'member_joined':
        if (notification.data?.chamaId) {
          navigation.navigate('ChamaMembers', {
            chamaId: notification.data.chamaId
          });
        }
        break;
      case 'financial':
        if (notification.metadata?.transaction_id) {
          navigation.navigate('TransactionDetails', { transactionId: notification.metadata.transaction_id });
        } else {
          navigation.navigate('Wallet');
        }
        break;
      case 'loan':
        if (notification.metadata?.loan_id) {
          navigation.navigate('LoanDetails', { loanId: notification.metadata.loan_id });
        }
        break;
      case 'marketplace':
        if (notification.metadata?.order_id) {
          navigation.navigate('OrderTracking', { orderId: notification.metadata.order_id });
        } else {
          navigation.navigate('MainTabs', { screen: 'Marketplace' });
        }
        break;
      case 'support_update':
      case 'new_support_request':
        // Navigate to support screen or show support details
        if (notification.data) {
          try {
            const data = typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data;
            if (data.supportRequestId) {
              // For users, show their support request details
              // For admins, navigate to admin support management
              navigation.navigate('ContactSupport', {
                requestId: data.supportRequestId,
                highlightRequest: true
              });
            }
          } catch (error) {
            console.warn('Failed to parse support notification data:', error);
            navigation.navigate('ContactSupport');
          }
        } else {
          navigation.navigate('ContactSupport');
        }
        break;
      default:
        break;
    }
  };

  const getFilteredNotifications = () => {
    let filtered = displayNotifications;

    switch (selectedFilter) {
      case 'unread':
        filtered = displayNotifications.filter(n => !n.isRead);
        break;
      case 'chama':
        filtered = displayNotifications.filter(n =>
          n.type === 'chama' ||
          n.type === 'chama_invitation' ||
          n.type === 'member_joined'
        );
        break;
      case 'financial':
        filtered = displayNotifications.filter(n =>
          n.type === 'financial' ||
          n.type.includes('contribution') ||
          n.type.includes('loan') ||
          n.type.includes('welfare') ||
          n.type === 'guarantor_request'
        );
        break;
      case 'system':
        filtered = displayNotifications.filter(n => n.type === 'system');
        break;
      case 'support':
        filtered = displayNotifications.filter(n =>
          n.type === 'support_update' ||
          n.type === 'new_support_request'
        );
        break;
      default:
        break;
    }

    return filtered.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  };

  const showInvitationDialog = (notification) => {
    const invitationData = notification.data;
    Alert.alert(
      'Chama Invitation',
      `${invitationData.inviterName} invited you to join ${invitationData.chamaName}\n\nContribution: KES ${invitationData.contributionAmount} ${invitationData.contributionFrequency}\n\n${invitationData.chamaDescription || ''}`,
      [
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => respondToInvitation(invitationData.invitationId, 'reject'),
        },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => respondToInvitation(invitationData.invitationId, 'accept'),
        },
      ]
    );
  };

  const respondToInvitation = async (invitationId, action) => {
    try {
      const endpoint = action === 'accept'
        ? `/notifications/invitations/${invitationId}/accept`
        : `/notifications/invitations/${invitationId}/reject`;

      const response = await ApiService.makeRequest(endpoint, 'POST');

      if (response.success) {
        Alert.alert(
          'Success',
          action === 'accept'
            ? 'You have successfully joined the chama!'
            : 'Invitation rejected successfully',
          [{ text: 'OK', onPress: () => loadLocalData() }]
        );
      } else {
        throw new Error(response.error || 'Failed to respond to invitation');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to respond to invitation');
    }
  };

  const showGuarantorDialog = (notification) => {
    const guarantorData = notification.data ? JSON.parse(notification.data) : {};
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0,
      }).format(amount);
    };

    Alert.alert(
      'Guarantor Request',
      `You have been requested to guarantee a loan of ${formatCurrency(guarantorData.amount)}\n\nPurpose: ${guarantorData.purpose || 'Not specified'}\n\nDo you accept to be a guarantor for this loan?`,
      [
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => showGuarantorReasonDialog(guarantorData.guarantor_id, 'decline'),
        },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => respondToGuarantorRequest(guarantorData.guarantor_id, 'accept'),
        },
      ]
    );
  };

  const showGuarantorReasonDialog = (guarantorId, action) => {
    Alert.prompt(
      'Decline Reason',
      'Please provide a reason for declining (optional):',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Submit',
          onPress: (reason) => respondToGuarantorRequest(guarantorId, action, reason || ''),
        },
      ],
      'plain-text'
    );
  };

  const respondToGuarantorRequest = async (guarantorId, action, reason = '') => {
    try {
      const response = await ApiService.respondToGuarantorRequest(guarantorId, action, reason);

      if (response.success) {
        Alert.alert(
          'Success',
          action === 'accept'
            ? 'You have accepted to be a guarantor for this loan!'
            : 'You have declined the guarantor request',
          [{ text: 'OK', onPress: () => loadLocalData() }]
        );
      } else {
        throw new Error(response.error || 'Failed to respond to guarantor request');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to respond to guarantor request');
    }
  };

  const getNotificationIcon = (type, priority) => {
    switch (type) {
      case 'chama_invitation':
        return 'mail';
      case 'guarantor_request':
        return 'shield-checkmark';
      case 'chama':
      case 'member_joined':
        return 'people';
      case 'meeting_scheduled':
      case 'meeting_started':
      case 'meeting_created':
        return 'calendar';
      case 'loan_application_submitted':
      case 'loan_approved':
      case 'loan_disbursed':
      case 'loan_rejected':
      case 'loan_application_new':
      case 'loan_approved_member':
        return 'cash';
      case 'welfare_request_created':
      case 'welfare_approved':
      case 'welfare_rejected':
      case 'welfare_request_new':
      case 'welfare_approved_member':
        return 'heart';
      case 'contribution_recorded':
      case 'welfare_contribution_recorded':
      case 'loan_payment_recorded':
      case 'member_contribution':
      case 'member_welfare_contribution':
        return 'wallet';
      case 'financial':
        return 'card';
      case 'loan':
        return 'cash';
      case 'marketplace':
        return 'storefront';
      case 'system':
        return priority === 'high' ? 'warning' : 'information-circle';
      case 'support_update':
      case 'new_support_request':
        return 'help-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type, priority) => {
    switch (type) {
      case 'chama_invitation':
        return colors.primary;
      case 'guarantor_request':
        return colors.warning;
      case 'chama':
      case 'member_joined':
        return colors.primary;
      case 'meeting_scheduled':
      case 'meeting_started':
      case 'meeting_created':
        return colors.info;
      case 'loan_application_submitted':
      case 'loan_approved':
      case 'loan_disbursed':
      case 'loan_rejected':
      case 'loan_application_new':
      case 'loan_approved_member':
        return colors.warning;
      case 'welfare_request_created':
      case 'welfare_approved':
      case 'welfare_rejected':
      case 'welfare_request_new':
      case 'welfare_approved_member':
        return colors.error;
      case 'contribution_recorded':
      case 'welfare_contribution_recorded':
      case 'loan_payment_recorded':
      case 'member_contribution':
      case 'member_welfare_contribution':
        return colors.success;
      case 'financial':
        return colors.success;
      case 'loan':
        return colors.warning;
      case 'marketplace':
        return colors.info;
      case 'system':
        return priority === 'high' ? colors.error : colors.secondary;
      case 'support_update':
      case 'new_support_request':
        return colors.info;
      default:
        return colors.textSecondary;
    }
  };

  // Time formatting function is now imported from utils
  // Memoized time formatting to prevent re-renders
  const memoizedTimeAgo = useMemo(() => {
    const cache = new Map();
    return (timestamp) => {
      const key = timestamp;
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = getTimeAgo(timestamp);
      cache.set(key, result);
      return result;
    };
  }, []);

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Notifications
        </Text>

        <View style={styles.headerActions}>          
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              const success = smartNavigate('Settings');
              if (!success) {
                Alert.alert('Navigation Error', 'Could not open Settings. Please try again.');
              }
            }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              const success = smartNavigate('Reminders');
              if (!success) {
                Alert.alert('Navigation Error', 'Could not open Reminders. Please try again.');
              }
            }}
          >
            <Ionicons name="alarm-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              const success = smartNavigate('NotificationTone');
              if (!success) {
                Alert.alert('Navigation Error', 'Could not open Notification Tones. Please try again.');
              }
            }}
          >
            <Ionicons name="musical-notes-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              const success = smartNavigate('Invitations');
              if (!success) {
                Alert.alert('Navigation Error', 'Could not open Invitations. Please try again.');
              }
            }}
          >
            <Ionicons name="mail-outline" size={22} color={colors.text} />
            {invitationsCount > 0 && (
              <View style={[styles.invitationIndicator, { backgroundColor: colors.error }]}>
                <Text style={[styles.invitationCount, { color: colors.white }]}>
                  {invitationsCount > 9 ? '9+' : invitationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {displayNotifications.filter(n => !(n.isRead || n.is_read)).length > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Text style={[styles.markAllText, { color: colors.primary }]}>
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        horizontal
        data={filters}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[ 
              styles.filterChip,
              {
                backgroundColor: selectedFilter === item.id ? colors.primary : colors.backgroundSecondary,
                borderColor: colors.border,
              }
            ]}
            onPress={() => setSelectedFilter(item.id)}
          >
            <Text style={[ 
              styles.filterText,
              {
                color: selectedFilter === item.id ? colors.white : colors.textSecondary
              }
            ]}>
              {item.name} ({item.count})
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      />
    </View>
  );

  const renderNotification = ({ item }) => {
    const isRead = item.isRead;
    const createdAt = item.createdAt;

    return (
      <Card style={[
        styles.notificationCard,
        {
          backgroundColor: isRead ? '#ffffff' : 'rgba(33, 150, 243, 0.08)',
          borderColor: isRead ? '#e0e0e0' : 'rgba(33, 150, 243, 0.3)',
          borderWidth: isRead ? 1 : 2,
        }
      ]}>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={[
              styles.notificationIcon,
              { backgroundColor: 'rgba(33, 150, 243, 0.15)' }
            ]}>
              <Ionicons
                name={getNotificationIcon(item.type, item.priority)}
                size={24}
                color="#2196F3"
              />
            </View>

            <View style={styles.notificationInfo}>
              <View style={styles.titleRow}>
                <Text style={[styles.notificationTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                <View style={styles.titleActions}>
                  {!isRead && (
                    <View style={[styles.unreadDot, { backgroundColor: '#2196F3' }]} />
                  )}
                </View>
              </View>
              <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
                {memoizedTimeAgo(createdAt)}
              </Text>
            </View>
          </View>

          <Text style={[styles.notificationMessage, { color: colors.text }]}>
            {item.message}
          </Text>

          {item.action_url && (
            <View style={styles.notificationAction}>
              <Text style={[styles.actionText, { color: colors.primary }]}>
                Tap to view details →
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          {/* Guarantor Request Actions */}
          {item.type === 'guarantor_request' && (
            <View style={styles.guarantorActions}>
              {/* Show status if already acted upon */}
              {isRead ? (
                <View style={styles.guarantorStatus}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#4CAF50"
                  />
                  <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
                    Already Responded
                  </Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton, { backgroundColor: 'rgba(76, 175, 80, 0.15)', borderColor: '#4CAF50', borderWidth: 1 }]}
                    onPress={async () => {
                      try {
                        // Parse loan data from notification
                        const loanData = JSON.parse(item.data || '{}');
                        const response = await ApiService.respondToGuaranteeRequest(loanData.loan_id, {
                          guarantorId: loanData.guarantor_id,
                          action: 'accept'
                        });

                        if (response.success) {
                          // Mark notification as read
                          await markNotificationAsRead(item.id);

                          // Update local state
                          setLocalNotifications(prev =>
                            prev.map(notification =>
                              notification.id === item.id
                                ? { ...notification, isRead: true, is_read: true }
                                : notification
                            )
                          );

                          Toast.show({
                            type: 'success',
                            text1: 'Guarantee Accepted',
                            text2: 'You have accepted the loan guarantee request',
                            position: 'bottom',
                            visibilityTime: 2000,
                          });
                        } else {
                          throw new Error(response.error || 'Failed to accept guarantee');
                        }
                      } catch (error) {
                        console.error('❌ Failed to accept guarantee:', error);
                        Toast.show({
                          type: 'error',
                          text1: 'Action Failed',
                          text2: 'Could not accept guarantee. Please try again.',
                          position: 'bottom',
                          visibilityTime: 3000,
                        });
                      }
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
                      Accept
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton, { backgroundColor: 'rgba(244, 67, 54, 0.15)', borderColor: '#f44336', borderWidth: 1 }]}
                    onPress={async () => {
                      try {
                        // Parse loan data from notification
                        const loanData = JSON.parse(item.data || '{}');
                        const response = await ApiService.respondToGuaranteeRequest(loanData.loan_id, {
                          guarantorId: loanData.guarantor_id,
                          action: 'decline'
                        });

                        if (response.success) {
                          // Mark notification as read
                          await markNotificationAsRead(item.id);

                          // Update local state
                          setLocalNotifications(prev =>
                            prev.map(notification =>
                              notification.id === item.id
                                ? { ...notification, isRead: true, is_read: true }
                                : notification
                            )
                          );

                          Toast.show({
                            type: 'info',
                            text1: 'Guarantee Declined',
                            text2: 'You have declined the loan guarantee request',
                            position: 'bottom',
                            visibilityTime: 2000,
                          });
                        } else {
                          throw new Error(response.error || 'Failed to decline guarantee');
                        }
                      } catch (error) {
                        console.error('❌ Failed to decline guarantee:', error);
                        Toast.show({
                          type: 'error',
                          text1: 'Action Failed',
                          text2: 'Could not decline guarantee. Please try again.',
                          position: 'bottom',
                          visibilityTime: 3000,
                        });
                      }
                    }}
                  >
                    <Ionicons name="close-circle" size={16} color="#f44336" />
                    <Text style={[styles.actionButtonText, { color: '#f44336' }]}>
                      Decline
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Standard Actions for other notification types */}
          {item.type !== 'guarantor_request' && !isRead && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: 'rgba(33, 150, 243, 0.15)' }]}
              onPress={async () => {
                try {

                  // Update local state immediately for instant UI feedback
setLocalNotifications(prev =>
                             prev.map(notification =>
                               notification.id === item.id
                                 ? { ...notification, isRead: true }
                                 : notification
                             )
                           );

                  const markResult = await markNotificationAsRead(item.id);
                  // Show success toast
                  Toast.show({
                    type: 'success',
                    text1: 'Marked as Read',
                    text2: 'Notification has been marked as read',
                    position: 'bottom',
                    visibilityTime: 1500,
                  });

} catch (error) {
                   console.error('❌ Failed to mark notification as read:', error);

                   // REVERT UI UPDATE on error - restore original read state
                   setLocalNotifications(prev =>
                     prev.map(notification =>
                       notification.id === item.id
                         ? { ...notification, isRead: false }
                         : notification
                     )
                   );

                   Toast.show({
                     type: 'error',
                     text1: 'Update Failed',
                     text2: 'Could not mark notification as read. Please try again.',
                     position: 'bottom',
                     visibilityTime: 3000,
                   });
                 }
              }}
            >
              <Ionicons name="checkmark" size={16} color="#2196F3" />
              <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>
                Mark Read
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, { backgroundColor: 'rgba(244, 67, 54, 0.15)', borderColor: '#f44336', borderWidth: 1 }]}
            onPress={async () => {
              // Prevent duplicate deletions
              if (deletedNotificationIds.has(item.id)) {
                return;
              }

              try {
                // IMMEDIATE UI UPDATE - Remove from local state instantly
                setLocalNotifications(prev => prev.filter(notification => notification.id !== item.id));
                setDeletedNotificationIds(prev => new Set([...prev, item.id]));

                // Delete notification with optimistic update
                const deleteResult = await deleteNotification(item.id);
                // Show success toast
                Toast.show({
                  type: 'success',
                  text1: 'Notification Deleted',
                  text2: 'The notification has been removed successfully',
                  position: 'bottom',
                  visibilityTime: 2000,
                });

              } catch (error) {
                console.error('❌ Failed to delete notification:', error);

                // REVERT UI UPDATE - Restore notification on error
                setDeletedNotificationIds(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(item.id);
                  return newSet;
                });
                setLocalNotifications(baseNotifications);

                Toast.show({
                  type: 'error',
                  text1: 'Delete Failed',
                  text2: 'Could not delete the notification. Please try again.',
                  position: 'bottom',
                  visibilityTime: 3000,
                });
              }
            }}
          >
            <Ionicons name="trash" size={18} color="#f44336" />
            <Text style={[styles.actionButtonText, styles.deleteButtonText, { color: '#f44336' }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
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
          : 'You\'ll see notifications here when they arrive'
        }
      </Text>
    </View>
  );

  const filteredNotifications = getFilteredNotifications();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
        ListEmptyComponent={!loading && renderEmptyState()}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: screenWidth < 350 ? typography.fontSize.lg : typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markAllButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  markAllText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  menuButton: {
    position: 'relative',
    padding: spacing.xs,
    borderRadius: borderRadius.md,
  },
  invitationIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  invitationCount: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 12,
  },
  filtersContainer: {
    paddingRight: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    marginRight: spacing.xs,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
  filterText: {
    fontSize: screenWidth < 350 ? typography.fontSize.xs : typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  notificationsList: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 500, // Ensure minimum height for empty state
  },
  notificationCard: {
    marginBottom: screenWidth < 350 ? spacing.md : spacing.lg,
    overflow: 'hidden',
    minHeight: screenWidth < 350 ? 100 : 120, // Responsive minimum height
    maxHeight: screenWidth < 350 ? 250 : 300, // Allow more height on larger screens
  },
  notificationContent: {
    padding: screenWidth < 350 ? spacing.md : spacing.lg,
    paddingBottom: screenWidth < 350 ? spacing.sm : spacing.md, // Less bottom padding since we have action buttons
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: screenWidth < 350 ? spacing.md : spacing.lg,
    minHeight: screenWidth < 350 ? 40 : 48, // Responsive minimum height
  },
  notificationIcon: {
    width: screenWidth < 350 ? 40 : 48,
    height: screenWidth < 350 ? 40 : 48,
    borderRadius: screenWidth < 350 ? 20 : 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: screenWidth < 350 ? spacing.md : spacing.lg,
    flexShrink: 0,
    marginTop: 2, // Slight adjustment for better alignment
  },
  notificationInfo: {
    flex: 1,
    minWidth: 0, // Allows text to wrap properly
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: screenWidth < 350 ? spacing.xs : spacing.sm,
    minHeight: screenWidth < 350 ? 20 : 24, // Responsive minimum height for title
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteIconButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'transparent',
  },
  notificationTitle: {
    fontSize: screenWidth < 350 ? typography.fontSize.base : typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
    marginRight: spacing.md,
    lineHeight: screenWidth < 350 ? 20 : 24,
    color: 'inherit', // Will inherit from parent
  },
  notificationTime: {
    fontSize: screenWidth < 350 ? typography.fontSize.xs : typography.fontSize.sm,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
    marginTop: 2,
  },
  notificationMessage: {
    fontSize: screenWidth < 350 ? typography.fontSize.sm : typography.fontSize.base,
    lineHeight: screenWidth < 350 ? 20 : 22,
    marginBottom: screenWidth < 350 ? spacing.sm : spacing.md,
    fontWeight: typography.fontWeight.normal,
    color: 'inherit', // Will inherit from parent
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  guarantorActions: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  guarantorStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#4CAF50',
    gap: spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: 'transparent', // Will be overridden by inline style
    backgroundColor: 'transparent', // Will be overridden by inline style
  },
  deleteButtonText: {
    fontWeight: typography.fontWeight.semibold,
  },
  notificationAction: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionText: {
    fontSize: screenWidth < 350 ? typography.fontSize.sm : typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    minHeight: 400, // Ensure good minimum height
  },
  emptyTitle: {
    fontSize: screenWidth < 350 ? 24 : 28, // Larger, fixed sizes
    fontWeight: '700', // Bolder weight
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    fontSize: screenWidth < 350 ? 16 : 18, // Larger, fixed sizes
    textAlign: 'center',
    lineHeight: 24, // Fixed line height for better readability
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
    opacity: 0.8, // Slightly transparent for hierarchy
  },
});

export default NotificationsScreen;
