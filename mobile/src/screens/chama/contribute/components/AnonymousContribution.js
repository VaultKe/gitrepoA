import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../../utils/theme';

const AnonymousContribution = ({ isAnonymous, setIsAnonymous }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <View style={styles.anonymousContainer}>
      <TouchableOpacity
        style={styles.anonymousOption}
        onPress={() => setIsAnonymous(!isAnonymous)}
        activeOpacity={0.7}
      >
        <View style={styles.anonymousCheckbox}>
          <Ionicons
            name={isAnonymous ? 'checkbox' : 'square-outline'}
            size={24}
            color={isAnonymous ? colors.primary : colors.textSecondary}
          />
        </View>
        <View style={styles.anonymousTextContainer}>
          <Text style={[styles.anonymousLabel, { color: colors.text }]}>
            Contribute Anonymously
          </Text>
          <Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
            Your name will not be shown in the transaction history
          </Text>
        </View>
      </TouchableOpacity>

      {isAnonymous && (
        <View style={styles.anonymousNotice}>
          <Ionicons name="information-circle" size={16} color={colors.info} />
          <Text style={[styles.anonymousNoticeText, { color: colors.info }]}>
            This contribution will appear as "Anonymous" in all transaction records
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  anonymousContainer: {
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  anonymousOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  anonymousCheckbox: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  anonymousTextContainer: {
    flex: 1,
  },
  anonymousLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  anonymousDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  anonymousNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginTop: spacing.sm,
  },
  anonymousNoticeText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});

export default AnonymousContribution;