import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';

const normalizeMpesaPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('07') || digits.startsWith('01')) return '254' + digits.slice(1);
  if (digits.length === 9 && digits.startsWith('7')) return '254' + digits;
  return '254' + digits;
};

const useDepositScreen = ({ navigation }) => {
  const { user } = useApp();
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [lastTransactionId, setLastTransactionId] = useState(null);

  const handleDeposit = useCallback(async () => {
    const depositAmount = parseFloat(amount) || 0;

    console.log('[Deposit] button clicked', { amount: depositAmount, phoneNumber });

    if (!depositAmount || depositAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    const normalizedPhone = normalizeMpesaPhone(phoneNumber);
    console.log('[Deposit] normalized phone', normalizedPhone);

    if (!normalizedPhone || normalizedPhone.length !== 12) {
      Alert.alert(
        'Invalid Phone Number',
        'Your profile phone number appears to be masked or incomplete. Please log out and log back in, or update your phone number in your profile.'
      );
      return;
    }

    try {
      setLoading(true);
      console.log('[Deposit] calling API', { depositAmount, normalizedPhone });
      const response = await ApiService.initiateDeposit(depositAmount, 'mpesa', '', '', normalizedPhone);
      console.log('[Deposit] API response', response);

      const transactionId = response?.data?.transactionId || response?.data?.id || null;
      if (transactionId) {
        setLastTransactionId(transactionId);
      }

      Alert.alert(
        'Deposit Initiated',
        `M-Pesa STK push sent to ${normalizedPhone} for KES ${depositAmount.toLocaleString()}${transactionId ? `\nTransaction: ${transactionId}` : ''}`,
        [{ text: 'OK' }]
      );

      setAmount('');
    } catch (error) {
      console.log('[Deposit] API error', error);
      const transactionId = error?.response?.data?.data?.transactionId || error?.response?.data?.transactionId || null;
      if (transactionId) {
        setLastTransactionId(transactionId);
        Alert.alert(
          'Deposit Recorded',
          `Transaction recorded with code: ${transactionId}\n${error.message || 'Please try again.'}`,
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert('Deposit Failed', error.message);
    } finally {
      setLoading(false);
    }
  }, [amount, phoneNumber]);

  return {
    amount,
    setAmount,
    phoneNumber,
    setPhoneNumber,
    loading,
    lastTransactionId,
    handleDeposit,
  };
};

export default useDepositScreen;
