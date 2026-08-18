import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ChamaLoansEmptyState = ({ canViewAllLoans, theme }) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptySubtitle, styles.emptySubtitleText]}>
        {canViewAllLoans()
          ? 'No loans are available'
          : 'You have no loan applications yet.'
        }
      </Text>

      <View style={[styles.privacyNotice, styles.privacyNoticeInfo]}>
        <Ionicons name="shield-checkmark" size={16} color={colors.info} />
        <Text style={[styles.privacyText, styles.privacyTextSecondary]}>
          {canViewAllLoans()
            ? 'As a chama leader, you can view all member loan records.'
            : 'Your loan information is secure.'
          }
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptySubtitleText: {
    color: colors.textSecondary,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  privacyNoticeInfo: {
    backgroundColor: colors.info + '10',
  },
  privacyText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  privacyTextSecondary: {
    color: colors.textSecondary,
  },
});

export default ChamaLoansEmptyState;
