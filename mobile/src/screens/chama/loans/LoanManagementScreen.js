import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import ApiService from '../../../services/api';

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
    fontSize: 12,
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

const LoanManagementScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  // State variables
  const [loans, setLoans] = useState([]);
  const [allLoans, setAllLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [userRole, setUserRole] = useState('member');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 15;

  // Modal states
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showBulkDisburseModal, setShowBulkDisburseModal] = useState(false);
  const [bulkDisburseData, setBulkDisburseData] = useState({
    selectedLoans: [],
    amount: '',
    description: '',
  });

  // Loan types subview state
  const [loanSubview, setLoanSubview] = useState('loans'); // 'loans' | 'loan-types' | 'create-loan-type'
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
      // When searching, filter from all data and show paginated results
      const filteredData = filterLoansData(allLoans, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setLoans(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
    } else {
      // When not searching, use server-side pagination
      loadLoans(currentPage);
    }
  }, [currentPage, selectedFilter]);

  useEffect(() => {
    if (searchQuery.trim()) {
      // Trigger search filtering
      const filteredData = filterLoansData(allLoans, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setLoans(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
      setCurrentPage(1); // Reset to first page when searching
    } else {
      // Clear search and reload with pagination
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
      }
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole('member');
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

        // For search functionality, if searching, load all data
        if (search.trim()) {
          const allResponse = await ApiService.getLoans(currentChamaId, 1000, 0); // Load more for search
          if (allResponse.success) {
            setAllLoans(allResponse.data || []);
            // Calculate pagination info from all data
            const filteredData = filterLoansData(allResponse.data || [], search, selectedFilter);
            setTotalItems(filteredData.length);
            setTotalPages(Math.ceil(filteredData.length / pageSize));
          }
        } else {
          setAllLoans(loansData);
          // Use pagination info from API if available, otherwise estimate
          setTotalItems(response.totalCount || response.data?.length || loansData.length);
          setTotalPages(Math.ceil((response.totalCount || loansData.length) / pageSize));
        }
      } else {
        console.error('Failed to load loans:', response.error);
        setLoans([]);
        setAllLoans([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error loading loans:', error);
      setLoans([]);
      setAllLoans([]);
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
      requiresGuarantors: false,
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
      requiresGuarantors: loanType.requiresGuarantors ?? false,
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
        response = await ApiService.updateLoanType(currentChamaId, editingLoanType.id, payload);
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

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(loan =>
        loan.status?.toLowerCase().replace(' ', '_') === filter.toLowerCase()
      );
    }

    // Apply search filter
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

  const handleAction = (loan, action) => {
    setSelectedLoan(loan);
    switch (action) {
      case 'view':
        // Navigate to loan details
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
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const canCollectPayments = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const canUpdateStatus = () => {
    return ['treasurer', 'secretary', 'chairperson', 'auditor'].includes(userRole.toLowerCase());
  };

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Member Name */}
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.applicant_name || item.memberName || item.applicant?.name || 'Unknown Member'}
          </Text>
        </View>

        {/* Amount */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium }]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        {/* Date */}
        <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
          <Text style={tableStyles.tableCellText}>
            {formatDate(item.createdAt || item.created_at)}
          </Text>
        </View>

        {/* Status */}
        <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
          <View style={[tableStyles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[tableStyles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status?.toUpperCase().replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <View style={tableStyles.actionButtons}>
            <TouchableOpacity
              style={[tableStyles.actionButton, { backgroundColor: colors.info + '20' }]}
              onPress={() => handleAction(item, 'view')}
            >
              <Ionicons name="eye" size={14} color={colors.info} />
            </TouchableOpacity>
            {canDisburseLoans() && item.status === 'disbursement' && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
                onPress={() => handleAction(item, 'disburse')}
              >
                <Ionicons name="send" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
            {canCollectPayments() && ['delinquent', 'partial', 'recovery_active'].includes(item.status?.toLowerCase().replace(' ', '_')) && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.success + '20' }]}
                onPress={() => handleAction(item, 'collect')}
              >
                <Ionicons name="cash" size={14} color={colors.success} />
              </TouchableOpacity>
            )}
            {canUpdateStatus() && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.warning + '20' }]}
                onPress={() => handleAction(item, 'update_status')}
              >
                <Ionicons name="create" size={14} color={colors.warning} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="card" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Loans Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {selectedFilter === 'all'
          ? 'No loans have been created yet'
          : `No loans with status "${selectedFilter}" found`
        }
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, backgroundColor: colors.background }}>
      <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm }}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={{ flex: 1, color: colors.text, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs }}
              placeholder="Search member"
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border }}
            onPress={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Ionicons
              name={filters.find(f => f.id === selectedFilter)?.icon || 'list'}
              size={16}
              color={colors.primary}
            />
            <Text style={{ color: colors.text, fontSize: typography.fontSize.sm }}>
              {filters.find(f => f.id === selectedFilter)?.name || 'All'}
            </Text>
            <Ionicons
              name={showFilterDropdown ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}

        <ScrollView
          style={{ flex: 1, marginTop: spacing.sm }}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden' }}>
            {/* Subview tabs */}
            <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md, backgroundColor: loanSubview === 'loans' ? colors.primary + '18' : 'transparent', borderBottomWidth: loanSubview === 'loans' ? 2 : 0, borderBottomColor: colors.primary }}
                onPress={() => setLoanSubview('loans')}
              >
                <Ionicons name="list" size={18} color={loanSubview === 'loans' ? colors.primary : colors.textSecondary} />
                <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.xs, color: loanSubview === 'loans' ? colors.primary : colors.textSecondary }}>Loans</Text>
              </TouchableOpacity>
              {canManageLoanTypes() && (
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md, backgroundColor: loanSubview === 'loan-types' ? colors.primary + '18' : 'transparent', borderBottomWidth: loanSubview === 'loan-types' ? 2 : 0, borderBottomColor: colors.primary }}
                  onPress={() => {
                    setLoanSubview('loan-types');
                    loadLoanTypes();
                  }}
                >
                  <Ionicons name="cash" size={18} color={loanSubview === 'loan-types' ? colors.primary : colors.textSecondary} />
                  <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.xs, color: loanSubview === 'loan-types' ? colors.primary : colors.textSecondary }}>Loan Types</Text>
                </TouchableOpacity>
              )}
              {canManageLoanTypes() && (
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md, backgroundColor: loanSubview === 'create-loan-type' ? colors.primary + '18' : 'transparent', borderBottomWidth: loanSubview === 'create-loan-type' ? 2 : 0, borderBottomColor: colors.primary }}
                  onPress={() => setLoanSubview('create-loan-type')}
                >
                  <Ionicons name="add-circle" size={18} color={loanSubview === 'create-loan-type' ? colors.primary : colors.textSecondary} />
                  <Text style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.xs, color: loanSubview === 'create-loan-type' ? colors.primary : colors.textSecondary }}>Add Loan Type</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Subview content */}
            {loanSubview === 'loans' ? (
              <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
                <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
                  <View style={{ flex: 2, paddingHorizontal: spacing.xs }}>
                    <Text style={{ fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Member</Text>
                  </View>
                  <View style={{ flex: 1.5, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Amount</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Date</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Status</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: 'semibold', color: colors.primary }}>Actions</Text>
                  </View>
                </View>
                <FlatList
                  data={loans}
                  renderItem={renderTableRow}
                  keyExtractor={(item) => item.id?.toString()}
                  style={{ minHeight: 200 }}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={[colors.primary]}
                      tintColor={colors.primary}
                    />
                  }
                  ListEmptyComponent={!loading && renderEmptyState()}
                />
              </View>
            ) : loanSubview === 'loan-types' ? (
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
                <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
                  <Text style={{ flex: 2, fontSize: 12, fontWeight: 'semibold', color: colors.primary, paddingHorizontal: spacing.xs }}>Name</Text>
                  <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Loan Amount</Text>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Rate</Text>
                  <Text style={{ flex: 1.5, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Term</Text>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Status</Text>
                  {canManageLoanTypes() && (
                    <Text style={{ flex: 0.8, fontSize: 12, fontWeight: 'semibold', color: colors.primary, textAlign: 'center' }}>Actions</Text>
                  )}
                </View>
                <FlatList
                  data={loanTypes}
                  keyExtractor={(item) => item.id}
                  refreshControl={
                    <RefreshControl
                      refreshing={loanTypesLoading}
                      onRefresh={loadLoanTypes}
                      colors={[colors.primary]}
                      tintColor={colors.primary}
                    />
                  }
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                      <Ionicons name="cash-outline" size={48} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>No loan types found</Text>
                    </View>
                  }
                  renderItem={({ item, index }) => (
                    <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: index % 2 === 0 ? colors.background : colors.surface, alignItems: 'center' }}>
                      <View style={{ flex: 2, justifyContent: 'center', paddingHorizontal: spacing.xs }}>
                        <Text style={{ fontSize: 8, fontWeight: 'medium', color: colors.text }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ fontSize: 7, color: colors.textSecondary }} numberOfLines={1}>{item.description || '-'}</Text>
                      </View>
                      <View style={{ flex: 1.5, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 7, color: colors.text }}>
                          {item.exactAmount ? formatCurrency(item.exactAmount) : 'KES 0'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 8, color: colors.text }}>{item.interestRate}%</Text>
                      </View>
                      <View style={{ flex: 1.5, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 8, color: colors.text }}>{item.termMonths} mo</Text>
                        <Text style={{ fontSize: 7, color: colors.textSecondary }}>
                          Grace: {item.gracePeriodDays || 0}d | Default: {item.defaultThresholdDays || 30}d
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ paddingHorizontal: spacing.xs / 2, paddingVertical: spacing.xs / 2, borderRadius: 4, backgroundColor: (item.status === 'active' ? colors.success : colors.textSecondary) + '20' }}>
                          <Text style={{ fontSize: 7, fontWeight: 'bold', color: item.status === 'active' ? colors.success : colors.textSecondary, textTransform: 'capitalize' }}>{item.status}</Text>
                        </View>
                      </View>
                      {canManageLoanTypes() && (
                        <View style={{ flex: 0.8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs / 2 }}>
                          <TouchableOpacity
                            style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '20' }}
                            onPress={() => handleEditLoanType(item)}
                          >
                            <Ionicons name="create" size={12} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                  style={{ minHeight: 200 }}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            ) : loanSubview === 'create-loan-type' ? (
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
                    <View style={{ marginBottom: spacing.lg }}>
                      <Text style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.text, marginBottom: spacing.xs }}>
                        {editingLoanType ? 'Edit Loan Type' : 'Loan Type Information'}
                      </Text>
                      <Text style={{ fontSize: typography.fontSize.base, color: colors.textSecondary }}>
                        {editingLoanType ? 'Update the loan product details below.' : 'Fill in the details below to define a new loan product for this chama.'}
                      </Text>
                    </View>
                    <View style={{ gap: spacing.md }}>
                      <View>
                        <Text style={[styles.formLabel, { color: colors.text }]}>Loan Name *</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                          value={createForm.name}
                          onChangeText={(text) => setCreateForm((prev) => ({ ...prev, name: text }))}
                          placeholder="Loan name"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                      <View>
                        <Text style={[styles.formLabel, { color: colors.text }]}>Loan Description</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, minHeight: 80, borderWidth: 1.5 }]}
                          value={createForm.description}
                          onChangeText={(text) => setCreateForm((prev) => ({ ...prev, description: text }))}
                          placeholder="Describe this loan"
                          placeholderTextColor={colors.textSecondary}
                          multiline
                          numberOfLines={3}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Loan Period</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.termMonths}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, termMonths: text }))}
                            placeholder="e.g. 12"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Grace Period (Days)</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.gracePeriodDays}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, gracePeriodDays: text }))}
                            placeholder="e.g. 7"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Loan Amount (KES) *</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.exactAmount}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, exactAmount: text }))}
                            placeholder="e.g. 10000"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Net Disbursement (KES)</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.netDisbursement}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, netDisbursement: text }))}
                            placeholder="e.g. 9500"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Loan Tenure (Repayment Cycle)</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.termMonths}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, termMonths: text }))}
                            placeholder="e.g. 12"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Default Threshold Days</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.defaultThresholdDays}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, defaultThresholdDays: text }))}
                            placeholder="e.g. 30"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Installment Penalty Type</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.installmentPenaltyType}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, installmentPenaltyType: text }))}
                            placeholder="fixed / percentage"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Installment Penalty Amount (KES)</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.installmentPenaltyAmount}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, installmentPenaltyAmount: text }))}
                            placeholder="e.g. 50"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Loan Penalty Amount (KES)</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.loanPenaltyAmount}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, loanPenaltyAmount: text }))}
                            placeholder="e.g. 500"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formLabel, { color: colors.text }]}>Interest Rate (%) *</Text>
                          <TextInput
                            style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5 }]}
                            value={createForm.interestRate}
                            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, interestRate: text }))}
                            placeholder="e.g. 12.5"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                          onPress={() => setCreateForm((prev) => ({ ...prev, requiresCollateral: !prev.requiresCollateral }))}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: createForm.requiresCollateral ? colors.primary : colors.background, alignItems: 'center', justifyContent: 'center' }}>
                            {createForm.requiresCollateral && <Ionicons name="checkmark" size={14} color={colors.white} />}
                          </View>
                          <Text style={{ color: colors.text }}>Requires collateral</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                          onPress={() => setCreateForm((prev) => ({ ...prev, requiresGuarantors: !prev.requiresGuarantors }))}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: createForm.requiresGuarantors ? colors.primary : colors.background, alignItems: 'center', justifyContent: 'center' }}>
                            {createForm.requiresGuarantors && <Ionicons name="checkmark" size={14} color={colors.white} />}
                          </View>
                          <Text style={{ color: colors.text }}>Requires guarantors</Text>
                        </TouchableOpacity>
                      </View>
                      <Button
                        title={createSubmitting ? (editingLoanType ? 'Updating...' : 'Creating...') : (editingLoanType ? 'Update Loan Type' : 'Create Loan Type')}
                        onPress={handleCreateLoanType}
                        disabled={createSubmitting}
                        style={{ backgroundColor: colors.primary, marginTop: spacing.md }}
                        icon={!createSubmitting && <Ionicons name={editingLoanType ? 'save' : 'add'} size={16} color={colors.white} />}
                      />
                    </View>
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </Card>
        </ScrollView>

        {loading && <LoadingSpinner />}
      </SafeAreaView>

      {/* Filter Dropdown */}
      {showFilterDropdown && (
        <View style={[headerStyles.dropdownContainer, {
          position: 'absolute',
          top: 140,
          right: 20,
          zIndex: 10000,
        }]}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                headerStyles.dropdownItem,
                selectedFilter === filter.id && headerStyles.dropdownItemSelected
              ]}
              onPress={() => {
                setSelectedFilter(filter.id);
                setShowFilterDropdown(false);
              }}
            >
              <Ionicons
                name={filter.icon}
                size={16}
                color={selectedFilter === filter.id ? colors.white : colors.textSecondary}
              />
              <Text style={[
                headerStyles.dropdownItemText,
                selectedFilter === filter.id && { color: colors.white }
              ]}>
                {filter.name}
              </Text>
              {selectedFilter === filter.id && (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Loan Action
              </Text>
              <TouchableOpacity
                onPress={() => setShowActionModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedLoan && (
              <View style={styles.modalBody}>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {selectedLoan.memberName} - {formatCurrency(selectedLoan.amount)}
                </Text>
                {/* Action form would go here */}
                <Text style={[styles.comingSoon, { color: colors.textSecondary }]}>
                  Action functionality coming soon...
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Bulk Disburse Modal */}
      <Modal
        visible={showBulkDisburseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBulkDisburseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Bulk Loan Disbursement
              </Text>
              <TouchableOpacity
                onPress={() => setShowBulkDisburseModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Disburse multiple loans at once
              </Text>
              <Text style={[styles.comingSoon, { color: colors.textSecondary }]}>
                Bulk disbursement functionality coming soon...
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  bulkActions: {
    padding: spacing.md,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalBody: {
    flex: 1,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.lg,
  },
  comingSoon: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    padding: spacing.xl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: typography.fontSize.sm,
    color: '#2563eb',
    fontWeight: typography.fontWeight.medium,
  },
  paginationTextDisabled: {
    color: '#9ca3af',
  },
  paginationInfo: {
    fontSize: typography.fontSize.sm,
    color: '#6b7280',
    fontWeight: typography.fontWeight.medium,
  },
});

export default LoanManagementScreen;