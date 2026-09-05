import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import { spacing, typography, borderRadius } from '../../utils/theme';
import AttendanceTable from './AttendanceTable';
import MeetingMinutesCard from './MeetingMinutesCard';
import MeetingDocumentsCard from './MeetingDocumentsCard';

const MeetingSummaryContent = ({
  meeting,
  colors,
  getMeetingTypeIcon,
  formatDate,
  formatTime,
  getAttendanceStats,
  attendanceData,
  totalAttendanceItems,
  meetingDocuments,
  handleDocumentPress,
  downloadingDocId,
  attendancePage,
  totalAttendancePages,
  onPageChange,
  getAttendeeName,
  onRefresh,
  refreshing,
  meetingId,
  chamaId,
  userRole,
  navigation,
}) => {
  if (!meeting) {
    return (
      <View style={styles.noMeetingsContainer}>
        <Ionicons name="document-outline" size={80} color={colors.textSecondary} />
        <Text style={[styles.noMeetingsTitle, { color: colors.text }]}>Meeting Data Not Available</Text>
        <Text style={[styles.noMeetingsText, { color: colors.textSecondary }]}>Unable to load the meeting summary.</Text>
      </View>
    );
  }

  // The minutes file is already presented by the minutes card above, with its
  // approval state. Listing it again under Meeting Documents made one upload
  // look like two, which is what made "Minutes: Not uploaded" sitting above
  // "Meeting Documents (1)" so contradictory.
  const otherDocuments = (meetingDocuments || []).filter(
    doc => String(doc?.documentType || '').toLowerCase() !== 'meeting_minutes'
  );

  const stats = getAttendanceStats();
  const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <View style={styles.detailsContainer}>
      <Card variant="outlined" style={styles.overviewCard}>
        <Text style={[styles.detailsTitle, { color: colors.text }]}>Attendance Summary</Text>
        <View style={styles.attendanceStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>{stats.present}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.error }]}>{stats.absent}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Absent</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{attendanceRate}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rate</Text>
          </View>
        </View>
      </Card>

      <Card variant="outlined" style={styles.attendanceTableCard}>
        <AttendanceTable
          attendanceData={attendanceData}
          totalAttendanceItems={totalAttendanceItems}
          attendancePage={attendancePage}
          totalAttendancePages={totalAttendancePages}
          onPageChange={onPageChange}
          getAttendeeName={getAttendeeName}
          colors={colors}
        />
      </Card>

      {/* This was handed `meetingMinutes`/`getRecorderName`, neither of which
          the card accepts -- it loads the record itself and needs the meeting
          to do it. Without `meetingId` that fetch had nothing to look up, so
          the card always reported "Not uploaded" even while the uploaded file
          sat in the documents list right below it. Passing the real props
          means this page and the meeting room now read the same record, and
          the chairperson gets the approve action in both places. */}
      <MeetingMinutesCard
        meetingId={meetingId || meeting.id}
        meetingTitle={meeting.title}
        chamaId={chamaId || meeting.chamaId}
        userRole={userRole}
        navigation={navigation}
        colors={colors}
        readOnly
      />

      <MeetingDocumentsCard
        meetingDocuments={otherDocuments}
        onDocumentPress={handleDocumentPress}
        downloadingDocId={downloadingDocId}
        colors={colors}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  detailsContainer: {
    gap: spacing.md,
  },
  overviewCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  attendanceTableCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  minutesCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  documentsCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  detailsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 212, 170, 0.05)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs / 2,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
  },
  noMeetingsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  noMeetingsTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  noMeetingsText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default MeetingSummaryContent;
