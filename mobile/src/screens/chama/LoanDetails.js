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

const LoanDetails = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const { loanId, chamaId } = route?.params || {};

  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (loanId) {
      loadLoanDetails();
    }
  }, [loanId]);

  const loadLoanDetails = async () => {
    try {
      setLoading(true);

      // Load loan details
      const loansResponse = await ApiService.getLoans(chamaId || currentChamaId);
      if (loansResponse.success) {
        const foundLoan = loansResponse.data?.find(l => l.id === loanId);
        setLoan(foundLoan);
      }

      // Load payment history (placeholder - would need specific API)
      setPayments([]);

    } catch (error) {
      console.error('Error loading loan details:', error);
      Alert.alert('Error', 'Failed to load loan details');
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

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'disbursed': return colors.success;
      case 'partial': return colors.warning;
      case 'delinquent': return colors.error;
      case 'recovery active': return colors.info;
      case 'collections': return colors.secondary;
      default: return colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!loan) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="card-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Loan Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load loan details
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
            <View style={styles.loanIcon}>
              <Ionicons name="card" size={32} color={colors.primary} />
            </View>
            <View style={styles.loanInfo}>
              <Text style={[styles.loanTitle, { color: colors.text }]}>
                Loan #{loan.id?.slice(-8)}
              </Text>
              <Text style={[styles.loanMember, { color: colors.textSecondary }]}>
                {loan.memberName}
              </Text>
            </View>
          </View>
        </View>

        {/* Amount Card */}
        <Card variant="outlined" style={styles.amountCard}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Loan Amount</Text>
          <Text style={[styles.amountValue, { color: getStatusColor(loan.status) }]}>
            {formatCurrency(loan.amount)}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(loan.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(loan.status) }]}>
                {loan.status?.toUpperCase().replace('_', ' ')}
              </Text>
            </View>
          </View>
        </Card>

        {/* Loan Details */}
        <Card variant="outlined" style={styles.detailsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Loan Details</Text>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Loan Type</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {loan.loanType || 'Standard Loan'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Member ID</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {loan.memberId}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Application Date</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(loan.createdAt)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Disbursement Date</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {loan.disbursedAt ? formatDate(loan.disbursedAt) : 'Not yet disbursed'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Interest Rate</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {loan.interestRate ? `${loan.interestRate}%` : 'N/A'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Term</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {loan.termMonths ? `${loan.termMonths} months` : 'N/A'}
            </Text>
          </View>
        </Card>

        {/* Payment History */}
        <Card variant="outlined" style={styles.paymentsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment History</Text>

          {payments.length === 0 ? (
            <View style={styles.emptyPayments}>
              <Ionicons name="cash-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No payments yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Loan payments will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.paymentsList}>
              {payments.map((payment, index) => (
                <View key={payment.id || index} style={styles.paymentItem}>
                  <View style={styles.paymentInfo}>
                    <Text style={[styles.paymentType, { color: colors.text }]}>
                      {payment.type}
                    </Text>
                    <Text style={[styles.paymentDate, { color: colors.textSecondary }]}>
                      {formatDate(payment.date)}
                    </Text>
                  </View>
                  <Text style={[styles.paymentAmount, { color: colors.success }]}>
                    {formatCurrency(payment.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          {loan.status === 'disbursement' && (
            <Button
              title="Disburse Loan"
              onPress={() => Alert.alert('Coming Soon', 'Loan disbursement will be available in the next update.')}
              style={{ backgroundColor: colors.primary, marginBottom: spacing.md }}
              icon={<Ionicons name="send" size={16} color={colors.white} />}
            />
          )}

          {['delinquent', 'partial', 'recovery_active'].includes(loan.status?.toLowerCase()) && (
            <Button
              title="Record Payment"
              onPress={() => Alert.alert('Coming Soon', 'Payment recording will be available in the next update.')}
              style={{ backgroundColor: colors.success, marginBottom: spacing.md }}
              icon={<Ionicons name="cash" size={16} color={colors.white} />}
            />
          )}

          <Button
            title="View Schedule"
            onPress={() => Alert.alert('Coming Soon', 'Loan schedule will be available in the next update.')}
            style={{ backgroundColor: colors.info, marginBottom: spacing.md }}
            icon={<Ionicons name="calendar" size={16} color={colors.white} />}
          />

          <Button
            title="Loan Report"
            onPress={() => Alert.alert('Coming Soon', 'Loan reports will be available in the next update.')}
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
  loanIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  loanInfo: {
    flex: 1,
  },
  loanTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  loanMember: {
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
    marginBottom: spacing.sm,
  },
  statusRow: {
    alignItems: 'center',
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
  paymentsCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  emptyPayments: {
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
  paymentsList: {
    marginTop: spacing.md,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentType: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs / 2,
  },
  paymentDate: {
    fontSize: typography.fontSize.xs,
  },
  paymentAmount: {
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

export default LoanDetails;