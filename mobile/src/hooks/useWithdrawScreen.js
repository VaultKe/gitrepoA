import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';
import { formatCurrency } from '../utils/formatters';

const useWithdrawScreen = ({ navigation, user }) => {
  const { theme } = useApp();

  const getInitialPhoneNumber = () => {
    if (user?.phone) {
      return user.phone;
    }
    return '';
  };

  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(getInitialPhoneNumber);
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('mpesa');

  const handleWithdraw = useCallback(async () => {
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
  }, [amount, phoneNumber, navigation]);

  return {
    theme,
    amount,
    setAmount,
    phoneNumber,
    setPhoneNumber,
    loading,
    selectedMethod,
    setSelectedMethod,
    handleWithdraw,
  };
};

export default useWithdrawScreen;
