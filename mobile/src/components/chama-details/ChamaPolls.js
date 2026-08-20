import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';

const ChamaPolls = ({ polls, pollsLoading, colors, navigation, chamaId, getResponsiveTextSize }) => {
  const getPollStatus = (poll) => {
    const pollStatus = (poll.status || '').toLowerCase();
    const endDate = poll.endDate || poll.end_date || poll.endsAt;
    const hasEnded = endDate && new Date(endDate) < new Date();
    const isActive = (pollStatus === 'active') && !hasEnded;
    return { isActive, hasEnded };
  };

  const activePolls = polls.filter(p => getPollStatus(p).isActive).slice(0, 5);
  const pastPolls = polls.filter(p => !getPollStatus(p).isActive).slice(0, 5);
  const totalDisplayed = activePolls.length + pastPolls.length;
  const newPollsCount = activePolls.filter(poll => !(poll.userVoted || poll.user_has_voted)).length;

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
      ) : totalDisplayed === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Ionicons name="bar-chart" size={48} color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.primary, marginTop: spacing.sm, fontWeight: '500' }]}>
            No polls & vote available
          </Text>
        </View>
      ) : (
        <View>
          {newPollsCount > 0 && (
            <View style={[styles.newPollsNotification, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
              <Ionicons name="notifications" size={20} color={colors.warning} />
              <Text style={[styles.newPollsText, { color: colors.warning }]}>
                You have {newPollsCount} new poll{newPollsCount !== 1 ? 's' : ''} waiting for your vote!
              </Text>
            </View>
          )}

          {activePolls.map((poll, index) => {
            const hasUserVoted = poll.userVoted || poll.user_has_voted;
            return (
              <View key={'active-poll-' + (poll.id || index)} style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{poll.title || 'Poll'}</Text>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={hasUserVoted ? 'checkmark-circle' : 'close-circle'} size={16} color={hasUserVoted ? colors.success : colors.error} />
                </View>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: colors.success, textAlign: 'center', fontWeight: '600' }}>Active</Text>
              </View>
            );
          })}

          {pastPolls.length > 0 && (
            <View>
              <View style={{ flexDirection: 'row', paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.textSecondary + '10' }}>
                <Text style={{ flex: 2, fontSize: getResponsiveTextSize(12), fontWeight: typography.fontWeight.bold, color: colors.textSecondary, textTransform: 'uppercase' }}>Past Polls</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(12), fontWeight: typography.fontWeight.bold, color: colors.textSecondary, textAlign: 'center', textTransform: 'uppercase' }}>You Voted</Text>
                <Text style={{ flex: 1, fontSize: getResponsiveTextSize(12), fontWeight: typography.fontWeight.bold, color: colors.textSecondary, textAlign: 'center', textTransform: 'uppercase' }}>Status</Text>
              </View>
              {pastPolls.map((poll, index) => {
                const hasUserVoted = poll.userVoted || poll.user_has_voted;
                return (
                  <View key={'past-poll-' + (poll.id || index)} style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
                    <Text style={{ flex: 2, fontSize: getResponsiveTextSize(14), color: colors.textSecondary }} numberOfLines={1}>{poll.title || 'Poll'}</Text>
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={hasUserVoted ? 'checkmark-circle' : 'close-circle'} size={16} color={hasUserVoted ? colors.success : colors.error} />
                    </View>
                    <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: colors.textSecondary, textAlign: 'center' }}>Closed</Text>
                  </View>
                );
              })}
            </View>
          )}
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
  newPollsNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  newPollsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
    flex: 1,
  },
});

export default ChamaPolls;
