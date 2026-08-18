import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import ApiService from '../services/api';

const useLoanManagementScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);

  const [loans, setLoans] = useState([]);
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
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loanSubview, setLoanSubview] = useState('loans');
  const [loanTypes, setLoanTypes] = useState([]);
  const [loanTypesLoading, setLoanTypesLoading] = useState(false);
  const [editingLoanType, setEditingLoanType] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    exactAmount: '',
    interestRate: '',
    termMonths: '',
    eligibilityCriteria: 'active_members',
    approvalRequired: true,
    gracePeriodDays: '0',
    penaltyRate: '0',
    maxLoansPerMember: '1',
    requiresCollateral: false,
    collateralDescription: '',
    netDisbursement: '',
    currentLoans: '0',
    defaultThresholdDays: '30',
    installmentPenaltyType: 'fixed',
    installmentPenaltyAmount: '',
    loanPenaltyAmount: '',
    status: 'active',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const filters = [
    { id: 'all', name: 'All Loans', icon: 'list' },
    { id: 'delinquent', name: 'Delinquent', icon: 'warning' },
    { id: 'partial', name: 'Partial Payment', icon: 'time' },
    { id: 'recovery_active', name: 'Recovery Active', icon: 'refresh-circle' },
    { id: 'disbursement', name: 'Disbursement', icon: 'send' },
    { id: 'disbursed', name: 'Disbursed', icon: 'checkmark-circle' },
    { id: 'collections', name: 'Collections', icon: 'cash' },
  ];

  useEffect(() => {
    if (currentChamaId) {
      loadInitialData();
    }
  }, [currentChamaId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filteredData = filterLoansData(loans, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setLoans(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
    } else {
      loadLoans(currentPage);
    }
  }, [currentPage, selectedFilter]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filteredData = filterLoansData(loans, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setLoans(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
      setCurrentPage(1);
    } else {
      loadLoans(1);
      setCurrentPage(1);
    }
  }, [searchQuery]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserRole(),
        loadLoans(),
      ]);
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
      const isNoisyRoleError = /Invalid JSON response|Empty response/.test(error?.message || '');
      if (!isNoisyRoleError) {
        console.error('Error loading user role:', error);
      }
      setUserRole('left');
    }
  };

  const loadLoans = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;
      const response = await ApiService.getLoans(currentChamaId, pageSize, offset);
      if (response.success) {
        const loansData = response.data || [];
        setLoans(loansData);
        if (search.trim()) {
          const allResponse = await ApiService.getLoans(currentChamaId, 1000, 0);
          if (allResponse.success) {
            const filteredData = filterLoansData(allResponse.data || [], search, selectedFilter);
            setTotalItems(filteredData.length);
            setTotalPages(Math.ceil(filteredData.length / pageSize));
          }
        } else {
          setTotalItems(response.totalCount || loansData.length);
          setTotalPages(Math.ceil((response.totalCount || loansData.length) / pageSize));
        }
      } else {
        setLoans([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      const isNoisyLoanError = /Invalid JSON response|Empty response|Server returned HTML/.test(error?.message || '');
      if (!isNoisyLoanError) {
        console.error('Error loading loans:', error);
      }
      setLoans([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const canManageLoanTypes = () => {
    return ['chairperson', 'secretary', 'treasurer'].includes(userRole.toLowerCase());
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      description: '',
      exactAmount: '',
      interestRate: '',
      termMonths: '',
      eligibilityCriteria: 'active_members',
      approvalRequired: true,
      gracePeriodDays: '0',
      penaltyRate: '0',
      maxLoansPerMember: '1',
      requiresCollateral: false,
      collateralDescription: '',
      netDisbursement: '',
      currentLoans: '0',
      defaultThresholdDays: '30',
      installmentPenaltyType: 'fixed',
      installmentPenaltyAmount: '',
      loanPenaltyAmount: '',
      status: 'active',
    });
    setEditingLoanType(null);
  };

  const handleEditLoanType = (loanType) => {
    if (!canManageLoanTypes()) {
      Alert.alert('Access Denied', 'You do not have permission to edit loan types.');
      return;
    }
    setEditingLoanType(loanType);
    setCreateForm({
      name: loanType.name || '',
      description: loanType.description || '',
      exactAmount: loanType.exactAmount?.toString() || '',
      interestRate: loanType.interestRate?.toString() || '',
      termMonths: loanType.termMonths?.toString() || '',
      eligibilityCriteria: loanType.eligibilityCriteria || 'active_members',
      approvalRequired: loanType.approvalRequired ?? true,
      gracePeriodDays: loanType.gracePeriodDays?.toString() || '0',
      penaltyRate: loanType.penaltyRate?.toString() || '0',
      maxLoansPerMember: loanType.maxLoansPerMember?.toString() || '1',
      requiresCollateral: loanType.requiresCollateral ?? false,
      collateralDescription: loanType.collateralDescription || '',
      netDisbursement: loanType.netDisbursement?.toString() || '',
      currentLoans: loanType.currentLoans?.toString() || '0',
      defaultThresholdDays: loanType.defaultThresholdDays?.toString() || '30',
      installmentPenaltyType: loanType.installmentPenaltyType || 'fixed',
      installmentPenaltyAmount: loanType.installmentPenaltyAmount?.toString() || '',
      loanPenaltyAmount: loanType.loanPenaltyAmount?.toString() || '',
      status: loanType.status || 'active',
    });
    setLoanSubview('create-loan-type');
  };

  const loadLoanTypes = async () => {
    try {
      setLoanTypesLoading(true);
      const response = await ApiService.getLoanTypes(currentChamaId);
      if (response.success) {
        setLoanTypes(response.data || []);
      } else {
        setLoanTypes([]);
      }
    } catch (error) {
      console.error('Failed to load loan types:', error);
      setLoanTypes([]);
    } finally {
      setLoanTypesLoading(false);
    }
  };

  const handleCreateLoanType = async () => {
    if (!canManageLoanTypes()) {
      Alert.alert('Access Denied', 'You do not have permission to manage loan types.');
      return;
    }
    if (!createForm.name || !createForm.exactAmount || !createForm.interestRate || !createForm.termMonths) {
      Alert.alert('Validation Error', 'Please fill in all required fields (name, loan amount, interest rate, term months).');
      return;
    }
    try {
      setCreateSubmitting(true);
      const payload = {
        ...createForm,
        exactAmount: parseFloat(createForm.exactAmount),
        interestRate: parseFloat(createForm.interestRate),
        termMonths: parseInt(createForm.termMonths, 10),
        gracePeriodDays: parseInt(createForm.gracePeriodDays, 10) || 0,
        penaltyRate: parseFloat(createForm.penaltyRate) || 0,
        maxLoansPerMember: parseInt(createForm.maxLoansPerMember, 10) || 1,
        netDisbursement: parseFloat(createForm.netDisbursement) || 0,
        currentLoans: parseInt(createForm.currentLoans, 10) || 0,
        defaultThresholdDays: parseInt(createForm.defaultThresholdDays, 10) || 30,
        installmentPenaltyAmount: parseFloat(createForm.installmentPenaltyAmount) || 0,
        loanPenaltyAmount: parseFloat(createForm.loanPenaltyAmount) || 0,
      };
      let response;
      if (editingLoanType) {
        response = await ApiService.updateLoanType(editingLoanType.id, payload);
        if (response.success) {
          Alert.alert('Success', 'Loan type updated successfully');
        }
      } else {
        response = await ApiService.createLoanType(currentChamaId, payload);
        if (response.success) {
          Alert.alert('Success', 'Loan type created successfully');
        }
      }
      if (response?.success) {
        resetCreateForm();
        await loadLoanTypes();
        setLoanSubview('loan-types');
      } else {
        Alert.alert('Error', response?.error || 'Failed to save loan type');
      }
    } catch (error) {
      console.error('Save loan type error:', error);
      Alert.alert('Error', 'Failed to save loan type. Please try again.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const filterLoansData = (loansData, search, filter) => {
    let filtered = loansData;
    if (filter !== 'all') {
      filtered = filtered.filter(loan =>
        loan.status?.toLowerCase().replace(' ', '_') === filter.toLowerCase()
      );
    }
    if (search.trim()) {
      filtered = filtered.filter(loan =>
        loan.memberName?.toLowerCase().includes(search.toLowerCase()) ||
        loan.id?.toString().includes(search) ||
        loan.amount?.toString().includes(search)
      );
    }
    return filtered;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLoans();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'delinquent': return colors.error;
      case 'partial': return colors.warning;
      case 'recovery active': return colors.info;
      case 'disbursement': return colors.primary;
      case 'disbursed': return colors.success;
      case 'collections': return colors.secondary;
      default: return colors.textSecondary;
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

  const handleAction = (loan, action) => {
    setSelectedLoan(loan);
    switch (action) {
      case 'view':
        navigation.navigate('LoanDetails', { loanId: loan.id, chamaId: currentChamaId });
        break;
      case 'disburse':
        if (canDisburseLoans()) {
          setShowActionModal(true);
        } else {
          Alert.alert('Access Denied', 'You do not have permission to disburse loans.');
        }
        break;
      case 'collect':
        if (canCollectPayments()) {
          setShowActionModal(true);
        } else {
          Alert.alert('Access Denied', 'You do not have permission to collect payments.');
        }
        break;
      case 'update_status':
        if (canUpdateStatus()) {
          setShowActionModal(true);
        } else {
          Alert.alert('Access Denied', 'You do not have permission to update loan status.');
        }
        break;
      default:
        break;
    }
  };

  const canDisburseLoans = () => {
    if (userRole === 'left') return false;
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const canCollectPayments = () => {
    if (userRole === 'left') return false;
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const canUpdateStatus = () => {
    if (userRole === 'left') return false;
    return ['treasurer', 'secretary', 'chairperson', 'auditor'].includes(userRole.toLowerCase());
  };

  return {
    // State
    loans,
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
    showActionModal,
    selectedLoan,
    loanSubview,
    loanTypes,
    loanTypesLoading,
    editingLoanType,
    createForm,
    createSubmitting,
    filters,
    // Handlers
    setLoans,
    setLoading,
    setRefreshing,
    setSelectedFilter,
    setSearchQuery,
    setShowFilterDropdown,
    setCurrentPage,
    setShowActionModal,
    setSelectedLoan,
    setLoanSubview,
    setLoanTypes,
    setLoanTypesLoading,
    setEditingLoanType,
    setCreateForm,
    setCreateSubmitting,
    onRefresh,
    loadInitialData,
    loadUserRole,
    loadLoans,
    canManageLoanTypes,
    resetCreateForm,
    handleEditLoanType,
    loadLoanTypes,
    handleCreateLoanType,
    filterLoansData,
    getStatusColor,
    formatCurrency,
    formatDate,
    handleAction,
    canDisburseLoans,
    canCollectPayments,
    canUpdateStatus,
    // Navigation
    navigation,
  };
};

export default useLoanManagementScreen;
