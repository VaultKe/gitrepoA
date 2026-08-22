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
    lastTransactionId,
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

          {lastTransactionId ? (
            <Card variant="outlined" style={{ marginTop: spacing.lg, padding: spacing.lg, borderColor: colors.warning }}>
              <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.warning, marginBottom: spacing.xs }]}>
                M-Pesa Transaction Code
              </Text>
              <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold, color: colors.text }]}>
                {lastTransactionId}
              </Text>
              <Text style={[{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs }]}>
                Use this code to track your deposit status
              </Text>
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
