import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import { formatDate, getInvitationStatus } from './chamaMembersUtils';

const ChamaInvitationCard = ({
  item,
  onResend,
  onCancel,
}) => {
  const colors = getThemeColors();
  const styles = createStyles(colors);
  const statusInfo = getInvitationStatus(item, colors);
  const isExpired = statusInfo.status === 'expired';
  const isPending = statusInfo.status === 'pending';

  return (
    <Card variant="outlined" style={[styles.invitationCard, isExpired && styles.invitationCardExpired]}>
      <View style={styles.invitationHeader}>
        <View style={styles.invitationInfo}>
          <Text style={[styles.inviteeEmail, styles.inviteeEmailText]}>
            {item.email}
          </Text>
          {item.phone_number && (
            <Text style={[styles.inviteePhone, styles.inviteePhoneText]}>
              {item.phone_number}
            </Text>
          )}
          {item.role && (
            <View style={styles.invitationRole}>
              <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
              <Text style={[styles.roleText, styles.roleTextPrimary]}>
                {item.role_name || item.role}
              </Text>
            </View>
          )}
        </View>

        <View style={getInvitationStatusBadgeStyle(statusInfo.status, styles)}>
          <Text style={getInvitationStatusTextStyle(statusInfo.status, styles)}>
            {statusInfo.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.invitationDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailLabel, styles.detailLabelText]}>
            Sent:
          </Text>
          <Text style={[styles.detailValue, styles.detailValueText]}>
            {formatDate(item.created_at)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailLabel, styles.detailLabelText]}>
            Expires:
          </Text>
          <Text style={[styles.detailValue, isExpired ? styles.detailValueTextError : styles.detailValueText]}>
            {formatDate(item.expires_at)}
          </Text>
        </View>

        {item.responded_at && (
          <View style={styles.detailRow}>
            <Ionicons name="checkmark-circle" size={16} color={statusInfo.color} />
            <Text style={[styles.detailLabel, styles.detailLabelText]}>
              Responded:
            </Text>
            <Text style={[styles.detailValue, styles.detailValueText]}>
              {formatDate(item.responded_at)}
            </Text>
          </View>
        )}
      </View>

      {item.message && (
        <View style={styles.messageContainer}>
          <Text style={[styles.messageLabel, styles.messageLabelText]}>
            Message:
          </Text>
          <Text style={[styles.messageText, styles.messageTextText]} numberOfLines={2}>
            {item.message}
          </Text>
        </View>
      )}

      {isPending && (
        <View style={styles.invitationActions}>
          <Button
            title="Resend"
            variant="outline"
            size="small"
            onPress={() => onResend(item.id)}
            style={styles.actionButton}
            icon={<Ionicons name="refresh" size={16} color={colors.primary} />}
          />
          <Button
            title="Cancel"
            variant="outline"
            size="small"
            onPress={() => onCancel(item.id)}
            style={[styles.actionButton, styles.actionButtonError]}
            textStyle={styles.errorButtonText}
            icon={<Ionicons name="close" size={16} color={colors.error} />}
          />
        </View>
      )}
    </Card>
  );
};

const getInvitationStatusBadgeStyle = (status, styles) => {
  switch (status) {
    case 'accepted':
      return [styles.statusBadge, styles.statusBadgeSuccess];
    case 'rejected':
      return [styles.statusBadge, styles.statusBadgeError];
    case 'cancelled':
      return [styles.statusBadge, styles.statusBadgeMuted];
    case 'expired':
      return [styles.statusBadge, styles.statusBadgeWarning];
    default:
      return [styles.statusBadge, styles.statusBadgePrimary];
  }
};

const getInvitationStatusTextStyle = (status, styles) => {
  switch (status) {
    case 'accepted':
      return [styles.statusText, styles.statusTextSuccess];
    case 'rejected':
      return [styles.statusText, styles.statusTextError];
    case 'cancelled':
      return [styles.statusText, styles.statusTextMuted];
    case 'expired':
      return [styles.statusText, styles.statusTextWarning];
    default:
      return [styles.statusText, styles.statusTextPrimary];
  }
};

const createStyles = (colors) => StyleSheet.create({
  invitationCard: {
    marginBottom: spacing.md,
  },
  invitationCardExpired: {
    opacity: 0.7,
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  invitationInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  inviteeEmail: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  inviteeEmailText: {
    color: colors.text,
  },
  inviteePhone: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  inviteePhoneText: {
    color: colors.textSecondary,
  },
  invitationRole: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  roleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  roleTextPrimary: {
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  statusBadgePrimary: {
    backgroundColor: colors.primary + '20',
  },
  statusBadgeSuccess: {
    backgroundColor: colors.success + '20',
  },
  statusBadgeError: {
    backgroundColor: colors.error + '20',
  },
  statusBadgeMuted: {
    backgroundColor: colors.textSecondary + '20',
  },
  statusBadgeWarning: {
    backgroundColor: colors.warning + '20',
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  statusTextPrimary: {
    color: colors.primary,
  },
  statusTextSuccess: {
    color: colors.success,
  },
  statusTextError: {
    color: colors.error,
  },
  statusTextMuted: {
    color: colors.textSecondary,
  },
  statusTextWarning: {
    color: colors.warning,
  },
  invitationDetails: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    minWidth: 80,
  },
  detailLabelText: {
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  detailValueText: {
    color: colors.text,
  },
  detailValueTextError: {
    color: colors.error,
  },
  messageContainer: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
  },
  messageLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  messageLabelText: {
    color: colors.textSecondary,
  },
  messageText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  messageTextText: {
    color: colors.text,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonError: {
    borderColor: colors.error,
  },
  errorButtonText: {
    color: colors.error,
  },
});

export default ChamaInvitationCard;
