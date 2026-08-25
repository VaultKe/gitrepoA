import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';

const ViewMemberStatsSection = ({ memberStats, formatCurrency, styles, colors }) => {
  if (!memberStats) return null;
  return (
    <Card variant="outlined" padding="none" style={[styles.statsCard, { borderWidth: 1, borderColor: colors.border }]}>
      <View style={styles.statsContent}>
        <Text style={styles.statsTitle}>Member Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <View style={styles.statIconBoxPrimary}>
                  <Ionicons name="wallet" size={20} color={colors.primary} />
                </View>
                <Text style={styles.statLabel}>Total Contributions</Text>
              </View>
              <Text style={styles.statValue}>{formatCurrency(memberStats.total_contributions)}</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <View style={styles.statIconBoxSuccess}>
                  <Ionicons name="card" size={20} color={colors.success} />
                </View>
                <Text style={styles.statLabel}>Loans Taken</Text>
              </View>
              <Text style={styles.statValue}>{memberStats.loans_count || 0}</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <View style={styles.statIconBoxWarning}>
                  <Ionicons name="calendar" size={20} color={colors.warning} />
                </View>
                <Text style={styles.statLabel}>Meetings Attended</Text>
              </View>
              <Text style={styles.statValue}>{memberStats.meetings_attended || 0}</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <View style={styles.statIconBoxInfo}>
                  <Ionicons name="star" size={20} color={colors.info} />
                </View>
                <Text style={styles.statLabel}>Member Rating</Text>
              </View>
              <Text style={styles.statValue}>{memberStats.rating || 0}/5</Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
};

export default ViewMemberStatsSection;
