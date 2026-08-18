import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
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

const styles = {
  detailsContainer: {
    gap: 12,
  },
  overviewCard: {
    marginBottom: 12,
    padding: 16,
  },
  attendanceTableCard: {
    marginBottom: 12,
    padding: 16,
  },
  minutesCard: {
    marginBottom: 12,
    padding: 16,
  },
  documentsCard: {
    marginBottom: 12,
    padding: 16,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 212, 170, 0.05)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  noMeetingsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 64,
  },
  noMeetingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  noMeetingsText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
};

export default MeetingSummaryContent;
