import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useOptimisticUpdate } from '../../../hooks/useLightningData';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import ResponsiveForm from '../../../components/common/ResponsiveForm';
import ApiService from '../../../services/api';
import { formatCurrency } from '../../../utils/formatters';

export default function TransferScreen({ navigation }) {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [transferType, setTransferType] = useState('user');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const availableBalance = 15750.50; // Mock balance - should be replaced with real balance

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > availableBalance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    if (!recipient) {
      Alert.alert('Error', 'Please enter recipient details');
      return;
    }

    Alert.alert(
      'Transfer Confirmation',
      `Transfer ${formatCurrency(parseFloat(amount))} to ${recipient}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setLoading(true);

              // Call the actual transfer API with recipient type
              const response = await ApiService.transferMoney(
                recipient,
                parseFloat(amount),
                note || `Transfer to ${recipient}`,
                transferType // 'phone', 'email', or 'user'
              );

              if (response.success) {
                // Show enhanced success message
                Alert.alert(
                  'Transfer Successful!',
                  `${formatCurrency(parseFloat(amount))} has been successfully transferred to ${recipient}. The recipient will be notified of the transfer.`,
                  [
                    {
                      text: 'View Transactions',
                      onPress: () => {
                        // Reset form and navigate to transaction history
                        setAmount('');
                        setRecipient('');
                        setNote('');
                        navigation.navigate('TransactionHistory');
                      },
                    },
                    {
                      text: 'OK',
                      style: 'default',
                      onPress: () => {
                        // Reset form and navigate back
                        setAmount('');
                        setRecipient('');
                        setNote('');
                        navigation.goBack();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Transfer Failed', response.error || 'Failed to complete transfer');
              }
            } catch (error) {
              Alert.alert('Transfer Failed', error.message || 'Failed to complete transfer');
            } finally {
              setLoading(false);
            }
          }
        },
      ]
    );
  };

  const transferTypes = [
    { id: 'user', name: 'VaultKe User', icon: 'person', placeholder: 'Enter username or phone' },
    { id: 'chama', name: 'Chama Wallet', icon: 'people', placeholder: 'Enter chama name or ID' },
  ];

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      {/* Scrollable Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <ResponsiveForm>
          <ResponsiveForm.Section title="Transfer To">
            {transferTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    borderWidth: 2,
                    backgroundColor: colors.surface,
                    borderColor: transferType === type.id ? colors.primary : colors.border
                  },
                  transferType === type.id && { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() => setTransferType(type.id)}
              >
                <Ionicons
                  name={type.icon}
                  size={24}
                  color={transferType === type.id ? colors.primary : colors.textSecondary}
                />
                <Text style={[
                  {
                    flex: 1,
                    fontSize: typography.fontSize.base,
                    marginLeft: spacing.sm,
                    color: transferType === type.id ? colors.text : colors.textSecondary
                  },
                  transferType === type.id && { fontWeight: '600' },
                ]}>
                  {type.name}
                </Text>
                <Ionicons
                  name={transferType === type.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={transferType === type.id ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </ResponsiveForm.Section>

          <ResponsiveForm.Section title="Transfer Details">
            <ResponsiveForm.Row>
              <ResponsiveForm.Field
                label="Recipient"
                value={recipient}
                onChangeText={setRecipient}
                placeholder={transferTypes.find(t => t.id === transferType)?.placeholder}
                icon="person"
                flex={2}
              />
              <ResponsiveForm.Field
                label="Amount (KES)"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="numeric"
                icon="cash"
                flex={1}
              />
            </ResponsiveForm.Row>
            <ResponsiveForm.Row>
              <ResponsiveForm.Field
                label="Note (Optional)"
                value={note}
                onChangeText={setNote}
                placeholder="Add a note for this transfer"
                multiline
                numberOfLines={3}
                icon="chatbubble"
                fullWidth
              />
            </ResponsiveForm.Row>
          </ResponsiveForm.Section>

          <ResponsiveForm.Section title="Transfer Summary">
            <View style={{ borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, backgroundColor: colors.surface, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={{ fontSize: typography.fontSize.base, color: colors.textSecondary }}>Transfer Amount</Text>
                <Text style={{ fontSize: typography.fontSize.base, color: colors.text }}>KES {amount || '0.00'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={{ fontSize: typography.fontSize.base, color: colors.textSecondary }}>Transfer Fee</Text>
                <Text style={{ fontSize: typography.fontSize.base, color: colors.text }}>KES 0.00</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.sm, borderTopColor: colors.border }}>
                <Text style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text }}>Total</Text>
                <Text style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.success }}>KES {amount || '0.00'}</Text>
              </View>
            </View>
          </ResponsiveForm.Section>

          <ResponsiveForm.Button
            title={loading ? 'Processing...' : `Transfer ${formatCurrency(parseFloat(amount) || 0)}`}
            onPress={handleTransfer}
            disabled={loading}
            loading={loading}
            icon="send"
          />
        </ResponsiveForm>
      </ScrollView>
    </View>
  );
}
