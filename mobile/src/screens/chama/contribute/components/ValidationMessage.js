import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../../utils/theme';

const ValidationMessage = ({ amount, walletBalance, formatCurrency }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  if (!amount) return null;

  const amountValue = parseFloat(amount);

  return (
    <View style={styles.validationContainer}>
      {amountValue > walletBalance ? (
        <View style={styles.validationMessage}>
          <Ionicons name="warning" size={16} color={colors.error} />
          <Text style={[styles.validationText, { color: colors.error }]}>
            Insufficient balance. You need KES {formatCurrency(amountValue - walletBalance)} more.
          </Text>
        </View>
      ) : walletBalance <= 0 ? (
        <View style={styles.validationMessage}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={[styles.validationText, { color: colors.error }]}>
            Your wallet balance is KES 0.00. Please deposit money first.
          </Text>
        </View>
      ) : (
        <View style={styles.validationMessage}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.validationText, { color: colors.success }]}>
            Sufficient balance. Remaining: KES {formatCurrency(walletBalance - amountValue)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  validationContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  validationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  validationText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
    flex: 1,
  },
});

export default ValidationMessage;