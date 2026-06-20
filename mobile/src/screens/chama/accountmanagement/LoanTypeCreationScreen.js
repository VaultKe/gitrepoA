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
    fontSize: 9,
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

const LoanTypeCreationScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  // State variables
  const [loanTypes, setLoanTypes] = useState([]);
  const [allLoanTypes, setAllLoanTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [userRole, setUserRole] = useState('member');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLoanType, setSelectedLoanType] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    maxAmount: '',
    minAmount: '',
    interestRate: '',
    termMonths: '',
    eligibilityCriteria: 'active_members',
    approvalRequired: true,
    gracePeriodDays: '',
    penaltyRate: '',
    maxLoansPerMember: '1',
    requiresCollateral: false,
    collateralDescription: '',
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

  const filterLoanTypes = () => {
    let filtered = allLoanTypes;

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(type =>
        type.status?.toLowerCase() === selectedFilter.toLowerCase()
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(type =>
        type.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.maxAmount?.toString().includes(searchQuery)
      );
    }

    setLoanTypes(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLoanTypes();
    setRefreshing(false);
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

  const handleCreateLoanType = async () => {
    if (!canCreateLoanTypes()) {
      Alert.alert('Access Denied', 'You do not have permission to create loan types.');
      return;
    }

    if (!createForm.name || !createForm.maxAmount || !createForm.interestRate || !createForm.termMonths) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    try {
      const loanTypeData = {
        ...createForm,
        maxAmount: parseFloat(createForm.maxAmount),
        minAmount: parseFloat(createForm.minAmount) || 0,
        interestRate: parseFloat(createForm.interestRate),
        termMonths: parseInt(createForm.termMonths),
        gracePeriodDays: parseInt(createForm.gracePeriodDays) || 0,
        penaltyRate: parseFloat(createForm.penaltyRate) || 0,
        maxLoansPerMember: parseInt(createForm.maxLoansPerMember) || 1,
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
      maxAmount: loanType.maxAmount?.toString() || '',
      minAmount: loanType.minAmount?.toString() || '',
      interestRate: loanType.interestRate?.toString() || '',
      termMonths: loanType.termMonths?.toString() || '',
      eligibilityCriteria: loanType.eligibilityCriteria || 'active_members',
      approvalRequired: loanType.approvalRequired ?? true,
      gracePeriodDays: loanType.gracePeriodDays?.toString() || '',
      penaltyRate: loanType.penaltyRate?.toString() || '',
      maxLoansPerMember: loanType.maxLoansPerMember?.toString() || '1',
      requiresCollateral: loanType.requiresCollateral ?? false,
      collateralDescription: loanType.collateralDescription || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateLoanType = async () => {
    if (!selectedLoanType) return;

    try {
      const updateData = {
        ...createForm,
        maxAmount: parseFloat(createForm.maxAmount),
        minAmount: parseFloat(createForm.minAmount) || 0,
        interestRate: parseFloat(createForm.interestRate),
        termMonths: parseInt(createForm.termMonths),
        gracePeriodDays: parseInt(createForm.gracePeriodDays) || 0,
        penaltyRate: parseFloat(createForm.penaltyRate) || 0,
        maxLoansPerMember: parseInt(createForm.maxLoansPerMember) || 1,
        updatedBy: userRole,
        updatedById: user.id,
        timestamp: new Date().toISOString(),
      };

      // TODO: Implement updateLoanType API in backend
      Alert.alert('Feature Coming Soon', 'Loan type updates will be available once the backend API is implemented.');
      setShowEditModal(false);
      setSelectedLoanType(null);
      resetCreateForm();
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
      const response = await ApiService.updateLoanType(currentChamaId, loanType.id, {
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
      maxAmount: '',
      minAmount: '',
      interestRate: '',
      termMonths: '',
      eligibilityCriteria: 'active_members',
      approvalRequired: true,
      gracePeriodDays: '',
      penaltyRate: '',
      maxLoansPerMember: '1',
      requiresCollateral: false,
      collateralDescription: '',
    });
  };

  const canCreateLoanTypes = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Loan Type Name */}
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[tableStyles.tableCellText, { fontSize: 7, color: colors.textSecondary }]}>
            {item.description || 'No description'}
          </Text>
        </View>

        {/* Max Amount */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium }]}>
            {formatCurrency(item.maxAmount)}
          </Text>
        </View>

        {/* Interest Rate */}
        <View style={[tableStyles.tableCell, tableStyles.rateCell]}>
          <Text style={tableStyles.tableCellText}>
            {item.interestRate}%
          </Text>
        </View>

        {/* Term */}
        <View style={[tableStyles.tableCell, tableStyles.termCell]}>
          <Text style={tableStyles.tableCellText}>
            {item.termMonths} months
          </Text>
        </View>

        {/* Actions */}
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <View style={tableStyles.actionButtons}>
            <TouchableOpacity
              style={[tableStyles.actionButton, { backgroundColor: colors.info + '20' }]}
              onPress={() => navigation.navigate('LoanTypeDetails', { loanTypeId: item.id, chamaId: currentChamaId })}
            >
              <Ionicons name="eye" size={14} color={colors.info} />
            </TouchableOpacity>
            {canCreateLoanTypes() && (
              <>
                <TouchableOpacity
                  style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => handleEditLoanType(item)}
                >
                  <Ionicons name="create" size={14} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[tableStyles.actionButton, {
                    backgroundColor: (item.status === 'active' ? colors.error : colors.success) + '20'
                  }]}
                  onPress={() => handleToggleStatus(item)}
                >
                  <Ionicons
                    name={item.status === 'active' ? "close-circle" : "checkmark-circle"}
                    size={14}
                    color={item.status === 'active' ? colors.error : colors.success}
                  />
                </TouchableOpacity>
              </>
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
        No Loan Types Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Get started by creating your first loan type for the chama
      </Text>
      {canCreateLoanTypes() && (
        <Button
          title="Create First Loan Type"
          onPress={() => setShowCreateModal(true)}
          style={{ marginTop: spacing.lg, backgroundColor: colors.primary }}
          icon={<Ionicons name="add-circle" size={16} color={colors.white} />}
        />
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={[headerStyles.header, { backgroundColor: colors.surface }]}>
      <View style={headerStyles.headerContent}>
        {/* Search Bar */}
        <View style={headerStyles.searchContainer}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[headerStyles.searchInput, { color: colors.text }]}
            placeholder="Search loan types by name or amount..."
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

        {/* Filter Dropdown */}
        <View style={headerStyles.filterContainer}>
          <TouchableOpacity
            style={headerStyles.filterButton}
            onPress={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Ionicons
              name={filters.find(f => f.id === selectedFilter)?.icon || 'list'}
              size={16}
              color={colors.primary}
            />
            <Text style={[headerStyles.filterButtonText, { color: colors.text }]}>
              {filters.find(f => f.id === selectedFilter)?.name || 'All'}
            </Text>
            <Ionicons
              name={showFilterDropdown ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}

        {/* Dropdown Overlay */}
        {showFilterDropdown && (
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowFilterDropdown(false)}
          />
        )}

        {/* Table Container */}
        <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
          {/* Table Header */}
          <View style={tableStyles.tableHeader}>
            <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
              <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Loan Type</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Max Amount</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.rateCell]}>
              <Text style={tableStyles.tableHeaderText}>Rate</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.termCell]}>
              <Text style={tableStyles.tableHeaderText}>Term</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
              <Text style={tableStyles.tableHeaderText}>Actions</Text>
            </View>
          </View>

          {/* Table Body */}
          <FlatList
            data={loanTypes}
            renderItem={renderTableRow}
            keyExtractor={(item) => item.id?.toString()}
            style={{ flex: 1, zIndex: 1 }}
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

          {/* Create Button */}
          {canCreateLoanTypes() && (
            <View style={styles.createActions}>
              <Button
                title="Create New Loan Type"
                onPress={() => setShowCreateModal(true)}
                style={{ backgroundColor: colors.primary }}
                icon={<Ionicons name="add-circle" size={16} color={colors.white} />}
              />
            </View>
          )}
        </View>

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

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal || showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedLoanType(null);
          resetCreateForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {showCreateModal ? 'Create Loan Type' : 'Edit Loan Type'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedLoanType(null);
                  resetCreateForm();
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Loan Type Name *
                </Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={createForm.name}
                  onChangeText={(text) => setCreateForm(prev => ({ ...prev, name: text }))}
                  placeholder="Enter loan type name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Description
                </Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={createForm.description}
                  onChangeText={(text) => setCreateForm(prev => ({ ...prev, description: text }))}
                  placeholder="Describe this loan type"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Maximum Amount (KES) *
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.maxAmount}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, maxAmount: text }))}
                    placeholder="Max loan amount"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Minimum Amount (KES)
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.minAmount}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, minAmount: text }))}
                    placeholder="Min loan amount"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Interest Rate (%) *
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.interestRate}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, interestRate: text }))}
                    placeholder="e.g. 12.5"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.sm }]}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Term (Months) *
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={createForm.termMonths}
                    onChangeText={(text) => setCreateForm(prev => ({ ...prev, termMonths: text }))}
                    placeholder="e.g. 12"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedLoanType(null);
                    resetCreateForm();
                  }}
                  style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                />
                <Button
                  title={showCreateModal ? "Create" : "Update"}
                  onPress={showCreateModal ? handleCreateLoanType : handleUpdateLoanType}
                  style={{ backgroundColor: colors.primary }}
                  disabled={!createForm.name || !createForm.maxAmount || !createForm.interestRate || !createForm.termMonths}
                />
              </View>
            </ScrollView>
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
  createActions: {
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
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  formRow: {
    flexDirection: 'row',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
});

export default LoanTypeCreationScreen;