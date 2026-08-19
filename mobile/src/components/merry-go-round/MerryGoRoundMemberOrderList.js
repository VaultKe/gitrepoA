import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { spacing, typography } from '../../utils/theme';
import { isMemberLeft, getMemberName } from '../../utils/merryGoRoundHelpers';

const MerryGoRoundMemberOrderList = ({
  colors,
  selectedRound,
  selectedRecipientPosition,
  setSelectedRecipientPosition,
  setContributorFilter,
  setContributorSearch,
  isMemberLeft,
  getMemberName,
}) => {
  if (!selectedRound) return null;

  const participants = selectedRound.members || selectedRound.participants || [];
  const currentPosition = selectedRound.current_position || selectedRound.currentRound || 1;

  if (participants.length === 0) {
    return (
      <Card style={styles.statsCard} variant="outlined">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Member Order
        </Text>
        <View style={styles.emptyMembersList}>
          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyMembersText, { color: colors.textSecondary }]}>
            No participants added yet
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.statsCard} variant="outlined">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Member Order ({participants.length} participants)
        </Text>
        <Ionicons name="hand-left-outline" size={18} color={colors.textTertiary} />
      </View>
      <Text style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm }}>
        Tap a member to see who has paid them
      </Text>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
        <View style={styles.memberOrderList}>
          {participants.map((participant, index) => {
            const position = index + 1;
            const participantStatus = participant.status || 'pending';
            const isCurrent = participantStatus === 'current';
            const isCompleted = participantStatus === 'completed';
            const isPending = participantStatus === 'pending';
            const memberLeft = isMemberLeft(participant);

            const member = participant.user || participant;
            const firstName = member.first_name || member.firstName || '';
            const lastName = member.last_name || member.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim() || `Member ${position}`;
            const initials = `${firstName[0] || 'M'}${lastName[0] || position}`.toUpperCase();

            const isSelectedRecipient = selectedRecipientPosition === position;

            return (
              <TouchableOpacity
                key={participant.id || index}
                activeOpacity={memberLeft ? 1 : 0.7}
                onPress={() => {
                  if (memberLeft) return;
                  setSelectedRecipientPosition(isSelectedRecipient ? null : position);
                  setContributorFilter('all');
                  setContributorSearch('');
                }}
                disabled={memberLeft}
                style={[
                  styles.memberOrderItem,
                  isSelectedRecipient && {
                    backgroundColor: colors.primary + '12',
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View style={styles.memberRow}>
                  <View style={styles.avatarContainer}>
                    {index > 0 && (
                      <View style={[
                        styles.connectorLineTop,
                        { backgroundColor: isCompleted || isCurrent ? colors.primary : colors.border }
                      ]} />
                    )}

                    <View style={[
                      styles.memberAvatar,
                      {
                        backgroundColor: memberLeft ? colors.error + '20' :
                                       isCurrent ? colors.primary :
                                       isCompleted ? colors.success : colors.backgroundSecondary,
                        borderColor: memberLeft ? colors.error :
                                     isSelectedRecipient ? colors.primary :
                                     isCurrent ? colors.primary :
                                     isCompleted ? colors.success : colors.border,
                      }
                    ]}>
                      <Text style={[
                        styles.avatarText,
                        { color: memberLeft ? colors.error :
                              isCurrent || isCompleted ? colors.white : colors.textSecondary }
                      ]}>
                        {initials}
                      </Text>
                    </View>

                    {index < participants.length - 1 && (
                      <View style={[
                        styles.connectorLineBottom,
                        { backgroundColor: isCompleted ? colors.primary : colors.border }
                      ]} />
                    )}

                    <View style={[
                      styles.statusIndicator,
                      {
                        backgroundColor: isCurrent ? colors.primary :
                                       isCompleted ? colors.success : colors.border
                      }
                    ]}>
                      {isCompleted && (
                        <Ionicons name="checkmark" size={12} color={colors.white} />
                      )}
                    </View>
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={[
                      styles.memberName,
                      {
                        color: memberLeft ? colors.error : isCurrent ? colors.primary : colors.text,
                        fontWeight: isCurrent ? 'bold' : 'normal',
                        textDecorationLine: memberLeft ? 'line-through' : 'none',
                      }
                    ]}>
                      {fullName}
                    </Text>
                    <Text style={[styles.memberPosition, { color: colors.textSecondary }]}>
                      Position {position}
                    </Text>
                  </View>

                  {memberLeft && !isSelectedRecipient && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.error + '20' }]}>
                      <Ionicons name="close" size={12} color={colors.error} />
                      <Text style={[styles.statusBadgeText, { color: colors.error }]}>
                        Left
                      </Text>
                    </View>
                  )}

                  {!memberLeft && isSelectedRecipient ? (
                    <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="eye" size={12} color={colors.white} />
                      <Text style={[styles.statusBadgeText, { color: colors.white }]}>
                        Viewing
                      </Text>
                    </View>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textTertiary}
                      style={{ marginLeft: spacing.sm }}
                    />
                  )}

                  {isCurrent && !isSelectedRecipient && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.white }]}>
                        Current
                      </Text>
                    </View>
                  )}

                  {isCompleted && !isSelectedRecipient && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.white }]}>
                        Completed
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </Card>
  );
};

const styles = StyleSheet.create({
  statsCard: { marginHorizontal: spacing.md, marginVertical: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm },
  emptyMembersList: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyMembersText: { fontSize: typography.fontSize.base, marginTop: spacing.md, textAlign: 'center' },
  memberOrderList: { paddingVertical: spacing.sm },
  memberOrderItem: { position: 'relative', borderWidth: 1, borderColor: 'transparent', borderRadius: 10, marginVertical: 2, paddingHorizontal: spacing.xs },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  avatarContainer: { position: 'relative', marginRight: spacing.md, alignItems: 'center', justifyContent: 'center' },
  connectorLineTop: { position: 'absolute', top: -spacing.sm, left: 23, width: 2, height: spacing.sm, zIndex: 1 },
  connectorLineBottom: { position: 'absolute', bottom: -spacing.sm, left: 23, width: 2, height: spacing.sm, zIndex: 1 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', zIndex: 2 },
  avatarText: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
  statusIndicator: { position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', zIndex: 3 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: typography.fontSize.base, marginBottom: spacing.xs },
  memberPosition: { fontSize: typography.fontSize.sm },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 4 },
  statusBadgeText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase' },
});

export default MerryGoRoundMemberOrderList;
