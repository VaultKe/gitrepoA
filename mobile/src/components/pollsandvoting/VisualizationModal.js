import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { spacing, typography } from '../../utils/theme';
import { formatTableDate, getPollTypeColor, getStatusColor, getTotalVotesCast, getTotalEligibleVoters, getVotePercentage } from '../../utils/pollsVotingHelpers';
import PollVisualizations from './PollVisualizations';

const VisualizationModal = ({
  colors,
  isDesktop,
  visible,
  onClose,
  poll,
  formatTableDate,
  getPollTypeColor,
  getStatusColor,
  getTotalVotesCast,
  getTotalEligibleVoters,
  getVotePercentage,
}) => {
  if (!visible || !poll) return null;

  return (
    <>
      {/* Backdrop */}
      <View style={styles.modalBackdrop}>
        <TouchableOpacity
          style={styles.modalBackdropTouchable}
          onPress={onClose}
          activeOpacity={1}
        />
      </View>

      {/* Modal Content */}
      <View style={[styles.visualizationModalContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
          <View style={styles.modalCloseButton} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Poll Details & Results
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
          {/* Poll Header Info */}
          <View style={styles.pollDetailHeader}>
            <Text style={[styles.pollDetailTitle, { color: colors.text }]}>
              {poll.title}
            </Text>
            <View style={[styles.pollTypeBadge, { backgroundColor: getPollTypeColor(poll.type, colors) + '15' }]}>
              <Text style={[styles.pollTypeText, { color: getPollTypeColor(poll.type, colors) }]}>
                {poll.type.replace('_', ' ')}
              </Text>
            </View>
          </View>

          {poll.description && (
            <Text style={[styles.pollDetailDescription, { color: colors.textSecondary }]}>
              {poll.description}
            </Text>
          )}

          {/* Poll Stats */}
          <View style={[styles.pollDetailStats, !isDesktop && { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={[styles.statItem, !isDesktop && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Votes:
              </Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {getTotalVotesCast(poll)}/{getTotalEligibleVoters(poll)}
              </Text>
            </View>
            <View style={[styles.statItem, !isDesktop && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Ended:
              </Text>
              <Text style={[styles.statValue, { color: colors.textSecondary }]}>
                {formatTableDate(poll.ends_at)}
              </Text>
            </View>
            <View style={[styles.statItem, !isDesktop && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Status:
              </Text>
              <Text style={[styles.statValue, { color: getStatusColor(poll.status, poll.result, colors) }]}>
                {poll.result === 'completed_early' ? 'Completed Early' : poll.result || 'Completed'}
              </Text>
            </View>
          </View>

          {/* Visualizations */}
          <PollVisualizations
            poll={poll}
            colors={colors}
            isDesktop={isDesktop}
            getTotalVotesCast={getTotalVotesCast}
            getTotalEligibleVoters={getTotalEligibleVoters}
            getVotePercentage={getVotePercentage}
          />

          {/* Poll Options with Vote Counts */}
          <View style={styles.pollOptionsDetail}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 16 }]}>
              Voting Options
            </Text>
            {poll.options.map((option, index) => {
              const totalVotes = getTotalVotesCast(poll);
              const percentage = getVotePercentage(option.vote_count, totalVotes);
              return (
                <View key={option.id || index} style={[styles.optionDetailItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.optionDetailContent}>
                    <Text style={[styles.optionDetailText, { color: colors.text }]}>
                      {option.option_text}
                    </Text>
                    <Text style={[styles.optionDetailVotes, { color: colors.textSecondary }]}>
                      {option.vote_count || 0} votes ({percentage}%)
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                      <View style={[styles.progressFill, {
                        width: `${percentage}%`,
                        backgroundColor: colors.primary
                      }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  modalBackdropTouchable: {
    flex: 1,
  },
  visualizationModalContainer: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    left: 20,
    right: 20,
    zIndex: 1002,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalCloseButton: {
    padding: 8,
    width: 40,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
  },
  pollDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pollDetailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
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
  pollDetailDescription: {
    fontSize: 14,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  pollDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  pollOptionsDetail: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  optionDetailItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionDetailContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionDetailText: {
    fontSize: 14,
    flex: 1,
  },
  optionDetailVotes: {
    fontSize: 12,
  },
  progressBarContainer: {
    marginTop: 8,
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
});

export default VisualizationModal;
