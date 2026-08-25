import React from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import Button from '../common/Button';
import OTPVerificationModal from '../common/OTPVerificationModal';

const ViewMemberActionsSection = ({
  userRole,
  memberData,
  user,
  removeLoading,
  showRemoveConfirm,
  showOTPModal,
  selectedApprovalItem,
  approvalActionType,
  otpLoading,
  onRemoveMember,
  onConfirmRemove,
  onCancelRemove,
  onVerifyOTP,
  onResendOTP,
  onCloseOTP,
  getMemberName,
  formatCurrency,
  styles,
  colors,
}) => {
  const canRemove = userRole === 'chairperson' && memberData?.user_id !== user?.id && memberData?.is_active !== false;

  return (
    <>
      {canRemove && (
        <Card variant="outlined" padding="none" style={[styles.actionsCard, { borderWidth: 1, borderColor: colors.border }]}>
          <View style={styles.actionsCardContent}>
            <Text style={[styles.sectionTitle, styles.sectionTitleText]}>Actions</Text>
            <TouchableOpacity style={[styles.actionButton, styles.removeButton, styles.removeButtonOutline]} onPress={onRemoveMember} disabled={removeLoading}>
              {removeLoading ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Ionicons name="person-remove" size={20} color={colors.error} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextError]}>Remove from Chama</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>
      )}

      <OTPVerificationModal
        visible={showOTPModal}
        onClose={onCloseOTP}
        title={approvalActionType === 'approve' ? 'Approve Disbursement' : 'Verify Disbursement'}
        subtitle={`Enter the OTP sent to your phone to ${approvalActionType || 'verify'} this ${selectedApprovalItem?.type || 'disbursement'}`}
        onVerify={onVerifyOTP}
        onResend={onResendOTP}
        loading={otpLoading}
        itemType={selectedApprovalItem?.type}
      />

      <Modal visible={showRemoveConfirm} transparent animationType="fade">
        <TouchableOpacity style={styles.removeConfirmOverlay} activeOpacity={1} onPress={onCancelRemove}>
          <View style={styles.removeConfirmCard}>
            <Text style={styles.removeConfirmTitle}>Remove Member</Text>
            <Text style={styles.removeConfirmMessage}>
              Are you sure you want to remove {getMemberName(memberData)} from the chama? This action cannot be undone.
            </Text>
            <View style={styles.removeConfirmActions}>
              <TouchableOpacity style={[styles.removeConfirmBtn, styles.removeConfirmCancel]} onPress={onCancelRemove} disabled={removeLoading}>
                <Text style={styles.removeConfirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.removeConfirmBtn, styles.removeConfirmDestructive]} onPress={onConfirmRemove} disabled={removeLoading}>
                {removeLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.removeConfirmDestructiveText}>Remove</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default ViewMemberActionsSection;
