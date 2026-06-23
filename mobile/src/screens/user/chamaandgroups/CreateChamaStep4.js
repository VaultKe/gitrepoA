import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ApiService from '../../../services/api';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
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
}) => {
  const [payRegistrationFee, setPayRegistrationFee] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  const handleFeeCheckbox = (value) => {
    setPayRegistrationFee(value);
    if (onRegistrationFeeStatusChange) {
      onRegistrationFeeStatusChange(value ? 'pending' : 'later');
    }
  };

  const handlePayRegistrationFee = async () => {
    setPaymentProcessing(true);
    try {
      const paymentType = chamaData.group_type === 'contribution' ? 'contribution' : 'chama';
      const response = await ApiService.initiateRegistrationPayment(50, '', paymentType, chamaData.id || 'pending');
      if (response.success) {
        setPaymentCompleted(true);
        setPayRegistrationFee(false);
        Toast.show({ type: 'success', text1: 'Registration fee paid successfully' });
        if (onRegistrationFeeStatusChange) {
          onRegistrationFeeStatusChange('paid');
        }
      } else {
        Toast.show({ type: 'error', text1: response.error || 'Payment failed' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Payment failed', text2: error.message });
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handlePayLater = () => {
    setPayRegistrationFee(false);
    if (onRegistrationFeeStatusChange) {
      onRegistrationFeeStatusChange('later');
    }
    Toast.show({ type: 'info', text1: 'You can pay registration fee later from settings' });
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
            value={chamaData.is_public}
            onValueChange={(value) => handleInputChange('is_public', value)}
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
            value={chamaData.requires_approval}
            onValueChange={(value) => handleInputChange('requires_approval', value)}
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
      </Card>

      <Card style={styles.section}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Registration Fee
        </Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
          {chamaData.group_type === 'chama'
            ? 'Pay KES 50 registration fee to activate your chama. Members also pay KES 50 each during onboarding.'
            : 'Pay KES 50 registration fee to activate your contribution group.'}
        </Text>

        {!paymentCompleted ? (
          <View>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => handleFeeCheckbox(!payRegistrationFee)}
            >
              <View style={[styles.checkbox, { borderColor: payRegistrationFee ? colors.primary : colors.border }]}>
                {payRegistrationFee && <Ionicons name="checkmark" size={16} color={colors.white} />}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                I want to pay the registration fee now
              </Text>
            </TouchableOpacity>

            {payRegistrationFee && (
              <View style={styles.paymentActions}>
                <Button
                  title={paymentProcessing ? 'Processing...' : 'Pay KES 50'}
                  onPress={handlePayRegistrationFee}
                  loading={paymentProcessing}
                  style={styles.payButton}
                />
                <Button
                  title="Pay Later"
                  variant="outline"
                  onPress={handlePayLater}
                  style={styles.payLaterButton}
                />
              </View>
            )}

            {!payRegistrationFee && (
              <Button
                title="Skip & Continue"
                variant="outline"
                onPress={handlePayLater}
                style={styles.payLaterButton}
              />
            )}
          </View>
        ) : (
          <View style={[styles.successBadge, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success }]}>
              Registration fee paid successfully!
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
