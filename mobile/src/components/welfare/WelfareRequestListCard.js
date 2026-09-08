import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import { useApp } from '../../context/AppContext';

/**
 * Card row for a welfare request — replaces the cramped horizontal table.
 * Same visual language as the reminder card: tinted icon + title + status pill,
 * a wrap of meta chips, then a divider and an action button.
 */
const WelfareRequestListCard = ({
  item,
  formatCurrency,
  formatDate,
  welfareCategories = [],
  urgencyLevels = [],
  getCategoryIcon,
  getCategoryColor,
  getUrgencyColor,
  getStatusColor,
  isUserIdLeft,
  getRequesterDisplayName,
  getBeneficiaryDisplayName,
  onAction,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const catColor = getCategoryColor?.(item.category) || colors.primary;
  const catName = welfareCategories.find((c) => c.id === item.category)?.name || item.category;
  const urgName = urgencyLevels.find((l) => l.id === item.urgency)?.name || item.urgency;
  const status = String(item.status || 'pending');
  const statusColor = getStatusColor?.(status) || colors.textSecondary;
  const yes = item.votes?.yes ?? item.votes_for ?? 0;
  const no = item.votes?.no ?? item.votes_against ?? 0;
  const myVote = item.userVote || item.user_vote || null; // 'yes' | 'no' | null
  const userVoted = !!myVote || item.hasVoted === true;
  const canVote = !userVoted && (status === 'pending' || status === 'voting');
  const requesterLeft = isUserIdLeft?.(item.requesterId);
  const requester = getRequesterDisplayName?.(item) || 'Unknown';
  const beneficiary = getBeneficiaryDisplayName?.(item);
  const beneficiaryLeft = isUserIdLeft?.(item.beneficiaryId);

  const Chip = ({ icon, text, tint, strike }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.sm,
        backgroundColor: (tint || colors.textSecondary) + '18',
      }}
    >
      {icon ? <Ionicons name={icon} size={12} color={tint || colors.textSecondary} /> : null}
      <Text
        style={{
          fontSize: 11,
          fontWeight: typography.fontWeight.medium,
          color: tint || colors.textSecondary,
          textDecorationLine: strike ? 'line-through' : 'none',
        }}
      >
        {text}
      </Text>
    </View>
  );

  return (
    <View>
      {/* Title row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: catColor + '20',
          }}
        >
          <Ionicons name={getCategoryIcon?.(item.category) || 'heart-outline'} size={17} color={catColor} />
        </View>

        <View style={{ flex: 1, paddingTop: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: typography.fontWeight.semibold, color: colors.text }} numberOfLines={2}>
            {item.title}
          </Text>
          {!!item.description && (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>

        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: borderRadius.sm,
            backgroundColor: statusColor + '20',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: typography.fontWeight.bold, color: statusColor, textTransform: 'capitalize' }}>
            {status}
          </Text>
        </View>
      </View>

      {/* Amount */}
      <Text style={{ fontSize: 18, fontWeight: typography.fontWeight.bold, color: colors.primary, marginTop: spacing.sm }}>
        {formatCurrency(item.amount)}
      </Text>

      {/* Meta chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
        <Chip icon="pricetag-outline" text={catName} tint={catColor} />
        <Chip icon="flag-outline" text={`${urgName} priority`} tint={getUrgencyColor?.(item.urgency) || colors.warning} />
        <Chip icon="time-outline" text={formatDate(item.createdAt || item.created_at)} />
        <Chip icon="person-outline" text={requester} strike={requesterLeft} tint={requesterLeft ? colors.error : undefined} />
        {beneficiary ? (
          <Chip icon="people-outline" text={`For ${beneficiary}`} strike={beneficiaryLeft} tint={beneficiaryLeft ? colors.error : undefined} />
        ) : null}
        <Chip icon="thumbs-up-outline" text={`${yes} support`} tint={colors.success} />
        <Chip icon="thumbs-down-outline" text={`${no} oppose`} tint={colors.error} />
      </View>

      {/* Action / vote status */}
      {(canVote || userVoted) && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {userVoted ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: borderRadius.sm,
                backgroundColor: (myVote === 'no' ? colors.error : colors.success) + '15',
              }}
            >
              <Ionicons name="checkmark-circle" size={14} color={myVote === 'no' ? colors.error : colors.success} />
              <Text style={{ fontSize: 12, fontWeight: typography.fontWeight.semibold, color: myVote === 'no' ? colors.error : colors.success }}>
                {myVote === 'no' ? 'You opposed' : 'You supported'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => onAction?.(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: borderRadius.sm,
                backgroundColor: colors.primary + '15',
              }}
            >
              <Ionicons name="hand-left-outline" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: typography.fontWeight.semibold, color: colors.primary }}>Vote</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default WelfareRequestListCard;
