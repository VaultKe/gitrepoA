import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';
import { sendApprovalNotification, showInAppToast } from '../services/disbursementNotificationService';
import { approveWelfareDisbursement, getChamaDisbursementApprovals } from '../services/api/welfareEndpoints';
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
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  bulkButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
  },
});

const useWelfareDisbursementScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  const [welfareFunds, setWelfareFunds] = useState([]);
  const [allWelfareFunds, setAllWelfareFunds] = useState([]);
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
  const [selectedFund, setSelectedFund] = useState(null);
  const [showBulkDisburseModal, setShowBulkDisburseModal] = useState(false);
  const [disburseForm, setDisburseForm] = useState({
    amount: '',
    recipientId: '',
    recipientName: '',
    description: '',
    privateNote: '',
  });
  const [bulkDisburseData, setBulkDisburseData] = useState({
    selectedFunds: [],
    description: '',
  });

  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState(null);
  const [approvalActionType, setApprovalActionType] = useState(null);

  const filters = [
    { id: 'all', name: 'All Funds', icon: 'list' },
    { id: 'approved', name: 'Approved', icon: 'checkmark-circle' },
    { id: 'pending', name: 'Pending', icon: 'time' },
    { id: 'disbursed', name: 'Disbursed', icon: 'cash' },
    { id: 'cancelled', name: 'Cancelled', icon: 'close-circle' },
  ];

  useEffect(() => {
    if (currentChamaId) {
      loadInitialData();
    }
  }, [currentChamaId]);

  useEffect(() => {
    if (!allWelfareFunds.length) return;
    let filtered = allWelfareFunds;
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(fund =>
        fund.status?.toLowerCase() === selectedFilter.toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      filtered = filtered.filter(fund =>
        (fund.memberName || getRequesterDisplayName(fund)).toLowerCase().includes(searchQuery.toLowerCase()) ||
        fund.id?.toString().includes(searchQuery) ||
        fund.amount?.toString().includes(searchQuery) ||
        (fund.purpose?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    setWelfareFunds(filtered.slice(startIndex, endIndex));
    setTotalItems(filtered.length);
    setTotalPages(Math.ceil(filtered.length / pageSize));
  }, [allWelfareFunds, searchQuery, selectedFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilter]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadUserRole();
      if (userRole === 'left') {
        Alert.alert(
          'Access Denied',
          'You are no longer a member of this chama. You cannot access welfare disbursement features.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      await loadWelfareFundsAll();
    } catch (error) {
      Alert.alert('Error', 'Failed to load initial data. Please try again.');
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
      setUserRole('left');
    }
  };

  const enrichWelfareFund = async (fund) => {
    const requester = fund.requester;
    if (requester) {
      const fullName = requester.fullName ||
        `${requester.firstName || requester.first_name || ''} ${requester.lastName || requester.last_name || ''}`.trim();
      return {
        ...fund,
        requester_name: fullName || requester.email?.split('@')[0] || 'Unknown Requester',
        memberName: fullName || requester.email?.split('@')[0] || 'Unknown Requester',
      };
    }

    const name = fund.requesterFirstName || fund.requester_first_name;
    if (name) {
      const fullName = `${name} ${fund.requesterLastName || fund.requester_last_name || ''}`.trim();
      return {
        ...fund,
        requester_name: fullName,
        memberName: fullName,
      };
    }

    const existingName = fund.requester_name || fund.memberName;
    if (existingName && existingName !== 'Unknown Requester') {
      return { ...fund, requester_name: existingName, memberName: existingName };
    }

    const fallbackId = fund.id || fund.requester_id;
    const fallbackName = fallbackId ? `Member ${fallbackId}` : 'Unknown Requester';
    return {
      ...fund,
      requester_name: fallbackName,
      memberName: fallbackName,
    };
  };

  const loadWelfareFundsAll = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getWelfareRequests(currentChamaId, 1000, 0);
      if (response.success) {
        let fundsData = response.data || [];
        const enrichedFunds = await Promise.all(fundsData.map(enrichWelfareFund));
        setWelfareFunds(enrichedFunds);
        setAllWelfareFunds(enrichedFunds);
        setTotalItems(enrichedFunds.length);
        setTotalPages(Math.ceil(enrichedFunds.length / pageSize));
      } else {
        setWelfareFunds([]);
        setAllWelfareFunds([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      setWelfareFunds([]);
      setAllWelfareFunds([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const loadWelfareFunds = async (page = 1) => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;
      const response = await ApiService.getWelfareRequests(currentChamaId, pageSize, offset);
      if (response.success) {
        let fundsData = response.data || [];
        const enrichedFunds = await Promise.all(fundsData.map(enrichWelfareFund));
        setWelfareFunds(enrichedFunds);
        setAllWelfareFunds(enrichedFunds);
        setTotalItems(response.totalCount || enrichedFunds.length);
        setTotalPages(Math.ceil((response.totalCount || enrichedFunds.length) / pageSize));
      } else {
        setWelfareFunds([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      setWelfareFunds([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWelfareFundsAll();
    setRefreshing(false);
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return colors.success;
      case 'pending': return colors.warning;
      case 'disbursed': return colors.info;
      case 'cancelled': return colors.error;
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

  const getRequesterDisplayName = (request) => {
    if (!request) return 'Unknown';
    if (request.requester_name || request.memberName) {
      return request.requester_name || request.memberName;
    }
    if (request.requester) {
      const requester = request.requester;
      const fullName = requester.fullName ||
        `${requester.firstName || requester.first_name || ''} ${requester.lastName || requester.last_name || ''}`.trim();
      return fullName || requester.email?.split('@')[0] || 'Unknown Requester';
    }
    return request.id ? `Member ${request.id}` : 'Unknown';
  };

  const handleDisburse = (fund) => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot disburse welfare funds.');
      return;
    }
    if (!canDisburseWelfare()) {
      Alert.alert('Access Denied', 'You do not have permission to disburse welfare funds.');
      return;
    }
    const recipientId = fund.requester_id || fund.memberId || (fund.requester?.id) || fund.id;
    const recipientName = fund.requester_name || fund.memberName || fund.requester?.name || 'Unknown';
    setSelectedFund(fund);
    setDisburseForm({
      amount: fund.amount?.toString() || '',
      recipientId,
      recipientName,
      description: `Welfare disbursement to ${recipientName}`,
      privateNote: '',
    });
    setShowDisburseModal(true);
  };

  const handleBulkDisburse = () => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot disburse welfare funds.');
      return;
    }
    if (!canDisburseWelfare()) {
      Alert.alert('Access Denied', 'You do not have permission to disburse welfare funds.');
      return;
    }
    const approvedFunds = allWelfareFunds.filter(fund =>
      fund.status === 'approved' && fund.status !== 'disbursed' && fund.status !== 'cancelled'
    );
    if (approvedFunds.length === 0) {
      Alert.alert('No Funds Available', 'No approved welfare funds available for disbursement.');
      return;
    }
    setBulkDisburseData({
      selectedFunds: approvedFunds,
      description: `Bulk welfare disbursement to ${approvedFunds.length} members`,
    });
    setShowBulkDisburseModal(true);
  };

  const submitDisbursement = async () => {
    if (!selectedFund) return;
    try {
      const disbursementData = {
        type: 'welfare',
        fundId: selectedFund.id,
        recipientId: disburseForm.recipientId,
        recipientName: disburseForm.recipientName,
        amount: parseFloat(disburseForm.amount),
        description: disburseForm.description,
        privateNote: disburseForm.privateNote,
        initiatedBy: userRole,
        initiatedById: user.id,
        timestamp: new Date().toISOString(),
      };
      const response = await ApiService.disburseWelfareFund(currentChamaId, disbursementData);
      if (response.success) {
        Alert.alert('Success', 'Welfare fund disbursed successfully - funds sent to recipient MPesa.');
        setShowDisburseModal(false);
        const updatedAll = allWelfareFunds.map(f =>
          f.id === selectedFund.id ? { ...f, status: 'disbursed' } : f
        );
        setAllWelfareFunds(updatedAll);
        setWelfareFunds(updatedAll.slice(0, pageSize));
      } else {
        Alert.alert('Error', response.error || 'Failed to disburse welfare fund.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process disbursement. Please try again.');
    }
  };

  const submitBulkDisbursement = async () => {
    try {
      const bulkData = {
        funds: bulkDisburseData.selectedFunds.map(fund => ({
          fundId: fund.id,
          recipientId: fund.requester_id || fund.memberId || (fund.requester?.id) || fund.id,
          recipientName: fund.requester_name || fund.memberName || fund.requester?.name || 'Unknown',
          amount: fund.amount,
        })),
        description: bulkDisburseData.description,
        initiatedBy: userRole,
        initiatedById: user.id,
        timestamp: new Date().toISOString(),
      };
      const response = await ApiService.bulkDisburseWelfareFunds(currentChamaId, bulkData);
      if (response.success) {
        Alert.alert('Success', `Bulk disbursement completed for ${bulkDisburseData.selectedFunds.length} members - funds sent to recipients MPesa.`);
        setShowBulkDisburseModal(false);
        const disbursedIds = new Set(bulkDisburseData.selectedFunds.map(f => f.id));
        const updatedAll = allWelfareFunds.map(f =>
          disbursedIds.has(f.id) ? { ...f, status: 'disbursed' } : f
        );
        setAllWelfareFunds(updatedAll);
        setWelfareFunds(updatedAll.slice(0, pageSize));
      } else {
        Alert.alert('Error', response.error || 'Failed to process bulk disbursement.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process bulk disbursement.');
    }
  };

  const canDisburseWelfare = () => {
    if (userRole === 'left') return false;
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const canApproveWelfare = () => {
    if (userRole === 'left') return false;
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const handleInitiateApprove = (fund) => {
    if (userRole === 'left') {
      Alert.alert('Access Denied', 'You are no longer a member of this chama and cannot approve disbursements.');
      return;
    }
    if (!canApproveWelfare()) {
      Alert.alert('Access Denied', 'You do not have permission to approve welfare funds.');
      return;
    }
    if (fund.status === 'disbursed' || fund.status === 'cancelled') {
      Alert.alert('Info', 'This disbursement has already been processed.');
      return;
    }
    setSelectedApprovalItem(fund);
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
        disbursementType: 'welfare',
        itemLabel: selectedApprovalItem.memberName || selectedApprovalItem.requester_name || `Fund #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.amount,
      };

      const response = await approveWelfareDisbursement(currentChamaId, selectedApprovalItem.id, approvalData);

      if (response.success) {
        showInAppToast({
          title: 'Success',
          message: `Welfare fund ${approvalActionType}d successfully.`,
          type: 'success',
        });

        await sendApprovalNotification({
          chamaId: currentChamaId,
          recipientUserId: selectedApprovalItem.requester_id || selectedApprovalItem.memberId || selectedApprovalItem.id,
          recipientName: selectedApprovalItem.memberName || selectedApprovalItem.requester_name || 'Member',
          recipientPhone: selectedApprovalItem.memberPhone || selectedApprovalItem.phone_number,
          recipientEmail: selectedApprovalItem.memberEmail || selectedApprovalItem.email,
          disbursementType: 'welfare',
          disbursementId: selectedApprovalItem.id,
          entityLabel: selectedApprovalItem.memberName || selectedApprovalItem.requester_name || `Fund #${selectedApprovalItem.id}`,
          amount: selectedApprovalItem.amount,
          action: approvalActionType,
          initiatedBy: userRole,
          chamaName: '',
        });

        setShowOTPModal(false);
        setSelectedApprovalItem(null);
        setApprovalActionType(null);
        await loadWelfareFundsAll();
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
        disbursementType: 'welfare',
        disbursementId: selectedApprovalItem.id,
        entityLabel: selectedApprovalItem.memberName || selectedApprovalItem.requester_name || `Fund #${selectedApprovalItem.id}`,
        amount: selectedApprovalItem.amount,
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
    welfareFunds,
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
    selectedFund,
    showBulkDisburseModal,
    disburseForm,
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
    loadWelfareFundsAll,
    loadWelfareFunds,
    onRefresh,
    handleDisburse,
    handleBulkDisburse,
    submitDisbursement,
    submitBulkDisbursement,
    handleInitiateApprove,
    handleVerifyOTP,
    handleResendOTP,
    canDisburseWelfare,
    canApproveWelfare,
    getStatusColor,
    formatCurrency,
    formatDate,
    getRequesterDisplayName,
  };
};

export default useWelfareDisbursementScreen;
