import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../../utils/theme';

const PhoneNumberDisplay = ({ user }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <View style={styles.phoneNumberContainer}>
      <Text style={[styles.phoneNumberLabel, { color: colors.text }]}>
        M-Pesa Phone Number
      </Text>
      <View style={[styles.phoneNumberDisplay, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="call" size={20} color={colors.textSecondary} style={styles.phoneIcon} />
        <Text style={[styles.phoneNumberText, { color: colors.text }]}>
          {user?.phone || 'No phone number registered'}
        </Text>
        <View style={[styles.readOnlyBadge, { borderColor: colors.primary, backgroundColor: 'transparent' }]}>
          <Text style={[styles.readOnlyText, { color: colors.primary }]}>
            Registered
          </Text>
        </View>
      </View>
      <Text style={[styles.phoneNumberHint, { color: colors.textSecondary }]}>
        You will receive the M-Pesa prompt on this number
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  phoneNumberContainer: {
    marginBottom: spacing.lg,
  },
  phoneNumberLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  phoneNumberDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  phoneIcon: {
    marginRight: spacing.sm,
  },
  phoneNumberText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  readOnlyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  readOnlyText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  phoneNumberHint: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
});

export default PhoneNumberDisplay;