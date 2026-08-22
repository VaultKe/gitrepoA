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
import useWithdrawScreen from '../../../hooks/useWithdrawScreen';

const WithdrawScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const {
    theme: _theme,
    amount,
    setAmount,
    phoneNumber,
    setPhoneNumber,
    loading,
    selectedMethod,
    setSelectedMethod,
    handleWithdraw,
  } = useWithdrawScreen({ navigation });

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
              Withdraw To
            </Text>
            <TouchableOpacity
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                borderWidth: 2,
                backgroundColor: colors.surface,
                borderColor: selectedMethod === 'mpesa' ? colors.primary : colors.border,
              }, selectedMethod === 'mpesa' && { backgroundColor: colors.primary + '20' }]}
              onPress={() => setSelectedMethod('mpesa')}
            >
              <Ionicons name="phone-portrait" size={24} color={selectedMethod === 'mpesa' ? colors.primary : colors.textSecondary} />
              <Text style={[{
                flex: 1,
                fontSize: typography.fontSize.base,
                marginLeft: spacing.sm,
                color: selectedMethod === 'mpesa' ? colors.text : colors.textSecondary,
              }, selectedMethod === 'mpesa' && { fontWeight: '600' }]}>
                M-Pesa
              </Text>
              <Ionicons
                name={selectedMethod === 'mpesa' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selectedMethod === 'mpesa' ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          </Card>

          <Card variant="outlined" style={{ marginTop: spacing.lg, padding: spacing.lg }}>
            <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>
              Phone Number
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
          </Card>

          <TouchableOpacity
            style={[{ borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xl, backgroundColor: colors.primary }]}
            onPress={handleWithdraw}
            disabled={loading}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {loading && (
                <Ionicons name="refresh" size={20} color={colors.white} style={{ marginRight: spacing.sm }} />
              )}
              <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.white }]}>
                {loading ? 'Processing...' : 'Withdraw'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default WithdrawScreen;
