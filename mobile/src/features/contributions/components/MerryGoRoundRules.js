import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';

const MerryGoRoundRules = ({ contributionStatus, currentRecipient, amountPerRound }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const expectedAmount = contributionStatus?.amountPerRound || 
                        currentRecipient?.amountPerRound || 
                        amountPerRound || 'Loading...';

  return (
    <View style={[styles.anonymousContainer, { backgroundColor: colors.warning + '10', borderColor: colors.warning }]}>
      <View style={styles.anonymousOption}>
        <View style={styles.anonymousCheckbox}>
          <Ionicons
            name="information-circle"
            size={24}
            color={colors.warning}
          />
        </View>
        <View style={styles.anonymousTextContainer}>
          <Text style={[styles.anonymousLabel, { color: colors.text }]}>
            Merry-Go-Round Rules
          </Text>
<Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
             • Exact amount required: {expectedAmount} KES
           </Text>
           <Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
             • Only wallet and M-Pesa payments allowed
           </Text>
           <Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
             • Anonymous contributions not permitted
           </Text>
           <Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
             • Each member can contribute only once per round
           </Text>
           <Text style={[styles.anonymousDescription, { color: colors.textSecondary }]}>
             • Round advances automatically when all members contribute
           </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  anonymousContainer: {
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
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
});

export default MerryGoRoundRules;