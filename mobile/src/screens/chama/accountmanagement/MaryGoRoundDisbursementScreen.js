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

const MaryGoRoundDisbursementScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  // State variables
  const [maryGoRoundCycles, setMaryGoRoundCycles] = useState([]);
  const [allMaryGoRoundCycles, setAllMaryGoRoundCycles] = useState([]);
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
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [showBulkDisburseModal, setShowBulkDisburseModal] = useState(false);
  const [disburseForm, setDisburseForm] = useState({
    amount: '',
    description: '',
    privateNote: '',
  });
  const [bulkDisburseData, setBulkDisburseData] = useState({
    selectedCycles: [],
    description: '',
  });

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
      // When searching, filter from all data and show paginated results
      const filteredData = filterMaryGoRoundCyclesData(allMaryGoRoundCycles, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setMaryGoRoundCycles(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
    } else {
      // When not searching, use server-side pagination
      loadMaryGoRoundCycles(currentPage);
    }
  }, [currentPage, selectedFilter]);

  useEffect(() => {
    if (searchQuery.trim()) {
      // Trigger search filtering
      const filteredData = filterMaryGoRoundCyclesData(allMaryGoRoundCycles, searchQuery, selectedFilter);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setMaryGoRoundCycles(filteredData.slice(startIndex, endIndex));
      setTotalItems(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / pageSize));
      setCurrentPage(1); // Reset to first page when searching
    } else {
      // Clear search and reload with pagination
      loadMaryGoRoundCycles(1);
      setCurrentPage(1);
    }
  }, [searchQuery]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUserRole(),
        loadMaryGoRoundCycles(),
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

  const loadMaryGoRoundCycles = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const offset = (page - 1) * pageSize;
      const response = await ApiService.getMerryGoRounds(currentChamaId, pageSize, offset);

      if (response.success) {
        let cyclesData = response.data || [];

        // Enrich cycles with recipient user information (similar to loans)
        const enrichedCycles = await Promise.all(
          cyclesData.map(async (cycle) => {
            try {
              // Find the current recipient based on round position
              const participants = cycle.members || cycle.participants || [];
              const currentPosition = cycle.current_position || cycle.currentRound || 1;
              const currentRecipient = participants[currentPosition - 1];

              if (currentRecipient) {
                const userId = currentRecipient.user_id || currentRecipient.user?.id || currentRecipient.id;
                if (userId) {
                  console.log(`🔍 Enriching cycle ${cycle.id} with recipient user ID: ${userId}`);
                  const userResponse = await ApiService.makeRequest(`/users/${userId}`);
                  console.log(`🔍 User response for recipient ${userId}:`, userResponse);

                  if (userResponse.success && userResponse.data) {
                    const userData = userResponse.data;
                    const fullName = `${userData.firstName || userData.first_name || ''} ${userData.lastName || userData.last_name || ''}`.trim();
                    console.log(`✅ Enriched cycle ${cycle.id} with recipient: ${fullName}`);

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

              // Return cycle with placeholder recipient data
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
              console.warn(`❌ Failed to enrich cycle ${cycle.id}:`, error);
              return {
                ...cycle,
                recipientId: cycle.recipientId,
                recipientName: cycle.recipientName || 'Unknown Recipient',
              };
            }
          })
        );

        setMaryGoRoundCycles(enrichedCycles);

        // For search functionality, if searching, load all data
        if (search.trim()) {
          const allResponse = await ApiService.getMerryGoRounds(currentChamaId, 1000, 0); // Load more for search
          if (allResponse.success) {
            let allCyclesData = allResponse.data || [];

            // Enrich all cycles data as well
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
            // Calculate pagination info from all data
            const filteredData = filterMaryGoRoundCyclesData(enrichedAllCycles, search, selectedFilter);
            setTotalItems(filteredData.length);
            setTotalPages(Math.ceil(filteredData.length / pageSize));
          }
        } else {
          setAllMaryGoRoundCycles(enrichedCycles);
          // Use pagination info from API if available, otherwise estimate
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

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(cycle =>
        cycle.status?.toLowerCase().replace(' ', '_') === filter.toLowerCase()
      );
    }

    // Apply search filter
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMaryGoRoundCycles();
    setRefreshing(false);
  };

  const getStatusColor = (item) => {
    // Determine status based on round position and participants
    const participants = item.members || item.participants || [];
    const totalParticipants = participants.length || item.total_participants || 0;
    const currentPosition = item.current_position || item.currentRound || 1;
    const roundComplete = item.roundComplete || false;

    if (roundComplete || currentPosition > totalParticipants) {
      return colors.primary; // Completed
    } else if (currentPosition >= 1) {
      return colors.success; // Ready for disbursement
    }
    return colors.textSecondary; // Default
  };

  const getStatusText = (item) => {
    // Determine status text based on round position and participants
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

  const handleDisburse = (cycle) => {
    if (!canDisburseMaryGoRound()) {
      Alert.alert('Access Denied', 'You do not have permission to disburse merry go round funds.');
      return;
    }
    setSelectedCycle(cycle);
    setDisburseForm({
      amount: cycle.amount?.toString() || cycle.totalAmount?.toString() || '',
      description: `Merry Go Round disbursement - ${cycle.name || `Cycle ${cycle.cycleNumber || cycle.currentRound || 1}`}} to ${cycle.recipientName || cycle.recipient?.name || 'recipient'}`,
      privateNote: '',
    });
    setShowDisburseModal(true);
  };

  const handleBulkDisburse = () => {
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

  const submitDisbursement = async () => {
    if (!selectedCycle) return;

    try {
      const disbursementData = {
        cycleId: selectedCycle.id,
        recipientId: selectedCycle.recipientId || selectedCycle.recipient?.id,
        recipientName: selectedCycle.recipientName || selectedCycle.recipient?.name || 'Unknown',
        cycleNumber: selectedCycle.cycleNumber || selectedCycle.currentRound || 1,
        amount: parseFloat(disburseForm.amount),
        description: disburseForm.description,
        privateNote: disburseForm.privateNote,
        disbursedBy: userRole,
        disbursedById: user.id,
        timestamp: new Date().toISOString(),
      };

      const response = await ApiService.disburseMaryGoRoundCycle(currentChamaId, disbursementData);

      if (response.success) {
        Alert.alert('Success', 'Merry go round disbursement processed successfully.');
        setShowDisburseModal(false);
        await loadMaryGoRoundCycles();
      } else {
        Alert.alert('Error', response.error || 'Failed to process disbursement.');
      }
    } catch (error) {
      console.error('Disbursement error:', error);
      Alert.alert('Error', 'Failed to process disbursement. Please try again.');
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

      const response = await ApiService.bulkDisburseMaryGoRoundCycles(currentChamaId, bulkData);

      if (response.success) {
        Alert.alert('Success', `Bulk disbursement completed for ${bulkDisburseData.selectedCycles.length} cycles.`);
        setShowBulkDisburseModal(false);
        await loadMaryGoRoundCycles();
      } else {
        Alert.alert('Error', response.error || 'Failed to process bulk disbursement.');
      }
    } catch (error) {
      console.error('Bulk disbursement error:', error);
      Alert.alert('Error', 'Failed to process bulk disbursement. Please try again.');
    }
  };

  const canDisburseMaryGoRound = () => {
    return ['treasurer', 'secretary', 'chairperson'].includes(userRole.toLowerCase());
  };

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Recipient Name */}
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
            {item.recipientName || item.recipient?.name || 'Unknown Recipient'}
          </Text>
          <Text style={[tableStyles.tableCellText, { fontSize: 7, color: colors.textSecondary }]}>
            {item.name || 'Merry Go Round'}
          </Text>
        </View>

        {/* Amount */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium }]}>
            {formatCurrency(item.amount_per_round || item.amountPerRound || item.amount || item.totalAmount || 0)}
          </Text>
        </View>

        {/* Round Info */}
        <View style={[tableStyles.tableCell, tableStyles.roundCell]}>
          <Text style={tableStyles.tableCellText}>
            {item.current_position || item.currentRound || item.cycleNumber || 1}
          </Text>
        </View>

        {/* Expected Date */}
        <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
          <Text style={tableStyles.tableCellText}>
            {formatDate(item.next_payout_date || item.nextPayoutDate || item.expectedDate || item.createdAt)}
          </Text>
        </View>

        {/* Actions */}
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <View style={tableStyles.actionButtons}>
            <TouchableOpacity
              style={[tableStyles.actionButton, { backgroundColor: colors.info + '20' }]}
              onPress={() => navigation.navigate('MaryGoRoundDetails', { cycleId: item.id, chamaId: currentChamaId })}
            >
              <Ionicons name="eye" size={14} color={colors.info} />
            </TouchableOpacity>
            {canDisburseMaryGoRound() && item.status?.toLowerCase().includes('ready') && (
              <TouchableOpacity
                style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
                onPress={() => handleDisburse(item)}
              >
                <Ionicons name="cash" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="refresh-circle" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Merry Go Round Cycles Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {selectedFilter === 'all'
          ? 'No merry go round cycles have been created yet'
          : `No cycles with status "${selectedFilter}" found`
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
            placeholder="Search recipient"
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
              <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Recipient & Cycle</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Amount</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.roundCell]}>
              <Text style={tableStyles.tableHeaderText}>Round</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
              <Text style={tableStyles.tableHeaderText}>Date</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
              <Text style={tableStyles.tableHeaderText}>Actions</Text>
            </View>
          </View>

          {/* Table Body */}
          <FlatList
            data={maryGoRoundCycles}
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
          {canDisburseMaryGoRound() && maryGoRoundCycles.filter(cycle => cycle.status?.toLowerCase().includes('ready')).length > 0 && (
            <View style={styles.bulkActions}>
              <Button
                title={`Bulk Disburse (${maryGoRoundCycles.filter(cycle => cycle.status?.toLowerCase().includes('ready')).length} ready cycles)`}
                onPress={handleBulkDisburse}
                style={{ backgroundColor: colors.primary }}
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
                Disburse Merry Go Round
              </Text>
              <TouchableOpacity
                onPress={() => setShowDisburseModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedCycle && (
                <View>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Cycle {selectedCycle.cycleNumber} - {selectedCycle.recipientName} - {formatCurrency(selectedCycle.amount)}
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Disbursement Amount (KES) *
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
                      style={{ backgroundColor: colors.primary }}
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
                Bulk Merry Go Round Disbursement
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
                Disburse merry go round funds for {bulkDisburseData.selectedCycles.length} ready cycles
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
                {bulkDisburseData.selectedCycles.map((cycle, index) => (
                  <View key={cycle.id} style={styles.summaryItem}>
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                      {index + 1}. {cycle.name || `Cycle ${cycle.cycleNumber || cycle.currentRound || 1}`} - {cycle.recipientName || cycle.recipient?.name}
                    </Text>
                    <Text style={[styles.summaryAmount, { color: colors.primary }]}>
                      {formatCurrency(cycle.amount)}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalSummary}>
                  <Text style={[styles.totalText, { color: colors.text }]}>
                    Total Disbursement:
                  </Text>
                  <Text style={[styles.totalAmount, { color: colors.primary }]}>
                    {formatCurrency(bulkDisburseData.selectedCycles.reduce((sum, cycle) => sum + (cycle.amount || 0), 0))}
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
                  style={{ backgroundColor: colors.primary }}
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

export default MaryGoRoundDisbursementScreen;