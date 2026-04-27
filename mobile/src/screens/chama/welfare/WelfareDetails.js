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
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import ApiService from '../../../services/api';

const WelfareDetails = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const { fundId, chamaId } = route?.params || {};

  const [welfareFund, setWelfareFund] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contributions, setContributions] = useState([]);

  useEffect(() => {
    if (fundId) {
      loadWelfareDetails();
    }
  }, [fundId]);

  const loadWelfareDetails = async () => {
    try {
      setLoading(true);

      // Load fund details
      const fundsResponse = await ApiService.getWelfareRequests(chamaId || currentChamaId);
      if (fundsResponse.success) {
        const fund = fundsResponse.data?.find(f => f.id === fundId);
        setWelfareFund(fund);
      }

      // Load contributions (placeholder - would need specific API)
      setContributions([]);

    } catch (error) {
      console.error('Error loading welfare details:', error);
      Alert.alert('Error', 'Failed to load welfare fund details');
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

  if (!welfareFund) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="heart-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Fund Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare fund details
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
            <View style={styles.fundIcon}>
              <Ionicons name="heart" size={32} color={colors.warning} />
            </View>
            <View style={styles.fundInfo}>
              <Text style={[styles.fundTitle, { color: colors.text }]}>
                Welfare Fund
              </Text>
              <Text style={[styles.fundMember, { color: colors.textSecondary }]}>
                {welfareFund.memberName}
              </Text>
            </View>
          </View>
        </View>

        {/* Amount Card */}
        <Card variant="outlined" style={styles.amountCard}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Fund Amount</Text>
          <Text style={[styles.amountValue, { color: colors.warning }]}>
            {formatCurrency(welfareFund.amount)}
          </Text>
          <Text style={[styles.requestDate, { color: colors.textSecondary }]}>
            Requested: {formatDate(welfareFund.createdAt)}
          </Text>
        </Card>

        {/* Fund Details */}
        <Card variant="outlined" style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Fund Details</Text>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={[styles.statusBadge, {
              backgroundColor: welfareFund.status === 'approved' ? colors.success + '20' :
                             welfareFund.status === 'pending' ? colors.warning + '20' : colors.error + '20'
            }]}>
              <Text style={[styles.statusText, {
                color: welfareFund.status === 'approved' ? colors.success :
                       welfareFund.status === 'pending' ? colors.warning : colors.error
              }]}>
                {welfareFund.status?.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Purpose</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {welfareFund.purpose || 'General welfare support'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Member ID</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {welfareFund.memberId}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Disbursement Date</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {welfareFund.disbursedAt ? formatDate(welfareFund.disbursedAt) : 'Not yet disbursed'}
            </Text>
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          {welfareFund.status === 'approved' && (
            <Button
              title="Disburse Funds"
              onPress={() => Alert.alert('Coming Soon', 'Welfare fund disbursement will be available in the next update.')}
              style={{ backgroundColor: colors.warning, marginBottom: spacing.md }}
              icon={<Ionicons name="cash" size={16} color={colors.white} />}
            />
          )}

          <Button
            title="View Contributors"
            onPress={() => navigation.navigate('WelfareContributions', { welfareRequestId: welfareFund.id, chamaId: currentChamaId })}
            style={{ backgroundColor: colors.info, marginBottom: spacing.md }}
            icon={<Ionicons name="people" size={16} color={colors.white} />}
          />

          <Button
            title="Fund Report"
            onPress={() => Alert.alert('Coming Soon', 'Fund reports will be available in the next update.')}
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
  fundIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  fundInfo: {
    flex: 1,
  },
  fundTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  fundMember: {
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
  requestDate: {
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
  contributionsCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  emptyContributions: {
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
  contributionsList: {
    marginTop: spacing.md,
  },
  contributionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  contributionInfo: {
    flex: 1,
  },
  contributionMember: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  contributionDate: {
    fontSize: typography.fontSize.xs,
  },
  contributionAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
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

export default WelfareDetails;