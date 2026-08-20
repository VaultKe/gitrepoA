import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const ChamaTransactions = ({ transactions, colors, navigation, chamaId, chama, setSelectedChama, formatCurrency, getResponsiveTextSize }) => {
  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs, borderWidth: 1, borderColor: colors.border }} variant="flat">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          My Transactions
        </Text>
        {transactions.length > 5 && (
          <TouchableOpacity onPress={() => {
            if (chama) {
              setSelectedChama(chama);
            }
            navigation.navigate('ChamaTransactionsScreen', { chamaId, chama });
          }}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {transactions.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No transactions found for your account
        </Text>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
            <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textTransform: 'uppercase' }}>Description</Text>
            <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'center', textTransform: 'uppercase' }}>Date</Text>
            <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'right', textTransform: 'uppercase' }}>Amount</Text>
          </View>

          {transactions.slice(0, 5).map((transaction, index) => {
            let contributionDate = 'Unknown Date';

            try {
              const dateValue = transaction.createdAt || transaction.created_at || transaction.date || transaction.transaction_date;

              if (dateValue) {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
                  contributionDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                }
              }
            } catch (error) {
            }

            const transactionType = transaction.type || 'transaction';
            const isContribution = transactionType === 'contribution' || transactionType === 'deposit' || transaction.description?.toLowerCase().includes('contribution');
            const transactionDescription = transaction.description || (isContribution ? 'Chama Contribution' : 'Transaction') || transactionType;

            return (
              <View key={`transaction-${transaction.id || index}`} style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{transactionDescription}</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: colors.textSecondary, textAlign: 'center' }}>{contributionDate}</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.medium, color: isContribution ? colors.success : colors.primary, textAlign: 'right' }}>
                  {formatCurrency(transaction.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  viewMoreText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});

export default ChamaTransactions;
