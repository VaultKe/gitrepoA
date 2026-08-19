import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, borderRadius, typography } from '../../utils/theme';
import { formatDate } from '../../utils/savingsHelpers';

const AccountDetailsCard = ({ colors, savingsAccount }) => {
  if (!savingsAccount) return null;

  return (
    <View style={[styles.detailsCard, { padding: spacing.lg, marginBottom: spacing.md }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Details</Text>

      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
        <View style={[styles.statusBadge, {
          backgroundColor: savingsAccount.status === 'eligible' ? colors.success + '20' : colors.warning + '20'
        }]}>
          <Text style={[styles.statusText, {
            color: savingsAccount.status === 'eligible' ? colors.success : colors.warning
          }]}>
            {savingsAccount.status?.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Member ID</Text>
        <Text style={[styles.detailValue, { color: colors.text }]}>
          {savingsAccount.memberId}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Created Date</Text>
        <Text style={[styles.detailValue, { color: colors.text }]}>
          {formatDate(savingsAccount.createdAt)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
});

export default AccountDetailsCard;
