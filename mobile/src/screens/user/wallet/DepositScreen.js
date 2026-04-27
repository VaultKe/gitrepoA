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
import { useOptimisticUpdate } from '../../../hooks/useLightningData';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';

export default function DepositScreen() {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [loading, setLoading] = useState(false);



  const paymentMethods = [
    { id: 'mpesa', name: 'M-Pesa', icon: 'phone-portrait' },
    { id: 'bank', name: 'Bank Transfer', icon: 'card' },
    { id: 'card', name: 'Credit/Debit Card', icon: 'card-outline' },
  ];

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      {/* Scrollable Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: spacing.xl }}>
        <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm, marginTop: spacing.md, color: colors.text }]}>Amount (KES)</Text>
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
            color: colors.text
          }]}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="numeric"
          placeholderTextColor={colors.textTertiary}
        />

        <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>
          <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md, color: colors.text }]}>Payment Method</Text>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: borderRadius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  borderWidth: 2,
                  backgroundColor: colors.surface,
                  borderColor: paymentMethod === method.id ? colors.primary : colors.border
                },
                paymentMethod === method.id && { backgroundColor: colors.primary + '20' },
              ]}
              onPress={() => setPaymentMethod(method.id)}
            >
              <Ionicons
                name={method.icon}
                size={24}
                color={paymentMethod === method.id ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                {
                  flex: 1,
                  fontSize: typography.fontSize.base,
                  marginLeft: spacing.sm,
                  color: paymentMethod === method.id ? colors.text : colors.textSecondary
                },
                paymentMethod === method.id && { fontWeight: '600' },
              ]}>
                {method.name}
              </Text>
              <Ionicons
                name={paymentMethod === method.id ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={paymentMethod === method.id ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Main Deposit Button */}
        <TouchableOpacity
          style={[{ borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.xl, backgroundColor: colors.primary }]}
          onPress={async () => {
            const depositAmount = parseFloat(amount) || 0;

            if (!depositAmount || depositAmount <= 0) {
              Alert.alert('Invalid Amount', 'Please enter a valid amount');
              return;
            }

            try {
              setLoading(true);
              const response = await ApiService.initiateDeposit(depositAmount, paymentMethod);

              Alert.alert(
                'Deposit Initiated',
                `M-Pesa STK push sent to your phone for KES ${depositAmount.toLocaleString()}`,
                [{ text: 'OK' }]
              );

              // Clear the amount after successful deposit
              setAmount('');
            } catch (error) {
              Alert.alert('Deposit Failed', error.message);
            } finally {
              setLoading(false);
            }
          }}
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
}
