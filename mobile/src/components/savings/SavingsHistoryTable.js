import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../../utils/theme';
import { formatDate, formatCurrency } from '../../utils/savingsHelpers';

const SavingsHistoryTable = ({ colors, savingsTransactions, transactionsLoading, formatDate, formatCurrency }) => {
  const renderHistoryRow = ({ item, index }) => {
    const rowBg = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[styles.tableRow, { backgroundColor: rowBg, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <View style={[styles.cell, { flex: 1.5, alignItems: 'flex-start' }]}>
          <Text style={[styles.cellText, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
            {item.created_at ? formatDate(item.created_at) : '-'}
          </Text>
        </View>
        <View style={[styles.cell, { flex: 1.5, alignItems: 'center' }]}>
          <Text style={[styles.cellText, { color: colors.success, fontWeight: '600' }]}>
            +{formatCurrency(item.amount)}
          </Text>
        </View>
        <View style={[styles.cell, { flex: 2, alignItems: 'flex-start' }]}>
          <Text style={[styles.cellText, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.description || '-'}
          </Text>
        </View>
        <View style={[styles.cell, { flex: 1.5, alignItems: 'center' }]}>
          <Text style={[styles.cellText, { color: colors.textSecondary }]}>
            {item.payment_method || 'wallet'}
          </Text>
        </View>
      </View>
    );
  };

  const renderHistoryHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: colors.success }]}>
      <View style={[styles.cell, { flex: 1.5 }]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Date</Text>
      </View>
      <View style={[styles.cell, { flex: 1.5 }]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Amount</Text>
      </View>
      <View style={[styles.cell, { flex: 2 }]}>
        <Text style={[styles.headerText, { color: colors.text, textAlign: 'left' }]}>Description</Text>
      </View>
      <View style={[styles.cell, { flex: 1.5 }]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Method</Text>
      </View>
    </View>
  );

  const renderHistoryEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Transactions Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        No savings transactions have been recorded yet.
      </Text>
    </View>
  );

  return (
    <>
      {renderHistoryHeader()}
      <FlatList
        data={savingsTransactions}
        renderItem={renderHistoryRow}
        keyExtractor={(item) => item.id?.toString()}
        contentContainerStyle={{ paddingBottom: spacing.sm }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !transactionsLoading ? renderHistoryEmptyState() : null
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
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  cellText: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
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
});

export default SavingsHistoryTable;
