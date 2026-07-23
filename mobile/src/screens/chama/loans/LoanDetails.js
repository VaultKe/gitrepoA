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
import { getLoanRepaymentHistory } from '../../../services/api/loanEndpoints';

const createTableStyles = (colors, spacing, typography, shadows) => ({
  tableContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  dateCell: {
    flex: 1.5,
    alignItems: 'flex-start',
  },
  typeCell: {
    flex: 2,
  },
  amountCell: {
    flex: 1.5,
  },
  statusCell: {
    flex: 1.2,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  dateText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
});

const LoanDetails = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const { loanId, chamaId } = route?.params || {};

  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [repaymentHistory, setRepaymentHistory] = useState(null);
  const [disbursement, setDisbursement] = useState(null);
  const [schedule, setSchedule] = useState([]);

  // Repayment history pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (loanId) {
      loadLoanDetails();
    }
  }, [loanId]);

  // Handle pagination
  useEffect(() => {
    if (allPayments.length > 0) {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setPayments(allPayments.slice(startIndex, endIndex));
    }
  }, [currentPage, allPayments]);

  const loadLoanDetails = async () => {
    try {
      setLoading(true);

      // Load loan details
      const loansResponse = await ApiService.getLoans(chamaId || currentChamaId);
      if (loansResponse.success) {
        const foundLoan = loansResponse.data?.find(l => l.id === loanId);
        setLoan(foundLoan);
      }

      // Load repayment history from API
      try {
        const historyResponse = await getLoanRepaymentHistory(loanId);
        if (historyResponse?.success && historyResponse?.data) {
          setRepaymentHistory(historyResponse.data);
          setDisbursement(historyResponse.data.disbursement || null);
          setSchedule(Array.isArray(historyResponse.data.schedule) ? historyResponse.data.schedule : []);
          const paymentList = Array.isArray(historyResponse.data.payments) ? historyResponse.data.payments : [];
          setAllPayments(paymentList);
          setTotalItems(paymentList.length);
          setTotalPages(Math.ceil(paymentList.length / pageSize));
          const startIndex = 0;
          const endIndex = pageSize;
          setPayments(paymentList.slice(startIndex, endIndex));
          setCurrentPage(1);
        }
      } catch (historyError) {
        console.error('Failed to load repayment history:', historyError);
        setAllPayments([]);
        setTotalItems(0);
        setTotalPages(1);
        setCurrentPage(1);
      }

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
      case 'disbursed':
      case 'completed':
        return colors.success;
      case 'partial':
      case 'processing':
        return colors.warning;
      case 'delinquent':
      case 'failed':
        return colors.error;
      case 'recovery active':
        return colors.info;
      case 'collections':
        return colors.secondary;
      default:
        return colors.textSecondary;
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

        {/* Disbursement Info */}
        {disbursement && (
          <Card variant="outlined" style={styles.amountCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                <Ionicons name="cash-outline" size={20} color={colors.success} />
              </View>
              <View>
                <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Disbursement</Text>
                <Text style={[styles.amountValue, { color: getStatusColor(disbursement.status), fontSize: typography.fontSize.lg }]}>
                  {formatCurrency(disbursement.amount)}
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(disbursement.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(disbursement.status) }]}>
                  {disbursement.status?.toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.xs, marginLeft: spacing.sm }}>
                {formatDate(disbursement.updatedAt || disbursement.createdAt)}
              </Text>
            </View>
          </Card>
        )}

        {/* Repayment Schedule */}
        {schedule.length > 0 && (
          <Card variant="outlined" style={{ marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                <Ionicons name="calendar" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Repayment Schedule</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm }}>
                {schedule.map((installment) => (
                  <View
                    key={installment.number}
                    style={[
                      { padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, minWidth: 100, alignItems: 'center' },
                      { backgroundColor: installment.status === 'paid' ? colors.success + '10' : colors.background, borderColor: installment.status === 'paid' ? colors.success : colors.border }
                    ]}
                  >
                    <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>Month {installment.number}</Text>
                    <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.text }}>
                      {formatCurrency(installment.amount)}
                    </Text>
                    <Text style={{ fontSize: typography.fontSize['2xs'], color: installment.status === 'paid' ? colors.success : colors.textSecondary }}>
                      {installment.status === 'paid' ? 'PAID' : 'PENDING'}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Card>
        )}

        {/* Repayment History Table */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.md }]}>Repayment History</Text>
        <View style={styles.repaymentTable}>
          {/* Table Header */}
          <View style={tableStyles.tableHeader}>
            <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
              <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Date</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
              <Text style={tableStyles.tableHeaderText}>Type</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Amount</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
              <Text style={tableStyles.tableHeaderText}>Status</Text>
            </View>
          </View>

          {/* Table Body */}
          {payments.map((payment, index) => {
            const paymentDate = payment.paidAt || payment.date || payment.createdAt;
            const paymentType = payment.paymentMethod || payment.type || 'Payment';
            const paymentStatus = payment.status || 'completed';
            return (
              <View
                key={payment.id}
                style={[
                  tableStyles.tableRow,
                  index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }
                ]}
              >
                {/* Date */}
                <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
                  <Text style={[tableStyles.tableCellText, tableStyles.dateText]} numberOfLines={1}>
                    {formatDate(paymentDate)}
                  </Text>
                </View>

                {/* Type */}
                <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
                  <Text style={tableStyles.tableCellText}>
                    {paymentType}
                  </Text>
                </View>

                {/* Amount */}
                <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                  <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium, color: colors.success }]}>
                    {formatCurrency(payment.amount)}
                  </Text>
                </View>

                {/* Status */}
                <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
                  <View style={[
                    tableStyles.statusBadge,
                    { backgroundColor: paymentStatus === 'completed' ? colors.success + '20' : paymentStatus === 'failed' ? colors.error + '20' : colors.warning + '20' }
                  ]}>
                    <Text style={[
                      { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, color: paymentStatus === 'completed' ? colors.success : paymentStatus === 'failed' ? colors.error : colors.warning }
                    ]}>
                      {paymentStatus?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Pagination */}
          {totalItems > pageSize && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.paginationArrow, currentPage === 1 && styles.paginationArrowDisabled]}
                onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? '#9ca3af' : '#2563eb'} />
              </TouchableOpacity>

              <Text style={styles.paginationInfo}>
                {currentPage} / {totalPages}
              </Text>

              <TouchableOpacity
                style={[styles.paginationArrow, currentPage === totalPages && styles.paginationArrowDisabled]}
                onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? '#9ca3af' : '#2563eb'} />
              </TouchableOpacity>
            </View>
          )}
        </View>

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
  repaymentTable: {
    marginTop: spacing.md,
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
  actions: {
    marginBottom: spacing.xxxl,
  },

  // Pagination Styles
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: spacing.sm,
  },
  paginationArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  paginationArrowDisabled: {
    opacity: 0.5,
  },
  paginationInfo: {
    fontSize: typography.fontSize.sm,
    color: '#6b7280',
    fontWeight: typography.fontWeight.medium,
    minWidth: 60,
    textAlign: 'center',
  },


});

export default LoanDetails;