import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors } from '../../utils/theme';

const InvitationCard = ({
  invitation,
  respondingTo,
  onRespond,
  formatDate,
  formatCurrency,
  isExpired,
  colors,
}) => {
  const expired = isExpired(invitation.expires_at);
  const isResponding = respondingTo === invitation.id;

  return (
    <View
      style={[
        styles.invitationCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        expired && { opacity: 0.6 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.chamaInfo}>
          <Text style={[styles.chamaName, { color: colors.text }]}>
            {invitation.chama?.name || 'Unknown Chama'}
          </Text>
          <Text style={[styles.inviterInfo, { color: colors.textSecondary }]}>
            Invited by {invitation.inviter?.first_name} {invitation.inviter?.last_name}
          </Text>
        </View>

        {expired && (
          <View style={[styles.expiredBadge, { backgroundColor: colors.error + '20' }]}>
            <Text style={[styles.expiredText, { color: colors.error }]}>
              Expired
            </Text>
          </View>
        )}
      </View>

      <View style={styles.chamaDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="wallet" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Contribution:
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {formatCurrency(invitation.chama?.contribution_amount)} {invitation.chama?.contribution_frequency}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Invited:
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {formatDate(invitation.created_at)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Expires:
          </Text>
          <Text style={[styles.detailValue, { color: expired ? colors.error : colors.text }]}>
            {formatDate(invitation.expires_at)}
          </Text>
        </View>
      </View>

      {invitation.message && (
        <View style={styles.messageContainer}>
          <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>
            Message:
          </Text>
          <Text style={[styles.messageText, { color: colors.text }]}>
            {invitation.message}
          </Text>
        </View>
      )}

      {invitation.chama?.description && (
        <View style={styles.descriptionContainer}>
          <Text style={[styles.descriptionLabel, { color: colors.textSecondary }]}>
            About this chama:
          </Text>
          <Text style={[styles.descriptionText, { color: colors.text }]}>
            {invitation.chama.description}
          </Text>
        </View>
      )}

      {!expired && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton, { borderColor: colors.error }]}
            onPress={() => onRespond(invitation.id, 'reject')}
            disabled={isResponding}
          >
            {isResponding ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="close" size={20} color={colors.error} />
            )}
            <Text style={[styles.actionButtonText, { color: colors.error }]}>
              Decline
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton, { backgroundColor: colors.primary }]}
            onPress={() => onRespond(invitation.id, 'accept')}
            disabled={isResponding}
          >
            {isResponding ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="checkmark" size={20} color="white" />
            )}
            <Text style={styles.acceptButtonText}>
              Accept
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = {
  invitationCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chamaInfo: {
    flex: 1,
  },
  chamaName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  inviterInfo: {
    fontSize: 14,
  },
  expiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiredText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chamaDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
    minWidth: 70,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  descriptionContainer: {
    marginBottom: 16,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  declineButton: {
    backgroundColor: 'transparent',
  },
  acceptButton: {
    borderWidth: 0,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
};

export default InvitationCard;
