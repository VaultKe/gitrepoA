import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import ApiService from '../../../services/api';

const SavingsOverviewScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);

  const [savingsData, setSavingsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [error, setError] = useState(null);

  const isActiveRef = useRef(true);

  const fetchSavingsData = useCallback(async (isRefresh = false) => {
    if (!currentChamaId) return;
    if (!isRefresh) setLoading(true);

    try {
      setError(null);
      const response = await ApiService.getEligibleSavingsMembers(currentChamaId);
      if (response.success && response.data) {
        const accounts = response.data || [];

        const enriched = accounts.map((account) => {
          const memberName = account.name || account.member_name || account.memberName || 'Unknown Member';
          return {
            ...account,
            member_name: memberName,
            memberName: memberName,
          };
        });

        if (isActiveRef.current) {
          setSavingsData(enriched);
          const total = enriched.reduce((sum, acc) => sum + (acc.balance || 0), 0);
          setTotalBalance(total);
          setMemberCount(enriched.length);
        }
      }
    } catch (error) {
      console.error('Error fetching savings data:', error);
      if (isActiveRef.current) {
        setError('Failed to load savings data. Please try again.');
      }
    } finally {
      if (isActiveRef.current) {
        setLoading(false);
      }
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, [currentChamaId]);

  useEffect(() => {
    isActiveRef.current = true;
    fetchSavingsData();

    return () => {
      isActiveRef.current = false;
    };
  }, [fetchSavingsData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSavingsData(true);
  }, [fetchSavingsData]);

  const formatCurrency = (amount) => {
    const val = amount || 0;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'eligible':
        return colors.success;
      case 'active':
        return colors.primary;
      case 'pending':
        return colors.warning;
      case 'locked':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const renderTableHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: colors.primary }]}>
      <View style={[styles.cell, styles.nameCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Member</Text>
      </View>
      <View style={[styles.cell, styles.balanceCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Balance</Text>
      </View>
      <View style={[styles.cell, styles.statusCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Status</Text>
      </View>
      <View style={[styles.cell, styles.dateCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Last Activity</Text>
      </View>
    </View>
  );

  const renderRow = ({ item, index }) => {
    const rowBg = index % 2 === 0 ? colors.background : colors.surface;
    const memberName = item.member_name || item.memberName || 'Unknown Member';

    return (
      <View style={[styles.tableRow, { backgroundColor: rowBg, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <View style={[styles.cell, styles.nameCell]}>
          <Text style={[styles.cellText, styles.nameText, { color: colors.text }]} numberOfLines={1}>
            {memberName}
          </Text>
        </View>
        <View style={[styles.cell, styles.balanceCell]}>
          <Text style={[styles.cellText, { color: colors.success, fontWeight: '600' }]}>
            {formatCurrency(item.balance)}
          </Text>
        </View>
        <View style={[styles.cell, styles.statusCell]}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {(item.status || 'active').toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={[styles.cell, styles.dateCell]}>
          <Text style={[styles.cellText, { color: colors.textSecondary }]}>
            {formatDate(item.lastActivity)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Unable to Load Savings
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => { setError(null); fetchSavingsData(true); }}
          >
            <Ionicons name="refresh" size={16} color={colors.white} />
            <Text style={[styles.retryText, { color: colors.white }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="wallet-outline" size={64} color={colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No Savings Accounts Found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          No savings accounts have been created for this chama yet.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                Members Savings Overview
              </Text>
              <TouchableOpacity
                onPress={onRefresh}
                disabled={refreshing || loading}
                style={{ padding: spacing.xs }}
              >
                <Ionicons
                  name="refresh"
                  size={18}
                  color={refreshing || loading ? colors.textTertiary : colors.primary}
                />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Ionicons name="people" size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {memberCount} Member{memberCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Ionicons name="wallet" size={14} color={colors.success} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.success }}>
                  Total: {formatCurrency(totalBalance)}
                </Text>
              </View>
            </View>
          </View>

          {renderTableHeader()}

          <FlatList
            data={savingsData}
            renderItem={renderRow}
            keyExtractor={(item) => item.id?.toString()}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              !loading ? renderEmptyState() : null
            }
            scrollEnabled={true}
          />
        </Card>
      </View>

      {loading && !refreshing && <LoadingSpinner />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 2.2,
    alignItems: 'flex-start',
  },
  balanceCell: {
    flex: 1.8,
    alignItems: 'center',
  },
  statusCell: {
    flex: 1.5,
    alignItems: 'center',
  },
  dateCell: {
    flex: 2,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  nameText: {
    fontWeight: '600',
    textAlign: 'left',
  },
  cellText: {
    fontSize: 12,
    textAlign: 'center',
  },
  cellSubText: {
    fontSize: 10,
    textAlign: 'left',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  retryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default SavingsOverviewScreen;
