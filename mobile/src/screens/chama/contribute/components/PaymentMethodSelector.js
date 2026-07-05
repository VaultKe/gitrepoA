import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../../utils/theme';

const PaymentMethodSelector = ({ 
  paymentMethod, 
  walletBalance, 
  amount,
  setPaymentMethod,
  formatCurrency 
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <View style={styles.paymentMethodContainer}>
      <Text style={[styles.paymentMethodLabel, { color: colors.text }]}>
        Payment Method
      </Text>
      <View style={styles.paymentMethodOptions}>
        <TouchableOpacity
          style={[
            styles.paymentMethodOption,
            {
              backgroundColor: colors.surface,
              borderColor: paymentMethod === 'wallet' ? colors.primary : colors.border,
              borderWidth: paymentMethod === 'wallet' ? 2 : 1,
            }
          ]}
          onPress={() => setPaymentMethod('wallet')}
        >
          <Ionicons
            name="wallet"
            size={20}
            color={paymentMethod === 'wallet' ? colors.primary : colors.text}
          />
          <Text
            style={[
              styles.paymentMethodText,
              { color: paymentMethod === 'wallet' ? colors.primary : colors.text }
            ]}
          >
            VaultKe Wallet
          </Text>
          {paymentMethod === 'wallet' && (
            <View style={styles.walletBalanceContainer}>
              <Text
                style={[
                  styles.paymentMethodBalance,
                  { color: paymentMethod === 'wallet' ? colors.primary : colors.textSecondary }
                ]}
              >
                Balance: {formatCurrency(walletBalance)}
              </Text>
              {walletBalance <= 0 && (
                <Text
                  style={[
                    styles.balanceWarning,
                    { color: colors.error }
                  ]}
                >
                  ⚠️ No balance
                </Text>
              )}
              {walletBalance > 0 && amount && parseFloat(amount) > walletBalance && (
                <Text
                  style={[
                    styles.balanceWarning,
                    { color: colors.error }
                  ]}
                >
                  ⚠️ Insufficient
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.paymentMethodOption,
            {
              backgroundColor: colors.surface,
              borderColor: paymentMethod === 'mpesa' ? colors.success : colors.border,
              borderWidth: paymentMethod === 'mpesa' ? 2 : 1,
            }
          ]}
          onPress={() => setPaymentMethod('mpesa')}
        >
          <Ionicons
            name="phone-portrait"
            size={20}
            color={paymentMethod === 'mpesa' ? colors.success : colors.text}
          />
          <Text
            style={[
              styles.paymentMethodText,
              { color: paymentMethod === 'mpesa' ? colors.success : colors.text }
            ]}
          >
            M-Pesa
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.paymentMethodOption,
            {
              backgroundColor: colors.surface,
              borderColor: paymentMethod === 'pay_for' ? colors.primary : colors.border,
              borderWidth: paymentMethod === 'pay_for' ? 2 : 1,
            }
          ]}
          onPress={() => setPaymentMethod('pay_for')}
        >
          <Ionicons
            name="people"
            size={20}
            color={paymentMethod === 'pay_for' ? colors.primary : colors.text}
          />
          <Text
            style={[
              styles.paymentMethodText,
              { color: paymentMethod === 'pay_for' ? colors.primary : colors.text }
            ]}
          >
            Pay for Someone
          </Text>
          <Text
            style={[
              styles.paymentMethodSubtext,
              { color: colors.textSecondary }
            ]}
          >
            Select a member to pay for
          </Text>
        </TouchableOpacity>
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