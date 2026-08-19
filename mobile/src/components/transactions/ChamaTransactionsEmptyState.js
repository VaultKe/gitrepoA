import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const ChamaTransactionsEmptyState = ({ selectedFilter, theme }) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  return (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, styles.emptyTitleText]}>
        No Transactions Found
      </Text>
      <Text style={[styles.emptySubtitle, styles.emptySubtitleText]}>
        {selectedFilter === 'all'
          ? 'No transactions have been made yet'
          : `No ${selectedFilter} transactions found`
        }
      </Text>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyTitleText: {
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  emptySubtitleText: {
    color: colors.textSecondary,
  },
});

export default ChamaTransactionsEmptyState;
