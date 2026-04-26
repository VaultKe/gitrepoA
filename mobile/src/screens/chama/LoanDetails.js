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
    fontSize: 9,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 8.5,
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

      // Load repayment history - simulate API call for now
      // In production, this would be: ApiService.getLoanRepaymentHistory(loanId)
      const mockPayments = [
        { id: 'pay-1', date: '2024-01-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-2', date: '2024-02-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-3', date: '2024-03-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-4', date: '2024-04-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-5', date: '2024-05-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-6', date: '2024-06-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-7', date: '2024-07-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-8', date: '2024-08-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-9', date: '2024-09-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-10', date: '2024-10-15', amount: 5000, type: 'Principal + Interest', status: 'completed' },
        { id: 'pay-11', date: '2024-11-15', amount: 5000, type: 'Principal + Interest', status: 'pending' },
        { id: 'pay-12', date: '2024-12-15', amount: 5000, type: 'Principal + Interest', status: 'pending' },
      ];

      setAllPayments(mockPayments);
      setTotalItems(mockPayments.length);
      setTotalPages(Math.ceil(mockPayments.length / pageSize));

      // Set initial page data
      const startIndex = 0;
      const endIndex = pageSize;
      setPayments(mockPayments.slice(startIndex, endIndex));
      setCurrentPage(1);

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
          {payments.map((payment, index) => (
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
                  {formatDate(payment.date)}
                </Text>
              </View>

              {/* Type */}
              <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
                <Text style={tableStyles.tableCellText}>
                  {payment.type}
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
                  { backgroundColor: payment.status === 'completed' ? colors.success + '20' : colors.warning + '20' }
                ]}>
                  <Text style={[
                    { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, color: payment.status === 'completed' ? colors.success : colors.warning }
                  ]}>
                    {payment.status?.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ))}

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