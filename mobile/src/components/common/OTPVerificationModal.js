import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Button from '../common/Button';
import { useApp } from '../../context/AppContext';

const OTPVerificationModal = ({
  visible,
  onClose,
  title = 'Verify Your Identity',
  subtitle = 'Enter the OTP sent to your phone to approve this disbursement.',
  onVerify,
  onResend,
  loading = false,
  chamaName = '',
  itemType = 'disbursement',
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (visible) {
      setOtp('');
    }
  }, [visible]);

  const handleVerify = () => {
    if (!otp.trim() || otp.trim().length < 4) {
      Alert.alert('Invalid OTP', 'Please enter a valid OTP code.');
      return;
    }
    onVerify?.(otp.trim());
  };

  const handleResend = () => {
    setOtp('');
    onResend?.();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>

          {chamaName ? (
            <View style={[styles.chamaBadge, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="people" size={14} color={colors.primary} />
              <Text style={[styles.chamaBadgeText, { color: colors.primary }]}>
                {chamaName}
              </Text>
            </View>
          ) : null}

          <View style={[styles.otpContainer, { borderColor: colors.border }]}>
            <TextInput
              style={[styles.otpInput, { color: colors.text }]}
              placeholder="Enter OTP code"
              placeholderTextColor={colors.textSecondary}
              value={otp}
              onChangeText={setOtp}
              keyboardType="numeric"
              maxLength={8}
              autoFocus
              editable={!loading}
            />
            <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
          </View>

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            OTP was sent to your registered phone number
          </Text>

          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ backgroundColor: colors.textSecondary, flex: 1 }}
              textStyle={{ color: colors.white }}
            />
            <View style={{ width: spacing.sm }} />
            <Button
              title={loading ? 'Verifying...' : 'Verify'}
              onPress={handleVerify}
              style={{ backgroundColor: colors.primary, flex: 1 }}
              loading={loading}
              disabled={loading}
            />
          </View>

          <TouchableOpacity
            style={styles.resendRow}
            onPress={handleResend}
            disabled={loading}
          >
            <Text style={[styles.resendText, { color: colors.primary }]}>
              Didn't receive OTP? Resend
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    ...shadows.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  chamaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  chamaBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  otpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  otpInput: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: 4,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendRow: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  resendText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

export default OTPVerificationModal;
