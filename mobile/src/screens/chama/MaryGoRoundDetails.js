import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useChamaContext } from '../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ApiService from '../../services/api';

const MaryGoRoundDetails = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const { cycleId, chamaId } = route?.params || {};

  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cycleHistory, setCycleHistory] = useState([]);

  useEffect(() => {
    if (cycleId) {
      loadCycleDetails();
    }
  }, [cycleId]);

  const loadCycleDetails = async () => {
    try {
      setLoading(true);

      // Load cycle details
      const cyclesResponse = await ApiService.getMerryGoRounds(chamaId || currentChamaId);
      if (cyclesResponse.success) {
        const foundCycle = cyclesResponse.data?.find(c => c.id === cycleId);
        setCycle(foundCycle);
      }

      // Load cycle history (placeholder - would need specific API)
      setCycleHistory([]);

    } catch (error) {
      console.error('Error loading cycle details:', error);
      Alert.alert('Error', 'Failed to load merry go round cycle details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'KES 0';
    }
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!cycle) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="refresh-circle-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Cycle Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load merry go round cycle details
          </Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <View style={styles.cycleIcon}>
              <Ionicons name="refresh-circle" size={32} color={colors.info} />
            </View>
            <View style={styles.cycleInfo}>
              <Text style={[styles.cycleTitle, { color: colors.text }]}>
                Cycle {cycle.cycleNumber}
              </Text>
              <Text style={[styles.cycleRecipient, { color: colors.textSecondary }]}>
                Recipient: {cycle.recipientName}
              </Text>
            </View>
          </View>
        </View>

        {/* Amount Card */}
        <Card variant="outlined" style={styles.amountCard}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Cycle Amount</Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>
            {formatCurrency(cycle.amount)}
          </Text>
          <Text style={[styles.expectedDate, { color: colors.textSecondary }]}>
            Expected: {formatDate(cycle.expectedDate)}
          </Text>
        </Card>

        {/* Cycle Details */}
        <Card variant="outlined" style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cycle Details</Text>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={[styles.statusBadge, {
              backgroundColor: cycle.status?.toLowerCase().includes('ready') ? colors.success + '20' :
                             cycle.status === 'disbursed' ? colors.info + '20' : colors.warning + '20'
            }]}>
              <Text style={[styles.statusText, {
                color: cycle.status?.toLowerCase().includes('ready') ? colors.success :
                       cycle.status === 'disbursed' ? colors.info : colors.warning
              }]}>
                {cycle.status?.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Recipient ID</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {cycle.recipientId}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Cycle Created</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(cycle.createdAt)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Disbursement Date</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {cycle.disbursedAt ? formatDate(cycle.disbursedAt) : 'Not yet disbursed'}
            </Text>
          </View>
        </Card>

        {/* Cycle History */}
        <Card variant="outlined" style={styles.historyCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cycle History</Text>

          {cycleHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No history available
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Cycle history will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {cycleHistory.map((event, index) => (
                <View key={event.id || index} style={styles.historyItem}>
                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyEvent, { color: colors.text }]}>
                      {event.event}
                    </Text>
                    <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                      {formatDate(event.date)}
                    </Text>
                  </View>
                  <Ionicons
                    name={event.icon || 'checkmark-circle'}
                    size={20}
                    color={colors.primary}
                  />
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          {cycle.status?.toLowerCase().includes('ready') && (
            <Button
              title="Disburse Funds"
              onPress={() => Alert.alert('Coming Soon', 'Merry go round disbursement will be available in the next update.')}
              style={{ backgroundColor: colors.primary, marginBottom: spacing.md }}
              icon={<Ionicons name="cash" size={16} color={colors.white} />}
            />
          )}

          <Button
            title="View Participants"
            onPress={() => Alert.alert('Coming Soon', 'Cycle participants view will be available in the next update.')}
            style={{ backgroundColor: colors.info, marginBottom: spacing.md }}
            icon={<Ionicons name="people" size={16} color={colors.white} />}
          />

          <Button
            title="Cycle Report"
            onPress={() => Alert.alert('Coming Soon', 'Cycle reports will be available in the next update.')}
            style={{ backgroundColor: colors.secondary }}
            icon={<Ionicons name="document-text" size={16} color={colors.white} />}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cycleIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  cycleInfo: {
    flex: 1,
  },
  cycleTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  cycleRecipient: {
    fontSize: typography.fontSize.sm,
  },
  amountCard: {
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  amountValue: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  expectedDate: {
    fontSize: typography.fontSize.xs,
  },
  detailsCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  historyCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  emptyHistory: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  historyList: {
    marginTop: spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  historyInfo: {
    flex: 1,
  },
  historyEvent: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  historyDate: {
    fontSize: typography.fontSize.xs,
  },
  actions: {
    marginBottom: spacing.xxxl,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorSubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
});

export default MaryGoRoundDetails;