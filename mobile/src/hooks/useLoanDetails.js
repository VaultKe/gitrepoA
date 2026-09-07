import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, StyleSheet, View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import ApiService from '../services/api';
import { getLoanApplication, getLoanRepaymentHistory, makeLoanPayment, disburseLoan, initiateLoanApproval, confirmLoanApproval, getLoanGuarantors, getLoanReferees, getLoanFines } from '../services/api/loanEndpoints';

// While the loan is still moving through the approval pipeline, poll fast (5s) so
// actionable buttons reflect other officers' / backers' actions instantly.
const APPROVAL_PIPELINE = [
  'pending', 'pending_approval', 'guarantors_approved', 'guarantors_declined',
  'secretary_approved', 'treasurer_approved', 'approved', 'disbursing',
];
// Fully closed — nothing changes, no poll at all. Everything else (disbursed,
// active, delinquent, partial, recovery_active, defaulted, ...) is a live
// repayment/recovery state that we still track, just at a relaxed cadence.
const FINAL_STATUSES = ['completed', 'rejected', 'cancelled', 'closed', 'written_off'];

const pollIntervalFor = (status) => {
  const s = (status || '').toLowerCase();
  if (APPROVAL_PIPELINE.includes(s)) return 5000;
  if (FINAL_STATUSES.includes(s)) return 0;
  return 20000;
};

