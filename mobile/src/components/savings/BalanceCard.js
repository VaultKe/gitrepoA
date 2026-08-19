import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, shadows, typography } from '../../utils/theme';
import { formatCurrency, formatDate } from '../../utils/savingsHelpers';

const BalanceCard = ({ colors, savingsAccount, formatCurrency, formatDate }) => {
  if (!savingsAccount) return null;

  return (
    <View style={[styles.balanceCard, { padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.sm }]}>
      <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Current Balance</Text>
      <Text style={[styles.balanceAmount, { color: colors.success }]}>
        {formatCurrency(savingsAccount.balance)}
      </Text>
      <Text style={[styles.balanceDate, { color: colors.textSecondary }]}>
        Last Updated: {formatDate(savingsAccount.lastActivity)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  balanceLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  balanceDate: {
    fontSize: typography.fontSize.xs,
  },
});

export default BalanceCard;
