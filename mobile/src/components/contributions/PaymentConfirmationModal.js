import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Button from '../common/Button';

const PaymentConfirmationModal = ({
  visible,
  onClose,
  amount,
  paymentMethod,
  walletBalance,
  selectedContributor,
  chama,
  user,
  loading,
  onConfirm,
  formatCurrency,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Confirm Contribution
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.confirmationRow}>
              <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                Amount:
              </Text>
              <Text style={[styles.confirmationValue, { color: colors.text }]}>
                {formatCurrency(parseFloat(amount || 0))}
              </Text>
            </View>

            <View style={styles.confirmationRow}>
              <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                Payment Method:
              </Text>
              <Text style={[styles.confirmationValue, { color: colors.text }]}>
                {paymentMethod === 'wallet' ? 'VaultKe Wallet' :
                 paymentMethod === 'mpesa' ? 'M-Pesa' :
                 paymentMethod === 'pay_for' ? 'Pay for Someone' : 'Unknown'}
              </Text>
            </View>

            {paymentMethod === 'wallet' && (
              <View style={styles.confirmationRow}>
                <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                  Wallet Balance:
                </Text>
                <Text style={[styles.confirmationValue, { color: colors.text }]}>
                  {formatCurrency(walletBalance)}
                </Text>
              </View>
            )}

            {paymentMethod === 'mpesa' && (
              <View style={styles.confirmationRow}>
                <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                  M-Pesa Number:
                </Text>
                <Text style={[styles.confirmationValue, { color: colors.text }]}>
                  {user?.phone || 'Not available'}
                </Text>
              </View>
            )}

            {paymentMethod === 'pay_for' && (
              <>
                <View style={styles.confirmationRow}>
                  <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                    Paying For:
                  </Text>
                  <Text style={[styles.confirmationValue, { color: colors.text }]}>
                    {selectedContributor?.fullName || 'Not selected'}
                  </Text>
                </View>

                <View style={styles.confirmationRow}>
                  <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                    Your Wallet Balance:
                  </Text>
                  <Text style={[styles.confirmationValue, { color: colors.text }]}>
                    {formatCurrency(walletBalance)}
                  </Text>
                </View>

                <View style={styles.confirmationRow}>
                  <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                    After Payment:
                  </Text>
                  <Text style={[styles.confirmationValue, { color: colors.text }]}>
                    {formatCurrency(Math.max(0, walletBalance - parseFloat(amount || 0)))}
                  </Text>
                </View>

                <View style={[styles.cashConfirmationNotice, { backgroundColor: colors.info + '20', borderColor: colors.info }]}>
                  <Ionicons name="information-circle" size={16} color={colors.info} />
                  <Text style={[styles.cashConfirmationNoticeText, { color: colors.text }]}>
                    KES {formatCurrency(parseFloat(amount || 0))} will be deducted from your wallet. {selectedContributor?.fullName || 'The selected member'} will appear to have paid this amount.
                  </Text>
                </View>
              </>
            )}

            <View style={styles.confirmationRow}>
              <Text style={[styles.confirmationLabel, { color: colors.textSecondary }]}>
                Contributing to:
              </Text>
              <Text style={[styles.confirmationValue, { color: colors.text }]}>
                {chama?.name}
              </Text>
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={onClose}
              style={styles.modalCancelButton}
            />
            <Button
              title={
                paymentMethod === 'wallet' ? 'Confirm Transfer' :
                paymentMethod === 'mpesa' ? 'Pay with M-Pesa' :
                paymentMethod === 'pay_for' ? 'Confirm Payment' : 'Confirm'
              }
              onPress={onConfirm}
              loading={loading}
              variant="outline"
              style={styles.modalConfirmButton}
              icon={
                <Ionicons
                  name={
                    paymentMethod === 'wallet' ? 'wallet' :
                    paymentMethod === 'mpesa' ? 'phone-portrait' :
                    paymentMethod === 'pay_for' ? 'people' : 'checkmark'
                  }
                  size={20}
                  color={colors.primary}
                />
              }
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.lg,
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmationLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  confirmationValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginRight: spacing.xs,
  },
  modalConfirmButton: {
    flex: 2,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginLeft: spacing.xs,
  },
  cashConfirmationNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  cashConfirmationNoticeText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});

export default PaymentConfirmationModal;