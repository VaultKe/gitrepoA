import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { spacing, typography } from '../../utils/theme';
import { formatTableDate, getPollTypeColor, getStatusColor, getTotalVotesCast, getTotalEligibleVoters, getVotePercentage, isPollFullyVoted, getMemberName, getMemberEmail } from '../../utils/pollsVotingHelpers';
import { PollOptions, PollBadges } from './PollOptions';

const PollItem = ({
  item,
  colors,
  isDesktop,
  screenWidth,
  numColumns,
  getMemberName,
  getMemberEmail,
  formatTableDate,
  getPollTypeColor,
  getStatusColor,
  getTotalVotesCast,
  getTotalEligibleVoters,
  getVotePercentage,
  isPollFullyVoted,
  onVote,
  onOpenVisualization,
}) => {
  const cardStyle = [
    styles.pollCard,
    { backgroundColor: colors.surface },
    isDesktop && [
      styles.pollCardDesktop,
      {
        marginHorizontal: 8,
        marginBottom: 16,
        flex: 1,
        maxWidth: (screenWidth - 32 - (numColumns - 1) * 16) / numColumns,
      }
    ]
  ];

  return (
    <View style={cardStyle}
      accessibilityLabel={`${item.title} poll. ${item.status} status. ${getTotalVotesCast(item)} out of ${getTotalEligibleVoters(item)} votes cast.`}
    >
      <View style={styles.pollHeader}>
        <View style={styles.pollInfo}>
          <Text style={[
            styles.pollTitle,
            { color: colors.text },
            isDesktop && styles.pollTitleDesktop
          ]}>
            {item.title}
          </Text>
          <Text style={[styles.pollCreator, { color: colors.textSecondary }]}>
            by {item.created_by}
          </Text>
        </View>
        <View style={[
          styles.pollTypeBadge,
          { backgroundColor: getPollTypeColor(item.type, colors) + '15' }
        ]}>
          <Text style={[styles.pollTypeText, { color: getPollTypeColor(item.type, colors) }]}>
            {item.type.replace('_', ' ')}
          </Text>
        </View>
      </View>

      {item.description && (
        <Text style={[
          styles.pollDescription,
          { color: colors.textSecondary },
          isDesktop && styles.pollDescriptionDesktop
        ]}>
          {item.description}
        </Text>
      )}

      <View style={[
        styles.pollStats,
        isDesktop && styles.pollStatsDesktop
      ]}>
        <View style={styles.statItem}>
          <Text style={[
            styles.statValue,
            { color: colors.primary },
            isDesktop && styles.statValueDesktop
          ]}>
            {getTotalVotesCast(item)}/{getTotalEligibleVoters(item)}
          </Text>
          <Text style={[
            styles.statLabel,
            { color: colors.textSecondary },
            isDesktop && styles.statLabelDesktop
          ]}>
            Votes Cast
          </Text>
        </View>

        {item.status === 'active' && item.time_remaining && (
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue,
              { color: item.isFullyVoted ? colors.success : colors.warning },
              isDesktop && styles.statValueDesktop
            ]}>
              {item.isFullyVoted ? 'All Votes Cast' : formatTimeRemaining(item.time_remaining)}
            </Text>
            <Text style={[
              styles.statLabel,
              { color: colors.textSecondary },
              isDesktop && styles.statLabelDesktop
            ]}>
              {item.isFullyVoted ? 'Effectively Complete' : 'Time Left'}
            </Text>
          </View>
        )}

        {item.status === 'completed' && (
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue,
              { color: getStatusColor(item.status, item.result, colors) },
              isDesktop && styles.statValueDesktop
            ]}>
              {item.result === 'completed_early' ? 'Completed Early' : item.result}
            </Text>
            <Text style={[
              styles.statLabel,
              { color: colors.textSecondary },
              isDesktop && styles.statLabelDesktop
            ]}>
              Result
            </Text>
          </View>
        )}
      </View>

      {/* Voting Status Message */}
      {item.user_voted && (
        <View style={[styles.votingStatusMessage, { backgroundColor: colors.success + '10', borderColor: colors.success, borderWidth: 1 }]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={[styles.votingStatusText, { color: colors.success, fontSize: 13, fontWeight: '600' }]}>
            You have voted on this item
          </Text>
        </View>
      )}

      {item.status === 'completed' && !item.user_voted && (
        <View style={[styles.votingStatusMessage, { backgroundColor: colors.textSecondary + '10', borderColor: colors.textSecondary, borderWidth: 1 }]}>
          <Ionicons name="time" size={18} color={colors.textSecondary} />
          <Text style={[styles.votingStatusText, { color: colors.textSecondary, fontSize: 13 }]}>
            Vote ended - You did not participate
          </Text>
        </View>
      )}

      <PollOptions
        item={item}
        colors={colors}
        isDesktop={isDesktop}
        onVote={onVote}
        getTotalVotesCast={getTotalVotesCast}
        getTotalEligibleVoters={getTotalEligibleVoters}
        getVotePercentage={getVotePercentage}
      />

      {/* Only show "You have voted" badge for active polls */}
      {item.user_voted && item.status === 'active' && (
        <View style={[styles.votedBadge, { backgroundColor: colors.success + '15' }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.votedText, { color: colors.success }]}>
            You have voted
          </Text>
        </View>
      )}

      {/* Fully voted indicator for active polls */}
      {item.status === 'active' && item.isFullyVoted && (
        <View style={[styles.fullyVotedBadge, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={[styles.fullyVotedText, { color: colors.success }]}>
            All Eligible Votes Cast
          </Text>
        </View>
      )}

      {/* Visualizations toggle for completed polls */}
      {item.status === 'completed' && (
        <TouchableOpacity
          style={[styles.visualizationToggle, { backgroundColor: colors.primary + '15' }]}
          onPress={() => onOpenVisualization(item)}
        >
          <Ionicons
            name="bar-chart"
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.visualizationToggleText, { color: colors.primary }]}>
            View Results Analysis
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.pollMeta}>
        <Text style={[styles.pollDate, { color: colors.textSecondary }]}>
          {item.status === 'active' ? 'Ends' : 'Ended'}: {formatTableDate(item.ends_at)}
        </Text>

        <PollBadges item={item} colors={colors} />
      </View>
    </View>
  );
};

const formatTimeRemaining = (seconds) => {
  if (!seconds || seconds <= 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const styles = StyleSheet.create({
  pollCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pollCardDesktop: {
    padding: 24,
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pollInfo: {
    flex: 1,
    marginRight: 12,
  },
  pollTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  pollTitleDesktop: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  pollCreator: {
    fontSize: 14,
  },
  pollTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pollTypeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  pollDescription: {
    fontSize: 14,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  pollDescriptionDesktop: {
    fontSize: 15,
    marginBottom: 16,
  },
  pollStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  pollStatsDesktop: {
    paddingVertical: 16,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValueDesktop: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  statLabelDesktop: {
    fontSize: 13,
    marginTop: 4,
  },
  votingStatusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  votingStatusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  votedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  votedText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  fullyVotedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  fullyVotedText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  visualizationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  visualizationToggleText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  pollMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pollDate: {
    fontSize: 12,
  },
});

export default PollItem;
