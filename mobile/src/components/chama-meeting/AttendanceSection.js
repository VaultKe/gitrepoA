import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AttendanceSection = ({
  chamaMembers,
  memberAttendance,
  canMarkAttendance,
  onToggleAttendance,
  colors,
  isReadOnly = false,
}) => {
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
      <View style={styles.attendanceHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Meeting Attendance
        </Text>
        {canMarkAttendance && !isReadOnly && (
          <Text style={[styles.attendanceSubtitle, { color: colors.textSecondary }]}>
            Mark members as present by tapping their names
          </Text>
        )}
        {isReadOnly && (
          <Text style={[styles.attendanceSubtitle, { color: colors.textSecondary }]}>
            Read-only attendance record
          </Text>
        )}
      </View>

      {chamaMembers.length > 0 ? (
        <ScrollView style={styles.membersList} nestedScrollEnabled>
          {chamaMembers.map((member) => {
            const userData = member.user || member;
            const userId = member.user_id || member.id;
            const firstName = userData.first_name || member.first_name || '';
            const lastName = userData.last_name || member.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim();
            const displayName = fullName || userData.name || member.name || member.email?.split('@')[0] || `Member ${userId?.slice(-4)}`;
            const isPresent = memberAttendance[userId] || false;
            const memberRole = member.role || 'Member';

            return (
              <TouchableOpacity
                key={userId}
                style={[
                  styles.memberItem,
                  {
                    backgroundColor: isPresent ? colors.success + '15' : colors.background,
                    borderColor: isPresent ? colors.success : colors.border,
                    borderWidth: isPresent ? 2 : 1,
                  }
                ]}
                onPress={() => {
                  console.log('Attendance toggle pressed for userId:', userId, 'canMarkAttendance:', canMarkAttendance, 'isReadOnly:', isReadOnly);
                  onToggleAttendance(userId);
                }}
                disabled={!canMarkAttendance || isReadOnly}
              >
                <View style={styles.memberInfo}>
                  <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                      {firstName?.[0]?.toUpperCase() || 'M'}{lastName?.[0]?.toUpperCase() || ''}
                    </Text>
                  </View>
                  <View style={styles.memberDetails}>
                    <Text style={[styles.memberName, { color: colors.text }]}>
                      {displayName}
                    </Text>
                    <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                      {memberRole}
                    </Text>
                  </View>
                </View>

                <View style={styles.attendanceStatus}>
                  {isPresent ? (
                    <View style={[styles.presentIndicator, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                      <Text style={[styles.presentText, { color: colors.success, fontWeight: '600' }]}>Present</Text>
                    </View>
                  ) : (
                    <View style={styles.absentIndicator}>
                      <Ionicons name="ellipse-outline" size={28} color={colors.textSecondary} />
                      <View>
                        <Text style={[styles.absentText, { color: colors.textSecondary }]}>Absent</Text>
                        {canMarkAttendance && (
                          <Text style={[styles.tapHint, { color: colors.primary, fontSize: 10 }]}>
                            Tap to mark present
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            Loading chama members...
          </Text>
        </View>
      )}

      {chamaMembers.length > 0 && (
        <View style={[styles.attendanceSummary, { backgroundColor: colors.background }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Members:</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{chamaMembers.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Present:</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {Object.values(memberAttendance).filter(Boolean).length}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Absent:</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>
              {chamaMembers.length - Object.values(memberAttendance).filter(Boolean).length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = {
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  attendanceHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  attendanceSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  membersList: {
    maxHeight: 300,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
  },
  attendanceStatus: {
    alignItems: 'center',
  },
  presentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  presentText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  absentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  absentText: {
    fontSize: 12,
    marginLeft: 4,
  },
  tapHint: {
    fontSize: 10,
    marginLeft: 4,
    fontStyle: 'italic',
    marginTop: 2,
  },
  attendanceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
};

export default AttendanceSection;