const useLoanDetails = ({ route, navigation }) => {
  const { theme } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

  const { loanId, chamaId } = route?.params || {};
  const [loan, setLoan] = useState(null);
  const [loanType, setLoanType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [repaymentHistory, setRepaymentHistory] = useState(null);
  const [disbursement, setDisbursement] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [guarantors, setGuarantors] = useState([]);
  const [referees, setReferees] = useState([]);
  const [fines, setFines] = useState([]);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalOTP, setApprovalOTP] = useState('');
  const [approvalStep, setApprovalStep] = useState('idle');
  const [approving, setApproving] = useState(false);
  const [backersLoaded, setBackersLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;
  const scrollViewRef = useRef(null);
  const mountedRef = useRef(true);
  const loanRef = useRef(null);
  loanRef.current = loan;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadLoanDetails = useCallback(async ({ silent = false, fresh = false } = {}) => {
    if (!loanId) { setLoading(false); return; }
    if (!silent) setLoading(true);

    // 1) The loan itself — a single fast row carrying the full approval state.
    //    The action buttons gate on this, so resolve it first and unblock the
    //    screen immediately; heavier data streams in afterwards.
    try {
      const res = await getLoanApplication(loanId, { fresh });
      if (res?.success && res.data) {
        if (mountedRef.current) setLoan(prev => ({ ...(prev || {}), ...res.data }));
      } else if (!silent) {
        const list = await ApiService.getLoans(chamaId || currentChamaId);
        const found = list?.data?.find(l => l.id === loanId);
        if (found && mountedRef.current) setLoan(found);
      }
    } catch (error) {
      if (!silent) {
        console.error('Error loading loan:', error);
        try {
          const list = await ApiService.getLoans(chamaId || currentChamaId);
          const found = list?.data?.find(l => l.id === loanId);
          if (found && mountedRef.current) setLoan(found);
        } catch {}
      }
    } finally {
      if (!silent && mountedRef.current) setLoading(false);
    }

    // 2) Everything else in parallel, in the background — never blocks the UI.
    const [history, gua, ref, fin] = await Promise.allSettled([
      getLoanRepaymentHistory(loanId),
      getLoanGuarantors(loanId),
      getLoanReferees(loanId),
      getLoanFines(loanId),
    ]);
    if (!mountedRef.current) return;

    if (history.status === 'fulfilled' && history.value?.success && history.value?.data) {
      const d = history.value.data;
      setRepaymentHistory(d);
      setDisbursement(d.disbursement || null);
      setSchedule(Array.isArray(d.schedule) ? d.schedule : []);
      const paymentList = Array.isArray(d.payments) ? d.payments : [];
      setAllPayments(paymentList);
      setTotalItems(paymentList.length);
      setTotalPages(Math.max(1, Math.ceil(paymentList.length / pageSize)));
    }

    setGuarantors(gua.status === 'fulfilled' && Array.isArray(gua.value?.data) ? gua.value.data : []);
    setReferees(ref.status === 'fulfilled' && Array.isArray(ref.value?.data) ? ref.value.data : []);
    setFines(fin.status === 'fulfilled' && Array.isArray(fin.value?.data) ? fin.value.data : []);
    setBackersLoaded(true);
  }, [loanId, chamaId, currentChamaId]);

  useEffect(() => {
    if (loanId) {
      loadLoanDetails();
    } else {
      setLoading(false);
    }
  }, [loanId, loadLoanDetails]);

  // Refresh the moment the screen regains focus (e.g. coming back from an
  // approval action elsewhere) — silent, no spinner.
  useFocusEffect(
    useCallback(() => {
      if (loanId) loadLoanDetails({ silent: true, fresh: true });
    }, [loanId, loadLoanDetails])
  );

  // Real-time poll. Fast while the loan is in the approval pipeline, relaxed for
  // ongoing repayment/recovery states, off once fully closed.
  useEffect(() => {
    if (!loanId) return;
    const interval = pollIntervalFor(loan?.status);
    if (!interval) return;
    const id = setInterval(() => {
      loadLoanDetails({ silent: true, fresh: true });
    }, interval);
    return () => clearInterval(id);
  }, [loanId, loan?.status, loadLoanDetails]);

  useEffect(() => {
    if (allPayments.length > 0) {
      const start = (currentPage - 1) * pageSize;
      setPayments(allPayments.slice(start, start + pageSize));
    } else {
      setPayments([]);
    }
  }, [currentPage, allPayments]);

  useEffect(() => {
    if (loan?.loanTypeId) {
      ApiService.getLoanType(loan.loanTypeId).then(response => {
        if (response?.success) {
          setLoanType(response.data);
        }
      }).catch(err => console.error('Failed to load loan type:', err));
    }
  }, [loan]);

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
              loadLoanDetails({ silent: true, fresh: true });
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

  const getNextApprovalRole = () => {
    if (!loan) return null;
    const stage = loan.approvalStage || loan.status;
    if (stage === 'pending' || stage === 'guarantors_approved') return 'secretary';
    if (stage === 'secretary_approved') return 'treasurer';
    if (stage === 'treasurer_approved') return 'chairperson';
    return null;
  };

  const handleInitiateApproval = async () => {
    if (!approvalComment.trim()) {
      Alert.alert('Comment Required', 'Please enter a comment before approving.');
      return;
    }
    try {
      setApproving(true);
      const response = await initiateLoanApproval(loanId, approvalComment.trim());
      if (response?.success) {
        setApprovalStep('confirm');
        Alert.alert('OTP Sent', response.message || 'Please enter the OTP sent to your phone.');
      } else {
        Alert.alert('Error', response?.error || 'Failed to initiate approval');
      }
    } catch (error) {
      Alert.alert('Cannot Approve Yet', error?.message || 'Failed to initiate approval');
    } finally {
      setApproving(false);
    }
  };

  const handleConfirmApproval = async () => {
    if (!approvalOTP.trim() || approvalOTP.trim().length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP sent to your phone.');
      return;
    }
    if (!approvalComment.trim()) {
      Alert.alert('Comment Required', 'Please enter a comment before confirming approval.');
      return;
    }
    try {
      setApproving(true);
      const response = await confirmLoanApproval(loanId, approvalOTP.trim(), approvalComment.trim());
      if (response?.success) {
        Alert.alert('Success', response.message || 'Loan approved successfully');
        setApprovalStep('idle');
        setApprovalComment('');
        setApprovalOTP('');
        loadLoanDetails({ silent: true, fresh: true });
      } else {
        Alert.alert('Error', response?.error || 'Failed to confirm approval');
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to confirm approval');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectLoan = async () => {
    if (!approvalComment.trim()) {
      Alert.alert('Comment Required', 'Please enter a reason for rejecting this loan.');
      return;
    }
    Alert.alert('Reject Loan', 'Are you sure you want to reject this loan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            setApproving(true);
            const response = await ApiService.rejectLoan(loanId, approvalComment.trim());
            if (response?.success) {
              Alert.alert('Success', 'Loan rejected successfully');
              setApprovalComment('');
              loadLoanDetails({ silent: true, fresh: true });
            } else {
              Alert.alert('Error', response?.error || 'Failed to reject loan');
            }
          } catch (error) {
            Alert.alert('Error', error?.message || 'Failed to reject loan');
          } finally {
            setApproving(false);
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
        loadLoanDetails({ silent: true, fresh: true });
      } else {
        Alert.alert('Error', response?.error || 'Failed to record payment');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return {
    // State
    loading,
    loan,
    loanType,
    payments,
    allPayments,
    repaymentHistory,
    disbursement,
    schedule,
    guarantors,
    referees,
    fines,
    paymentModalVisible,
    paymentAmount,
    paymentMethod,
    submittingPayment,
    approvalComment,
    approvalOTP,
    approvalStep,
    approving,
    backersLoaded,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    scrollViewRef,
    // Handlers
    setPaymentModalVisible,
    setPaymentAmount,
    setPaymentMethod,
    setApprovalComment,
    setApprovalOTP,
    setCurrentPage,
    setLoan,
    setLoanType,
    setPayments,
    setAllPayments,
    setRepaymentHistory,
    setDisbursement,
    setSchedule,
    setGuarantors,
    setReferees,
    setFines,
    setSubmittingPayment,
    setApprovalStep,
    setApproving,
    setLoading,
    loadLoanDetails,
    formatCurrency,
    formatDate,
    getStatusColor,
    getLoanStatusStyles,
    renderStatusBadge,
    handleDisburseLoan,
    getNextApprovalRole,
    handleInitiateApproval,
    handleConfirmApproval,
    handleRejectLoan,
    handleRecordPayment,
    // Navigation
    navigation,
    colors,
    styles,
  };
};

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  containerBackground: { backgroundColor: colors.background },
  scrollView: { flex: 1, padding: spacing.md },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: typography.fontSize.base },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  errorTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginTop: spacing.md, marginBottom: spacing.xs },
  errorSubtitle: { fontSize: typography.fontSize.sm, textAlign: 'center' },
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
  label: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.base, borderColor: colors.border, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  paginationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: '#f5f5f5', borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: spacing.sm },
  paginationArrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.sm },
  paginationArrowDisabled: { opacity: 0.5 },
  paginationInfo: { fontSize: typography.fontSize.sm, color: '#6b7280', fontWeight: typography.fontWeight.medium, minWidth: 60, textAlign: 'center' },
  actions: { marginBottom: spacing.xxxl },
});

export default useLoanDetails;
