import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';
import ReceiptService from '../../../services/receiptService';

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
    flex: 2.5,
    alignItems: 'flex-start',
  },
  amountCell: {
    flex: 1.2,
  },
  dateCell: {
    flex: 1.5,
  },
  typeCell: {
    flex: 1,
  },
  actionsCell: {
    flex: 0.8,
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
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const createHeaderStyles = (colors, spacing, typography, borderRadius) => ({
  viewModeContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewModeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
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
    minWidth: 80,
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
});

const ChamaTransactionsScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const {
    currentChamaId,
    selectedChama,
    canViewGroupRecords
  } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const headerStyles = createHeaderStyles(colors, spacing, typography, borderRadius);

  // State variables
  const [transactions, setTransactions] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [viewMode, setViewMode] = useState('personal'); // 'personal' or 'group'
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filters = [
    { id: 'all', name: 'All Records', icon: 'list' },
    { id: 'contribution', name: 'Contributions', icon: 'add-circle' },
    { id: 'welfare', name: 'Welfare', icon: 'heart' },
    { id: 'merry-go-round', name: 'Merry-Go-Round', icon: 'refresh-circle' },
    { id: 'loan', name: 'Loans', icon: 'card' },
    { id: 'withdrawal', name: 'Withdrawals', icon: 'remove-circle' },
    { id: 'penalty', name: 'Penalties', icon: 'warning' },
  ];

  // Apply role-based filtering to determine what user can see
  const applyRoleBasedFiltering = (allData) => {
    const isLeader = canViewGroupRecords();
    const shouldShowGroupData = isLeader && viewMode === 'group';

    if (shouldShowGroupData) {
      // Leadership in group view: show ALL records
      console.log('👑 Leadership group view: showing all', allData.length, 'records');
      return allData;
    } else {
      // Personal view OR regular member: show personal + group welfare/merry-go-round
      const filteredData = allData.filter(item => {
        // User's own transactions/contributions - check all possible field names
        const isUserRecord = item.initiatedBy === user.id ||
                             item.initiated_by === user.id ||
                             item.user_id === user.id ||
                             item.userId === user.id ||
                             item.contributed_by === user.id ||
                             item.member_id === user.id ||
                             item.memberId === user.id;

        // Group welfare and merry-go-round are visible to all members
        const isGroupVisible = ['welfare', 'merry-go-round'].includes(item.type?.toLowerCase());

        return isUserRecord || isGroupVisible;
      });

      console.log('👤 Personal/member view: showing', filteredData.length, 'of', allData.length, 'records');
      return filteredData;
    }
  };

  useEffect(() => {
    if (currentChamaId) {
      loadInitialData();
    }
  }, [currentChamaId]);

  useEffect(() => {
    if (currentChamaId) {
      loadTransactions();
    }
  }, [currentChamaId, selectedFilter, viewMode, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, viewMode]);

  // Separate effect for view mode changes to re-filter existing data
  useEffect(() => {
    if (allRecords.length > 0) {
      console.log('🔄 View mode changed to:', viewMode, '- Re-filtering data');
      const filteredData = applyRoleBasedFiltering(allRecords);

      // Apply selected filter
      let finalData = filteredData;
      if (selectedFilter !== 'all') {
        finalData = filteredData.filter(item =>
          item.type?.toLowerCase() === selectedFilter.toLowerCase() ||
          item.transaction_type?.toLowerCase() === selectedFilter.toLowerCase()
        );
      }

      setTransactions(finalData);
      console.log('📊 Re-filtered to', finalData.length, 'records');
    }
  }, [viewMode, selectedFilter]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Initial data loading is now handled by ChamaContext
      // Load chama members for proper name resolution in receipts
      await loadChamaMembers();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);

      let allData = [];

      // Fetch paginated chama transactions (15 items per page)
      console.log('🔍 Fetching paginated transactions for chama:', currentChamaId);
      const offset = (currentPage - 1) * itemsPerPage;
      const transactionResponse = await ApiService.getChamaTransactions(currentChamaId, itemsPerPage, offset);
      if (transactionResponse.success) {
        const transactionData = transactionResponse.data || [];
        console.log('📊 Fetched transactions:', transactionData.length);
        allData = [...allData, ...transactionData];
      }

      // Fetch paginated chama contributions
      try {
        const contributionResponse = await ApiService.getContributions(currentChamaId, itemsPerPage, offset);
        if (contributionResponse.success) {
          const contributionData = contributionResponse.data || [];

          // Debug merry-go-round contributions specifically
          const merryGoRoundContributions = contributionData.filter(item =>
            item.type === 'merry-go-round' || item.transaction_type === 'merry-go-round'
          );
          if (merryGoRoundContributions.length > 0) {
            merryGoRoundContributions.forEach((item, index) => {
            });
          }

          allData = [...allData, ...contributionData];
        }
      } catch (error) {
        console.warn('Contributions API not available:', error);
      }

      // Fetch paginated welfare transactions/contributions
      try {
        const welfareResponse = await ApiService.getWelfareRequests(currentChamaId, itemsPerPage, offset);
        if (welfareResponse.success) {
          const welfareData = welfareResponse.data || [];
          // Add welfare data with proper type
          const welfareTransactions = welfareData.map(item => ({
            ...item,
            type: 'welfare',
            transaction_type: 'welfare'
          }));
          allData = [...allData, ...welfareTransactions];
        }
      } catch (error) {
        console.warn('Welfare API not available:', error);
      }
      // Fetch paginated loan data
      try {
        const loanResponse = await ApiService.getLoans(currentChamaId, itemsPerPage, offset);
        if (loanResponse.success) {
          const loanData = loanResponse.data || [];
          // Add loan data with proper type
          const loanTransactions = loanData.map(item => ({
            ...item,
            type: 'loan',
            transaction_type: 'loan'
          }));
          allData = [...allData, ...loanTransactions];
        }
      } catch (error) {
        console.warn('Loan API not available:', error);
      }
      // Store all data for role-based filtering
      setAllRecords(allData);

      // Apply role-based filtering for display
      const filteredData = applyRoleBasedFiltering(allData);

      // Apply selected filter
      let finalData = filteredData;
      if (selectedFilter !== 'all') {
        finalData = filteredData.filter(item =>
          item.type?.toLowerCase() === selectedFilter.toLowerCase() ||
          item.transaction_type?.toLowerCase() === selectedFilter.toLowerCase()
        );
      }

      setTransactions(finalData);

    } catch (error) {
      console.error('Error loading transactions:', error);
      Alert.alert('Error', 'Failed to load transaction data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions(); // This now loads all data
    setRefreshing(false);
  };

  // Load chama members for member selector (leadership only)
  const loadChamaMembers = async () => {
    try {
      const response = await ApiService.getChamaMembers(currentChamaId);
      if (response.success) {
        setChamaMembers(response.data || []);
      }
    } catch (error) {
      console.warn('Failed to load chama members:', error);
    }
  };

  // Enhanced download functions with professional formatting
  const handleDownload = async (format, scope = 'personal', memberId = null) => {
    try {
      setExportLoading(true);

      // Determine what data to include
      let dataToExport = [];
      let reportTitle = '';
      let memberName = '';

      console.log('🔍 Download data check:', {
        scope,
        allRecordsCount: allRecords?.length || 0,
        transactionsCount: transactions?.length || 0,
        canViewGroupRecords: canViewGroupRecords(),
        memberId
      });

      if (scope === 'all' && canViewGroupRecords()) {
        // Leadership downloading all chama records
        dataToExport = allRecords || [];
        reportTitle = `${selectedChama?.name || 'Chama'} - Complete Transaction Report`;
      } else if (scope === 'member' && canViewGroupRecords() && memberId) {
        // Leadership downloading specific member's records
        const member = chamaMembers.find(m => m.user_id === memberId || m.id === memberId);
        memberName = member?.name || member?.user?.name || 'Unknown Member';
        dataToExport = (allRecords || []).filter(record =>
          record.user_id === memberId ||
          record.initiated_by === memberId ||
          record.contributed_by === memberId ||
          record.member_id === memberId
        );
        reportTitle = `${selectedChama?.name || 'Chama'} - ${memberName} Transaction Report`;
      } else {
        // Personal records (default for members)
        dataToExport = transactions || []; // Already filtered for user
        reportTitle = `${selectedChama?.name || 'Chama'} - Personal Transaction Report`;
      }

      if (dataToExport.length === 0) {
        Alert.alert(
          'No Data',
          'No transaction records found for the selected scope. Please ensure there are transactions to export.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Group data by type for better organization
      const groupedData = groupTransactionsByType(dataToExport);

      // Generate document based on format
      let result;
      switch (format) {
        case 'pdf':
          result = await ReceiptService.generateChamaTransactionsPDF({
            title: reportTitle,
            chamaName: selectedChama?.name || 'Chama',
            memberName: memberName,
            groupedData,
            allData: dataToExport,
            generatedBy: user?.name || 'User',
            scope,
            dateRange: getDateRange(dataToExport),
            chamaMembers: chamaMembers // Pass chama members for proper name resolution
          });
          break;
        case 'excel':
          result = await ReceiptService.generateChamaTransactionsExcel({
            title: reportTitle,
            chamaName: selectedChama?.name || 'Chama',
            memberName: memberName,
            groupedData,
            allData: dataToExport,
            generatedBy: user?.name || 'User',
            scope,
            chamaMembers: chamaMembers // Pass chama members for proper name resolution
          });
          break;
        case 'word':
          result = await ReceiptService.generateChamaTransactionsWord({
            title: reportTitle,
            chamaName: selectedChama?.name || 'Chama',
            memberName: memberName,
            groupedData,
            allData: dataToExport,
            generatedBy: user?.name || 'User',
            scope,
            chamaMembers: chamaMembers // Pass chama members for proper name resolution
          });
          break;
        default:
          throw new Error('Unsupported format');
      }

      if (result.success) {
        Alert.alert(
          'Download Complete',
          `${format.toUpperCase()} report has been saved successfully.`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(result.error || 'Download failed');
      }

    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(
        'Download Failed',
        error.message || 'Failed to generate report. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setExportLoading(false);
      setShowExportModal(false);
    }
  };

  // Helper function to group transactions by type
  const groupTransactionsByType = (data) => {
    const grouped = {
      contributions: [],
      welfare: [],
      'merry-go-round': [],
      loans: [],
      withdrawals: [],
      penalties: [],
      other: []
    };

    data.forEach(item => {
      const type = item.type?.toLowerCase() || item.transaction_type?.toLowerCase() || 'other';
      if (grouped[type]) {
        grouped[type].push(item);
      } else {
        grouped.other.push(item);
      }
    });

    return grouped;
  };

  // Helper function to get date range from data
  const getDateRange = (data) => {
    if (data.length === 0) return { start: new Date(), end: new Date() };

    const dates = data.map(item => new Date(item.created_at || item.date || Date.now()));
    return {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates))
    };
  };

  // Export functions (legacy - for simple export without scope selection)
  const handleExport = async (format) => {
    if (!canViewGroupRecords() && viewMode === 'group') {
      Alert.alert('Access Denied', 'Only chairperson, secretary, and treasurer can export group records.');
      return;
    }

    setExportLoading(true);
    try {
      const dataToExport = allRecords.length > 0 ? allRecords : transactions;

      if (dataToExport.length === 0) {
        Alert.alert('No Data', 'No records available to export.');
        return;
      }

      // Use the new download method with proper scope
      const scope = canViewGroupRecords() && viewMode === 'group' ? 'all' : 'personal';
      const result = await handleDownload(format, scope);

      if (result !== false) { // handleDownload handles success/error internally
        setShowExportModal(false);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export records');
    } finally {
      setExportLoading(false);
    }
  };

  // Individual transaction receipt download
  const handleIndividualReceipt = async (transaction, format = 'pdf') => {
    try {
      setExportLoading(true);

      const result = await ReceiptService.generateTransactionReceipt(transaction, format, {
        chamaName: selectedChama?.name || 'Chama',
        userInfo: {
          name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'User',
          email: user?.email || '',
          phone: user?.phone || ''
        },
        chamaMembers: chamaMembers // Pass chama members for proper name resolution
      });

      if (result.success) {
        Alert.alert(
          'Receipt Generated',
          `Transaction receipt has been saved successfully.`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(result.error || 'Failed to generate receipt');
      }

    } catch (error) {
      console.error('Individual receipt error:', error);
      Alert.alert(
        'Receipt Failed',
        error.message || 'Failed to generate transaction receipt. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setExportLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    // Handle null, undefined, or invalid amounts
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'KES 0';
    }
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Enhanced function to format user name as first name + first letter of second name
  const formatUserName = (fullName) => {
    if (!fullName || fullName === 'Unknown Member') return fullName;

    const nameParts = fullName.trim().split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0]} ${nameParts[1].charAt(0)}.`;
    }
    return nameParts[0]; // If only one name, return as is
  };

  // Enhanced function to get transaction user name with proper fallback logic
  const getTransactionUserName = (item) => {
    // Handle anonymous transactions
    if (item.metadata?.isAnonymous || item.metadata?.displayName === 'Anonymous') {
      return 'Anonymous';
    }

    // For cash/cheque contributions, try to get the contributor's name from metadata
    if ((item.paymentMethod === 'cash' || item.paymentMethod === 'cheque') && item.metadata?.contributorId) {
      // Find the contributor in chama members
      const contributor = chamaMembers.find(member =>
        member.id === item.metadata.contributorId ||
        member.user_id === item.metadata.contributorId
      );

      if (contributor) {
        const firstName = contributor.first_name || contributor.user?.first_name || '';
        const lastName = contributor.last_name || contributor.user?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || contributor.name || contributor.user?.name || 'Unknown Member';
      }
    }

    // For merry-go-round contributions, check if we have participant info
    if (item.type === 'merry-go-round' || item.transaction_type === 'merry-go-round') {
      // Check if we have participant information in the item
      if (item.participant) {
        const participant = item.participant;
        const firstName = participant.first_name || participant.user?.first_name || '';
        const lastName = participant.last_name || participant.user?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) {
          return fullName;
        }
      }

      // Check metadata for merry-go-round specific info
      if (item.metadata?.participantId) {
        const participant = chamaMembers.find(member =>
          member.id === item.metadata.participantId ||
          member.user_id === item.metadata.participantId
        );
        if (participant) {
          const firstName = participant.first_name || participant.user?.first_name || '';
          const lastName = participant.last_name || participant.user?.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim();
          if (fullName) {
            return fullName;
          }
        }
      }
    }

    // Fallback to standard user fields
    const firstName = item.user?.firstName || item.user?.first_name || '';
    const lastName = item.user?.lastName || item.user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    // If we have a full name, return it
    if (fullName) {
      return fullName;
    }

    // Try other common user name fields, but avoid using description as name
    const userName = item.user?.name ||
                     item.user?.fullName ||
                     item.user?.displayName ||
                     item.name ||
                     item.fullName ||
                     item.displayName;

    // Don't use description field as it might contain things like "for us only"
    if (userName && userName !== item.description) {
      return userName;
    }

    return 'Unknown Member';
  };

  // Enhanced function to get transaction amount with proper fallback logic
  const getTransactionAmount = (item) => {
    // For merry-go-round contributions, try specific fields first
    if (item.type === 'merry-go-round' || item.transaction_type === 'merry-go-round') {
      let amount = item.amount ||
                   item.transaction_amount ||
                   item.total_amount ||
                   item.contribution_amount ||
                   item.merry_go_round_amount ||
                   item.amount_per_round ||
                   0;

      // If amount is still 0, try to get it from metadata
      if (amount === 0 && item.metadata) {
        amount = item.metadata.amount ||
                 item.metadata.transaction_amount ||
                 item.metadata.contribution_amount ||
                 item.metadata.merry_go_round_amount ||
                 0;
      }

      // If still 0, this might be a configuration record, not a contribution
      if (amount === 0) {
        console.warn('Merry-go-round transaction has zero amount:', item.id, item);
        return 0;
      }

      // Handle string amounts that might need parsing
      if (typeof amount === 'string') {
        amount = amount.replace(/[KES,\s]/g, '');
        amount = parseFloat(amount);
      }

      if (isNaN(amount) || amount === null || amount === undefined) {
        console.warn('Invalid merry-go-round amount:', amount, 'for transaction:', item.id);
        return 0;
      }

      return Math.abs(amount);
    }

    // For regular contributions, try standard fields
    let amount = item.amount || item.transaction_amount || item.total_amount || 0;

    // Handle string amounts that might need parsing
    if (typeof amount === 'string') {
      // Remove any currency symbols and commas
      amount = amount.replace(/[KES,\s]/g, '');
      amount = parseFloat(amount);
    }

    // Ensure it's a valid number
    if (isNaN(amount) || amount === null || amount === undefined) {
      console.warn('Invalid transaction amount:', item.amount, 'for transaction:', item.id);
      return 0;
    }

    return Math.abs(amount); // Ensure positive amount for display
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'contribution':
        return 'add-circle';
      case 'withdrawal':
        return 'remove-circle';
      case 'loan':
        return 'card';
      case 'expense':
        return 'receipt';
      default:
        return 'swap-horizontal';
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'contribution':
        return colors.success;
      case 'withdrawal':
        return colors.warning;
      case 'loan':
        return colors.info;
      case 'expense':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const renderFilterChips = () => (
    <View style={styles.filtersContainer}>
      <FlatList
        horizontal
        data={filters}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedFilter === item.id ? colors.primary : colors.backgroundSecondary,
                borderColor: colors.border,
              }
            ]}
            onPress={() => setSelectedFilter(item.id)}
          >
            <Ionicons 
              name={item.icon} 
              size={16} 
              color={selectedFilter === item.id ? colors.white : colors.textSecondary} 
            />
            <Text style={[
              styles.filterText,
              { color: selectedFilter === item.id ? colors.white : colors.textSecondary }
            ]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
      />
    </View>
  );

  // Get current page transactions (already paginated from backend)
  const getCurrentPageTransactions = () => {
    return transactions;
  };

  const renderTableRow = ({ item, index }) => {
    const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

    return (
      <View style={[tableStyles.tableRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Name/User Column */}
        <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
          <View style={tableStyles.nameContainer}>
            <View style={[tableStyles.typeIcon, { backgroundColor: getTransactionColor(item.type) + '20' }]}>
              <Ionicons
                name={getTransactionIcon(item.type)}
                size={12}
                color={getTransactionColor(item.type)}
              />
            </View>
            <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
              {(item.metadata?.isAnonymous || item.metadata?.displayName === 'Anonymous')
                ? 'Anonymous'
                : formatUserName(getTransactionUserName(item))
              }
            </Text>
          </View>
        </View>

        {/* Description Column */}
        <View style={[tableStyles.tableCell, { flex: 2 }]}>
          <Text style={tableStyles.tableCellText} numberOfLines={2}>
            {(item.description || `${item.type} Transaction`).length > 6
              ? (item.description || `${item.type} Transaction`).substring(0, 6) + '...'
              : (item.description || `${item.type} Transaction`)
            }
          </Text>
        </View>

        {/* Amount Column */}
        <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
          <Text style={[
            tableStyles.tableCellText,
            {
              color: item.type === 'contribution' ? colors.success :
                    item.type === 'withdrawal' ? colors.warning : colors.text,
              fontWeight: typography.fontWeight.medium
            }
          ]}>
            {item.type === 'contribution' ? '+' : '-'}{formatCurrency(getTransactionAmount(item))}
          </Text>
        </View>

        {/* Date Column */}
        <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
          <Text style={tableStyles.tableCellText}>
            {formatDate(item.createdAt || item.created_at)}
          </Text>
        </View>

        {/* Type Column */}
        <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
          <View style={[tableStyles.statusBadge, { backgroundColor: getTransactionColor(item.type) + '20' }]}>
            <Text style={[tableStyles.statusText, { color: getTransactionColor(item.type) }]}>
              {item.type?.toUpperCase().length > 5
                ? item.type?.toUpperCase().substring(0, 5) + '...'
                : item.type?.toUpperCase()
              }
            </Text>
          </View>
        </View>

        {/* Actions Column */}
        <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
          <TouchableOpacity
            style={[tableStyles.actionButton, { backgroundColor: colors.primary + '20' }]}
            onPress={() => handleIndividualReceipt(item)}
            disabled={exportLoading}
          >
            <Ionicons
              name="receipt-outline"
              size={12}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Transactions Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {selectedFilter === 'all' 
          ? 'No transactions have been made yet'
          : `No ${selectedFilter} transactions found`
        }
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      <View style={styles.headerContent}>
        {/* Personal/Group Toggle Buttons */}
        <View style={headerStyles.viewModeContainer}>
          <TouchableOpacity
            style={[
              headerStyles.viewModeButton,
              viewMode === 'personal' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setViewMode('personal')}
          >
            <Ionicons
              name="person"
              size={16}
              color={viewMode === 'personal' ? colors.white : colors.textSecondary}
            />
            <Text style={[
              headerStyles.viewModeText,
              { color: viewMode === 'personal' ? colors.white : colors.textSecondary }
            ]}>
              Personal
            </Text>
          </TouchableOpacity>

          {canViewGroupRecords() && (
            <TouchableOpacity
              style={[
                headerStyles.viewModeButton,
                viewMode === 'group' && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => setViewMode('group')}
            >
              <Ionicons
                name="people"
                size={16}
                color={viewMode === 'group' ? colors.white : colors.textSecondary}
              />
              <Text style={[
                headerStyles.viewModeText,
                { color: viewMode === 'group' ? colors.white : colors.textSecondary }
              ]}>
                Group
              </Text>
            </TouchableOpacity>
          )}
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

  // Show loading or error state if no chama is selected
  if (!currentChamaId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <Ionicons name="business" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Chama Selected
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Please select a chama from the dashboard to view transactions
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, overflow: 'visible' }]}>
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
              <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>User</Text>
            </View>
            <View style={[tableStyles.tableCell, { flex: 2 }]}>
              <Text style={tableStyles.tableHeaderText}>Description</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Amount</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
              <Text style={tableStyles.tableHeaderText}>Date</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.typeCell]}>
              <Text style={tableStyles.tableHeaderText}>Type</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.actionsCell]}>
              <Text style={tableStyles.tableHeaderText}>Action</Text>
            </View>
          </View>

          {/* Table Body */}
          <FlatList
            data={getCurrentPageTransactions()}
            renderItem={renderTableRow}
            keyExtractor={(item) => item.id}
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
          {transactions.length > itemsPerPage && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? colors.textSecondary : colors.text} />
              </TouchableOpacity>
              <Text style={[styles.pageText, { color: colors.text }]}>
                {currentPage} of {Math.ceil(transactions.length / itemsPerPage)}
              </Text>
              <TouchableOpacity
                style={[styles.pageButton, currentPage === Math.ceil(transactions.length / itemsPerPage) && styles.pageButtonDisabled]}
                onPress={() => currentPage < Math.ceil(transactions.length / itemsPerPage) && setCurrentPage(currentPage + 1)}
                disabled={currentPage === Math.ceil(transactions.length / itemsPerPage)}
              >
                <Ionicons name="chevron-forward" size={16} color={currentPage === Math.ceil(transactions.length / itemsPerPage) ? colors.textSecondary : colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Export Modal */}
        <Modal
          visible={showExportModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowExportModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Export Records
                </Text>
                <TouchableOpacity
                  onPress={() => setShowExportModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Choose export format for {transactions.length} records
              </Text>

              <View style={styles.exportOptions}>
                <TouchableOpacity
                  style={[styles.exportOption, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => handleExport('pdf')}
                  disabled={exportLoading}
                >
                  <Ionicons name="document-text" size={24} color={colors.error} />
                  <Text style={[styles.exportOptionText, { color: colors.text }]}>
                    PDF Report
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: colors.textSecondary }]}>
                    Professional formatted report
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.exportOption, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => handleExport('excel')}
                  disabled={exportLoading}
                >
                  <Ionicons name="grid" size={24} color={colors.success} />
                  <Text style={[styles.exportOptionText, { color: colors.text }]}>
                    Excel Spreadsheet
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: colors.textSecondary }]}>
                    Data analysis and calculations
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.exportOption, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => handleExport('word')}
                  disabled={exportLoading}
                >
                  <Ionicons name="document" size={24} color={colors.info} />
                  <Text style={[styles.exportOptionText, { color: colors.text }]}>
                    Word Document
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: colors.textSecondary }]}>
                    Editable document format
                  </Text>
                </TouchableOpacity>
              </View>

              {exportLoading && (
                <View style={styles.loadingContainer}>
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Generating export...
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Member Selector Modal */}
        <Modal
          visible={showMemberSelector}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowMemberSelector(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Member
                </Text>
                <TouchableOpacity
                  onPress={() => setShowMemberSelector(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Choose a member to download their transaction records
              </Text>

              <FlatList
                data={chamaMembers}
                keyExtractor={(item) => item.id || item.user_id}
                renderItem={({ item }) => {
                  const memberName = item.name || item.user?.name || `${item.user?.first_name || ''} ${item.user?.last_name || ''}`.trim() || 'Unknown Member';
                  const memberEmail = item.email || item.user?.email || '';

                  return (
                    <TouchableOpacity
                      style={[styles.memberOption, { borderColor: colors.border }]}
                      onPress={() => {
                        setSelectedMember(item.user_id || item.id);
                        setShowMemberSelector(false);
                      }}
                    >
                      <View style={styles.memberInfo}>
                        <View style={[styles.memberAvatar, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.memberAvatarText, { color: colors.white }]}>
                            {memberName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.memberDetails}>
                          <Text style={[styles.memberName, { color: colors.text }]}>
                            {memberName}
                          </Text>
                          {memberEmail && (
                            <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                              {memberEmail}
                            </Text>
                          )}
                          <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                            {item.role || 'Member'}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                }}
                style={styles.memberList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>

      {/* Filter Dropdown - Rendered at root level for proper z-index */}
      {showFilterDropdown && (
        <View style={[headerStyles.dropdownContainer, {
          position: 'absolute',
          top: 140, // Approximate position below header
          right: 20, // Position from right edge
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
                setCurrentPage(1); // Reset to first page when filter changes
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
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
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
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  exportText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  filtersContainer: {
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
  },
  filtersContent: {
    paddingHorizontal: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    borderWidth: 1,
  },
  filterText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  transactionsList: {
    padding: spacing.md,
  },
  transactionCard: {
    marginBottom: spacing.md,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  transactionDate: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  transactionUser: {
    fontSize: typography.fontSize.xs,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  transactionType: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xl,
  },
  exportOptions: {
    gap: spacing.md,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  exportOptionText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  exportOptionDesc: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    fontStyle: 'italic',
  },
  // Enhanced modal styles
  scopeSection: {
    marginBottom: spacing.lg,
  },
  formatSection: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  scopeOption: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  scopeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scopeOptionText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  scopeOptionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  scopeOptionSubtitle: {
    fontSize: typography.fontSize.sm,
  },
  // Member selector styles
  memberList: {
    maxHeight: 300,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  memberDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  memberName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  memberEmail: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  memberRole: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  // Individual receipt button styles
  receiptButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  // Pagination styles
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pageButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
});

export default ChamaTransactionsScreen;
