import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';
import { showInAppToast } from '../services/disbursementNotificationService';
import {
  initiateMerryGoRoundDisbursement,
  confirmMerryGoRoundDisbursement,
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
    { id: 'all', name: 'All Cycles', icon: 'list' },
    { id: 'pending', name: 'Pending', icon: 'time' },
    { id: 'ready', name: 'Ready for Disbursement', icon: 'checkmark-circle' },
    { id: 'disbursed', name: 'Disbursed', icon: 'cash' },
    { id: 'completed', name: 'Completed', icon: 'trophy' },
  ];

  useEffect(() => {
    if (currentChamaId) {
      loadInitialData();
    }
  }, [currentChamaId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filteredData = filterMaryGoRoundCyclesData(allMaryGoRoundCycles, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setMaryGoRoundCycles(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
    } else {
      loadMaryGoRoundCycles(currentPage);
    }
  }, [currentPage, selectedFilter]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filteredData = filterMaryGoRoundCyclesData(allMaryGoRoundCycles, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setMaryGoRoundCycles(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
      setCurrentPage(1);
    } else {
      loadMaryGoRoundCycles(1);
      setCurrentPage(1);
    }
  }, [searchQuery]);

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

  const loadMaryGoRoundCycles = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;
      const response = await ApiService.getMerryGoRounds(currentChamaId, pageSize, offset);

      if (response.success) {
        let cyclesData = response.data || [];

        const enrichedCycles = await Promise.all(
          cyclesData.map(async (cycle) => {
            try {
              const participants = cycle.members || cycle.participants || [];
              const currentPosition = cycle.current_position || cycle.currentRound || 1;
              const currentRecipient = participants[currentPosition - 1];

              if (currentRecipient) {
                const userId = currentRecipient.user_id || currentRecipient.user?.id || currentRecipient.id;
                if (userId) {
                  const userResponse = await ApiService.makeRequest(`/users/${userId}`);
                  if (userResponse.success && userResponse.data) {
                    const userData = userResponse.data;
                    const fullName = `${userData.firstName || userData.first_name || ''} ${userData.lastName || userData.last_name || ''}`.trim();
                    return {
                      ...cycle,
                      recipientId: userId,
                      recipientName: fullName,
                      recipient: {
                        id: userId,
                        first_name: userData.firstName || userData.first_name,
                        last_name: userData.lastName || userData.last_name,
                        name: fullName,
                        username: userData.username || userData.email
                      }
                    };
                  }
                }
              }

              return {
                ...cycle,
                recipientId: currentRecipient?.user_id || currentRecipient?.id,
                recipientName: currentRecipient?.name || 'Unknown Recipient',
                recipient: {
                  id: currentRecipient?.user_id || currentRecipient?.id,
                  name: currentRecipient?.name || 'Unknown Recipient',
                  first_name: 'Unknown',
                  last_name: 'Recipient',
                  username: 'unknown'
                }
              };
            } catch (error) {
              console.warn(`Failed to enrich cycle ${cycle.id}:`, error);
              return {
                ...cycle,
                recipientId: cycle.recipientId,
                recipientName: cycle.recipientName || 'Unknown Recipient',
              };
            }
          })
        );

        setMaryGoRoundCycles(enrichedCycles);

        if (search.trim()) {
          const allResponse = await ApiService.getMerryGoRounds(currentChamaId, 1000, 0);
          if (allResponse.success) {
            let allCyclesData = allResponse.data || [];
            const enrichedAllCycles = await Promise.all(
              allCyclesData.map(async (cycle) => {
                try {
                  const participants = cycle.members || cycle.participants || [];
                  const currentPosition = cycle.current_position || cycle.currentRound || 1;
                  const currentRecipient = participants[currentPosition - 1];

                  if (currentRecipient) {
                    const userId = currentRecipient.user_id || currentRecipient.user?.id || currentRecipient.id;
                    if (userId) {
                      const userResponse = await ApiService.makeRequest(`/users/${userId}`);
                      if (userResponse.success && userResponse.data) {
                        const userData = userResponse.data;
                        const fullName = `${userData.firstName || userData.first_name || ''} ${userData.lastName || userData.last_name || ''}`.trim();

                        return {
                          ...cycle,
                          recipientId: userId,
                          recipientName: fullName,
                          recipient: {
                            id: userId,
                            first_name: userData.firstName || userData.first_name,
                            last_name: userData.lastName || userData.last_name,
                            name: fullName,
                            username: userData.username || userData.email
                          }
                        };
                      }
                    }
                  }

                  return {
                    ...cycle,
                    recipientId: currentRecipient?.user_id || currentRecipient?.id,
                    recipientName: currentRecipient?.name || 'Unknown Recipient',
                  };
                } catch (error) {
                  return {
                    ...cycle,
                    recipientId: cycle.recipientId,
                    recipientName: cycle.recipientName || 'Unknown Recipient',
                  };
                }
              })
            );

            setAllMaryGoRoundCycles(enrichedAllCycles);
            const filteredData = filterMaryGoRoundCyclesData(enrichedAllCycles, search, selectedFilter);
            setTotalItems(filteredData.length);
            setTotalPages(Math.ceil(filteredData.length / pageSize));
          }
        } else {
          setAllMaryGoRoundCycles(enrichedCycles);
          setTotalItems(response.totalCount || response.data?.length || enrichedCycles.length);
          setTotalPages(Math.ceil((response.totalCount || enrichedCycles.length) / pageSize));
        }
      } else {
        console.error('Failed to load merry go round cycles:', response.error);
        setMaryGoRoundCycles([]);
        setAllMaryGoRoundCycles([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error loading merry go round cycles:', error);
      setMaryGoRoundCycles([]);
      setAllMaryGoRoundCycles([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const filterMaryGoRoundCyclesData = (cyclesData, search, filter) => {
    let filtered = cyclesData;

    if (filter !== 'all') {
      filtered = filtered.filter(cycle =>
        cycle.status?.toLowerCase().replace(' ', '_') === filter.toLowerCase()
      );
    }

    if (search.trim()) {
      filtered = filtered.filter(cycle =>
        cycle.recipientName?.toLowerCase().includes(search.toLowerCase()) ||
        cycle.name?.toLowerCase().includes(search.toLowerCase()) ||
        cycle.cycleNumber?.toString().includes(search) ||
        cycle.amount?.toString().includes(search)
      );
    }

    return filtered;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMaryGoRoundCycles();
    setRefreshing(false);
  }, []);

  const getStatusColor = (item) => {
    const participants = item.members || item.participants || [];
    const totalParticipants = participants.length || item.total_participants || 0;
    const currentPosition = item.current_position || item.currentRound || 1;
    const roundComplete = item.roundComplete || false;

    if (roundComplete || currentPosition > totalParticipants) {
      return colors.primary;
    } else if (currentPosition >= 1) {
      return colors.success;
    }
    return colors.textSecondary;
  };

  const getStatusText = (item) => {
    const participants = item.members || item.participants || [];
    const totalParticipants = participants.length || item.total_participants || 0;
    const currentPosition = item.current_position || item.currentRound || 1;
    const roundComplete = item.roundComplete || false;

    if (roundComplete || currentPosition > totalParticipants) {
      return 'Completed';
    } else if (currentPosition >= 1) {
      return 'Ready for Disbursement';
    }
    return 'Pending';
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
