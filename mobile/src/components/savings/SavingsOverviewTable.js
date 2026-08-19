import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { spacing, typography, borderRadius } from '../../utils/theme';
import { formatCurrency, getStatusColor } from '../../utils/savingsHelpers';

const SavingsOverviewTable = ({ colors, savingsData, loading, error, refreshing, onRefresh, fetchSavingsData }) => {
  const renderTableHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: colors.primary }]}>
      <View style={[styles.cell, styles.nameCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Member</Text>
      </View>
      <View style={[styles.cell, styles.balanceCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>My Savings</Text>
      </View>
      <View style={[styles.cell, styles.statusCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Status</Text>
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
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, colors) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status, colors) }]}>
              {(item.status || 'active').toUpperCase()}
            </Text>
          </View>
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
    <>
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
    </>
  );
};

const styles = StyleSheet.create({
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

export default SavingsOverviewTable;
