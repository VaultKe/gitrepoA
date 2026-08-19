import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import { getThemeColors } from '../utils/theme';
import {
  getMerryGoRounds,
  getMerryGoRoundPayments,
} from '../services/api/chamaEndpoints';
import {
  formatCurrency,
  formatDate,
  getTransactionUserName,
  getTransactionAmount,
  getTransactionIcon,
  getTransactionColor,
  getAmountColor,
  getShortTypeLabel,
  getShortDescription,
  getMemberName,
  getMemberEmail,
} from '../utils/transactionsHelpers';
import useChamaTransactionReceipts from './useChamaTransactionReceipts';

const useChamaTransactionsScreen = ({ navigation, route }) => {
  const { theme, user } = useApp();
  const { currentChamaId, selectedChama, canViewGroupRecords } = useChamaContext();
  const colors = getThemeColors(theme);
  const canViewGroup = canViewGroupRecords();

  const routeChamaId = route?.params?.chamaId;
  const chamaId = routeChamaId || currentChamaId;

  const [transactions, setTransactions] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [viewMode, setViewMode] = useState('personal');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  const {
    handleIndividualReceipt,
    handleBulkPrintReceipts,
    handleBulkShareReceipts,
    getReceiptId,
    getReceiptFileName,
    getReceiptBodyHTML,
    buildReceiptHTML,
    buildCombinedReceiptsHTML,
    printReceiptHTML,
    shareReceiptHTML,
    formatReportDate,
    formatReportAmount,
    formatSummaryAmount,
    formatReportType,
    getReportDescription,
    getReportValue,
    getReportNumericAmount,
    getReportNumericFees,
    isCompletedTransaction,
    escapeReportHTML,
  } = useChamaTransactionReceipts({
    selectedChama,
    chamaMembers,
    transactions,
    allRecords,
    exportLoading,
    setExportLoading,
    setShowExportModal,
  });

  const isPrivateTransaction = useCallback((item) => {
    return item?.privacy === 'private' ||
           item?.isPrivate === true ||
           item?.metadata?.privacy === 'private' ||
           item?.metadata?.isPrivate === true;
  }, []);

  const getUserRelatedIds = useCallback((item) => {
    return new Set([
      item?.id,
      item?.user_id,
      item?.userId,
      item?.initiatedBy,
      item?.initiated_by,
      item?.initiatedById,
      item?.initiated_by_id,
      item?.contributed_by,
      item?.contributedById,
      item?.contributed_by_id,
      item?.member_id,
      item?.memberId,
      item?.sender_id,
      item?.recipient_id,
      item?.createdBy,
      item?.created_by,
      item?.creator_id,
      item?.createdById,
      item?.user?.id,
      item?.user?.userId,
      item?.member?.user_id,
      item?.member?.id,
      item?.initiatedBy?.id,
      item?.initiatedBy?.user_id,
      item?.contributedBy?.id,
      item?.contributedBy?.user_id,
    ].filter(Boolean).map(String));
  }, []);

  const isUserTransaction = useCallback((item) => {
    if (!user?.id) return false;
    return getUserRelatedIds(item).has(String(user.id));
  }, [user?.id, getUserRelatedIds]);

  const applyRoleBasedFiltering = useCallback((allData) => {
    const isLeader = canViewGroupRecords();

    return allData.filter(item => {
      if (isPrivateTransaction(item)) {
        const initiatedBy = item.initiated_by || item.initiatedBy || item.user_id || item.userId;
        if (initiatedBy !== user?.id && !isLeader) {
          return false;
        }
      }
      return true;
    });
  }, [canViewGroupRecords, isPrivateTransaction, user?.id]);

  useEffect(() => {
    if (chamaId) {
      loadAllData();
    }
  }, [chamaId]);

  useEffect(() => {
    if (allRecords.length > 0) {
      const filteredData = applyRoleBasedFiltering(allRecords);
      let finalData = filteredData;

      if (selectedFilter !== 'all') {
        finalData = filteredData.filter(item =>
          item.type?.toLowerCase() === selectedFilter.toLowerCase() ||
          item.transaction_type?.toLowerCase() === selectedFilter.toLowerCase()
        );
      }

      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginatedData = finalData.slice(startIndex, startIndex + itemsPerPage);

      setTransactions(paginatedData);
    } else {
      setTransactions([]);
    }
  }, [allRecords, selectedFilter, currentPage, user?.id, applyRoleBasedFiltering]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, viewMode]);

  useEffect(() => {
    if (!user) {
      setAllRecords([]);
      setTransactions([]);
      setCurrentPage(1);
    }
  }, [user]);

  const loadChamaMembers = useCallback(async () => {
    try {
      const response = await ApiService.getChamaMembers(chamaId);
      if (response.success) {
        setChamaMembers(response.data || []);
      }
    } catch (error) {
      console.warn('Failed to load chama members:', error);
    }
  }, [chamaId]);

  const loadAllData = useCallback(async () => {
    try {
      setIsLoadingAll(true);
      setLoading(true);
      setAllRecords([]);
      setTransactions([]);
      setCurrentPage(1);

      const membersPromise = loadChamaMembers();

      const pageSize = 50;

      const fetchAllPages = async (label, fetchFn) => {
        const results = [];
        let page = 1;
        let hasMore = true;
        let lastError = null;

        while (hasMore) {
          const offset = (page - 1) * pageSize;
          try {
            const response = await fetchFn(pageSize, offset);
            if (response.success && response.data && Array.isArray(response.data)) {
              const batch = response.data;
              results.push(...batch);
              hasMore = batch.length === pageSize;
              page++;
            } else if (response.success && response.data && !Array.isArray(response.data)) {
              console.warn(`${label}: unexpected data format on page ${page}:`, typeof response.data);
              hasMore = false;
            } else {
              hasMore = false;
            }
          } catch (error) {
            lastError = error;
            console.warn(`${label}: fetch page ${page} error:`, error.message);
            hasMore = false;
          }
        }

        if (results.length > 0) {
        } else if (lastError) {
          console.warn(`${label}: failed after partial load:`, lastError.message);
        } else {
          console.warn(`${label}: returned empty data`);
        }

        return results;
      };

      const seenIds = new Set();
      let buffer = [];
      const pushRecords = (items) => {
        const mapped = (items || []).filter(Boolean).filter(item => {
          const itemId = String(item.id || item.transaction_id || item.reference || '');
          if (!itemId || seenIds.has(itemId)) return false;
          seenIds.add(itemId);
          return true;
        });
        if (mapped.length === 0) return;
        buffer = buffer.concat(mapped);
        setAllRecords(buffer);
      };

      const txnTask = fetchAllPages('ChamaTransactions', (limit, offset) =>
        ApiService.getChamaTransactions(chamaId, limit, offset)
      ).then(items => pushRecords(items.map(item => ({
        ...item,
        type: item.type || 'transaction',
        transaction_type: item.transaction_type || item.type || 'transaction',
      }))));

      const contribTask = fetchAllPages('Contributions', (limit, offset) =>
        ApiService.getContributions(chamaId, limit, offset)
      ).then(items => pushRecords(items));

      const loanTask = fetchAllPages('Loans', (limit, offset) =>
        ApiService.getLoans(chamaId, limit, offset)
      ).then(items => pushRecords(items.map(item => ({
        ...item,
        type: 'loan',
        transaction_type: 'loan',
      }))));

      const welfareTask = (async () => {
        const welfareRequests = await fetchAllPages('WelfareRequests', (limit, offset) =>
          ApiService.getWelfareRequests(chamaId, limit, offset)
        );
        pushRecords(welfareRequests.map(item => ({
          ...item,
          type: 'welfare',
          transaction_type: 'welfare',
        })));

        if (welfareRequests.length > 0) {
          const contributionResponses = await Promise.all(
            welfareRequests.map(request =>
              ApiService.getWelfareContributions(request.id, 100, 0).catch(() => ({ success: false, data: [] }))
            )
          );
          const welfareContributions = [];
          contributionResponses.forEach(response => {
            if (response.success && response.data && Array.isArray(response.data)) {
              welfareContributions.push(...response.data.map(item => ({
                ...item,
                type: 'welfare_contribution',
                transaction_type: 'welfare_contribution',
              })));
            }
          });
          pushRecords(welfareContributions);
        }
      })();

      const mgrTask = (async () => {
        const mgrResponse = await getMerryGoRounds(chamaId);
        if (mgrResponse.success && mgrResponse.data && Array.isArray(mgrResponse.data)) {
          const paymentResponses = await Promise.allSettled(
            mgrResponse.data.map(mgr => getMerryGoRoundPayments(mgr.id))
          );
          const mgrTransactions = [];
          paymentResponses.forEach(result => {
            if (result.status === 'fulfilled' && result.value.success && result.value.data && Array.isArray(result.value.data)) {
              mgrTransactions.push(...result.value.data.map(payment => ({
                ...payment,
                type: 'merry-go-round',
                transaction_type: 'merry-go-round',
                description: payment.description || `MGR Round ${payment.roundNumber || ''} - Position ${payment.position || ''}`.trim(),
                amount: payment.amount,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
                status: payment.status || 'completed',
              })));
            }
          });
          pushRecords(mgrTransactions);
        }
      })();

      await Promise.allSettled([membersPromise, txnTask, contribTask, loanTask, welfareTask, mgrTask]);

      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading all transactions:', error);
      Alert.alert('Error', 'Failed to load transaction data');
    } finally {
      setLoading(false);
      setIsLoadingAll(false);
    }
  }, [chamaId, loadChamaMembers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  const handleDownload = useCallback(async (format, scope = 'personal', memberId = null) => {
    try {
      setExportLoading(true);

      let dataToExport = [];

      if (scope === 'all' && canViewGroup) {
        dataToExport = allRecords || [];
      } else if (scope === 'member' && canViewGroup && memberId) {
        const member = chamaMembers.find(m => m.user_id === memberId || m.id === memberId);
        dataToExport = (allRecords || []).filter(record =>
          record.user_id === memberId ||
          record.initiated_by === memberId ||
          record.contributed_by === memberId ||
          record.member_id === memberId
        );
      } else {
        dataToExport = transactions || [];
      }

      if (dataToExport.length === 0) {
        Alert.alert(
          'No Data',
          'No transaction records found for the selected scope. Please ensure there are transactions to export.',
          [{ text: 'OK' }]
        );
        return false;
      }

      if (format !== 'pdf' && format !== 'excel' && format !== 'word') {
        throw new Error('Unsupported format');
      }

      throw new Error('Report export is not available yet');
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
  }, [canViewGroup, allRecords, transactions, chamaMembers]);

  const handleExport = useCallback(async (format) => {
    if (!canViewGroup && viewMode === 'group') {
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

      const scope = canViewGroup && viewMode === 'group' ? 'all' : 'personal';
      const result = await handleDownload(format, scope);

      if (result !== false) {
        setShowExportModal(false);
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExportLoading(false);
    }
  }, [canViewGroup, viewMode, allRecords, transactions, handleDownload]);

  const totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage));

  const handleSelectFilter = useCallback((filterId) => {
    setSelectedFilter(filterId);
    setShowFilterDropdown(false);
    setCurrentPage(1);
  }, []);

  return {
    theme,
    user,
    colors,
    canViewGroup,
    chamaId,
    transactions,
    allRecords,
    loading,
    refreshing,
    selectedFilter,
    setSelectedFilter,
    viewMode,
    setViewMode,
    showExportModal,
    setShowExportModal,
    exportLoading,
    chamaMembers,
    showMemberSelector,
    setShowMemberSelector,
    showFilterDropdown,
    setShowFilterDropdown,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    isLoadingAll,
    onRefresh,
    loadChamaMembers,
    handleDownload,
    handleExport,
    handleSelectFilter,
    handleIndividualReceipt,
    handleBulkPrintReceipts,
    handleBulkShareReceipts,
    totalPages,
    formatCurrency,
    formatDate,
    getTransactionUserName,
    getTransactionAmount,
    getTransactionIcon,
    getTransactionColor,
    getAmountColor,
    getShortTypeLabel,
    getShortDescription,
    getMemberName,
    getMemberEmail,
  };
};

export default useChamaTransactionsScreen;
