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
  theme,
}) => {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);
  const statusInfo = getInvitationStatus(item, colors);
  const isExpired = statusInfo.status === 'expired';
  const isPending = statusInfo.status === 'pending';

  const statusStyle = {
    accepted: { color: colors.success, bgColor: colors.success + '20' },
    rejected: { color: colors.error, bgColor: colors.error + '20' },
    cancelled: { color: colors.textSecondary, bgColor: colors.textSecondary + '20' },
    expired: { color: colors.warning, bgColor: colors.warning + '20' },
    pending: { color: colors.primary, bgColor: colors.primary + '20' },
  }[statusInfo.status] || { color: colors.primary, bgColor: colors.primary + '20' };

  return (
    <Card variant="default" style={{ borderRadius: 8, overflow: 'hidden', marginBottom: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.text, marginBottom: spacing.xs }} numberOfLines={1}>
              {item.email}
            </Text>
            {item.phone_number && (
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs }}>
                {item.phone_number}
              </Text>
            )}
            {item.role && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
                <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.primary, marginLeft: spacing.xs }}>
                  {item.role_name || item.role}
                </Text>
              </View>
            )}
          </View>

          <View style={[
            { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginLeft: spacing.sm },
            { backgroundColor: statusStyle.bgColor }
          ]}>
            <Text style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, textTransform: 'capitalize', color: statusStyle.color }}>
              {statusInfo.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.sm, marginBottom: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="calendar" size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 60 }}>Sent:</Text>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.text, flex: 1 }}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="time" size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 60 }}>Expires:</Text>
            <Text style={{ fontSize: typography.fontSize.sm, color: isExpired ? colors.error : colors.text, flex: 1 }}>{formatDate(item.expires_at)}</Text>
          </View>

          {item.responded_at && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="checkmark-circle" size={16} color={statusInfo.color} />
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 60 }}>Responded:</Text>
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.text, flex: 1 }}>{formatDate(item.responded_at)}</Text>
            </View>
          )}
        </View>

        {item.message && (
          <View style={{ marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.background, borderRadius: borderRadius.md }}>
            <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.xs }}>Message:</Text>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.text }} numberOfLines={2}>{item.message}</Text>
          </View>
        )}

        {isPending && (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              title="Resend"
              variant="outline"
              size="small"
              onPress={() => onResend(item.id)}
              style={{ flex: 1 }}
              icon={<Ionicons name="refresh" size={16} color={colors.primary} />}
            />
            <Button
              title="Cancel"
              variant="outline"
              size="small"
              onPress={() => onCancel(item.id)}
              style={[{ flex: 1, borderColor: colors.error }]}
              textStyle={{ color: colors.error }}
              icon={<Ionicons name="close" size={16} color={colors.error} />}
            />
          </View>
        )}
      </View>
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
    borderColor: colors.border,
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
    backgroundColor: colors.surface,
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
