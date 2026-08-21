import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ApiService from '../../services/api';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const NotificationActions = React.memo(({ item, isRead, colors, iconColor, onMarkAsRead, onDelete }) => {
  if (item.type === 'guarantor_request') {
    if (isRead) {
      return (
        <View style={[styles.actionButtonsRow, styles.guarantorActions]}>
          <View style={[styles.guarantorStatus, { backgroundColor: colors.success + '26', borderColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.actionButtonText, { color: colors.success }]}>Already Responded</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.actionButtonsRow, styles.guarantorActions]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.success + '26', borderColor: colors.success, borderWidth: 1 }]}
          onPress={async () => {
            try {
              const loanData = JSON.parse(item.data || '{}');
              const response = await ApiService.respondToGuaranteeRequest(loanData.loan_id, { guarantorId: loanData.guarantor_id, action: 'accept' });
              if (response.success) {
                await onMarkAsRead(item.id);
                Toast.show({ type: 'success', text1: 'Guarantee Accepted', text2: 'You have accepted the loan guarantee request', position: 'bottom', visibilityTime: 2000 });
              } else {
                throw new Error(response.error || 'Failed to accept guarantee');
              }
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Action Failed', text2: 'Could not accept guarantee. Please try again.', position: 'bottom', visibilityTime: 3000 });
            }
          }}
        >
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.actionButtonText, { color: colors.success }]}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.error + '26', borderColor: colors.error, borderWidth: 1 }]}
          onPress={async () => {
            try {
              const loanData = JSON.parse(item.data || '{}');
              const response = await ApiService.respondToGuaranteeRequest(loanData.loan_id, { guarantorId: loanData.guarantor_id, action: 'decline' });
              if (response.success) {
                await onMarkAsRead(item.id);
                Toast.show({ type: 'info', text1: 'Guarantee Declined', text2: 'You have declined the loan guarantee request', position: 'bottom', visibilityTime: 2000 });
              } else {
                throw new Error(response.error || 'Failed to decline guarantee');
              }
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Action Failed', text2: 'Could not decline guarantee. Please try again.', position: 'bottom', visibilityTime: 3000 });
            }
          }}
        >
          <Ionicons name="close-circle" size={16} color={colors.error} />
          <Text style={[styles.actionButtonText, { color: colors.error }]}>Decline</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.actionButtonsRow, !isRead && { borderTopWidth: 1, borderTopColor: colors.divider + '80', backgroundColor: colors.backgroundSecondary }]}>
      {!isRead && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary + '26' }]}
          onPress={async () => {
            try {
              await onMarkAsRead(item.id);
              Toast.show({ type: 'success', text1: 'Marked as Read', text2: 'Notification has been marked as read', position: 'bottom', visibilityTime: 1500 });
            } catch (error) {
              // Error already handled in onMarkAsRead
            }
          }}
        >
          <Ionicons name="checkmark" size={16} color={colors.primary} />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>Mark Read</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.error + '26', borderColor: colors.error + '80', borderWidth: 1 }]}
        onPress={async () => {
          try {
            await onDelete(item.id);
            Toast.show({ type: 'success', text1: 'Notification Deleted', text2: 'The notification has been removed successfully', position: 'bottom', visibilityTime: 2000 });
          } catch (error) {
            // Error already handled in onDelete
          }
        }}
      >
        <Ionicons name="trash" size={18} color={colors.error} />
        <Text style={[styles.actionButtonText, { color: colors.error }]}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  guarantorActions: { flex: 1, justifyContent: 'space-between' },
  guarantorStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, gap: spacing.xs },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, gap: spacing.xs },
  actionButtonText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },
});

export default NotificationActions;
