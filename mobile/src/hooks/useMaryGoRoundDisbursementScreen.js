import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';
import { showInAppToast } from '../services/disbursementNotificationService';
import {
  initiateMerryGoRoundDisbursement,
  confirmMerryGoRoundDisbursement,
  getMerryGoRoundDisbursements,
} from '../services/api/chamaEndpoints';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../utils/theme';

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
    backgroundColor: colors.primary + '10',
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
  nameCell: {
    flex: 2,
  },
  amountCell: {
    flex: 1.5,
  },
  roundCell: {
    flex: 1,
  },
  dateCell: {
    flex: 1.5,
  },
  actionsCell: {
    flex: 1,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    fontSize: 12,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 7,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'capitalize',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const createHeaderStyles = (colors, spacing, typography, borderRadius) => ({
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    ...shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterContainer: {
    marginLeft: 'auto',
    position: 'relative',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    minWidth: 100,
    justifyContent: 'space-between',
  },
  filterButtonText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  dropdownContainer: {
    minWidth: 200,
    maxWidth: 250,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary,
  },
  dropdownItemIcon: {
    width: 20,
    textAlign: 'center',
  },
  dropdownItemText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    marginRight: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
});

const useMaryGoRoundDisbursementScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  const [maryGoRoundCycles, setMaryGoRoundCycles] = useState([]);
  const [allMaryGoRoundCycles, setAllMaryGoRoundCycles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [userRole, setUserRole] = useState('member');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 15;

  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [showBulkDisburseModal, setShowBulkDisburseModal] = useState(false);
  const [disburseForm, setDisburseForm] = useState({
    description: '',
  });
  const [initiating, setInitiating] = useState(false);
  const [bulkDisburseData, setBulkDisburseData] = useState({
    selectedCycles: [],
    description: '',
  });

  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);

  const filters = [
    { id: 'all', name: 'All rounds', icon: 'list' },
    { id: 'ready', name: 'Ready to disburse', icon: 'cash-outline' },
    { id: 'awaiting_confirmation', name: 'Awaiting chairperson', icon: 'hourglass-outline' },
    { id: 'collecting', name: 'Collecting', icon: 'time-outline' },
    { id: 'disbursed', name: 'Disbursed', icon: 'checkmark-circle' },
  ];

  useEffect(() => {
    if (currentChamaId) {
      loadInitialData();
    }
  }, [currentChamaId]);

  // Derive the visible page from the full record set whenever the filter,
  // search or page changes.
  useEffect(() => {
    const filtered = filterMaryGoRoundCyclesData(allMaryGoRoundCycles, searchQuery, selectedFilter);
    const start = (currentPage - 1) * pageSize;
    setMaryGoRoundCycles(filtered.slice(start, start + pageSize));
    setTotalItems(filtered.length);
    setTotalPages(Math.max(1, Math.ceil(filtered.length / pageSize)));
  }, [allMaryGoRoundCycles, selectedFilter, searchQuery, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, searchQuery]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadUserRole();
      if (userRole === 'left') {
        Alert.alert(
          'Access Denied',
          'You are no longer a member of this chama. You cannot access merry-go-round disbursement features.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      await loadMaryGoRoundCycles();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRole = async () => {
    try {
      const response = await ApiService.getMemberRole(currentChamaId, user.id);
      if (response.success) {
        setUserRole(response.data?.role || 'member');
      } else {
        setUserRole('left');
      }
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole('left');
    }
  };

  // Map a server record (one round of one merry-go-round) to a table row.
  const STATE_TO_STATUS = {
    ready: 'ready',
    awaiting_confirmation: 'awaiting_confirmation',
    processing: 'processing',
    disbursed: 'disbursed',
    failed: 'failed',
    collecting: 'collecting',
    upcoming: 'upcoming',
  };

  const mapRecord = (r) => ({
    id: r.merryGoRoundId,
    key: `${r.merryGoRoundId}-${r.roundNumber}`,
    merryGoRoundId: r.merryGoRoundId,
    name: r.merryGoRoundName,
    roundNumber: r.roundNumber,
    current_position: r.roundNumber,
    recipientId: r.recipientId,
    recipientName: r.recipientName,
    recipient: { id: r.recipientId, name: r.recipientName },
    amount: r.disbursedAmount || r.collected || 0,
    amount_per_round: r.disbursedAmount || r.collected || 0,
    expectedAmount: r.expectedAmount,
    collected: r.collected,
    state: r.state,
    status: STATE_TO_STATUS[r.state] || r.state,
    disbursedAt: r.disbursedAt,
    next_payout_date: r.disbursedAt,
    mpesaCode: r.mpesaCode,
    transactionStatus: r.transactionStatus,
    isCurrentRound: r.isCurrentRound,
    pendingDisbursement:
      r.state === 'awaiting_confirmation'
        ? {
            amount: r.collected,
            recipientName: r.recipientName,
            roundNumber: r.roundNumber,
            expiresAt: r.otpExpiresAt,
          }
        : null,
  });

  const loadMaryGoRoundCycles = async () => {
    try {
      setLoading(true);
      const response = await getMerryGoRoundDisbursements(currentChamaId);
      if (response.success) {
        const rows = (response.data || []).map(mapRecord);
        setAllMaryGoRoundCycles(rows);
        setSummary(response.summary || null);
      } else {
        console.error('Failed to load merry-go-round disbursements:', response.error);
        setAllMaryGoRoundCycles([]);
      }
    } catch (error) {
      console.error('Error loading merry-go-round disbursements:', error);
      setAllMaryGoRoundCycles([]);
    } finally {
      setLoading(false);
    }
  };

  const filterMaryGoRoundCyclesData = (rows, search, filter) => {
    let filtered = rows || [];

    if (filter && filter !== 'all') {
      filtered = filtered.filter((row) => {
        if (filter === 'disbursed') return row.state === 'disbursed' || row.state === 'processing';
        return row.state === filter;
      });
    }

    const q = (search || '').trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((row) =>
        row.recipientName?.toLowerCase().includes(q) ||
        row.name?.toLowerCase().includes(q) ||
        String(row.roundNumber).includes(q) ||
        row.mpesaCode?.toLowerCase().includes(q)
      );
    }

    return filtered;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMaryGoRoundCycles();
    setRefreshing(false);
  }, [currentChamaId]);

  const STATE_META = {
    ready: { label: 'Ready to disburse', color: colors.success },
    awaiting_confirmation: { label: 'Awaiting chairperson', color: colors.warning },
    processing: { label: 'Sending…', color: colors.info },
    disbursed: { label: 'Disbursed', color: colors.primary },
    failed: { label: 'Failed', color: colors.error },
    collecting: { label: 'Collecting contributions', color: colors.textSecondary },
    upcoming: { label: 'Upcoming', color: colors.textSecondary },
  };

  const getStatusColor = (item) => (STATE_META[item.state] || STATE_META.upcoming).color;
  const getStatusText = (item) => (STATE_META[item.state] || STATE_META.upcoming).label;

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

  // Treasurer opens the "initiate" modal. The amount is decided by the server
  // (whatever has been collected for the round so far) — it is not entered here.
  const handleDisburse = (cycle) => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot disburse merry-go-round funds.');
      return;
    }
    if (!canDisburseMaryGoRound()) {
      Alert.alert('Access Denied', 'Only the treasurer can initiate a merry-go-round disbursement.');
      return;
    }
    setSelectedCycle(cycle);
    setDisburseForm({ description: '' });
    setShowDisburseModal(true);
  };

  const handleBulkDisburse = () => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot disburse merry-go-round funds.');
      return;
    }
    if (!canDisburseMaryGoRound()) {
      Alert.alert('Access Denied', 'You do not have permission to disburse merry go round funds.');
      return;
    }
    const readyCycles = maryGoRoundCycles.filter(cycle =>
      cycle.status?.toLowerCase().includes('ready')
    );
    if (readyCycles.length === 0) {
      Alert.alert('No Cycles Available', 'No merry go round cycles ready for disbursement.');
      return;
    }
    setBulkDisburseData({
      selectedCycles: readyCycles,
      description: `Bulk merry go round disbursement for ${readyCycles.length} cycles`,
    });
    setShowBulkDisburseModal(true);
  };

  // Step 1 — treasurer initiates. The server computes the amount collected for
  // the round and e-mails a confirmation code to the chairperson.
  const submitDisbursement = async () => {
    if (!selectedCycle || initiating) return;
    setInitiating(true);
    try {
      const response = await initiateMerryGoRoundDisbursement(currentChamaId, selectedCycle.id, {
        recipientId: selectedCycle.recipientId || selectedCycle.recipient?.id || '',
        description: disburseForm.description || '',
      });

      if (response.success) {
        const d = response.data || {};
        setShowDisburseModal(false);
        Alert.alert(
          'Sent for approval',
          `KES ${Number(d.amount || 0).toLocaleString()} (collected for round ${d.roundNumber ?? ''}) is ready for ${d.recipientName || 'the recipient'}.\n\n` +
          `A confirmation code has been e-mailed to the chairperson${d.approver?.email ? ` (${d.approver.email})` : ''}. ` +
          `The payout is sent to the recipient's M-Pesa as soon as the chairperson confirms.`
        );
        await loadMaryGoRoundCycles();
      } else {
        Alert.alert('Cannot initiate', response.error || 'Failed to initiate disbursement.');
      }
    } catch (error) {
      console.error('MGR initiate error:', error);
      Alert.alert('Error', 'Failed to initiate disbursement. Please try again.');
    } finally {
      setInitiating(false);
    }
  };

  const submitBulkDisbursement = async () => {
    try {
      const bulkData = {
        disbursements: bulkDisburseData.selectedCycles.map(cycle => ({
          cycleId: cycle.id,
          recipientId: cycle.recipientId || cycle.recipient?.id,
          recipientName: cycle.recipientName || cycle.recipient?.name || 'Unknown',
          cycleNumber: cycle.cycleNumber || cycle.currentRound || 1,
          amount: cycle.amount || cycle.totalAmount,
        })),
        description: bulkDisburseData.description,
        disbursedBy: userRole,
        disbursedById: user.id,
        timestamp: new Date().toISOString(),
      };

      const response = await ApiService.disburseMerryGoRoundCyclesBulk(currentChamaId, bulkData);

      if (response.success) {
        Alert.alert('Success', `Bulk disbursement completed for ${bulkDisburseData.selectedCycles.length} cycles - funds sent to recipients MPesa.`);
        setShowBulkDisburseModal(false);
        await loadMaryGoRoundCycles();
      } else {
        Alert.alert('Error', response.error || 'Failed to process bulk disbursement.');
      }
    } catch (error) {
      console.error('Bulk disbursement error:', error);
      Alert.alert('Error', 'Failed to process bulk disbursement.');
    }
  };

  // Only the treasurer initiates a payout.
  const canDisburseMaryGoRound = () => {
    if (userRole === 'left') return false;
    return userRole.toLowerCase() === 'treasurer';
  };

  // Only the chairperson confirms (with the e-mailed code).
  const canApproveMaryGoRound = () => {
    if (userRole === 'left') return false;
    return userRole.toLowerCase() === 'chairperson';
  };

  const handleInitiateApprove = (cycle) => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot approve disbursements.');
      return;
    }
    if (!canApproveMaryGoRound()) {
      Alert.alert('Access Denied', 'Only the chairperson can confirm merry-go-round disbursements.');
      return;
    }
    if (cycle.status?.toLowerCase() === 'disbursed' || cycle.status?.toLowerCase() === 'completed') {
      Alert.alert('Info', 'This disbursement has already been processed.');
      return;
    }
    setSelectedApprovalItem(cycle);
    setApprovalActionType('approve');
    setShowOTPModal(true);
  };

  // Step 2 — chairperson confirms with the code from their e-mail. On success
  // the B2C payout to the recipient's M-Pesa fires immediately.
  const handleVerifyOTP = async (code) => {
    if (!selectedApprovalItem) return;
    setOtpLoading(true);
    try {
      const response = await confirmMerryGoRoundDisbursement(
        currentChamaId,
        selectedApprovalItem.id,
        (code || '').trim(),
      );

      if (response.success) {
        const d = response.data || {};
        setShowOTPModal(false);
        setSelectedApprovalItem(null);
        setApprovalActionType(null);
        Alert.alert(
          'Disbursement confirmed',
          `KES ${Number(d.amount || 0).toLocaleString()} is being sent to ${d.recipientName || 'the recipient'}'s M-Pesa now. ` +
          `The M-Pesa transaction code will be recorded against this payout once Safaricom confirms it.`
        );
        await loadMaryGoRoundCycles();
      } else {
        Alert.alert('Could not confirm', response.error || 'Failed to confirm the disbursement.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm the disbursement. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  // There is no resend: the code is issued by the treasurer's "initiate" step.
  // If it expired, the treasurer must initiate the payout again.
  const handleResendOTP = async () => {
    try {
      showInAppToast({
        title: 'Ask the treasurer',
        message: 'The confirmation code is issued when the treasurer initiates the payout. If it expired, ask the treasurer to initiate it again.',
        type: 'info',
      });
    } catch (error) {
      showInAppToast({
        title: 'Resend Failed',
        message: 'Could not resend OTP. Please try again.',
        type: 'error',
      });
    }
  };

  return {
    colors,
    maryGoRoundCycles,
    summary,
    loading,
    refreshing,
    selectedFilter,
    searchQuery,
    showFilterDropdown,
    userRole,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    showDisburseModal,
    selectedCycle,
    showBulkDisburseModal,
    disburseForm,
    initiating,
    bulkDisburseData,
    showOTPModal,
    otpLoading,
    selectedApprovalItem,
    approvalActionType,
    filters,
    tableStyles,
    headerStyles,
    currentChamaId,
    setSelectedFilter,
    setSearchQuery,
    setShowFilterDropdown,
    setShowDisburseModal,
    setShowBulkDisburseModal,
    setDisburseForm,
    setBulkDisburseData,
    setShowOTPModal,
    setSelectedApprovalItem,
    setApprovalActionType,
    loadMaryGoRoundCycles,
    onRefresh,
    handleDisburse,
    handleBulkDisburse,
    submitDisbursement,
    submitBulkDisbursement,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    canDisburseMaryGoRound,
    canApproveMaryGoRound,
    getStatusColor,
    getStatusText,
    formatCurrency,
    formatDate,
  };
};

export default useMaryGoRoundDisbursementScreen;
