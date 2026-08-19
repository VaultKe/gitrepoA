import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, shadows, typography } from '../../utils/theme';

const SavingsAccountHeader = ({ colors, savingsAccount }) => {
  if (!savingsAccount) return null;

  return (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      <View style={styles.headerContent}>
        <View style={styles.accountIcon}>
          <Ionicons name="wallet" size={32} color={colors.secondary} />
        </View>
        <View style={styles.accountInfo}>
          <Text style={[styles.accountName, { color: colors.text }]}>
            {savingsAccount.memberName || 'Savings Account'}
          </Text>
          <Text style={[styles.accountNumber, { color: colors.textSecondary }]}>
            Account: {savingsAccount.accountNumber || savingsAccount.id}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  accountNumber: {
    fontSize: typography.fontSize.sm,
  },
});

export default SavingsAccountHeader;
