import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { spacing, typography } from '../../utils/theme';
import { formatTableDate, getPollTypeColor, getStatusColor, getTotalVotesCast, getTotalEligibleVoters } from '../../utils/pollsVotingHelpers';

const CompletedPollsTable = ({
  colors,
  paginatedPolls,
  totalPages,
  currentPage,
  onPageChange,
  onOpenVisualization,
  formatTableDate,
  getPollTypeColor,
  getStatusColor,
  getTotalVotesCast,
  getTotalEligibleVoters,
}) => {
  return (
    <View style={{ flex: 1 }}>
      <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
        {/* Table Header */}
        <View style={[styles.tableHeader, {
          backgroundColor: colors.primary + '15',
          borderBottomWidth: 2,
          borderBottomColor: colors.primary
        }]}>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Title</Text>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Type</Text>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Total</Text>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Ended</Text>
          <Text style={[styles.tableHeaderText, { color: colors.primary }]}>Action</Text>
        </View>

        {/* Table Rows */}
        {paginatedPolls.map((poll, index) => (
          <View key={poll.id} style={[styles.tableRow, { borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
            <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={2}>{(poll.title || '').length > 10 ? (poll.title || '').substring(0, 10) + '...' : (poll.title || '')}</Text>
            <Text style={[styles.tableCell, { color: colors.textSecondary }]}>{(poll.type || 'General').length > 7 ? (poll.type || 'General').substring(0, 7) + '...' : (poll.type || 'General')}</Text>
            <Text style={[styles.tableCell, { color: colors.textSecondary }]}>
              {getTotalVotesCast(poll)}/{getTotalEligibleVoters(poll)}
            </Text>
              <Text style={[styles.tableCell, { color: colors.textSecondary }]}>{formatTableDate(poll.ends_at)}</Text>
            <TouchableOpacity
              style={[styles.actionCell, { backgroundColor: colors.primary + '15' }]}
              onPress={() => onOpenVisualization(poll)}
            >
              <Ionicons name="eye" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.paginationButton, {
                backgroundColor: colors.surface,
                borderColor: colors.border
              }, currentPage === 1 && styles.paginationButtonDisabled]}
              onPress={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? colors.textSecondary : colors.primary} />
            </TouchableOpacity>

            <Text style={[styles.paginationText, { color: colors.textSecondary }]}>
              Page {currentPage} of {totalPages}
            </Text>

            <TouchableOpacity
              style={[styles.paginationButton, {
                backgroundColor: colors.surface,
                borderColor: colors.border
              }, currentPage === totalPages && styles.paginationButtonDisabled]}
              onPress={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? colors.textSecondary : colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {paginatedPolls.length === 0 && (
          <View style={[styles.emptyState, { alignItems: 'center' }]}>
            <Ionicons name="checkmark-done" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              No completed polls yet
            </Text>
            <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
              Completed polls will appear here
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  actionCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  paginationButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
});

export default CompletedPollsTable;
