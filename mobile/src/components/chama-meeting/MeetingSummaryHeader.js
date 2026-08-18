import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';

const MeetingSummaryHeader = ({ meeting, formatDate, formatTime, getMeetingTypeIcon, colors }) => {
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

const styles = {
  meetingHeaderCard: {
    marginBottom: 12,
    padding: 16,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  meetingHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  meetingDate: {
    fontSize: 14,
    marginBottom: 2,
  },
  meetingTime: {
    fontSize: 14,
    marginBottom: 2,
  },
  meetingLocation: {
    fontSize: 14,
  },
  meetingDescription: {
    fontSize: 16,
    lineHeight: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
};

export default MeetingSummaryHeader;
