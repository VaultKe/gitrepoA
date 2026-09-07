import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ApiService from '../../services/api';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const NotificationActions = React.memo(({ item, isRead, colors, iconColor, onMarkAsRead, onDelete }) => {
  const [submitting, setSubmitting] = React.useState(null); // 'accept' | 'decline' | null

  // Fall back to the data payload's role so the Accept/Decline UI still renders
  // if the notification type was stored under a different label.
  let parsedData = {};
  try { parsedData = typeof item.data === 'string' ? JSON.parse(item.data || '{}') : (item.data || {}); } catch {}
  const role = parsedData.role;
  const isGuarantor = item.type === 'guarantor_request' || role === 'guarantor' || (!!parsedData.guarantor_id && role !== 'referee');
  const isReferee = item.type === 'referee_request' || role === 'referee' || (!!parsedData.referee_id && !parsedData.guarantor_id);

  if (isGuarantor || isReferee) {
    const roleLabel = isReferee ? 'referee' : 'guarantee';

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

    const respond = async (action) => {
      if (submitting) return; // guard double-tap
      setSubmitting(action);
      const loanData = parsedData;
      const refId = loanData.referee_id;
      const gId = loanData.guarantor_id;
      const loanId = loanData.loan_id;

      // No usable identifiers → tell the user plainly instead of a silent no-op.
      if (isReferee ? !refId : (!gId || !loanId)) {
        setSubmitting(null);
        Toast.show({ type: 'error', text1: 'Cannot respond', text2: 'This request is missing information. Pull to refresh and try again.', position: 'bottom', visibilityTime: 3000 });
        return;
      }

      try {
        const response = isReferee
          ? await ApiService.respondToRefereeRequest(refId, action)
          : await ApiService.respondToGuarantorRequest(loanId, { guarantorId: gId, action });

        const msg = (response && (response.error || response.message)) || '';
        const alreadyDone = /not found|already|not authorized|no longer/i.test(msg);

        if (response?.success || alreadyDone) {
          // Best-effort mark-read — never let its failure look like the whole
          // action failed (the response already succeeded).
          try { await onMarkAsRead(item.id); } catch {}
          Toast.show({
            type: action === 'accept' ? 'success' : 'info',
            text1: alreadyDone ? 'Already handled' : (action === 'accept' ? 'Request Accepted' : 'Request Declined'),
            text2: alreadyDone
              ? 'This request was already responded to.'
              : `You have ${action}ed the loan ${roleLabel} request`,
            position: 'bottom',
            visibilityTime: 2000,
          });
        } else {
          throw new Error(msg || `Failed to ${action} ${roleLabel}`);
        }
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Action Failed', text2: error?.message || `Could not ${action}. Please try again.`, position: 'bottom', visibilityTime: 3000 });
      } finally {
        setSubmitting(null);
      }
    };

    return (
      <View style={[styles.actionButtonsRow, styles.guarantorActions]}>
        <TouchableOpacity
          disabled={!!submitting}
          style={[styles.actionButton, { backgroundColor: colors.success + '26', borderColor: colors.success, borderWidth: 1 }, submitting && submitting !== 'accept' && { opacity: 0.4 }]}
          onPress={() => respond('accept')}
        >
          {submitting === 'accept'
            ? <ActivityIndicator size="small" color={colors.success} />
            : <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
          <Text style={[styles.actionButtonText, { color: colors.success }]}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!!submitting}
          style={[styles.actionButton, { backgroundColor: colors.error + '26', borderColor: colors.error, borderWidth: 1 }, submitting && submitting !== 'decline' && { opacity: 0.4 }]}
          onPress={() => respond('decline')}
        >
          {submitting === 'decline'
            ? <ActivityIndicator size="small" color={colors.error} />
            : <Ionicons name="close-circle" size={16} color={colors.error} />}
          <Text style={[styles.actionButtonText, { color: colors.error }]}>Decline</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.actionButtonsRow, !isRead && { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
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
