import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import ApiService from '../../../services/api';
import { getLoanRepaymentHistory, makeLoanPayment, disburseLoan } from '../../../services/api/loanEndpoints';
import RecordPaymentModal from './RecordPaymentModal';

const LoanDetails = ({ route, navigation }) => {
  const { theme } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);
  const { loanId, chamaId } = route?.params || {};

  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [repaymentHistory, setRepaymentHistory] = useState(null);
  const [disbursement, setDisbursement] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (loanId) loadLoanDetails();
  }, [loanId]);

  useEffect(() => {
    if (allPayments.length > 0) {
      const start = (currentPage - 1) * pageSize;
      setPayments(allPayments.slice(start, start + pageSize));
    } else {
      setPayments([]);
    }
  }, [currentPage, allPayments]);

  const loadLoanDetails = async () => {
    try {
      setLoading(true);
      const loansResponse = await ApiService.getLoans(chamaId || currentChamaId);
      if (loansResponse.success) {
        const foundLoan = loansResponse.data?.find(l => l.id === loanId);
        setLoan(foundLoan);
      }

      try {
        const historyResponse = await getLoanRepaymentHistory(loanId);
        if (historyResponse?.success && historyResponse?.data) {
          setRepaymentHistory(historyResponse.data);
          setDisbursement(historyResponse.data.disbursement || null);
          setSchedule(Array.isArray(historyResponse.data.schedule) ? historyResponse.data.schedule : []);
          const paymentList = Array.isArray(historyResponse.data.payments) ? historyResponse.data.payments : [];
          setAllPayments(paymentList);
          setTotalItems(paymentList.length);
          setTotalPages(Math.max(1, Math.ceil(paymentList.length / pageSize)));
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
    if (amount === null || amount === undefined || isNaN(amount)) return 'KES 0';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

  const getLoanStatusStyles = (status) => {
    const normalized = status?.toLowerCase();
    switch (normalized) {
      case 'approved':
      case 'completed':
      case 'disbursed':
        return [[styles.statusBadge, styles.statusBadgeSuccess], [styles.statusText, styles.statusTextSuccess]];
      case 'pending':
        return [[styles.statusBadge, styles.statusBadgeWarning], [styles.statusText, styles.statusTextWarning]];
      case 'rejected':
      case 'failed':
        return [[styles.statusBadge, styles.statusBadgeError], [styles.statusText, styles.statusTextError]];
      default:
        return [[styles.statusBadge, styles.statusBadgeMuted], [styles.statusText, styles.statusTextMuted]];
    }
  };

  const renderStatusBadge = (status) => {
    const badgeStyle = getLoanStatusStyles(status);
    return (
      <View style={badgeStyle[0]}>
        <Text style={badgeStyle[1]}>{status?.toUpperCase()}</Text>
      </View>
    );
  };

  const handleDisburseLoan = async () => {
    Alert.alert('Disburse Loan', 'Are you sure you want to disburse this loan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disburse',
        onPress: async () => {
          try {
            setLoading(true);
            const response = await disburseLoan(loanId);
            if (response?.success) {
              Alert.alert('Success', 'Loan disbursed successfully');
              loadLoanDetails();
            } else {
              Alert.alert('Error', response?.error || 'Failed to disburse loan');
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to disburse loan');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }
    try {
      setSubmittingPayment(true);
      const response = await makeLoanPayment(loanId, parseFloat(paymentAmount), paymentMethod);
      if (response?.success) {
        Alert.alert('Success', 'Payment recorded successfully');
        setPaymentModalVisible(false);
        setPaymentAmount('');
        setPaymentMethod('mobile_money');
        loadLoanDetails();
      } else {
        Alert.alert('Error', response?.error || 'Failed to record payment');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const borrowerName = loan?.borrower?.fullName || loan?.memberName || 'Unknown Borrower';

  const detailsHeaders = ['Field', 'Value'];
  const detailsData = [
    { id: 'status', cells: ['Status', renderStatusBadge(loan?.status)] },
    { id: 'type', cells: ['Type', loan?.type || 'N/A'] },
    { id: 'purpose', cells: ['Purpose', loan?.purpose || 'N/A'] },
    { id: 'borrower', cells: ['Borrower', borrowerName] },
    { id: 'amount', cells: ['Loan Amount', formatCurrency(loan?.amount)] },
    { id: 'rate', cells: ['Interest Rate', `${loan?.interestRate || 0}%`] },
    { id: 'duration', cells: ['Duration', `${loan?.duration || 0} months`] },
    { id: 'total', cells: ['Total Amount', formatCurrency(loan?.totalAmount)] },
    { id: 'paid', cells: ['Paid Amount', formatCurrency(loan?.paidAmount)] },
    { id: 'remaining', cells: ['Remaining', formatCurrency(loan?.remainingAmount)] },
    { id: 'due', cells: ['Due Date', formatDate(loan?.dueDate)] },
    { id: 'reqGuarantors', cells: ['Required Guarantors', loan?.requiredGuarantors?.toString() || '0'] },
    { id: 'appGuarantors', cells: ['Approved Guarantors', loan?.approvedGuarantors?.toString() || '0'] },
    { id: 'created', cells: ['Created At', formatDate(loan?.createdAt)] },
  ];

  const scheduleHeaders = ['Month', 'Due Date', 'Amount', 'Principal', 'Interest', 'Status'];
  const scheduleData = schedule.map((item) => ({
    id: String(item.number),
    cells: [
      `Month ${item.number}`,
      formatDate(item.dueDate),
      formatCurrency(item.amount),
      formatCurrency(item.principal),
      formatCurrency(item.interest),
      item.status?.toUpperCase(),
    ],
  }));

  const paymentHeaders = ['Date', 'Type', 'Amount', 'Status'];
  const paymentData = payments.map((payment) => {
    const paymentDate = payment.paidAt || payment.date || payment.createdAt;
    const paymentType = payment.paymentMethod || payment.type || 'Payment';
    const paymentStatus = payment.status || 'completed';
    return {
      id: payment.id,
      cells: [
        formatDate(paymentDate),
        paymentType,
        formatCurrency(payment.amount),
        renderStatusBadge(paymentStatus),
      ],
    };
  });

  const renderCell = (cell, index, totalCells) => {
    const isFirst = index === 0;
    const isLast = index === totalCells - 1;
    const flex = isFirst ? 1.5 : isLast ? 1 : 1.5;
    return (
      <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, isLast && styles.actionsCell, { flex }]}>
        <Text style={[styles.tableCellText, isFirst && styles.nameText]}>{cell}</Text>
      </View>
    );
  };

  const renderEmpty = (message) => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={24} color={colors.textSecondary} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const renderLoanTable = ({ title, headers, data, emptyMessage }) => (
    <View style={styles.tableContainer}>
      <Card variant="outlined" padding="none" style={styles.tableCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
          <View style={styles.tableContent}>
            <View style={styles.tableHeader}>
              {headers.map((header, index) => {
                const isFirst = index === 0;
                const isLast = index === headers.length - 1;
                const flex = isFirst ? 1.6 : isLast ? 1 : 1.5;
                return (
                  <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, isLast && styles.actionsCell, { flex }]}>
                    <Text style={[styles.tableHeaderText, isFirst && styles.tableHeaderTextLeft]}>{header}</Text>
                  </View>
                );
              })}
            </View>
            <FlatList
              data={data}
              renderItem={({ item, index }) => (
                <View style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                  {item.cells.map((cell, cellIndex) => renderCell(cell, cellIndex, item.cells.length))}
                </View>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.loansList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmpty(emptyMessage)}
            />
          </View>
        </ScrollView>
      </Card>
    </View>
  );

  const renderDetailsCell = (cell, index, totalCells) => {
    const isFirst = index === 0;
    const isLast = index === totalCells - 1;
    const flex = isFirst ? 0.8 : 2;
    return (
      <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, isLast && styles.actionsCell, { flex, alignItems: 'flex-start' }]}>
        <Text style={[styles.tableCellText, isFirst && styles.nameText, { textAlign: 'left' }]}>{cell}</Text>
      </View>
    );
  };

  const renderDetailsTable = ({ title, headers, data, emptyMessage }) => (
    <View style={styles.tableContainer}>
      <Card variant="outlined" padding="none" style={styles.tableCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
          <View style={styles.tableContent}>
            <View style={styles.tableHeader}>
              {headers.map((header, index) => {
                const isFirst = index === 0;
                const isLast = index === headers.length - 1;
                const flex = isFirst ? 0.8 : 2;
                return (
                  <View key={index} style={[styles.tableCell, isFirst && styles.nameCell, isLast && styles.actionsCell, { flex }]}>
                    <Text style={[styles.tableHeaderText, isFirst && styles.tableHeaderTextLeft, { textAlign: 'left' }]}>{header}</Text>
                  </View>
                );
              })}
            </View>
            <FlatList
              data={data}
              renderItem={({ item, index }) => (
                <View style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                  {item.cells.map((cell, cellIndex) => renderDetailsCell(cell, cellIndex, item.cells.length))}
                </View>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.loansList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmpty(emptyMessage)}
            />
          </View>
        </ScrollView>
      </Card>
    </View>
  );

  if (!loan) {
    return (
      <SafeAreaView style={[styles.container, styles.containerBackground]}>
        <View style={styles.errorState}>
          <Ionicons name="card-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Loan Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>Unable to load loan details</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      <ScrollView ref={scrollViewRef} style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <View style={styles.loanIcon}>
              <Ionicons name="card" size={32} color={colors.primary} />
            </View>
            <View style={styles.loanInfo}>
              <Text style={[styles.loanTitle, { color: colors.text }]}>Loan #{loan.id?.slice(-8)}</Text>
              <Text style={[styles.loanMember, { color: colors.textSecondary }]}>{borrowerName}</Text>
            </View>
          </View>
        </View>

        {renderDetailsTable({ title: 'Loan Details', headers: detailsHeaders, data: detailsData, emptyMessage: 'No loan details available' })}

        {disbursement && (
          <Card variant="outlined" style={styles.amountCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                <Ionicons name="cash-outline" size={20} color={colors.success} />
              </View>
              <View>
                <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Disbursement</Text>
                <Text style={[styles.amountValue, { color: getStatusColor(disbursement.status), fontSize: typography.fontSize.lg }]}>{formatCurrency(disbursement.amount)}</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              {renderStatusBadge(disbursement.status)}
              <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize.xs, marginLeft: spacing.sm }}>{formatDate(disbursement.updatedAt || disbursement.createdAt)}</Text>
            </View>
          </Card>
        )}

        {renderLoanTable({ title: 'Repayment Schedule', headers: scheduleHeaders, data: scheduleData, emptyMessage: 'No schedule available yet' })}
        {renderLoanTable({ title: 'Repayment History', headers: paymentHeaders, data: paymentData, emptyMessage: 'No repayment history yet' })}

        {totalItems > pageSize && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.paginationArrow, currentPage === 1 && styles.paginationArrowDisabled]}
              onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? '#9ca3af' : '#2563eb'} />
            </TouchableOpacity>
            <Text style={styles.paginationInfo}>{currentPage} / {totalPages}</Text>
            <TouchableOpacity
              style={[styles.paginationArrow, currentPage === totalPages && styles.paginationArrowDisabled]}
              onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? '#9ca3af' : '#2563eb'} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actions}>
          {loan.status === 'approved' && (
            <Button title="Disburse Loan" onPress={handleDisburseLoan} loading={loading} style={{ backgroundColor: colors.primary, marginBottom: spacing.md }} icon={<Ionicons name="send" size={16} color={colors.white} />} />
          )}
          {['active', 'delinquent', 'partial', 'recovery_active'].includes(loan.status?.toLowerCase()) && (
            <Button title="Record Payment" onPress={() => setPaymentModalVisible(true)} style={{ backgroundColor: colors.success, marginBottom: spacing.md }} icon={<Ionicons name="cash" size={16} color={colors.white} />} />
          )}
          <Button title="View Schedule" onPress={() => {}} style={{ backgroundColor: colors.info, marginBottom: spacing.md }} icon={<Ionicons name="calendar" size={16} color={colors.white} />} />
          <Button title="Loan Report" onPress={() => Alert.alert('Coming Soon', 'Loan reports will be available in the next update.')} style={{ backgroundColor: colors.secondary, marginBottom: spacing.md }} icon={<Ionicons name="document-text" size={16} color={colors.white} />} />
        </View>
      </ScrollView>

      <RecordPaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        colors={colors}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        submittingPayment={submittingPayment}
        handleRecordPayment={handleRecordPayment}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  containerBackground: { backgroundColor: colors.background },
  scrollView: { flex: 1, padding: spacing.md },
  header: { borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  loanIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(59, 130, 246, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg },
  loanInfo: { flex: 1 },
  loanTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.xs },
  loanMember: { fontSize: typography.fontSize.sm },
  tableContainer: { marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm, alignSelf: 'stretch' },
  tableCard: { minHeight: 360, borderRadius: 8, width: '100%', alignSelf: 'stretch', padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tableScrollContent: { flexGrow: 1, width: '100%' },
  tableContent: { minWidth: 680, width: '100%' },
  tableHeader: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary },
  tableCell: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  nameCell: { flex: 1.6, alignItems: 'flex-start' },
  amountCell: { flex: 1.3 },
  statusCell: { flex: 1 },
  dateCell: { flex: 1.2 },
  actionsCell: { flex: 1 },
  tableHeaderText: { fontWeight: typography.fontWeight.bold, color: colors.primary, fontSize: 12, textAlign: 'center' },
  tableHeaderTextLeft: { textAlign: 'left' },
  tableRowEven: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center', backgroundColor: colors.background },
  tableRowOdd: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  tableCellText: { fontSize: 12, color: colors.text, textAlign: 'center' },
  nameText: { fontWeight: typography.fontWeight.medium, textAlign: 'left' },
  statusBadge: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.sm },
  statusBadgeSuccess: { backgroundColor: colors.success + '20' },
  statusBadgeWarning: { backgroundColor: colors.warning + '20' },
  statusBadgeError: { backgroundColor: colors.error + '20' },
  statusBadgeMuted: { backgroundColor: colors.textSecondary + '20' },
  statusText: { fontSize: 7, fontWeight: typography.fontWeight.bold, textTransform: 'capitalize' },
  statusTextSuccess: { color: colors.success },
  statusTextWarning: { color: colors.warning },
  statusTextError: { color: colors.error },
  statusTextMuted: { color: colors.textSecondary },
  loansList: { padding: spacing.md },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  emptyText: { color: colors.textSecondary, fontSize: typography.fontSize.sm, marginTop: spacing.sm, textAlign: 'center' },
  amountCard: { padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  amountLabel: { fontSize: typography.fontSize.sm, marginBottom: spacing.xs },
  amountValue: { fontSize: typography.fontSize.xxxl, fontWeight: typography.fontWeight.bold, marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  paginationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: '#f5f5f5', borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: spacing.sm },
  paginationArrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.sm },
  paginationArrowDisabled: { opacity: 0.5 },
  paginationInfo: { fontSize: typography.fontSize.sm, color: '#6b7280', fontWeight: typography.fontWeight.medium, minWidth: 60, textAlign: 'center' },
  actions: { marginBottom: spacing.xxxl },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  errorTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginTop: spacing.md, marginBottom: spacing.xs, color: colors.text },
  errorSubtitle: { fontSize: typography.fontSize.sm, textAlign: 'center', color: colors.textSecondary },
});

export default LoanDetails;
