import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import ApiService from '../../services/api';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

const WALLET_TYPES = [
  { id: 'merry-go-round', label: 'Merry-go-round Contribution', icon: 'swap-horizontal' },
  { id: 'welfare', label: 'Welfare Contribution', icon: 'heart' },
  { id: 'savings', label: 'Savings', icon: 'wallet' },
  { id: 'shares', label: 'Shares', icon: 'cube' },
  { id: 'dividends', label: 'Dividends', icon: 'cash' },
  { id: 'loans', label: 'Loans', icon: 'cash-outline' },
];

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
  const [uploadingRules, setUploadingRules] = useState(false);

  const feeLabel = chamaData.group_type === 'chama' ? 'Monthly Subscription Fee' : 'Registration Fee';
  const feeAmount = 500;
  const selectedWalletTypes = chamaData.wallet_types || [];

  const toggleWalletType = (walletType) => {
    const current = selectedWalletTypes;
    const updated = current.includes(walletType)
      ? current.filter(w => w !== walletType)
      : [...current, walletType];
    handleInputChange('wallet_types', updated);
  };

  const handleRulesFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const document = result.assets[0];
        if (document.mimeType && document.mimeType !== 'application/pdf') {
          Toast.show({ type: 'error', text1: 'Invalid file type', text2: 'Only PDF files are accepted for rules' });
          return;
        }
        handleInputChange('rules_file', {
          uri: document.uri,
          name: document.name,
          mimeType: document.mimeType || 'application/pdf',
          size: document.size,
        });
        Toast.show({ type: 'success', text1: 'Rules PDF attached successfully' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed to pick document', text2: error.message });
    }
  };

  const handleRemoveRulesFile = () => {
    handleInputChange('rules_file', null);
    Toast.show({ type: 'info', text1: 'Rules PDF removed' });
  };

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
      <Card style={styles.section} variant="outlined">
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Wallet Types
        </Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
          Select the wallet types you want to enable for your {chamaData.group_type === 'contribution' ? 'group' : 'chama'}. You must select at least one.
        </Text>

        {WALLET_TYPES.map((wallet) => {
          const isSelected = selectedWalletTypes.includes(wallet.id);
          return (
            <TouchableOpacity
              key={wallet.id}
              style={styles.walletTypeRow}
              onPress={() => toggleWalletType(wallet.id)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.walletCheckbox,
                { 
                  borderColor: isSelected ? colors.primary : colors.border, 
                  backgroundColor: isSelected ? colors.primary : 'transparent' 
                }
              ]}>
                {isSelected && <Ionicons name="checkmark" size={16} color={colors.white} />}
              </View>
              <Ionicons 
                name={wallet.icon} 
                size={22} 
                color={isSelected ? colors.primary : colors.textSecondary} 
                style={{ marginRight: spacing.sm }} 
              />
              <Text style={[
                styles.walletTypeLabel, 
                { color: isSelected ? colors.text : colors.textSecondary }
              ]}>
                {wallet.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {showErrors && formErrors.wallet_types && (
          <Text style={[styles.fieldError, { color: colors.error, marginTop: spacing.sm }]}>
            {formErrors.wallet_types}
          </Text>
        )}

        <View style={[styles.infoBox, { backgroundColor: colors.info + '10', borderColor: colors.info, marginTop: spacing.md }]}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={[styles.infoText, { color: colors.info, marginLeft: spacing.sm }]}>
            You can add the remaining wallet types later from the {chamaData.group_type === 'contribution' ? 'group' : 'chama'} settings page after creation.
          </Text>
        </View>
      </Card>

      <Card style={styles.section} variant="outlined">
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

        <View style={styles.rulesSection}>
          <Text style={[styles.label, { color: colors.text }]}>
            {chamaData.group_type === 'chama' ? 'Chama Rules' : 'Group Rules'} <Text style={{ color: colors.textSecondary }}>(Optional)</Text>
          </Text>

          <TouchableOpacity
            style={[styles.pdfUploadButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handleRulesFilePick}
            disabled={uploadingRules}
            activeOpacity={0.7}
          >
            <Ionicons name="document-attach-outline" size={24} color={colors.primary} />
            <View style={styles.pdfUploadText}>
              <Text style={[styles.pdfUploadTitle, { color: colors.text }]}>
                {chamaData.rules_file ? 'Change Rules PDF' : 'Upload Rules (PDF only)'}
              </Text>
              <Text style={[styles.pdfUploadSubtitle, { color: colors.textSecondary }]}>
                Attach a PDF document with your {chamaData.group_type === 'chama' ? 'chama' : 'group'} rules
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {chamaData.rules_file && (
            <View style={[styles.attachedFile, { backgroundColor: colors.success + '10', borderColor: colors.success }]}>
              <Ionicons name="document-text" size={20} color={colors.success} />
              <Text style={[styles.attachedFileName, { color: colors.success, flex: 1 }]} numberOfLines={1}>
                {chamaData.rules_file.name}
              </Text>
              <TouchableOpacity onPress={handleRemoveRulesFile} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}

          {chamaData.group_type === 'chama' && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[styles.orText, { color: colors.textSecondary }]}>
                Or type your rules below:
              </Text>
              <Input
                label=""
                value={chamaData.rules}
                onChangeText={(text) => handleInputChange('rules', text)}
                placeholder="Define rules and guidelines for your chama..."
                multiline
                numberOfLines={4}
                error={showErrors && formErrors.rules}
              />
            </View>
          )}
        </View>

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

      <Card style={styles.section} variant="outlined">
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
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
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
  walletTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  walletCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  walletTypeLabel: {
    fontSize: typography.fontSize.base,
    flex: 1,
    fontWeight: typography.fontWeight.medium,
  },
  rulesSection: {
    marginBottom: spacing.md,
  },
  orText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  pdfUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  pdfUploadText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  pdfUploadTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  pdfUploadSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  attachedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  attachedFileName: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
  fieldError: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
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
  processingContainer: {
    marginBottom: spacing.lg,
  },
  processingText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});

export default CreateChamaStep4;
