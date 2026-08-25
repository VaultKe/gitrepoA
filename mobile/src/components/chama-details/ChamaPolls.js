import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography } from '../../utils/theme';

const ChamaPolls = ({ polls, pollsLoading, colors, navigation, chamaId, getResponsiveTextSize }) => {
  const getPollStatus = (poll) => {
    const pollStatus = (poll.status || '').toLowerCase();
    const endDate = poll.endDate || poll.end_date || poll.endsAt;
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

  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Polls & Voting
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('PollsVotingScreen', { chamaId })}>
          <Text style={[styles.viewMoreText, { color: colors.primary }]}>
            View All
          </Text>
        </TouchableOpacity>
      </View>

      {pollsLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Loading polls...
          </Text>
        </View>
      ) : latestPolls.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Ionicons name="bar-chart" size={48} color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.primary, marginTop: spacing.sm, fontWeight: '500' }]}>
            No polls & vote available
          </Text>
        </View>
      ) : (
        <View>
          {latestPolls.map((poll, index) => {
            const hasUserVoted = poll.userVoted || poll.user_has_voted;
            const pollStatus = getPollStatus(poll);
            return (
              <View key={'poll-' + (poll.id || index)} style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{poll.title || 'Poll'}</Text>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={hasUserVoted ? 'checkmark-circle' : 'close-circle'} size={16} color={hasUserVoted ? colors.success : colors.error} />
                </View>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: pollStatus.isActive ? colors.success : colors.textSecondary, textAlign: 'center', fontWeight: '600' }}>{pollStatus.isActive ? 'Active' : 'Closed'}</Text>
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
