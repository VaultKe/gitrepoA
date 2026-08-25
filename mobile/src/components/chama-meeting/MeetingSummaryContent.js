import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import { spacing, typography, borderRadius } from '../../utils/theme';
import MeetingSummaryHeader from './MeetingSummaryHeader';
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
  meetingMinutes,
  meetingDocuments,
  getRecorderName,
  handleDocumentPress,
  downloadingDocId,
  attendancePage,
  totalAttendancePages,
  onPageChange,
  getAttendeeName,
  onRefresh,
  refreshing,
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

  return (
    <View style={styles.detailsContainer}>
      <Card variant="outlined" style={styles.overviewCard}>
        <Text style={[styles.detailsTitle, { color: colors.text }]}>Attendance Summary</Text>
        <View style={styles.attendanceStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>{getAttendanceStats().present}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.error }]}>{getAttendanceStats().absent}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Absent</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {getAttendanceStats().total > 0 ? Math.round((getAttendanceStats().present / getAttendanceStats().total) * 100) : 0}%
            </Text>
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

      <MeetingMinutesCard
        meetingMinutes={meetingMinutes}
        getRecorderName={getRecorderName}
        colors={colors}
      />

      <MeetingDocumentsCard
        meetingDocuments={meetingDocuments}
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
