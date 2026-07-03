import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ApiService from '../../../services/api';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';

const CreateChamaStep4 = ({
  chamaData,
  handleInputChange,
  showErrors,
  formErrors,
  colors,
  onRegistrationFeeStatusChange,
  user,
}) => {
  const [payRegistrationFee, setPayRegistrationFee] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const feeLabel = chamaData.group_type === 'chama' ? 'Monthly Subscription Fee' : 'Registration Fee';
  const feeAmount = 500;

  const handleFeeCheckbox = async (value) => {
    setPayRegistrationFee(value);
    setPaymentError('');
    
    if (value && onRegistrationFeeStatusChange) {
      onRegistrationFeeStatusChange('pending');
    }
    
    if (value) {
      await initiateFeePayment();
    }
  };

  const initiateFeePayment = async () => {
    setPaymentProcessing(true);
    setPaymentError('');
    try {
      const phone = user?.phone || user?.phoneNumber || '';
      if (!phone) {
        setPaymentError('No phone number found on your account. Please update your profile.');
        setPayRegistrationFee(false);
        return;
      }

      const paymentType = chamaData.group_type === 'contribution' ? 'contribution' : 'chama';
      const response = await ApiService.initiateRegistrationPayment(
        feeAmount,
        phone,
        paymentType,
        chamaData.id || 'pending'
      );

      if (response.success) {
        setPaymentCompleted(true);
        setPayRegistrationFee(false);
        Toast.show({ type: 'success', text1: 'Payment prompt sent to your phone' });
        if (onRegistrationFeeStatusChange) {
          onRegistrationFeeStatusChange('paid');
        }
      } else {
        setPaymentError(response.error || 'Payment failed');
        setPayRegistrationFee(false);
        if (onRegistrationFeeStatusChange) {
          onRegistrationFeeStatusChange('failed');
        }
      }
    } catch (error) {
      setPaymentError('Payment failed: ' + error.message);
      setPayRegistrationFee(false);
      if (onRegistrationFeeStatusChange) {
        onRegistrationFeeStatusChange('failed');
      }
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handlePayLater = () => {
    setPayRegistrationFee(false);
    setPaymentError('');
    if (onRegistrationFeeStatusChange) {
      onRegistrationFeeStatusChange('later');
    }
    Toast.show({ type: 'info', text1: 'You can pay later from settings' });
  };

  const handleSkipAndContinue = () => {
    if (onRegistrationFeeStatusChange) {
      onRegistrationFeeStatusChange('later');
    }
  };

  return (
    <View>
      <Card style={styles.section}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Settings & Rules
        </Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              {chamaData.group_type === 'contribution' ? 'Public Contribution Group' : 'Public Chama'}
            </Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              {chamaData.group_type === 'contribution'
                ? 'Allow others to discover and join your contribution group'
                : 'Allow others to discover and join your chama'
              }
            </Text>
          </View>
          <Switch
            value={!!chamaData.is_public}
            onValueChange={(value) => handleInputChange('is_public', !!value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              Require Approval
            </Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              New members need approval to join
            </Text>
          </View>
          <Switch
            value={!!chamaData.requires_approval}
            onValueChange={(value) => handleInputChange('requires_approval', !!value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {chamaData.group_type === 'chama' && (
          <Input
            label="Chama Rules (Optional)"
            value={chamaData.rules}
            onChangeText={(text) => handleInputChange('rules', text)}
            placeholder="Define rules and guidelines for your chama..."
            multiline
            numberOfLines={4}
            error={showErrors && formErrors.rules}
          />
        )}

        <Input
          label="Meeting Schedule (Optional)"
          value={chamaData.meeting_schedule}
          onChangeText={(text) => handleInputChange('meeting_schedule', text)}
          placeholder={chamaData.group_type === 'contribution'
            ? 'e.g., Weekly check-ins every Sunday at 7 PM'
            : 'e.g., Every first Saturday of the month at 2 PM'
          }
          error={showErrors && formErrors.meeting_schedule}
        />

        {chamaData.group_type === 'contribution' && (
          <View style={[styles.infoBox, { backgroundColor: colors.info + '10', borderColor: colors.info }]}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <Text style={[styles.infoText, { color: colors.info, marginLeft: spacing.sm }]}>
              Contribution rules were set in Step 2. You can modify them later from the group settings.
            </Text>
          </View>
        )}

        {chamaData.group_type === 'chama' && (
          <View style={[styles.infoBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary, marginLeft: spacing.sm }]}>
              Monthly subscription fee of KES 1000 will be auto-deducted from the chama wallet on the 2nd of each month. Service fees for members will be managed separately.
            </Text>
          </View>
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          {feeLabel}
        </Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
          {chamaData.group_type === 'chama'
            ? `Pay KES ${feeAmount} monthly subscription fee to activate your chama. A payment prompt will be sent to your phone (${user?.phone || user?.phoneNumber || 'N/A'}). This will be auto-deducted on the 2nd of each month.`
            : `Pay KES ${feeAmount} one-time registration fee to activate your contribution group. A payment prompt will be sent to your phone (${user?.phone || user?.phoneNumber || 'N/A'}).`
          }
        </Text>

        {!paymentCompleted ? (
          <View>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => handleFeeCheckbox(!payRegistrationFee)}
              disabled={paymentProcessing}
            >
              <View style={[styles.checkbox, { borderColor: payRegistrationFee ? colors.primary : colors.border }]}>
                {payRegistrationFee && <Ionicons name="checkmark" size={16} color={colors.white} />}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                I want to pay the {feeLabel.toLowerCase()} now
              </Text>
            </TouchableOpacity>

            {paymentProcessing && (
              <View style={styles.processingContainer}>
                <Text style={[styles.processingText, { color: colors.primary }]}>
                  Processing payment... Check your phone for the STK push prompt.
                </Text>
              </View>
            )}

            {paymentError ? (
              <View style={[styles.errorBox, { backgroundColor: colors.error + '10', borderColor: colors.error }]}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error, marginLeft: spacing.sm }]}>
                  {paymentError}
                </Text>
              </View>
            ) : null}

            {paymentCompleted && (
              <View style={[styles.successBadge, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <Text style={[styles.successText, { color: colors.success }]}>
                  {feeLabel} paid successfully!
                </Text>
              </View>
            )}

            <View style={styles.actionButtonsRow}>
              <Button
                title="Skip & Continue"
                variant="outline"
                onPress={handleSkipAndContinue}
                style={styles.actionButton}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.successBadge, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success }]}>
              {feeLabel} paid successfully!
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'left',
    lineHeight: 24,
    letterSpacing: 0.2,
    width: '100%',
    flexShrink: 1,
    flexGrow: 1,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.md,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: typography.fontSize.sm,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  paymentActions: {
    gap: spacing.md,
  },
  payButton: {
    marginTop: spacing.sm,
  },
  payLaterButton: {
    marginTop: spacing.sm,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  successText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
});

export default CreateChamaStep4;
