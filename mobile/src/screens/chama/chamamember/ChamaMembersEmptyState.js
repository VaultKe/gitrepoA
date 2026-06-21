import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography } from '../../../utils/theme';

const ChamaMembersEmptyState = ({ type, searchQuery, theme }) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);
  const isMembers = type === 'members';

  return (
    <View style={styles.emptyState}>
      <Ionicons
        name={isMembers ? 'people-outline' : 'mail-outline'}
        size={64}
        color={colors.textTertiary}
      />
      <Text style={[styles.emptyTitle, styles.emptyTitleText]}>
        {isMembers ? 'No members found' : 'No invitations sent'}
      </Text>
      <Text style={[styles.emptySubtitle, styles.emptySubtitleText]}>
        {isMembers
          ? (searchQuery ? 'Try adjusting your search' : 'Invite people to join your chama')
          : 'Send invitations to grow your chama membership'
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

export default ChamaMembersEmptyState;
