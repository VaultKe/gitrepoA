import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../utils/theme';
import Input from './common/Input';
import Button from './common/Button';
import stkPushService from '../services/stkPushService';

const PaymentModal = ({ visible, onClose, chama, onSuccess }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);

  const handlePayment = async () => {
    if (!amount || !phone) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please enter amount and phone number'
      });
      return;
    }

    setLoading(true);
    
    try {
      const result = await stkPushService.startPayment({
        phone: phone,
        amount: amount,
        chamaId: chama.id,
        userId: user.id,
        description: `Contribution to ${chama.name}`
      });

      if (result.success) {
        setCheckoutRequestId(result.checkoutRequestId);
        Toast.show({
          type: 'success',
          text1: 'Payment Initiated',
          text2: result.message
        });
        
        // Start checking status
        checkPaymentStatus(result.checkoutRequestId);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Payment Failed',
          text2: result.message
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async (requestId) => {
    setCheckingStatus(true);
    let attempts = 0;
    const maxAttempts = 30; // Check for 5 minutes (30 * 10 seconds)

    const checkStatus = async () => {
      try {
        const result = await stkPushService.checkStatus(requestId);
        
        if (result.success) {
          // Payment successful
          Toast.show({
            type: 'success',
            text1: 'Payment Successful!',
            text2: `KES ${result.amount} paid successfully`
          });
          
          setCheckingStatus(false);
          onSuccess && onSuccess(result);
          onClose();
          return;
        }
        
        // Check if it's a final error (not pending)
        if (result.resultCode && result.resultCode !== 0) {
          Toast.show({
            type: 'error',
            text1: 'Payment Failed',
            text2: result.message
          });
          setCheckingStatus(false);
          return;
        }
        
        // Still pending, check again
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000); // Check every 10 seconds
        } else {
          Toast.show({
            type: 'error',
            text1: 'Payment Timeout',
            text2: 'Please check your M-Pesa messages'
          });
          setCheckingStatus(false);
        }
        
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000);
        } else {
          setCheckingStatus(false);
        }
      }
    };

    // Start checking after 5 seconds
    setTimeout(checkStatus, 5000);
  };

  const resetModal = () => {
    setAmount('');
    setPhone(user?.phone || '');
    setLoading(false);
    setCheckingStatus(false);
    setCheckoutRequestId(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Make Payment
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Chama Info */}
          <View style={[styles.chamaInfo, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.chamaName, { color: colors.text }]}>
              {chama?.name}
            </Text>
            <Text style={[styles.chamaType, { color: colors.textSecondary }]}>
              {chama?.category === 'contribution' ? 'Contribution Group' : 'Chama'}
            </Text>
          </View>

          {/* Payment Form */}
          <View style={styles.form}>
            <Input
              label="Amount (KES)"
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount"
              keyboardType="numeric"
            />
            
            <Input
              label="M-Pesa Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="254XXXXXXXXX"
              keyboardType="phone-pad"
            />
          </View>

          {/* Status */}
          {checkingStatus && (
            <View style={styles.status}>
              <Ionicons name="time" size={20} color={colors.primary} />
              <Text style={[styles.statusText, { color: colors.primary }]}>
                Waiting for payment confirmation...
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttons}>
            <Button
              title="Cancel"
              onPress={handleClose}
              variant="outline"
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <Button
              title={loading ? "Processing..." : "Pay Now"}
              onPress={handlePayment}
              loading={loading || checkingStatus}
              disabled={loading || checkingStatus}
              style={{ flex: 1, marginLeft: spacing.sm }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  chamaInfo: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  chamaName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  chamaType: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  form: {
    marginBottom: spacing.lg,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  buttons: {
    flexDirection: 'row',
  },
};

export default PaymentModal;
