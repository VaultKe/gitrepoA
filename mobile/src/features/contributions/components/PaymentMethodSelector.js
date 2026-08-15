import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';

const PaymentMethodSelector = ({
  paymentMethod,
  walletBalance,
  amount,
  setPaymentMethod,
  formatCurrency,
  availablePaymentMethods,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const allMethods = [
    {
      id: 'wallet',
      label: 'VaultKe Wallet',
      icon: 'wallet',
      colorKey: 'primary',
      showBalance: true,
    },
    {
      id: 'mpesa',
      label: 'M-Pesa',
      icon: 'phone-portrait',
      colorKey: 'success',
      showBalance: false,
    },
    {
      id: 'pay_for',
      label: 'Pay for Someone',
      icon: 'people',
      colorKey: 'primary',
      showBalance: false,
      subtext: 'Select a member to pay for',
    },
  ];

  const methods = availablePaymentMethods
    ? allMethods.filter(m => availablePaymentMethods.includes(m.id))
    : allMethods;

  return (
    <View style={styles.paymentMethodContainer}>
      <Text style={[styles.paymentMethodLabel, { color: colors.text }]}>
        Payment Method
      </Text>
      <View style={styles.paymentMethodOptions}>
        {methods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.paymentMethodOption,
              {
                backgroundColor: colors.surface,
                borderColor: paymentMethod === method.id
                  ? method.colorKey === 'success'
                    ? colors.success
                    : colors.primary
                  : colors.border,
                borderWidth: paymentMethod === method.id ? 2 : 1,
              }
            ]}
            onPress={() => setPaymentMethod(method.id)}
          >
            <Ionicons
              name={method.icon}
              size={20}
              color={
                paymentMethod === method.id
                  ? method.colorKey === 'success'
                    ? colors.success
                    : colors.primary
                  : colors.text
              }
            />
            <Text
              style={[
                styles.paymentMethodText,
                {
                  color:
                    paymentMethod === method.id
                      ? method.colorKey === 'success'
                        ? colors.success
                        : colors.primary
                      : colors.text
                }
              ]}
            >
              {method.label}
            </Text>
            {method.showBalance && paymentMethod === method.id && (
              <View style={styles.walletBalanceContainer}>
                <Text
                  style={[
                    styles.paymentMethodBalance,
                    {
                      color:
                        paymentMethod === method.id
                          ? method.colorKey === 'success'
                            ? colors.success
                            : colors.primary
                          : colors.textSecondary
                    }
                  ]}
                >
                  Balance: {formatCurrency(walletBalance)}
                </Text>
                {walletBalance <= 0 && (
                  <Text style={[styles.balanceWarning, { color: colors.error }]}>
                    ⚠️ No balance
                  </Text>
                )}
                {walletBalance > 0 && amount && parseFloat(amount) > walletBalance && (
                  <Text style={[styles.balanceWarning, { color: colors.error }]}>
                    ⚠️ Insufficient
                  </Text>
                )}
              </View>
            )}
            {method.subtext && paymentMethod !== method.id && (
              <Text
                style={[styles.paymentMethodSubtext, { color: colors.textSecondary }]}
              >
                {method.subtext}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  paymentMethodContainer: {
    marginBottom: spacing.lg,
  },
  paymentMethodLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  paymentMethodOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paymentMethodOption: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minHeight: 85,
    justifyContent: 'center',
    ...shadows.sm,
  },
  paymentMethodText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  paymentMethodBalance: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  paymentMethodSubtext: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  walletBalanceContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  balanceWarning: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium,
  },
});

export default PaymentMethodSelector;