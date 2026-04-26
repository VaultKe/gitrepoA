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

const WelfareDisbursementScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  // State variables
  const [welfareFunds, setWelfareFunds] = useState([]);
  const [allWelfareFunds, setAllWelfareFunds] = useState([]);
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
    if (searchQuery.trim()) {
      // When searching, filter from all data and show paginated results
      const filteredData = filterWelfareFundsData(allWelfareFunds, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setWelfareFunds(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
    } else {
      // When not searching, use server-side pagination
      loadWelfareFunds(currentPage);
    }
  }, [currentPage, selectedFilter]);

  useEffect(() => {
    if (searchQuery.trim()) {
      // Trigger search filtering
      const filteredData = filterWelfareFundsData(allWelfareFunds, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setWelfareFunds(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
      setCurrentPage(1); // Reset to first page when searching
    } else {
      // Clear search and reload with pagination
      loadWelfareFunds(1);
      setCurrentPage(1);
    }
  }, [searchQuery]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserRole(),
        loadWelfareFunds(),
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

  const loadWelfareFunds = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;
      const response = await ApiService.getWelfareRequests(currentChamaId, pageSize, offset);

      if (response.success) {
        let fundsData = response.data || [];

        // Enrich welfare funds with requester user information
        const enrichedFunds = await Promise.all(
          fundsData.map(async (fund) => {
            try {
              // Get requester user ID from various possible field names
              const userId = fund.requester_id || fund.requesterId || fund.user_id || fund.memberId || fund.requested_by;
              if (userId) {
                console.log(`🔍 Enriching welfare fund ${fund.id} with requester user ID: ${userId}`);
                const userResponse = await ApiService.makeRequest(`/users/${userId}`);
                console.log(`🔍 User response for requester ${userId}:`, userResponse);

                if (userResponse.success && userResponse.data) {
                  const userData = userResponse.data;
                  const fullName = `${userData.firstName || userData.first_name || ''} ${userData.lastName || userData.last_name || ''}`.trim();
                  console.log(`✅ Enriched welfare fund ${fund.id} with requester: ${fullName}`);

                  return {
                    ...fund,
                    requester_id: userId,
                    requester_name: fullName,
                    memberId: userId,
                    memberName: fullName,
                    requester: {
                      id: userId,
                      first_name: userData.firstName || userData.first_name,
                      last_name: userData.lastName || userData.last_name,
                      name: fullName,
                      username: userData.username || userData.email
                    }
                  };
                }
              }

              // Return fund with placeholder requester data
              return {
                ...fund,
                requester_id: userId,
                requester_name: fund.requester_name || fund.memberName || 'Unknown Requester',
                memberId: userId,
                memberName: fund.requester_name || fund.memberName || 'Unknown Requester',
                requester: {
                  id: userId,
                  name: fund.requester_name || fund.memberName || 'Unknown Requester',
                  first_name: 'Unknown',
                  last_name: 'Requester',
                  username: 'unknown'
                }
              };
            } catch (error) {
              console.warn(`❌ Failed to enrich welfare fund ${fund.id}:`, error);
              return {
                ...fund,
                requester_name: fund.requester_name || fund.memberName || 'Unknown Requester',
                memberName: fund.requester_name || fund.memberName || 'Unknown Requester',
              };
            }
          })
        );

        setWelfareFunds(enrichedFunds);

        // For search functionality, if searching, load all data
        if (search.trim()) {
          const allResponse = await ApiService.getWelfareRequests(currentChamaId, 1000, 0); // Load more for search
          if (allResponse.success) {
            let allFundsData = allResponse.data || [];

            // Enrich all welfare funds data as well
            const enrichedAllFunds = await Promise.all(
              allFundsData.map(async (fund) => {
                try {
                  const userId = fund.requester_id || fund.requesterId || fund.user_id || fund.memberId || fund.requested_by;
                  if (userId) {
                    const userResponse = await ApiService.makeRequest(`/users/${userId}`);
                    if (userResponse.success && userResponse.data) {
                      const userData = userResponse.data;
                      const fullName = `${userData.firstName || userData.first_name || ''} ${userData.lastName || userData.last_name || ''}`.trim();

                      return {
                        ...fund,
                        requester_id: userId,
                        requester_name: fullName,
                        memberId: userId,
                        memberName: fullName,
                        requester: {
                          id: userId,
                          first_name: userData.firstName || userData.first_name,
                          last_name: userData.lastName || userData.last_name,
                          name: fullName,
                          username: userData.username || userData.email
                        }
                      };
                    }
                  }

                  return {
                    ...fund,
                    requester_name: fund.requester_name || fund.memberName || 'Unknown Requester',
                    memberName: fund.requester_name || fund.memberName || 'Unknown Requester',
                  };
                } catch (error) {
                  return {
                    ...fund,
                    requester_name: fund.requester_name || fund.memberName || 'Unknown Requester',
                    memberName: fund.requester_name || fund.memberName || 'Unknown Requester',
                  };
                }
              })
            );

            setAllWelfareFunds(enrichedAllFunds);
            // Calculate pagination info from all data
            const filteredData = filterWelfareFundsData(enrichedAllFunds, search, selectedFilter);
            setTotalItems(filteredData.length);
            setTotalPages(Math.ceil(filteredData.length / pageSize));
          }
        } else {
          setAllWelfareFunds(enrichedFunds);
          // Use pagination info from API if available, otherwise estimate
          setTotalItems(response.totalCount || response.data?.length || enrichedFunds.length);
          setTotalPages(Math.ceil((response.totalCount || enrichedFunds.length) / pageSize));
        }
      } else {
        console.error('Failed to load welfare funds:', response.error);
        setWelfareFunds([]);
        setAllWelfareFunds([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error loading welfare funds:', error);
      setWelfareFunds([]);
      setAllWelfareFunds([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const filterWelfareFundsData = (fundsData, search, filter) => {
    let filtered = fundsData;

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(fund =>
        fund.status?.toLowerCase() === filter.toLowerCase()
      );
    }

    // Apply search filter
    if (search.trim()) {
      filtered = filtered.filter(fund =>
        fund.memberName?.toLowerCase().includes(search.toLowerCase()) ||
        fund.id?.toString().includes(search) ||
        fund.amount?.toString().includes(search) ||
        fund.purpose?.toLowerCase().includes(search.toLowerCase())
      );
    }

    return filtered;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWelfareFunds();
    setRefreshing(false);
  };

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

  const handleDisburse = (fund) => {
    if (!canDisburseWelfare()) {
      Alert.alert('Access Denied', 'You do not have permission to disburse welfare funds.');
      return;
    }
    setSelectedFund(fund);
    setDisburseForm({
      amount: fund.amount?.toString() || '',
      recipientId: fund.memberId || fund.requester_id || fund.id,
      recipientName: fund.requester_name || fund.memberName || fund.requester?.name || 'Unknown',
      description: `Welfare disbursement to ${fund.requester_name || fund.memberName || 'member'}`,
      privateNote: '',
    });
    setShowDisburseModal(true);
  };

  const handleBulkDisburse = () => {
    if (!canDisburseWelfare()) {
      Alert.alert('Access Denied', 'You do not have permission to disburse welfare funds.');
      return;
    }
    const approvedFunds = welfareFunds.filter(fund => fund.status === 'approved');
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
        Alert.alert('Success', 'Welfare fund disbursed successfully.');
        setShowDisburseModal(false);
        await loadWelfareFunds();
      } else {
        Alert.alert('Error', response.error || 'Failed to disburse welfare fund.');
      }
    } catch (error) {
      console.error('Disbursement error:', error);
      Alert.alert('Error', 'Failed to process disbursement. Please try again.');
    }
  };

  const submitBulkDisbursement = async () => {
    try {
      const bulkData = {
        funds: bulkDisburseData.selectedFunds.map(fund => ({
          fundId: fund.id,
          recipientId: fund.memberId || fund.requester_id,
          recipientName: fund.requester_name || fund.memberName || 'Unknown',
          amount: fund.amount,
        })),
        description: bulkDisburseData.description,
        initiatedBy: userRole,
        initiatedById: user.id,
        timestamp: new Date().toISOString(),
      };

      const response = await ApiService.bulkDisburseWelfareFunds(currentChamaId, bulkData);

      if (response.success) {
        Alert.alert('Success', `Bulk disbursement completed for ${bulkDisburseData.selectedFunds.length} members.`);
        setShowBulkDisburseModal(false);
        await loadWelfareFunds();
      } else {
        Alert.alert('Error', response.error || 'Failed to process bulk disbursement.');
      }
    } catch (error) {
      console.error('Bulk disbursement error:', error);
      Alert.alert('Error', 'Failed to process bulk disbursement. Please try again.');
    }
  };

  const canDisburseWelfare = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Member Name */}
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.requester_name || item.memberName || item.requester?.name || 'Unknown Member'}
          </Text>
          <Text style={[tableStyles.tableCellText, { fontSize: 7, color: colors.textSecondary }]}>
            {item.purpose || item.description || 'General welfare'}
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
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <View style={tableStyles.actionButtons}>
            <TouchableOpacity
              style={[tableStyles.actionButton, { backgroundColor: colors.info + '20' }]}
              onPress={() => navigation.navigate('WelfareDetails', { fundId: item.id, chamaId: currentChamaId })}
            >
              <Ionicons name="eye" size={14} color={colors.info} />
            </TouchableOpacity>
            {canDisburseWelfare() && item.status === 'approved' && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.success + '20' }]}
                onPress={() => handleDisburse(item)}
              >
                <Ionicons name="cash" size={14} color={colors.success} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="heart" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Welfare Funds Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {selectedFilter === 'all'
          ? 'No welfare funds have been approved yet'
          : `No welfare funds with status "${selectedFilter}" found`
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
              <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Member & Purpose</Text>
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
            data={welfareFunds}
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
          {canDisburseWelfare() && welfareFunds.filter(fund => fund.status === 'approved').length > 0 && (
            <View style={styles.bulkActions}>
              <Button
                title={`Bulk Disburse (${welfareFunds.filter(fund => fund.status === 'approved').length} approved funds)`}
                onPress={handleBulkDisburse}
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

      {/* Disburse Modal */}
      <Modal
        visible={showDisburseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDisburseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Disburse Welfare Fund
              </Text>
              <TouchableOpacity
                onPress={() => setShowDisburseModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedFund && (
                <View>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    {selectedFund.memberName} - {formatCurrency(selectedFund.amount)}
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Amount to Disburse (KES) *
                    </Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={disburseForm.amount}
                      onChangeText={(text) => setDisburseForm(prev => ({ ...prev, amount: text }))}
                      placeholder="Enter disbursement amount"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Description *
                    </Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={disburseForm.description}
                      onChangeText={(text) => setDisburseForm(prev => ({ ...prev, description: text }))}
                      placeholder="Enter disbursement description"
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
                      value={disburseForm.privateNote}
                      onChangeText={(text) => setDisburseForm(prev => ({ ...prev, privateNote: text }))}
                      placeholder="Optional note for audit purposes"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  <View style={styles.modalActions}>
                    <Button
                      title="Cancel"
                      onPress={() => setShowDisburseModal(false)}
                      style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                    />
                    <Button
                      title="Disburse"
                      onPress={submitDisbursement}
                      style={{ backgroundColor: colors.success }}
                      disabled={!disburseForm.amount || !disburseForm.description}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
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
                Bulk Welfare Disbursement
              </Text>
              <TouchableOpacity
                onPress={() => setShowBulkDisburseModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Disburse welfare funds to {bulkDisburseData.selectedFunds.length} approved members
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Description *
                </Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={bulkDisburseData.description}
                  onChangeText={(text) => setBulkDisburseData(prev => ({ ...prev, description: text }))}
                  placeholder="Enter bulk disbursement description"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.bulkSummary}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>
                  Disbursement Summary
                </Text>
                {bulkDisburseData.selectedFunds.map((fund, index) => (
                  <View key={fund.id} style={styles.summaryItem}>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                      {index + 1}. {fund.requester_name || fund.memberName || 'Unknown'}
                    </Text>
                    <Text style={[styles.summaryAmount, { color: colors.success }]}>
                      {formatCurrency(fund.amount)}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalSummary}>
                  <Text style={[styles.totalText, { color: colors.text }]}>
                    Total Amount:
                  </Text>
                  <Text style={[styles.totalAmount, { color: colors.success }]}>
                    {formatCurrency(bulkDisburseData.selectedFunds.reduce((sum, fund) => sum + (fund.amount || 0), 0))}
                  </Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowBulkDisburseModal(false)}
                  style={{ backgroundColor: colors.textSecondary, marginRight: spacing.sm }}
                />
                <Button
                  title="Disburse All"
                  onPress={submitBulkDisbursement}
                  style={{ backgroundColor: colors.warning }}
                  disabled={!bulkDisburseData.description}
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

export default WelfareDisbursementScreen;