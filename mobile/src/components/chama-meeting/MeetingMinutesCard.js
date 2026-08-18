import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';

const MeetingMinutesCard = ({ meetingMinutes, getRecorderName, colors }) => {
  return (
    <Card variant="outlined" style={styles.minutesCard}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Meeting Minutes</Text>
      {meetingMinutes ? (
        <>
          <Text style={[styles.minutesContent, { color: colors.textSecondary }]}>{meetingMinutes.content}</Text>
          <View style={styles.minutesMetadata}>
            <Text style={[styles.minutesStatus, { color: colors.primary }]}>Status: {meetingMinutes.status?.charAt(0).toUpperCase() + meetingMinutes.status?.slice(1)}</Text>
            <Text style={[styles.minutesTakenBy, { color: colors.textSecondary }]}>Recorded by: {getRecorderName(meetingMinutes)}</Text>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No meeting minutes available</Text>
        </View>
      )}
    </Card>
  );
};

const styles = {
  minutesCard: {
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  minutesContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  minutesMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  minutesStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  minutesTakenBy: {
    fontSize: 14,
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

export default MeetingMinutesCard;
