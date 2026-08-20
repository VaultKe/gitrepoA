import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ChamaMembers = ({ members, colors, navigation, chamaId, renderMemberAvatar, handleAvatarPress, userMembership }) => {
  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Members ({members.length})
        </Text>
        {members.length > 5 && (
          <TouchableOpacity onPress={() => navigation.navigate('ChamaMembersScreen', { chamaId })}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {members.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No members found
        </Text>
      ) : (
        <View style={styles.membersList}>
          {members.slice(0, 5).map((member, index) => {
            const firstName = member.first_name || member.user?.first_name || '';
            const lastName = member.last_name || member.user?.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Member';

            let joinDate = 'Unknown Date';
            try {
              if (member.joined_at) {
                const date = new Date(member.joined_at);
                if (!isNaN(date.getTime())) {
                  joinDate = date.toLocaleDateString();
                }
              }
            } catch (error) {
            }

            const memberStatus = member.status || member.user?.status || 'active';
            const isActive = memberStatus === 'active';

            return (
              <View key={[member.user_id, member.id, index].filter(Boolean).join('-')} style={[styles.memberItem, { borderBottomColor: colors.border }]}>
                {renderMemberAvatar(member)}
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>
                    {fullName}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                    {member.role || 'Member'} • Joined {joinDate}
                  </Text>
                </View>
                <View style={[styles.memberStatus, { backgroundColor: isActive ? colors.success + '20' : colors.warning + '20' }]}>
                  <Text style={[styles.memberStatusText, { color: isActive ? colors.success : colors.warning }]}>
                    {memberStatus}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  viewMoreText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  membersList: {
    gap: spacing.sm,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  memberRole: {
    fontSize: typography.fontSize.sm,
  },
  memberStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  memberStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
});

export default ChamaMembers;
