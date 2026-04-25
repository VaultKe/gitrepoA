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
            {item.memberName || 'Unknown Member'}
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
    <View style={[headerStyles.header, { backgroundColor: colors.surface }]}>
      <View style={headerStyles.headerContent}>
        {/* Search Bar */}
        <View style={headerStyles.searchContainer}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[headerStyles.searchInput, { color: colors.text }]}
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
              <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Member</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Amount</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
              <Text style={tableStyles.tableHeaderText}>Date</Text>
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
            data={loans}
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
          {canDisburseLoans() && loans.filter(loan => loan.status === 'disbursement').length > 0 && (
            <View style={styles.bulkActions}>
              <Button
                title={`Bulk Disburse (${loans.filter(loan => loan.status === 'disbursement').length} loans)`}
                onPress={() => setShowBulkDisburseModal(true)}
                style={{ backgroundColor: colors.primary }}
                icon={<Ionicons name="send" size={16} color={colors.white} />}
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