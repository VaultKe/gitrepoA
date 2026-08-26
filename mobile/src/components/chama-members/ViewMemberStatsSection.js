import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import { spacing, typography, borderRadius } from '../../utils/theme';

const ViewMemberStatsSection = ({ memberStats, formatCurrency, colors }) => {
  if (!memberStats) return null;
  return (
    <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Member Statistics
      </Text>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="wallet" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatCurrency(memberStats.total_contributions)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Contributions
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="card" size={24} color={colors.success} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {memberStats.loans_count || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Loans Taken
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="calendar" size={24} color={colors.warning} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {memberStats.meetings_attended || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Meetings Attended
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Ionicons name="star" size={24} color={colors.info} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {memberStats.rating || 0}/5
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Member Rating
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default ViewMemberStatsSection;
