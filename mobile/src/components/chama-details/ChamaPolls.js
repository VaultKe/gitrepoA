import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const ChamaPolls = ({ polls, pollsLoading, colors, navigation, chamaId, getResponsiveTextSize }) => {
  const getPollStatus = (poll) => {
    const pollStatus = (poll.status || '').toLowerCase();
    const endDate = poll.endDate || poll.end_date || poll.ends_at || poll.endsAt;
    const hasEnded = endDate && new Date(endDate) < new Date();
    const isActive = (pollStatus === 'active') && !hasEnded;
    return { isActive, hasEnded };
  };

  const sortedPolls = [...polls].sort((a, b) => {
    const dateA = new Date(a.created_at || a.createdAt || 0);
    const dateB = new Date(b.created_at || b.createdAt || 0);
    return dateB - dateA;
  });
  const latestPolls = sortedPolls.slice(0, 5);

  const formatPollDate = (poll) => {
    const dateValue = poll.endDate || poll.end_date || poll.ends_at || poll.endsAt || poll.created_at || poll.createdAt;
    if (!dateValue) return 'Unknown Date';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime()) || date.getFullYear() <= 1900) return 'Unknown Date';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'Unknown Date';
    }
  };

  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs, borderWidth: 1, borderColor: colors.border }} variant="flat">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Polls & Voting
        </Text>
        {polls.length > 5 && (
          <TouchableOpacity onPress={() => navigation.navigate('PollsVotingScreen', { chamaId })}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {pollsLoading ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Loading polls...
        </Text>
      ) : latestPolls.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No polls & vote available
        </Text>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
            <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textTransform: 'uppercase' }}>Poll</Text>
            <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'center', textTransform: 'uppercase' }}>Status</Text>
            <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'right', textTransform: 'uppercase' }}>Date</Text>
          </View>

          {latestPolls.map((poll, index) => {
            const pollStatus = getPollStatus(poll);
            return (
              <View key={'poll-' + (poll.id || index)} style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{poll.title || 'Poll'}</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: pollStatus.isActive ? colors.success : colors.textSecondary, textAlign: 'center', fontWeight: '600' }}>{pollStatus.isActive ? 'Active' : 'Closed'}</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: colors.textSecondary, textAlign: 'right' }}>{formatPollDate(poll)}</Text>
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

export default ChamaPolls;
