import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import useMeetingSummaryScreen from '../../../hooks/useMeetingSummaryScreen';
import MeetingSummaryContent from '../../../components/chama-meeting/MeetingSummaryContent';

const createTableStyles = (colors, spacing, typography, shadows) => ({
  tableContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 2,
    alignItems: 'flex-start',
  },
  statusCell: {
    flex: 1.5,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
});

const MeetingSummaryScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const screen = useMeetingSummaryScreen({ route, navigation });
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);

  const {
    loading,
    dataReady,
    refreshing,
    meetingDetails,
    attendanceData,
    totalAttendanceItems,
    meetingMinutes,
    meetingDocuments,
    handleDocumentPress,
    getRecorderName,
    getAttendeeName,
    formatDate,
    formatTime,
    getMeetingTypeIcon,
    getAttendanceStats,
    onRefresh,
    setAttendancePage,
    downloadingDocId,
    attendancePage,
    totalAttendancePages,
  } = screen;

  const renderMeetingHeader = () => {
    const meeting = meetingDetails;
    if (!meeting) {
      return (
        <Card variant="outlined" style={styles.meetingHeaderCard}>
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>Meeting details not available</Text>
          </View>
        </Card>
      );
    }
    return (
      <Card variant="outlined" style={styles.meetingHeaderCard}>
        <View style={styles.meetingHeader}>
          <View style={[styles.meetingTypeIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name={getMeetingTypeIcon(meeting.meetingType)} size={24} color={colors.primary} />
          </View>
          <View style={styles.meetingHeaderInfo}>
            <Text style={[styles.meetingTitle, { color: colors.text }]}>{meeting.title}</Text>
            <Text style={[styles.meetingDate, { color: colors.textSecondary }]}>{formatDate(meeting.scheduledAt)}</Text>
            <Text style={[styles.meetingTime, { color: colors.textSecondary }]}>
              {formatTime(meeting.scheduledAt)} • {meeting.meetingType?.charAt(0).toUpperCase() + meeting.meetingType?.slice(1)}
            </Text>
            {meeting.location && <Text style={[styles.meetingLocation, { color: colors.textSecondary }]}>Location: {meeting.location}</Text>}
          </View>
        </View>
        {meeting.description && <Text style={[styles.meetingDescription, { color: colors.textSecondary }]}>{meeting.description}</Text>}
      </Card>
    );
  };

  const renderMeetingDetails = () => {
    const meeting = meetingDetails;
    if (!meeting) return null;

    const stats = getAttendanceStats();
    const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

    return (
      <View style={{ gap: spacing.md }}>
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

        <MeetingSummaryContent
          meeting={meeting}
          colors={colors}
          getMeetingTypeIcon={getMeetingTypeIcon}
          formatDate={formatDate}
          formatTime={formatTime}
          getAttendanceStats={getAttendanceStats}
          attendanceData={attendanceData}
          totalAttendanceItems={totalAttendanceItems}
          meetingMinutes={meetingMinutes}
          meetingDocuments={meetingDocuments}
          getRecorderName={getRecorderName}
          handleDocumentPress={handleDocumentPress}
          downloadingDocId={downloadingDocId}
          attendancePage={attendancePage}
          totalAttendancePages={totalAttendancePages}
          onPageChange={setAttendancePage}
          getAttendeeName={getAttendeeName}
        />
      </View>
    );
  };

  if (loading && !dataReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading meeting summary...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {loading && (
            <View style={styles.inlineTableLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.inlineTableLoadingText, { color: colors.textSecondary }]}>
                Loading meeting summary...
              </Text>
            </View>
          )}
          {meetingDetails ? (
            <View style={styles.allCardsContainer}>
              {renderMeetingHeader()}
              {renderMeetingDetails()}
            </View>
          ) : (
            <View style={styles.noMeetingsContainer}>
              <Ionicons name="document-outline" size={80} color={colors.textTertiary} />
              <Text style={[styles.noMeetingsTitle, { color: colors.text }]}>Meeting Data Not Available</Text>
              <Text style={[styles.noMeetingsText, { color: colors.textSecondary }]}>Unable to load the meeting summary.</Text>
            </View>
          )}
        </ScrollView>
        <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs / 2,
  },
  refreshButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.sm,
  },
  allCardsContainer: {
    gap: spacing.md,
  },
  meetingHeaderCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  meetingHeaderInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  meetingTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  meetingDate: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs / 2,
  },
  meetingTime: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs / 2,
  },
  meetingLocation: {
    fontSize: typography.fontSize.sm,
  },
  meetingDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  meetingsList: {
    // Remove maxHeight for mobile
  },
  meetingItem: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  meetingItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  meetingItemInfo: {
    flex: 1,
  },
  meetingItemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs / 2,
  },
  meetingItemDate: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs / 2,
  },
  meetingItemTime: {
    fontSize: typography.fontSize.sm,
  },
  detailsContainer: {
    paddingHorizontal: spacing.sm,
  },
  overviewCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  detailsTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  detailsDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.5,
    marginBottom: spacing.md,
  },
  meetingMetadata: {
    gap: spacing.sm,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metadataText: {
    fontSize: typography.fontSize.sm,
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
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
  attendanceCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  attendanceList: {
    marginTop: spacing.md,
  },
  subsectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  attendanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  attendanceInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  attendanceType: {
    fontSize: typography.fontSize.sm,
  },
  attendanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  attendanceStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  minutesCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  minutesContent: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.6,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  minutesMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  minutesStatus: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  minutesTakenBy: {
    fontSize: typography.fontSize.sm,
  },
  documentsCard: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  documentType: {
    fontSize: typography.fontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  noMeetingsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
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
    maxWidth: 350,
    marginBottom: spacing.md,
  },
  requirementsList: {
    alignSelf: 'stretch',
    marginBottom: spacing.lg,
  },
  requirementItem: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.xs,
    textAlign: 'left',
  },
  helpText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium,
    fontStyle: 'italic',
  },

  // Attendance Table Styles
  attendanceTable: {
    width: '100%',
  },
  inlineTableLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  inlineTableLoadingText: {
    fontSize: typography.fontSize.sm,
  },
});

export default MeetingSummaryScreen;
