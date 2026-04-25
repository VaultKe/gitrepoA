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
import { useApp } from '../../context/AppContext';
import { useChamaContext } from '../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ApiService from '../../services/api';

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
    color: colors.text,
    fontSize: 9,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 8.5,
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

const SavingsWithdrawalScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  // State variables
  const [savingsAccounts, setSavingsAccounts] = useState([]);
  const [allSavingsAccounts, setAllSavingsAccounts] = useState([]);
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
      // When searching, filter from all data and show paginated results
      const filteredData = filterSavingsAccountsData(allSavingsAccounts, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setSavingsAccounts(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
    } else {
      // When not searching, use server-side pagination
      loadSavingsAccounts(currentPage);
    }
  }, [currentPage, selectedFilter]);

  useEffect(() => {
    if (searchQuery.trim()) {
      // Trigger search filtering
      const filteredData = filterSavingsAccountsData(allSavingsAccounts, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setSavingsAccounts(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
      setCurrentPage(1); // Reset to first page when searching
    } else {
      // Clear search and reload with pagination
      loadSavingsAccounts(1);
      setCurrentPage(1);
    }
  }, [searchQuery]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserRole(),
        loadSavingsAccounts(),
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

  const loadSavingsAccounts = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;
      const response = await ApiService.getEligibleSavingsMembers(currentChamaId, pageSize, offset);

      if (response.success) {
        const accountsData = response.data || [];
        setSavingsAccounts(accountsData);

        // For search functionality, if searching, load all data
        if (search.trim()) {
          const allResponse = await ApiService.getEligibleSavingsMembers(currentChamaId, 1000, 0); // Load more for search
          if (allResponse.success) {
            setAllSavingsAccounts(allResponse.data || []);
            // Calculate pagination info from all data
            const filteredData = filterSavingsAccountsData(allResponse.data || [], search, selectedFilter);
            setTotalItems(filteredData.length);
            setTotalPages(Math.ceil(filteredData.length / pageSize));
          }
        } else {
          setAllSavingsAccounts(accountsData);
          // Use pagination info from API if available, otherwise estimate
          setTotalItems(response.totalCount || response.data?.length || accountsData.length);
          setTotalPages(Math.ceil((response.totalCount || accountsData.length) / pageSize));
        }
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

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(account =>
        account.status?.toLowerCase() === filter.toLowerCase()
      );
    }

    // Apply search filter
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

    // Validate amount
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
          amount: account.balance, // Full balance withdrawal for bulk
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
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Member Name */}
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.memberName || 'Unknown Member'}
          </Text>
          <Text style={[tableStyles.tableCellText, { fontSize: 7, color: colors.textSecondary }]}>
            Account: {item.accountNumber || item.id}
          </Text>
        </View>

        {/* Balance */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium, color: colors.success }]}>
            {formatCurrency(item.balance)}
          </Text>
        </View>

        {/* Last Activity */}
        <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
          <Text style={tableStyles.tableCellText}>
            {formatDate(item.lastActivity || item.createdAt)}
          </Text>
        </View>

        {/* Status */}
        <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
          <View style={[tableStyles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[tableStyles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <View style={tableStyles.actionButtons}>
            <TouchableOpacity
              style={[tableStyles.actionButton, { backgroundColor: colors.info + '20' }]}
              onPress={() => navigation.navigate('SavingsDetails', { accountId: item.id, chamaId: currentChamaId })}
            >
              <Ionicons name="eye" size={14} color={colors.info} />
            </TouchableOpacity>
            {canWithdrawSavings() && item.status === 'eligible' && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.warning + '20' }]}
                onPress={() => handleWithdraw(item)}
              >
                <Ionicons name="cash" size={14} color={colors.warning} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="wallet" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Savings Accounts Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {selectedFilter === 'all'
          ? 'No savings accounts have been created yet'
          : `No savings accounts with status "${selectedFilter}" found`
        }
      </Text>
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
            placeholder="Search by name"
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
              <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Member & Account</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Balance</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
              <Text style={tableStyles.tableHeaderText}>Last Activity</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.statusCell]}>
              <Text style={tableStyles.tableHeaderText}>Status</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
              <Text style={tableStyles.tableHeaderText}>Actions</Text>
            </View>
          </View>

          {/* Table Body */}
          <FlatList
            data={savingsAccounts}
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

          {/* Pagination */}
          {totalItems > pageSize && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? colors.textTertiary : colors.primary} />
                <Text style={[styles.paginationText, currentPage === 1 && styles.paginationTextDisabled]}>Previous</Text>
              </TouchableOpacity>

              <Text style={styles.paginationInfo}>
                Page {currentPage} of {totalPages} ({totalItems} total)
              </Text>

              <TouchableOpacity
                style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <Text style={[styles.paginationText, currentPage === totalPages && styles.paginationTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={currentPage === totalPages ? colors.textTertiary : colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Bulk Actions */}
          {canWithdrawSavings() && savingsAccounts.filter(account => account.status === 'eligible').length > 0 && (
            <View style={styles.bulkActions}>
              <Button
                title={`Bulk Withdraw (${savingsAccounts.filter(account => account.status === 'eligible').length} eligible accounts)`}
                onPress={handleBulkWithdraw}
                style={{ backgroundColor: colors.warning }}
                icon={<Ionicons name="cash" size={16} color={colors.white} />}
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

      {/* Withdraw Modal */}
      <Modal
        visible={showWithdrawModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Withdraw Savings
              </Text>
              <TouchableOpacity
                onPress={() => setShowWithdrawModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedAccount && (
                <View>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    {selectedAccount.memberName} - Available: {formatCurrency(selectedAccount.balance)}
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Withdrawal Amount (KES) *
                    </Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={withdrawForm.amount}
                      onChangeText={(text) => setWithdrawForm(prev => ({ ...prev, amount: text }))}
                      placeholder="Enter withdrawal amount"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                      Maximum: {formatCurrency(selectedAccount.balance)}
                    </Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Reason *
                    </Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={withdrawForm.reason}
                      onChangeText={(text) => setWithdrawForm(prev => ({ ...prev, reason: text }))}
                      placeholder="Enter withdrawal reason"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Private Note (Audit Trail)
                    </Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={withdrawForm.privateNote}
                      onChangeText={(text) => setWithdrawForm(prev => ({ ...prev, privateNote: text }))}
                      placeholder="Optional note for audit purposes"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  <View style={styles.modalActions}>
                    <Button
                      title="Cancel"
                      onPress={() => setShowWithdrawModal(false)}
                      style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                    />
                    <Button
                      title="Withdraw"
                      onPress={submitWithdrawal}
                      style={{ backgroundColor: colors.warning }}
                      disabled={!withdrawForm.amount || !withdrawForm.reason}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bulk Withdraw Modal */}
      <Modal
        visible={showBulkWithdrawModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBulkWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Bulk Savings Withdrawal
              </Text>
              <TouchableOpacity
                onPress={() => setShowBulkWithdrawModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Withdraw savings from {bulkWithdrawData.selectedAccounts.length} eligible accounts
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Reason *
                </Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={bulkWithdrawData.reason}
                  onChangeText={(text) => setBulkWithdrawData(prev => ({ ...prev, reason: text }))}
                  placeholder="Enter bulk withdrawal reason"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.bulkSummary}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>
                  Withdrawal Summary
                </Text>
                {bulkWithdrawData.selectedAccounts.map((account, index) => (
                  <View key={account.id} style={styles.summaryItem}>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                      {index + 1}. {account.memberName}
                    </Text>
                    <Text style={[styles.summaryAmount, { color: colors.warning }]}>
                      {formatCurrency(account.balance)}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalSummary}>
                  <Text style={[styles.totalText, { color: colors.text }]}>
                    Total Withdrawal:
                  </Text>
                  <Text style={[styles.totalAmount, { color: colors.warning }]}>
                    {formatCurrency(bulkWithdrawData.selectedAccounts.reduce((sum, account) => sum + (account.balance || 0), 0))}
                  </Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowBulkWithdrawModal(false)}
                  style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                />
                <Button
                  title="Withdraw All"
                  onPress={submitBulkWithdrawal}
                  style={{ backgroundColor: colors.warning }}
                  disabled={!bulkWithdrawData.reason}
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
  formHint: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs / 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
  bulkSummary: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#f5f5f5',
    borderRadius: borderRadius.md,
  },
  summaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryText: {
    fontSize: typography.fontSize.sm,
  },
  summaryAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  totalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: spacing.sm,
  },
  totalText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  totalAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
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

export default SavingsWithdrawalScreen;