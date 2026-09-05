import { useState, useCallback, useRef, useEffect } from 'react';
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

// How long / how often to wait for Safaricom's STK callback to land before we
// stop actively polling. The callback normally arrives within 10-30s of the
// user entering their PIN.
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 24; // ~2 minutes

const parseMetadata = (md) => {
  if (!md) return {};
  if (typeof md === 'string') {
    try {
      return JSON.parse(md);
    } catch {
      return {};
    }
  }
  return md;
};

// The only code worth showing the user is the one Safaricom issues (e.g.
// "SGH7XYZ123") — it is what appears on their M-Pesa statement and is
// verifiable on the Safaricom portal. It is captured from the STK callback
// into the transaction metadata; the internal "TXN_..." id is not it.
const extractMpesaCode = (txn) => {
  const meta = parseMetadata(txn?.metadata);
  return (
    txn?.mpesaReceiptNumber ||
    txn?.mpesa_receipt_number ||
    meta.mpesa_receipt_number ||
    meta.mpesaReceiptNumber ||
    meta.receipt_number ||
    meta.receiptNumber ||
    null
  );
};

const useDepositScreen = ({ navigation }) => {
  const { user } = useApp();
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  // null | { status: 'pending' | 'completed' | 'failed' | 'timeout', mpesaCode: string|null, amount: number }
  const [deposit, setDeposit] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const pollForConfirmation = useCallback((transactionId, expectedAmount, attempt = 0) => {
    stopPolling();
    pollRef.current = setTimeout(async () => {
      try {
        // Bypass the 30s GET cache so each poll sees the latest status.
        ApiService.invalidateCache('/wallets/transactions');
        const res = await ApiService.getTransactions(50, 0);
        const txn = (res?.data || []).find((t) => t.id === transactionId);
        if (txn) {
          const status = String(txn.status || '').toLowerCase();
          if (status === 'completed' || status === 'success') {
            setDeposit({ status: 'completed', mpesaCode: extractMpesaCode(txn), amount: expectedAmount });
            stopPolling();
            return;
          }
          if (status === 'failed' || status === 'cancelled' || status === 'reversed') {
            setDeposit({ status: 'failed', mpesaCode: null, amount: expectedAmount });
            stopPolling();
            return;
          }
        }
      } catch (e) {
        // transient — fall through and retry
      }

      if (attempt + 1 >= POLL_MAX_ATTEMPTS) {
        setDeposit((prev) => (prev && prev.status === 'pending' ? { ...prev, status: 'timeout' } : prev));
        stopPolling();
        return;
      }
      pollForConfirmation(transactionId, expectedAmount, attempt + 1);
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  const handleDeposit = useCallback(async () => {
    const depositAmount = parseFloat(amount) || 0;

    if (!depositAmount || depositAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    const normalizedPhone = normalizeMpesaPhone(phoneNumber);

    if (!normalizedPhone || normalizedPhone.length !== 12) {
      Alert.alert(
        'Invalid Phone Number',
        'Your profile phone number appears to be masked or incomplete. Please log out and log back in, or update your phone number in your profile.'
      );
      return;
    }

    try {
      setLoading(true);
      stopPolling();
      setDeposit(null);

      const response = await ApiService.initiateDeposit(depositAmount, 'mpesa', '', '', normalizedPhone);
      const transactionId = response?.data?.id || response?.data?.transactionId || null;

      setDeposit({ status: 'pending', mpesaCode: null, amount: depositAmount });
      Alert.alert(
        'Check your phone',
        `Enter your M-Pesa PIN to authorise KES ${depositAmount.toLocaleString()}. The M-Pesa confirmation code will appear here once Safaricom confirms the payment.`,
        [{ text: 'OK' }]
      );

      setAmount('');

      if (transactionId) {
        pollForConfirmation(transactionId, depositAmount);
      }
    } catch (error) {
      setDeposit(null);
      Alert.alert('Deposit Failed', error.message);
    } finally {
      setLoading(false);
    }
  }, [amount, phoneNumber, pollForConfirmation, stopPolling]);

  return {
    amount,
    setAmount,
    phoneNumber,
    setPhoneNumber,
    loading,
    deposit,
    handleDeposit,
  };
};

export default useDepositScreen;
