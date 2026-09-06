import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';
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
  nameCell: {
    flex: 2,
  },
  amountCell: {
    flex: 1.5,
  },
  rateCell: {
    flex: 1,
  },
  termCell: {
    flex: 1,
  },
  actionsCell: {
    flex: 1,
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

const useLoanTypeCreationScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  const [loanTypes, setLoanTypes] = useState([]);
  const [allLoanTypes, setAllLoanTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [userRole, setUserRole] = useState('member');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLoanType, setSelectedLoanType] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    exactAmount: '',
    interestRate: '',
    termMonths: '',
    eligibilityCriteria: 'active_members',
    approvalRequired: true,
    gracePeriodDays: '',
    penaltyRate: '',
    maxLoansPerMember: '1',
    requiresCollateral: false,
    requiresGuarantors: false,
    requiresReferees: false,
    minGuarantors: 2,
    minReferees: 1,
    collateralDescription: '',
    netDisbursement: '',
    currentLoans: '0',
    defaultThresholdDays: '30',
    installmentPenaltyType: 'fixed',
    installmentPenaltyAmount: '',
    loanPenaltyAmount: '',
    status: 'active',
  });

  const filters = [
    { id: 'all', name: 'All Types', icon: 'list' },
    { id: 'active', name: 'Active', icon: 'checkmark-circle' },
    { id: 'inactive', name: 'Inactive', icon: 'close-circle' },
  ];

  useEffect(() => {
    if (currentChamaId) {
      loadInitialData();
    }
  }, [currentChamaId]);

  useEffect(() => {
    filterLoanTypes();
  }, [allLoanTypes, selectedFilter, searchQuery]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserRole(),
        loadLoanTypes(),
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
      }
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole('member');
    }
  };

  const loadLoanTypes = async () => {
    try {
      const response = await ApiService.getLoanTypes(currentChamaId, selectedFilter !== 'all' ? selectedFilter : '');
      if (response.success) {
        setAllLoanTypes(response.data || []);
      } else {
        setAllLoanTypes([]);
      }
    } catch (error) {
      console.error('Error loading loan types:', error);
      setAllLoanTypes([]);
    }
  };

  const filterLoanTypes = useCallback(() => {
    let filtered = allLoanTypes;

    if (selectedFilter !== 'all') {
      filtered = filtered.filter(type =>
        type.status?.toLowerCase() === selectedFilter.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(type =>
        type.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.exactAmount?.toString().includes(searchQuery)
      );
    }

    setLoanTypes(filtered);
  }, [allLoanTypes, selectedFilter, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLoanTypes();
    setRefreshing(false);
  }, []);

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

  const handleCreateLoanType = async () => {
    if (!canCreateLoanTypes()) {
      Alert.alert('Access Denied', 'You do not have permission to create loan types.');
      return;
    }

    if (!createForm.name || !createForm.exactAmount || !createForm.interestRate || !createForm.termMonths) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    try {
      const loanTypeData = {
        ...createForm,
        exactAmount: parseFloat(createForm.exactAmount),
        interestRate: parseFloat(createForm.interestRate),
        termMonths: parseInt(createForm.termMonths),
        gracePeriodDays: parseInt(createForm.gracePeriodDays) || 0,
        penaltyRate: parseFloat(createForm.penaltyRate) || 0,
        maxLoansPerMember: parseInt(createForm.maxLoansPerMember) || 1,
        requiresCollateral: createForm.requiresCollateral,
        requiresGuarantors: createForm.requiresGuarantors,
        requiresReferees: createForm.requiresReferees,
        minGuarantors: createForm.requiresGuarantors ? Math.max(1, parseInt(createForm.minGuarantors, 10) || 2) : 0,
        minReferees: createForm.requiresReferees ? Math.max(1, parseInt(createForm.minReferees, 10) || 1) : 0,
        netDisbursement: parseFloat(createForm.netDisbursement) || 0,
        currentLoans: parseInt(createForm.currentLoans) || 0,
        defaultThresholdDays: parseInt(createForm.defaultThresholdDays) || 30,
        installmentPenaltyAmount: parseFloat(createForm.installmentPenaltyAmount) || 0,
        loanPenaltyAmount: parseFloat(createForm.loanPenaltyAmount) || 0,
      };

      const response = await ApiService.createLoanType(currentChamaId, loanTypeData);
      if (response.success) {
        Alert.alert('Success', 'Loan type created successfully');
        setShowCreateModal(false);
        resetCreateForm();
        loadLoanTypes();
      } else {
        Alert.alert('Error', response.error || 'Failed to create loan type');
      }
    } catch (error) {
      console.error('Create loan type error:', error);
      Alert.alert('Error', 'Failed to create loan type. Please try again.');
    }
  };

  const handleEditLoanType = (loanType) => {
    if (!canCreateLoanTypes()) {
      Alert.alert('Access Denied', 'You do not have permission to edit loan types.');
      return;
    }
    setSelectedLoanType(loanType);
    setCreateForm({
      name: loanType.name || '',
      description: loanType.description || '',
      exactAmount: loanType.exactAmount?.toString() || '',
      interestRate: loanType.interestRate?.toString() || '',
      termMonths: loanType.termMonths?.toString() || '',
      eligibilityCriteria: loanType.eligibilityCriteria || 'active_members',
      approvalRequired: loanType.approvalRequired ?? true,
      gracePeriodDays: loanType.gracePeriodDays?.toString() || '',
      penaltyRate: loanType.penaltyRate?.toString() || '0',
      maxLoansPerMember: loanType.maxLoansPerMember?.toString() || '1',
      requiresCollateral: loanType.requiresCollateral ?? false,
      requiresGuarantors: loanType.requiresGuarantors ?? false,
      requiresReferees: loanType.requiresReferees ?? false,
      minGuarantors: Number(loanType.minGuarantors) || 2,
      minReferees: Number(loanType.minReferees) || 1,
      collateralDescription: loanType.collateralDescription || '',
      netDisbursement: loanType.netDisbursement?.toString() || '',
      currentLoans: loanType.currentLoans?.toString() || '0',
      defaultThresholdDays: loanType.defaultThresholdDays?.toString() || '30',
      installmentPenaltyType: loanType.installmentPenaltyType || 'fixed',
      installmentPenaltyAmount: loanType.installmentPenaltyAmount?.toString() || '',
      loanPenaltyAmount: loanType.loanPenaltyAmount?.toString() || '',
      status: loanType.status || 'active',
    });
    setShowEditModal(true);
  };

  const handleUpdateLoanType = async () => {
    if (!selectedLoanType) return;

    try {
      const updateData = {
        ...createForm,
        exactAmount: parseFloat(createForm.exactAmount),
        interestRate: parseFloat(createForm.interestRate),
        termMonths: parseInt(createForm.termMonths),
        gracePeriodDays: parseInt(createForm.gracePeriodDays) || 0,
        penaltyRate: parseFloat(createForm.penaltyRate) || 0,
        maxLoansPerMember: parseInt(createForm.maxLoansPerMember) || 1,
        requiresCollateral: createForm.requiresCollateral,
        requiresGuarantors: createForm.requiresGuarantors,
        requiresReferees: createForm.requiresReferees,
        minGuarantors: createForm.requiresGuarantors ? Math.max(1, parseInt(createForm.minGuarantors, 10) || 2) : 0,
        minReferees: createForm.requiresReferees ? Math.max(1, parseInt(createForm.minReferees, 10) || 1) : 0,
        netDisbursement: parseFloat(createForm.netDisbursement) || 0,
        currentLoans: parseInt(createForm.currentLoans) || 0,
        defaultThresholdDays: parseInt(createForm.defaultThresholdDays) || 30,
        installmentPenaltyAmount: parseFloat(createForm.installmentPenaltyAmount) || 0,
        loanPenaltyAmount: parseFloat(createForm.loanPenaltyAmount) || 0,
      };

      const response = await ApiService.updateLoanType(selectedLoanType.id, updateData);
      if (response.success) {
        Alert.alert('Success', 'Loan type updated successfully');
        setShowEditModal(false);
        setSelectedLoanType(null);
        resetCreateForm();
        loadLoanTypes();
      } else {
        Alert.alert('Error', response.error || 'Failed to update loan type');
      }
    } catch (error) {
      console.error('Update loan type error:', error);
      Alert.alert('Error', 'Failed to update loan type. Please try again.');
    }
  };

  const handleToggleStatus = async (loanType) => {
    if (!canCreateLoanTypes()) {
      Alert.alert('Access Denied', 'You do not have permission to change loan type status.');
      return;
    }

    const newStatus = loanType.status === 'active' ? 'inactive' : 'active';
    try {
      const response = await ApiService.updateLoanType(loanType.id, {
        status: newStatus,
        updatedBy: userRole,
        updatedById: user.id,
        timestamp: new Date().toISOString(),
      });

      if (response.success) {
        Alert.alert('Success', `Loan type ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`);
        await loadLoanTypes();
      } else {
        Alert.alert('Error', response.error || 'Failed to update loan type status.');
      }
    } catch (error) {
      console.error('Toggle status error:', error);
      Alert.alert('Error', 'Failed to update loan type status. Please try again.');
    }
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
      requiresGuarantors: false,
      requiresReferees: false,
      minGuarantors: 2,
      minReferees: 1,
      collateralDescription: '',
      netDisbursement: '',
      currentLoans: '0',
      defaultThresholdDays: '30',
      installmentPenaltyType: 'fixed',
      installmentPenaltyAmount: '',
      loanPenaltyAmount: '',
      status: 'active',
    });
  };

  const canCreateLoanTypes = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  return {
    colors,
    loanTypes,
    loading,
    refreshing,
    selectedFilter,
    searchQuery,
    showFilterDropdown,
    userRole,
    showCreateModal,
    showEditModal,
    selectedLoanType,
    createForm,
    filters,
    tableStyles,
    headerStyles,
    currentChamaId,
    setSelectedFilter,
    setSearchQuery,
    setShowFilterDropdown,
    setShowCreateModal,
    setShowEditModal,
    setSelectedLoanType,
    setCreateForm,
    loadLoanTypes,
    onRefresh,
    handleCreateLoanType,
    handleEditLoanType,
    handleUpdateLoanType,
    handleToggleStatus,
    resetCreateForm,
    canCreateLoanTypes,
    formatCurrency,
  };
};

export default useLoanTypeCreationScreen;
