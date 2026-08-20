import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const ChamaMeetings = ({ meetings, colors, navigation, chamaId, getResponsiveTextSize }) => {
  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs, borderWidth: 1, borderColor: colors.border }} variant="flat">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Meetings
        </Text>
        {meetings.length > 5 && (
          <TouchableOpacity onPress={() => navigation.navigate('ChamaMeetingsScreen', { chamaId })}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {meetings.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No meetings scheduled
        </Text>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
            <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textTransform: 'uppercase' }}>Title</Text>
            <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'center', textTransform: 'uppercase' }}>Date & Time</Text>
            <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'center', textTransform: 'uppercase' }}>Status</Text>
          </View>

          {meetings.slice(0, 5).map((meeting, index) => {
            let meetingDate = 'Unknown Date';
            let meetingTime = '';

            try {
              const dateStr = meeting.scheduledAt || meeting.scheduled_date || meeting.date;
              if (dateStr) {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                  meetingDate = date.toLocaleDateString();
                  meetingTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
              }
            } catch (error) {
            }

            const meetingStatus = meeting.status || 'scheduled';
            const isCompleted = meetingStatus === 'completed' || meetingStatus === 'ended';
            const isPast = new Date(meeting.scheduledAt || meeting.scheduled_date || meeting.date) < new Date();

            return (
              <View key={`meeting-${meeting.id || index}`} style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{meeting.title || 'Chama Meeting'}</Text>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.textSecondary, textAlign: 'center' }}>{meetingDate} {meetingTime}</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: isCompleted ? colors.success : isPast ? colors.textSecondary : colors.info, textAlign: 'center' }}>
                  {isCompleted ? 'Completed' : isPast ? 'Past' : 'Scheduled'}
                </Text>
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
});

export default ChamaMeetings;
