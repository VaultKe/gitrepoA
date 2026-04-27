import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import ApiService from '../../../services/api';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';

const AdminSupportScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [supportRequests, setSupportRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  });

  const statusFilters = [
    { id: 'all', label: 'All', shortLabel: 'All', count: 0 },
    { id: 'open', label: 'Open', shortLabel: 'Open', count: 0 },
    { id: 'in_progress', label: 'In Progress', shortLabel: 'Active', count: 0 },
    { id: 'resolved', label: 'Resolved', shortLabel: 'Done', count: 0 },
    { id: 'closed', label: 'Closed', shortLabel: 'Closed', count: 0 },
  ];

  const priorityColors = {
    low: colors.success,
    medium: colors.warning,
    high: colors.error,
    urgent: colors.error,
  };

  const statusColors = {
    open: colors.warning,
    in_progress: colors.primary,
    resolved: colors.success,
    closed: colors.textSecondary,
  };

  // Real-time updates - load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadSupportRequests();

      // Set up real-time polling every 30 seconds
      const interval = setInterval(() => {
        loadSupportRequests(true); // Silent refresh
      }, 30000);

      return () => clearInterval(interval);
    }, [selectedFilter])
  );

  useEffect(() => {
    calculateStats();
  }, [supportRequests]);

  useEffect(() => {
    loadSupportRequests();
  }, []);

  // Refresh when coming back from update screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSupportRequests(true); // Silent refresh
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    loadSupportRequests();
  }, []);

  // Refresh when coming back from update screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSupportRequests(true); // Silent refresh
    });

    return unsubscribe;
  }, [navigation]);

  const calculateStats = () => {
    const stats = {
      total: supportRequests.length,
      open: supportRequests.filter(r => r.status === 'open').length,
      in_progress: supportRequests.filter(r => r.status === 'in_progress').length,
      resolved: supportRequests.filter(r => r.status === 'resolved').length,
      closed: supportRequests.filter(r => r.status === 'closed').length,
    };
    setStats(stats);
  };

  const loadSupportRequests = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      // Always load all requests for proper statistics
      const response = await ApiService.getSupportRequests({});

      if (response.success) {
        const requests = response.data || [];
        setSupportRequests(requests);

        if (!silent) {
        }
      } else {
        throw new Error(response.error || 'Failed to load support requests');
      }
    } catch (error) {
      console.error('Failed to load support requests:', error);
      if (!silent) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load support requests',
        });
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSupportRequests();
    setRefreshing(false);
  };



  const handleRequestPress = (request) => {
    navigation.navigate('UpdateSupportRequest', { supportRequest: request });
  };

  const handleQuickStatusUpdate = async (requestId, newStatus) => {
    try {
      const updateData = {
        status: newStatus,
        adminNotes: `Status updated to ${newStatus} via quick action`,
      };

      const response = await ApiService.updateSupportRequest(requestId, updateData);

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Updated',
          text2: `Request marked as ${newStatus.replace('_', ' ')}`,
        });

        loadSupportRequests(true); // Silent refresh
      } else {
        throw new Error(response.error || 'Failed to update support request');
      }
    } catch (error) {
      console.error('Failed to update support request:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update request status',
      });
    }
  };



  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFilteredRequests = () => {
    return supportRequests.filter(request => 
      selectedFilter === 'all' || request.status === selectedFilter
    );
  };



  const renderSupportRequest = (request) => {
    const timeAgo = formatDate(request.createdAt);
    const isUrgent = request.priority === 'urgent' || request.priority === 'high';
    const isOverdue = request.status === 'open' && new Date() - new Date(request.createdAt) > 24 * 60 * 60 * 1000; // 24 hours

    return (
      <TouchableOpacity
        key={request.id}
        style={[
          styles.requestCard,
          {
            backgroundColor: colors.surface,
            borderColor: isUrgent ? priorityColors[request.priority] : colors.border,
            borderLeftWidth: isUrgent ? 4 : 1,
          }
        ]}
        onPress={() => handleRequestPress(request)}
      >
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <View style={styles.requestTitleRow}>
              <Text style={[styles.requestSubject, { color: colors.text }]} numberOfLines={1}>
                {request.subject}
              </Text>
              {isOverdue && (
                <View style={[styles.overdueIndicator, { backgroundColor: colors.error + '20' }]}>
                  <Ionicons name="time" size={12} color={colors.error} />
                  <Text style={[styles.overdueText, { color: colors.error }]}>Overdue</Text>
                </View>
              )}
            </View>
            <Text style={[styles.requestUser, { color: colors.textSecondary }]}>
              {request.userFirstName} {request.userLastName} • {request.userEmail}
            </Text>
            <Text style={[styles.requestCategory, { color: colors.primary }]}>
              {request.category.replace('_', ' ').toUpperCase()} • {timeAgo}
            </Text>
          </View>
          <View style={styles.requestBadges}>
            <View style={[styles.priorityBadge, { backgroundColor: priorityColors[request.priority] + '20' }]}>
              <Text style={[styles.badgeText, { color: priorityColors[request.priority] }]}>
                {request.priority.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[request.status] + '20' }]}>
              <Text style={[styles.badgeText, { color: statusColors[request.status] }]}>
                {request.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.requestDescription, { color: colors.textSecondary }]} numberOfLines={3}>
          {request.description}
        </Text>

        {request.adminNotes && (
          <View style={[styles.adminNotesPreview, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="document-text" size={14} color={colors.primary} />
            <Text style={[styles.adminNotesText, { color: colors.primary }]} numberOfLines={1}>
              Admin Notes: {request.adminNotes}
            </Text>
          </View>
        )}

        <View style={styles.requestFooter}>
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.chatButton, { backgroundColor: colors.primary + '20' }]}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('AdminSupportChat', { supportRequest: request });
              }}
            >
              <Ionicons name="chatbubble" size={14} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.success + '20' }]}
              onPress={(e) => {
                e.stopPropagation();
                handleQuickStatusUpdate(request.id, 'resolved');
              }}
            >
              <Ionicons name="checkmark" size={14} color={colors.success} />
              <Text style={[styles.actionButtonText, { color: colors.success }]}>Resolve</Text>
            </TouchableOpacity>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Compact Header with Stats and Filters */}
      <View style={styles.compactHeader}>
        {/* Stats Row */}
        <View style={styles.compactStatsRow}>
          <View style={[styles.compactStatCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.compactStatNumber, { color: colors.primary }]}>{stats.total}</Text>
            <Text style={[styles.compactStatLabel, { color: colors.text }]}>Total</Text>
          </View>
          <View style={[styles.compactStatCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.compactStatNumber, { color: colors.warning }]}>{stats.open}</Text>
            <Text style={[styles.compactStatLabel, { color: colors.text }]}>Open</Text>
          </View>
          <View style={[styles.compactStatCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.compactStatNumber, { color: colors.info }]}>{stats.in_progress}</Text>
            <Text style={[styles.compactStatLabel, { color: colors.text }]}>Active</Text>
          </View>
          <View style={[styles.compactStatCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.compactStatNumber, { color: colors.success }]}>{stats.resolved}</Text>
            <Text style={[styles.compactStatLabel, { color: colors.text }]}>Done</Text>
          </View>
          <TouchableOpacity
            style={[styles.compactRefreshButton, { backgroundColor: colors.primary + '20' }]}
            onPress={() => loadSupportRequests()}
            disabled={loading}
          >
            <Ionicons
              name="refresh"
              size={16}
              color={colors.primary}
              style={loading ? { transform: [{ rotate: '180deg' }] } : {}}
            />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.compactFilterContainer}>
          {statusFilters.map((filter) => {
            const count = filter.id === 'all'
              ? stats.total
              : stats[filter.id] || 0;

            return (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.compactFilterTab,
                  {
                    backgroundColor: selectedFilter === filter.id ? colors.primary : colors.surface,
                    borderColor: selectedFilter === filter.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.compactFilterText,
                    {
                      color: selectedFilter === filter.id ? colors.white : colors.text,
                    },
                  ]}
                >
                  {filter.shortLabel}
                </Text>
                <Text
                  style={[
                    styles.compactFilterCount,
                    {
                      color: selectedFilter === filter.id ? colors.white : colors.textSecondary,
                    },
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading support requests...
            </Text>
          </View>
        ) : getFilteredRequests().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="help-circle-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No support requests found
            </Text>
          </View>
        ) : (
          getFilteredRequests().map(renderSupportRequest)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  compactHeader: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  compactStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  compactStatCard: {
    flex: 1,
    padding: spacing.xs,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  compactStatNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  compactStatLabel: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  compactRefreshButton: {
    padding: spacing.xs,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 65,
    height: 32,
  },
  compactFilterContainer: {
    marginBottom: spacing.xs,
  },
  compactFilterTab: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: spacing.xs,
    minWidth: 65,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactFilterText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 10,
  },
  compactFilterCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 1,
  },



  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
  },
  requestCard: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  requestInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  requestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  requestSubject: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    flex: 1,
  },
  requestUser: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  overdueIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  overdueText: {
    fontSize: typography.fontSize.xs,
    fontWeight: 'bold',
  },
  requestBadges: {
    alignItems: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: 'bold',
  },
  requestCategory: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  requestDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  adminNotesPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  adminNotesText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  requestDate: {
    fontSize: typography.fontSize.xs,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  chatButton: {
    // Inherits from actionButton
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
  },
  saveButton: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  modalSection: {
    marginBottom: spacing.xl,
  },
  modalSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  modalText: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    minHeight: 100,
  },
});

export default AdminSupportScreen;
