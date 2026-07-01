import React, { useState } from 'react';
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
import ApiService from '../../../services/api';
import { formatCurrency } from '../../../utils/formatters';

export default function WithdrawScreen({ navigation }) {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('mpesa');

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid M-Pesa phone number');
      return;
    }

    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw ${formatCurrency(parseFloat(amount))} to ${phoneNumber} via M-Pesa?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await ApiService.initiateWithdrawal(
                parseFloat(amount),
                'mpesa',
                phoneNumber,
                null,
                null,
                'Withdrawal via M-Pesa'
              );

              if (response.success) {
                Alert.alert(
                  'Withdrawal Initiated',
                  `${formatCurrency(parseFloat(amount))} will be sent to ${phoneNumber} shortly.`,
                  [
                    {
                      text: 'View Transactions',
                      onPress: () => {
                        setAmount('');
                        setPhoneNumber('');
                        navigation.navigate('TransactionHistory');
                      },
                    },
                    {
                      text: 'OK',
                      style: 'default',
                      onPress: () => {
                        setAmount('');
                        setPhoneNumber('');
                        navigation.goBack();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Withdrawal Failed', response.error || 'Failed to initiate withdrawal');
              }
            } catch (error) {
              Alert.alert('Withdrawal Failed', error.message || 'Failed to initiate withdrawal');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.xl }}>
          <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm, marginTop: spacing.md, color: colors.text }]}>
            Amount (KES)
          </Text>
          <TextInput
            style={[{
              borderRadius: borderRadius.lg,
              padding: spacing.md,
              fontSize: typography.fontSize['2xl'],
              fontWeight: typography.fontWeight.bold,
              textAlign: 'center',
              borderWidth: 2,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="numeric"
            placeholderTextColor={colors.textTertiary}
          />

          <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>
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

          <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>
            <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>
              Phone Number
            </Text>
            <TextInput
              style={[{
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                fontSize: typography.fontSize.base,
                borderWidth: 1,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              }]}
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
                {loading ? 'Processing...' : `Withdraw ${formatCurrency(parseFloat(amount) || 0)}`}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
