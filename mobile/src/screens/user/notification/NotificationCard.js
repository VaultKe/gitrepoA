import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import { getTimeAgo } from '../../../utils/dateUtils';
import Toast from 'react-native-toast-message';
import ApiService from '../../../services/api';

const NotificationCard = React.memo(({ item, colors, screenWidth, onMarkAsRead, onDelete, smartNavigate }) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const isRead = item.isRead;

  const getNotificationIcon = (type, priority) => {
    switch (type) {
      case 'chama_invitation': return 'mail';
      case 'guarantor_request': return 'shield-checkmark';
      case 'chama':
      case 'member_joined': return 'people';
      case 'meeting_scheduled':
      case 'meeting_started':
      case 'meeting_created': return 'calendar';
      case 'loan_application_submitted':
      case 'loan_approved':
      case 'loan_disbursed':
      case 'loan_rejected':
      case 'loan_application_new':
      case 'loan_approved_member': return 'cash';
      case 'welfare_request_created':
      case 'welfare_approved':
      case 'welfare_rejected':
      case 'welfare_request_new':
      case 'welfare_approved_member': return 'heart';
      case 'contribution_recorded':
      case 'welfare_contribution_recorded':
      case 'loan_payment_recorded':
      case 'member_contribution':
      case 'member_welfare_contribution': return 'wallet';
      case 'financial': return 'card';
      case 'loan': return 'cash';
      case 'marketplace': return 'storefront';
      case 'system': return priority === 'high' ? 'warning' : 'information-circle';
      case 'support_update':
      case 'new_support_request': return 'help-circle';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type, priority) => {
    switch (type) {
      case 'chama_invitation':
      case 'chama':
      case 'member_joined': return colors.primary;
      case 'guarantor_request': return colors.warning;
      case 'meeting_scheduled':
      case 'meeting_started':
      case 'meeting_created': return colors.info;
      case 'loan_application_submitted':
      case 'loan_approved':
      case 'loan_disbursed':
      case 'loan_rejected':
      case 'loan_application_new':
      case 'loan_approved_member': return colors.warning;
      case 'welfare_request_created':
      case 'welfare_approved':
      case 'welfare_rejected':
      case 'welfare_request_new':
      case 'welfare_approved_member': return colors.error;
      case 'contribution_recorded':
      case 'welfare_contribution_recorded':
      case 'loan_payment_recorded':
      case 'member_contribution':
      case 'member_welfare_contribution': return colors.success;
      case 'financial': return colors.success;
      case 'loan': return colors.warning;
      case 'marketplace': return colors.info;
      case 'system': return priority === 'high' ? colors.error : colors.secondary;
      case 'support_update':
      case 'new_support_request': return colors.info;
      default: return colors.textSecondary;
    }
  };

  const iconColor = getNotificationColor(item.type, item.priority);

  return (
    <Card variant="outlined" style={[styles.notificationCard, {
      backgroundColor: isRead ? colors.background : colors.primary + '14',
      borderColor: isRead ? colors.divider : colors.primary + '4D',
      borderWidth: isRead ? 1 : 2,
    }]}>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={[styles.notificationIcon, { backgroundColor: iconColor + '26' }]}>
            <Ionicons name={getNotificationIcon(item.type, item.priority)} size={24} color={iconColor} />
          </View>

          <View style={styles.notificationInfo}>
            <View style={styles.titleRow}>
              <Text style={[styles.notificationTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.titleActions}>
                {!isRead && <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />}
              </View>
            </View>
            <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>
              {getTimeAgo(item.createdAt)}
            </Text>
          </View>
        </View>

        <Text style={[styles.notificationMessage, { color: colors.text }]} numberOfLines={3}>
          {item.message}
        </Text>

        {item.action_url && (
          <View style={styles.notificationAction}>
            <Text style={[styles.actionText, { color: colors.primary }]}>
              Tap to view details →
            </Text>
          </View>
        )}
      </View>

      <NotificationActions
        item={item}
        isRead={isRead}
        colors={colors}
        iconColor={iconColor}
        onMarkAsRead={onMarkAsRead}
        onDelete={onDelete}
        smartNavigate={smartNavigate}
      />
    </Card>
  );
});

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
  notificationCard: { marginBottom: screenWidth < 350 ? spacing.md : spacing.lg, overflow: 'hidden', minHeight: screenWidth < 350 ? 100 : 120, maxHeight: screenWidth < 350 ? 250 : 300 },
  notificationContent: { padding: screenWidth < 350 ? spacing.md : spacing.lg, paddingBottom: screenWidth < 350 ? spacing.sm : spacing.md },
  notificationHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: screenWidth < 350 ? spacing.md : spacing.lg, minHeight: screenWidth < 350 ? 40 : 48 },
  notificationIcon: { width: screenWidth < 350 ? 40 : 48, height: screenWidth < 350 ? 40 : 48, borderRadius: screenWidth < 350 ? 20 : 24, alignItems: 'center', justifyContent: 'center', marginRight: screenWidth < 350 ? spacing.md : spacing.lg, flexShrink: 0, marginTop: 2 },
  notificationInfo: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: screenWidth < 350 ? spacing.xs : spacing.sm, minHeight: screenWidth < 350 ? 20 : 24 },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0, marginTop: 2 },
  notificationTitle: { fontSize: screenWidth < 350 ? typography.fontSize.base : typography.fontSize.lg, fontWeight: typography.fontWeight.bold, flex: 1, marginRight: spacing.md, lineHeight: screenWidth < 350 ? 20 : 24 },
  notificationTime: { fontSize: screenWidth < 350 ? typography.fontSize.xs : typography.fontSize.sm, marginTop: spacing.xs, fontWeight: typography.fontWeight.medium },
  notificationMessage: { fontSize: screenWidth < 350 ? typography.fontSize.sm : typography.fontSize.base, lineHeight: screenWidth < 350 ? 20 : 22, marginBottom: screenWidth < 350 ? spacing.sm : spacing.md, fontWeight: typography.fontWeight.normal },
  notificationAction: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)' },
  actionText: { fontSize: screenWidth < 350 ? typography.fontSize.sm : typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  guarantorActions: { flex: 1, justifyContent: 'space-between' },
  guarantorStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, gap: spacing.xs },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, gap: spacing.xs },
  actionButtonText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },
});

export default NotificationCard;
