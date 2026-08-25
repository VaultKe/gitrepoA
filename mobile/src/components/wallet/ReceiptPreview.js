import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';

const ReceiptPreview = ({ transaction, style }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  const getTransactionTypeLabel = (type) => {
    switch (type) {
      case 'deposit': return 'Deposit';
      case 'withdraw': return 'Withdrawal';
      case 'transfer': return 'Transfer';
      default: return 'Transaction';
    }
  };

  const receiptId = `RCP-${transaction.id.substring(0, 8).toUpperCase()}`;
  const transactionDate = formatDate(transaction.date || transaction.createdAt);
  const amount = formatCurrency(transaction.amount);
  const fees = transaction.fees ? formatCurrency(transaction.fees) : 'KES 0.00';
  const totalAmount = formatCurrency(transaction.amount + (transaction.fees || 0));

  return (
    <ScrollView style={[styles.container, style]} showsVerticalScrollIndicator={false}>
      <View style={[styles.receiptContainer, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={[styles.receiptHeader, { backgroundColor: colors.primary }]}>
          <View style={[styles.companyLogo, { backgroundColor: colors.surface }]}>
            <Text style={[styles.logoText, { color: colors.primary }]}>VK</Text>
          </View>
          <Text style={[styles.companyName, { color: colors.white }]}>VaultKe</Text>
          <Text style={[styles.receiptTitle, { color: colors.white }]}>Transaction Receipt</Text>
        </View>

        {/* Receipt Info */}
        <View style={[styles.receiptInfo, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Receipt ID</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{receiptId}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{transaction.id.substring(0, 16)}...</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date & Time</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{transactionDate}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: transaction.status === 'completed' ? colors.success : colors.warning }
              ]}>
                <Text style={[styles.statusText, { color: colors.white }]}>
                  {(transaction.status || 'completed').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Transaction Details */}
        <View style={[styles.transactionDetails, { borderColor: colors.border }]}>
          <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction Type</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{getTransactionTypeLabel(transaction.type)}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Description</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{transaction.description || 'N/A'}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{amount}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction Fees</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{fees}</Text>
          </View>
          <View style={[styles.detailRow, styles.totalRow, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.detailLabel, styles.totalLabel, { color: colors.text }]}>Total Amount</Text>
            <Text style={[styles.detailValue, styles.totalValue, { color: colors.text }]}>{totalAmount}</Text>
          </View>
          
          {transaction.reference && (
            <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Reference</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{transaction.reference}</Text>
            </View>
          )}
          
          {transaction.paymentMethod && (
            <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment Method</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{transaction.paymentMethod.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={[styles.receiptFooter, { backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border }]}>
          <Text style={[styles.thankYou, { color: colors.text }]}>Thank you for using VaultKe!</Text>
          <Text style={[styles.companyDetails, { color: colors.textSecondary }]}>
            Nairobi, Kenya{'\n'}
            Phone: +254 700 000 000 | Email: support@vaultke.co.ke{'\n'}
            www.vaultke.co.ke
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  receiptContainer: {
    margin: spacing.sm,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  receiptHeader: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  companyLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
  },
  companyName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  receiptTitle: {
    fontSize: typography.fontSize.lg,
    opacity: 0.9,
  },
  receiptInfo: {
    padding: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  transactionDetails: {
    borderWidth: 1,
    margin: spacing.lg,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  totalRow: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'right',
    flex: 1,
    marginLeft: spacing.md,
  },
  totalLabel: {
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
  totalValue: {
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
  receiptFooter: {
    padding: spacing.lg,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  thankYou: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  companyDetails: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default ReceiptPreview;
