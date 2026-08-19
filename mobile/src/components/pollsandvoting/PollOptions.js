import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../../utils/theme';
import { getTotalVotesCast, getTotalEligibleVoters, getVotePercentage } from '../../utils/pollsVotingHelpers';

const PollOptions = ({
  item,
  colors,
  isDesktop,
  onVote,
  getTotalVotesCast,
  getTotalEligibleVoters,
  getVotePercentage,
}) => {
  const totalVotesCast = getTotalVotesCast(item);

  return (
    <View style={[
      styles.optionsContainer,
      isDesktop && styles.optionsContainerDesktop
    ]}>
      {item.options.map((option, index) => {
        const percentage = getVotePercentage(option.vote_count, totalVotesCast);
        const canVote = item.status === 'active' && !item.user_voted;
        const showVotingInterface = item.status === 'active' && !item.user_voted;

        return (
          <View
            key={option.id || index}
            style={[
              styles.optionItem,
              { backgroundColor: colors.surface },
              isDesktop && styles.optionItemDesktop,
              canVote && {
                borderColor: colors.primary,
                borderWidth: 2,
                backgroundColor: colors.primary + '08'
              },
              item.user_voted && {
                borderColor: colors.success,
                backgroundColor: colors.success + '08'
              },
              item.status === 'completed' && {
                borderColor: colors.textSecondary,
                backgroundColor: colors.textSecondary + '05'
              }
            ]}
            onPress={showVotingInterface ? () => {
              onVote(item.id, option.id, item);
            } : undefined}
            disabled={!showVotingInterface}
            activeOpacity={showVotingInterface ? 0.8 : 1}
          >
            {/* Voting Interface - Only show when user can vote */}
            {showVotingInterface && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                {/* Simple Vote Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.warning,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 8,
                    minWidth: 80,
                    alignItems: 'center'
                  }}
                  onPress={() => {
                    onVote(item.id, option.id, item);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel={`Vote for ${option.option_text}`}
                  accessibilityRole="button"
                  accessibilityHint="Double tap to cast your vote for this option"
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                    VOTE
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* User Already Voted Icon - Smaller and cleaner */}
            {item.user_voted && (
              <View style={[styles.voteIconContainer, { backgroundColor: colors.success + '15', borderRadius: 12, padding: 6 }]}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.success}
                />
              </View>
            )}

            {/* Completed Vote Icon - Smaller */}
            {item.status === 'completed' && !item.user_voted && (
              <View style={[styles.voteIconContainer, { backgroundColor: colors.textSecondary + '15', borderRadius: 12, padding: 6 }]}>
                <Ionicons
                  name="time"
                  size={16}
                  color={colors.textSecondary}
                />
              </View>
            )}

            <View style={styles.optionContent}>
              <Text style={[
                styles.optionText,
                { color: colors.text },
                isDesktop && styles.optionTextDesktop
              ]}>
                {option.option_text}
              </Text>
              {/* Show vote count for all polls */}
              <Text style={[
                styles.optionVotes,
                { color: colors.textSecondary },
                isDesktop && styles.optionVotesDesktop
              ]}>
                {option.vote_count} votes ({percentage}%)
              </Text>
            </View>

            {/* Vote Action Indicator */}
            {showVotingInterface && (
              <View style={[styles.actionIndicator, { backgroundColor: colors.primary }]}>
                <Text style={[styles.actionText, { color: colors.surface }]}>
                  TAP TO VOTE
                </Text>
              </View>
            )}

            {/* Voted Indicator - Compact */}
            {item.user_voted && (
              <View style={[styles.actionIndicator, { backgroundColor: colors.success, paddingHorizontal: 6, paddingVertical: 2 }]}>
                <Text style={[styles.actionText, { color: colors.surface, fontSize: 12 }]}>
                  VOTED
                </Text>
              </View>
            )}

            {/* Completed Indicator - Compact */}
            {item.status === 'completed' && !item.user_voted && (
              <View style={[styles.actionIndicator, { backgroundColor: colors.textSecondary, paddingHorizontal: 6, paddingVertical: 2 }]}>
                <Text style={[styles.actionText, { color: colors.surface, fontSize: 12 }]}>
                  ENDED
                </Text>
              </View>
            )}

            {/* Anonymous Voting Indicator */}
            {item.is_anonymous && (
              <View style={[styles.anonymousIndicator, { backgroundColor: colors.warning + '15', borderRadius: 12, padding: 4 }]}>
                <Ionicons
                  name="eye-off"
                  size={16}
                  color={colors.warning}
                />
              </View>
            )}
            
            {item.status === 'completed' && (
              <View style={[
                styles.progressBar,
                { backgroundColor: colors.border }
              ]}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${percentage}%`,
                    backgroundColor: colors.primary
                  }
                ]} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const PollBadges = ({ item, colors }) => {
  return (
    <View style={styles.pollBadges}>
      {item.is_anonymous && (
        <View style={[styles.anonymousBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning, borderWidth: 1 }]}>
          <Ionicons name="eye-off" size={12} color={colors.warning} />
          <Text style={[styles.anonymousText, { color: colors.warning }]}>
            Anonymous
          </Text>
        </View>
      )}

      {item.user_voted && (
        <View style={[styles.votedBadge, { backgroundColor: colors.success + '15', borderColor: colors.success, borderWidth: 1 }]}>
          <Ionicons name="checkmark-circle" size={10} color={colors.success} />
          <Text style={[styles.votedText, { color: colors.success, fontSize: 12 }]}>
            VOTED
          </Text>
        </View>
      )}

      {item.status === 'active' && !item.user_voted && (
        <View style={[styles.canVoteBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary, borderWidth: 1 }]}>
          <Ionicons name="radio-button-off" size={10} color={colors.primary} />
          <Text style={[styles.canVoteText, { color: colors.primary, fontSize: 12 }]}>
            CAN VOTE
          </Text>
        </View>
      )}

      {item.status === 'completed' && (
        <View style={[styles.completedBadge, { backgroundColor: colors.textSecondary + '15', borderColor: colors.textSecondary, borderWidth: 1 }]}>
          <Ionicons name="time" size={10} color={colors.textSecondary} />
          <Text style={[styles.completedText, { color: colors.textSecondary, fontSize: 12 }]}>
            ENDED
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  optionsContainer: {
    marginBottom: 12,
  },
  optionsContainerDesktop: {
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  optionItemDesktop: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  voteIconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  anonymousIndicator: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIndicator: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
  optionTextDesktop: {
    fontSize: 15,
    flex: 1,
  },
  optionVotes: {
    fontSize: 12,
  },
  optionVotesDesktop: {
    fontSize: 13,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  votedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  votedText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '500',
  },
  canVoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  canVoteText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '500',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '500',
  },
  anonymousBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  anonymousText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '500',
  },
  pollBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export { PollOptions, PollBadges };
