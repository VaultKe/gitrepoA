import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import ApiService from '../services/api';
import { sendApprovalNotification, showInAppToast } from '../services/disbursementNotificationService';
import { approveWelfareDisbursement } from '../services/api/welfareEndpoints';

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
  dateCell: {
    flex: 1.5,
  },
  statusCell: {
    flex: 1.2,
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

const useSavingsWithdrawalScreen = (navigation) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  const [savingsAccounts, setSavingsAccounts] = useState([]);
  const [allSavingsAccounts, setAllSavingsAccounts] = useState([]);
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

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showBulkWithdrawModal, setShowBulkWithdrawModal] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    reason: '',
    privateNote: '',
  });
  const [bulkWithdrawData, setBulkWithdrawData] = useState({
    selectedAccounts: [],
    reason: '',
  });

  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);

  const filters = [
    { id: 'all', name: 'All Accounts', icon: 'list' },
    { id: 'eligible', name: 'Eligible', icon: 'checkmark-circle' },
    { id: 'pending', name: 'Pending', icon: 'time' },
    { id: 'locked', name: 'Locked', icon: 'lock-closed' },
  ];

  useEffect(() => {
    if (currentChamaId) {
      loadInitialData();
    }
  }, [currentChamaId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filteredData = filterSavingsAccountsData(allSavingsAccounts, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setSavingsAccounts(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
    } else {
      loadSavingsAccounts(currentPage);
    }
  }, [currentPage, selectedFilter]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filteredData = filterSavingsAccountsData(allSavingsAccounts, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setSavingsAccounts(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
      setCurrentPage(1);
    } else {
      loadSavingsAccounts(1);
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
          'You are no longer a member of this chama. You cannot access savings withdrawal features.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      await loadSavingsAccounts();
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

  const loadSavingsAccounts = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const response = await ApiService.getEligibleSavingsMembers(currentChamaId);

      if (response.success) {
        const accountsData = response.data || [];
        setSavingsAccounts(accountsData);
        setAllSavingsAccounts(accountsData);
        setTotalItems(accountsData.length);
        setTotalPages(Math.ceil(accountsData.length / pageSize));
      } else {
        console.error('Failed to load savings accounts:', response.error);
        setSavingsAccounts([]);
        setAllSavingsAccounts([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error loading savings accounts:', error);
      setSavingsAccounts([]);
      setAllSavingsAccounts([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const filterSavingsAccountsData = (accountsData, search, filter) => {
    let filtered = accountsData;

    if (filter !== 'all') {
      filtered = filtered.filter(account =>
        account.status?.toLowerCase() === filter.toLowerCase()
      );
    }

    if (search.trim()) {
      filtered = filtered.filter(account =>
        account.memberName?.toLowerCase().includes(search.toLowerCase()) ||
        account.id?.toString().includes(search) ||
        account.balance?.toString().includes(search)
      );
    }

    return filtered;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSavingsAccounts();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'eligible': return colors.success;
      case 'pending': return colors.warning;
      case 'locked': return colors.error;
      default: return colors.textSecondary;
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

  const handleWithdraw = (account) => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot process savings withdrawals.');
      return;
    }
    if (!canWithdrawSavings()) {
      Alert.alert('Access Denied', 'You do not have permission to process savings withdrawals.');
      return;
    }
    setSelectedAccount(account);
    setWithdrawForm({
      amount: '',
      reason: `Savings withdrawal for ${account.memberName}`,
      privateNote: '',
    });
    setShowWithdrawModal(true);
  };

  const handleBulkWithdraw = () => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot process savings withdrawals.');
      return;
    }
    if (!canWithdrawSavings()) {
      Alert.alert('Access Denied', 'You do not have permission to process savings withdrawals.');
      return;
    }
    const eligibleAccounts = savingsAccounts.filter(account => account.status === 'eligible');
    if (eligibleAccounts.length === 0) {
      Alert.alert('No Accounts Available', 'No eligible savings accounts available for withdrawal.');
      return;
    }
    setBulkWithdrawData({
      selectedAccounts: eligibleAccounts,
      reason: `Bulk savings withdrawal for ${eligibleAccounts.length} members`,
    });
    setShowBulkWithdrawModal(true);
  };

  const submitWithdrawal = async () => {
    if (!selectedAccount) return;

    const withdrawAmount = parseFloat(withdrawForm.amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid withdrawal amount.');
      return;
    }

    if (withdrawAmount > selectedAccount.balance) {
      Alert.alert('Validation Error', 'Withdrawal amount cannot exceed available balance.');
      return;
    }

    try {
      const withdrawalData = {
        accountId: selectedAccount.id,
        memberId: selectedAccount.memberId,
        memberName: selectedAccount.memberName,
        amount: withdrawAmount,
        reason: withdrawForm.reason,
        privateNote: withdrawForm.privateNote,
        processedBy: userRole,
        processedById: user.id,
        timestamp: new Date().toISOString(),
      };

      const response = await ApiService.processSavingsWithdrawal(currentChamaId, withdrawalData);

      if (response.success) {
        Alert.alert('Success', 'Savings withdrawal processed successfully.');
        setShowWithdrawModal(false);
        await loadSavingsAccounts();
      } else {
        Alert.alert('Error', response.error || 'Failed to process savings withdrawal.');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      Alert.alert('Error', 'Failed to process withdrawal. Please try again.');
    }
  };

  const submitBulkWithdrawal = async () => {
    try {
      const bulkData = {
        withdrawals: bulkWithdrawData.selectedAccounts.map(account => ({
          accountId: account.id,
          memberId: account.memberId,
          memberName: account.memberName,
          amount: account.balance,
        })),
        reason: bulkWithdrawData.reason,
        processedBy: userRole,
        processedById: user.id,
        timestamp: new Date().toISOString(),
      };

      const response = await ApiService.processBulkSavingsWithdrawal(currentChamaId, bulkData);

      if (response.success) {
        Alert.alert('Success', `Bulk withdrawal completed for ${bulkWithdrawData.selectedAccounts.length} accounts.`);
        setShowBulkWithdrawModal(false);
        await loadSavingsAccounts();
      } else {
        Alert.alert('Error', response.error || 'Failed to process bulk withdrawal.');
      }
    } catch (error) {
      console.error('Bulk withdrawal error:', error);
      Alert.alert('Error', 'Failed to process bulk withdrawal. Please try again.');
    }
  };

  const canWithdrawSavings = () => {
    if (userRole === 'left') return false;
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const canApproveSavings = () => {
    if (userRole === 'left') return false;
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const handleInitiateApprove = (account) => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot approve savings withdrawals.');
      return;
    }
    if (!canApproveSavings()) {
      Alert.alert('Access Denied', 'You do not have permission to approve savings withdrawals.');
      return;
    }
    if (account.status === 'locked') {
      Alert.alert('Info', 'This account is locked and cannot be processed.');
      return;
    }
    setSelectedApprovalItem(account);
    setApprovalActionType('approve');
    setShowOTPModal(true);
  };

  const handleVerifyOTP = async (code) => {
    if (!selectedApprovalItem) return;
    setOtpLoading(true);
    try {
      const approvalData = {
        action: approvalActionType,
        otpCode: code,
        approvedBy: userRole,
        approvedById: user.id,
        approvedByName: user?.fullName || user?.firstName || user?.email || 'Unknown',
        timestamp: new Date().toISOString(),
        chamaId: currentChamaId,
        disbursementType: 'savings-withdrawal',
        itemLabel: selectedApprovalItem.memberName || selectedApprovalItem.member_name || `Account #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.balance,
      };

      const response = await approveWelfareDisbursement(currentChamaId, selectedApprovalItem.id, approvalData);

      if (response.success) {
        showInAppToast({
          title: 'Success',
          message: `Savings withdrawal ${approvalActionType}d successfully.`,
          type: 'success',
        });

        await sendApprovalNotification({
          chamaId: currentChamaId,
          recipientUserId: selectedApprovalItem.memberId || selectedApprovalItem.id,
          recipientName: selectedApprovalItem.memberName || selectedApprovalItem.member_name || 'Member',
          recipientPhone: selectedApprovalItem.memberPhone || selectedApprovalItem.phone_number,
          recipientEmail: selectedApprovalItem.memberEmail || selectedApprovalItem.email,
          disbursementType: 'savings-withdrawal',
          disbursementId: selectedApprovalItem.id,
          entityLabel: selectedApprovalItem.memberName || selectedApprovalItem.member_name || `Account #${selectedApprovalItem.id}`,
          amount: selectedApprovalItem.balance,
          action: approvalActionType,
          initiatedBy: userRole,
          chamaName: '',
        });

        setShowOTPModal(false);
        setSelectedApprovalItem(null);
        setApprovalActionType(null);
        await loadSavingsAccounts();
      } else {
        Alert.alert('Error', response.error || 'Failed to process approval.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!selectedApprovalItem) return;
    try {
      await sendApprovalNotification({
        chamaId: currentChamaId,
        recipientUserId: user.id,
        recipientName: user?.fullName || user?.firstName || 'You',
        recipientPhone: user?.phone || user?.phone_number,
        recipientEmail: user?.email,
        disbursementType: 'savings-withdrawal',
        disbursementId: selectedApprovalItem.id,
        entityLabel: selectedApprovalItem.memberName || selectedApprovalItem.member_name || `Account #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.balance,
        action: 'otp_resend',
        initiatedBy: userRole,
        chamaName: '',
      });
      showInAppToast({
        title: 'OTP Resent',
        message: 'A new OTP has been sent to your phone.',
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
    tableStyles,
    headerStyles,
    savingsAccounts,
    setSavingsAccounts,
    allSavingsAccounts,
    setAllSavingsAccounts,
    loading,
    setLoading,
    refreshing,
    setRefreshing,
    selectedFilter,
    setSelectedFilter,
    searchQuery,
    setSearchQuery,
    showFilterDropdown,
    setShowFilterDropdown,
    userRole,
    setUserRole,
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
    totalItems,
    setTotalItems,
    pageSize,
    showWithdrawModal,
    setShowWithdrawModal,
    selectedAccount,
    setSelectedAccount,
    showBulkWithdrawModal,
    setShowBulkWithdrawModal,
    withdrawForm,
    setWithdrawForm,
    bulkWithdrawData,
    setBulkWithdrawData,
    showOTPModal,
    setShowOTPModal,
    otpLoading,
    setOtpLoading,
    selectedApprovalItem,
    setSelectedApprovalItem,
    approvalActionType,
    setApprovalActionType,
    filters,
    loadInitialData,
    loadUserRole,
    loadSavingsAccounts,
    filterSavingsAccountsData,
    onRefresh,
    getStatusColor,
    formatCurrency,
    formatDate,
    handleWithdraw,
    handleBulkWithdraw,
    submitWithdrawal,
    submitBulkWithdrawal,
    canWithdrawSavings,
    canApproveSavings,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
  };
};

export default useSavingsWithdrawalScreen;
