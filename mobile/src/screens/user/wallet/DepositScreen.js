import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import AmountInput from '../../../components/wallet/AmountInput';
import useDepositScreen from '../../../hooks/useDepositScreen';

const DepositScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    amount,
    setAmount,
    phoneNumber,
    setPhoneNumber,
    loading,
    deposit,
    handleDeposit,
  } = useDepositScreen({ navigation });

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ padding: spacing.lg }}>
          <Card variant="outlined" style={{ padding: spacing.lg }}>
            <AmountInput
              value={amount}
              onChangeText={setAmount}
              label="Amount (KES)"
              colors={colors}
            />
          </Card>

          <Card variant="outlined" style={{ marginTop: spacing.lg, padding: spacing.lg }}>
            <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>
              M-Pesa Number
            </Text>
            <TextInput
              style={[
                {
                  borderRadius: borderRadius.lg,
                  padding: spacing.md,
                  fontSize: typography.fontSize.base,
                  borderWidth: 1,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="254712345678"
              keyboardType="phone-pad"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={[{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs }]}>
              STK push will be sent to this number
            </Text>
          </Card>

          {deposit ? (
            <Card
              variant="outlined"
              style={{
                marginTop: spacing.lg,
                padding: spacing.lg,
                borderColor:
                  deposit.status === 'completed'
                    ? colors.success
                    : deposit.status === 'failed'
                    ? colors.error
                    : colors.warning,
              }}
            >
              {deposit.status === 'pending' && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                    <Ionicons name="time-outline" size={16} color={colors.warning} style={{ marginRight: spacing.xs }} />
                    <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.warning }]}>
                      Waiting for M-Pesa confirmation…
                    </Text>
                  </View>
                  <Text style={[{ fontSize: typography.fontSize.xs, color: colors.textSecondary }]}>
                    Enter your M-Pesa PIN on your phone to authorise this payment. Safaricom’s confirmation code will appear here once the payment goes through.
                  </Text>
                </>
              )}

              {deposit.status === 'completed' && (
                <>
                  <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.success, marginBottom: spacing.xs }]}>
                    M-Pesa Confirmation Code
                  </Text>
                  <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text, letterSpacing: 1 }]}>
                    {deposit.mpesaCode || 'Payment confirmed'}
                  </Text>
                  <Text style={[{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs }]}>
                    {deposit.mpesaCode
                      ? 'This is the Safaricom code for your deposit — you can verify it against your M-Pesa statement.'
                      : 'Your deposit was received. The M-Pesa code will show on your transaction history and receipt shortly.'}
                  </Text>
                </>
              )}

              {deposit.status === 'failed' && (
                <>
                  <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.error, marginBottom: spacing.xs }]}>
                    Payment not completed
                  </Text>
                  <Text style={[{ fontSize: typography.fontSize.xs, color: colors.textSecondary }]}>
                    The payment was cancelled or failed. If any money was deducted it is reversed automatically.
                  </Text>
                </>
              )}

              {deposit.status === 'timeout' && (
                <>
                  <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.warning, marginBottom: spacing.xs }]}>
                    Still waiting for confirmation
                  </Text>
                  <Text style={[{ fontSize: typography.fontSize.xs, color: colors.textSecondary }]}>
                    This is taking longer than usual. Check your M-Pesa messages, then open your transaction history for the confirmation code.
                  </Text>
                </>
              )}
            </Card>
          ) : null}

          <TouchableOpacity
            style={[{ borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xl, backgroundColor: colors.primary }]}
            onPress={handleDeposit}
            disabled={loading}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {loading && (
                <Ionicons
                  name="refresh"
                  size={20}
                  color={colors.white}
                  style={{ marginRight: spacing.sm }}
                />
              )}
              <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.white }]}>
                {loading ? 'Processing...' : `Deposit KES ${amount || '0.00'}`}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default DepositScreen;
