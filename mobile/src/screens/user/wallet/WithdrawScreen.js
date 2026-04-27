import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ResponsiveForm from '../../../components/common/ResponsiveForm';
import ApiService from '../../../services/api';
import { formatCurrency } from '../../../utils/formatters';

export default function WithdrawScreen({ navigation }) {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const availableBalance = 15750.50; // Mock balance - should be replaced with real balance

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > availableBalance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your M-Pesa phone number');
      return;
    }

    Alert.alert(
      'Withdraw Confirmation',
      `Withdraw ${formatCurrency(parseFloat(amount))} to M-Pesa (${phoneNumber})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setLoading(true);

              // Call the withdrawal API for M-Pesa
              const response = await ApiService.initiateWithdrawal(
                parseFloat(amount),
                'mpesa',
                phoneNumber,
                null, // No account number for M-Pesa
                null, // No bank code for M-Pesa
                'Withdrawal via M-Pesa'
              );

              if (response.success) {
                // Show success message for M-Pesa withdrawal
                const successMessage = `Withdrawal of ${formatCurrency(parseFloat(amount))} has been initiated to M-Pesa number ${phoneNumber}. You will receive the money shortly.`;

                Alert.alert(
                  'Withdrawal Initiated!',
                  successMessage,
                  [
                    {
                      text: 'View Transactions',
                      onPress: () => {
                        // Reset form and navigate to transaction history
                        setAmount('');
                        setPhoneNumber('');
                        navigation.navigate('TransactionHistory');
                      },
                    },
                    {
                      text: 'OK',
                      style: 'default',
                      onPress: () => {
                        // Reset form and navigate back
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
          }
        },
      ]
    );
  };

  //M-Pesa withdrawal is supported

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Scrollable Content */}
      <ResponsiveForm>
        <ResponsiveForm.Section title="Withdrawal Details">
          <ResponsiveForm.Row>
            <ResponsiveForm.Field
              label="Amount (KES)"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="numeric"
              icon="cash"
              fullWidth
            />
          </ResponsiveForm.Row>
        </ResponsiveForm.Section>

        <ResponsiveForm.Section title="M-Pesa Details">
          <ResponsiveForm.Row>
            <ResponsiveForm.Field
              label="M-Pesa Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="254712345678"
              keyboardType="phone-pad"
              icon="phone-portrait"
              fullWidth
            />
          </ResponsiveForm.Row>
        </ResponsiveForm.Section>

        <ResponsiveForm.Button
          title={loading ? 'Processing...' : `Withdraw ${formatCurrency(parseFloat(amount) || 0)}`}
          onPress={handleWithdraw}
          disabled={loading}
          loading={loading}
          variant="primary"
          icon="arrow-up-circle"
        />
      </ResponsiveForm>
    </ScrollView>
  );
}


