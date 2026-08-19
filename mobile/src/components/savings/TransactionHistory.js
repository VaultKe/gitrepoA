import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../../utils/theme';
import { formatDate, formatCurrency } from '../../utils/savingsHelpers';

const TransactionHistory = ({ colors, transactions, formatDate, formatCurrency }) => {
  if (transactions.length === 0) {
    return (
      <View style={styles.emptyTransactions}>
        <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No transactions found
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
          Transaction history will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.transactionsList}>
      {transactions.map((transaction, index) => (
        <View key={transaction.id || index} style={styles.transactionItem}>
          <View style={styles.transactionInfo}>
            <Text style={[styles.transactionType, { color: colors.text }]}>
              {transaction.type}
            </Text>
            <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>
              {formatDate(transaction.date)}
            </Text>
          </View>
          <Text style={[styles.transactionAmount, {
            color: transaction.type === 'deposit' ? colors.success : colors.error
          }]}>
            {transaction.type === 'deposit' ? '+' : '-'}{formatCurrency(transaction.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyTransactions: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  transactionsList: {
    marginTop: spacing.md,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  transactionDate: {
    fontSize: typography.fontSize.xs,
  },
  transactionAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

export default TransactionHistory;
