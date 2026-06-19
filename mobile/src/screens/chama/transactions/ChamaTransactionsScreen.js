import React, { useState, useEffect } from 'react';
import {
  View,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing } from '../../../utils/theme';
import ApiService from '../../../services/api';
import { getMemberNameFromTransaction } from '../../../services/receiptService/memberName';
import { generatePDFOptimizedReceiptHTML } from '../../../services/receiptService/html/template';
import { COMPANY_INFO } from '../../../services/receiptService/config';
import ChamaTransactionsHeader from './ChamaTransactionsHeader';
import ChamaTransactionsFilterDropdown from './ChamaTransactionsFilterDropdown';
import ChamaTransactionsFilterChips from './ChamaTransactionsFilterChips';
import ChamaTransactionsTable from './ChamaTransactionsTable';
import ChamaTransactionsExportModal from './ChamaTransactionsExportModal';
import ChamaTransactionsMemberSelectorModal from './ChamaTransactionsMemberSelectorModal';
import ChamaTransactionsNoChama from './ChamaTransactionsNoChama';

const ChamaTransactionsScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  const {
    currentChamaId,
    selectedChama,
    canViewGroupRecords,
  } = useChamaContext();
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);

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
  const itemsPerPage = 15;

  const applyRoleBasedFiltering = (allData) => {
    const isLeader = canViewGroupRecords();
    const shouldShowGroupData = isLeader && viewMode === 'group';

    if (shouldShowGroupData) {
      return allData;
    }

    return allData.filter(item => {
      const isUserRecord = item.initiatedBy === user.id ||
                           item.initiated_by === user.id ||
                           item.user_id === user.id ||
                           item.userId === user.id ||
                           item.contributed_by === user.id ||
                           item.member_id === user.id ||
                           item.memberId === user.id;
      const isGroupVisible = ['welfare', 'merry-go-round'].includes(item.type?.toLowerCase());

      return isUserRecord || isGroupVisible;
    });
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

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, viewMode]);

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

      setTransactions(finalData);
    }
  }, [viewMode, selectedFilter]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
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
      const offset = (currentPage - 1) * itemsPerPage;

      const transactionResponse = await ApiService.getChamaTransactions(currentChamaId, itemsPerPage, offset);
      if (transactionResponse.success) {
        allData = [...allData, ...(transactionResponse.data || [])];
      }

      try {
        const contributionResponse = await ApiService.getContributions(currentChamaId, itemsPerPage, offset);
        if (contributionResponse.success) {
          allData = [...allData, ...(contributionResponse.data || [])];
        }
      } catch (error) {
        console.warn('Contributions API not available:', error);
      }

      try {
        const welfareResponse = await ApiService.getWelfareRequests(currentChamaId, itemsPerPage, offset);
        if (welfareResponse.success) {
          const welfareTransactions = (welfareResponse.data || []).map(item => ({
            ...item,
            type: 'welfare',
            transaction_type: 'welfare',
          }));
          allData = [...allData, ...welfareTransactions];
        }
      } catch (error) {
        console.warn('Welfare API not available:', error);
      }

      try {
        const allWelfareRequests = await ApiService.getWelfareRequests(currentChamaId, 500, 0);
        if (allWelfareRequests.success && allWelfareRequests.data) {
          const welfareContributionPromises = allWelfareRequests.data.map(request =>
            ApiService.getWelfareContributions(request.id, itemsPerPage, offset)
          );
          const welfareContributionsResponses = await Promise.all(welfareContributionPromises);

          welfareContributionsResponses.forEach(response => {
            if (response.success && response.data) {
              const welfareContributionTransactions = response.data.map(item => ({
                ...item,
                type: 'welfare_contribution',
                transaction_type: 'welfare_contribution',
              }));
              allData = [...allData, ...welfareContributionTransactions];
            }
          });
        }
      } catch (error) {
        console.warn('Welfare contributions API not available:', error);
      }

      try {
        const loanResponse = await ApiService.getLoans(currentChamaId, itemsPerPage, offset);
        if (loanResponse.success) {
          const loanTransactions = (loanResponse.data || []).map(item => ({
            ...item,
            type: 'loan',
            transaction_type: 'loan',
          }));
          allData = [...allData, ...loanTransactions];
        }
      } catch (error) {
        console.warn('Loan API not available:', error);
      }

      setAllRecords(allData);

      const filteredData = applyRoleBasedFiltering(allData);
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
    await loadTransactions();
    setRefreshing(false);
  };

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

  const handleDownload = async (format, scope = 'personal', memberId = null) => {
    try {
      setExportLoading(true);

      let dataToExport = [];

      if (scope === 'all' && canViewGroupRecords()) {
        dataToExport = allRecords || [];
      } else if (scope === 'member' && canViewGroupRecords() && memberId) {
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
  };

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

      const scope = canViewGroupRecords() && viewMode === 'group' ? 'all' : 'personal';
      const result = await handleDownload(format, scope);

      if (result !== false) {
        setShowExportModal(false);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export records');
    } finally {
      setExportLoading(false);
    }
  };

  const openTransactionReceipt = (transaction) => {
    const receiptId = `RCP-${String(transaction.id || Date.now()).substring(0, 8).toUpperCase()}`;
    const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;
    const html = generatePDFOptimizedReceiptHTML(
      transaction,
      selectedChama?.name || 'Chama',
      getMemberNameFromTransaction(transaction, chamaMembers),
      COMPANY_INFO
    );

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return { success: true, fileName };
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transaction Receipt - ${receiptId}</title>
          <style>
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${html}
          <div class="no-print" style="position: fixed; top: 10px; right: 10px; background: #007bff; color: white; padding: 10px; border-radius: 5px; cursor: pointer;" onclick="window.print()">
            Click here to save as PDF
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => window.print(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    return { success: true, fileName };
  };

  const handleIndividualReceipt = async (transaction, format = 'pdf') => {
    try {
      setExportLoading(true);
      const result = format === 'html'
        ? openTransactionReceipt(transaction)
        : openTransactionReceipt(transaction);

      if (result.success) {
        Alert.alert(
          'Receipt Generated',
          'Transaction receipt has been opened successfully.',
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

  const totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage));

  const handleSelectFilter = (filterId) => {
    setSelectedFilter(filterId);
    setShowFilterDropdown(false);
    setCurrentPage(1);
  };

  if (!currentChamaId) {
    return <ChamaTransactionsNoChama navigation={navigation} theme={theme} />;
  }

  return (
    <SafeAreaView style={[styles.container, styles.containerBackground]}>
      <ScrollView
        style={styles.pageScroll}
        nestedScrollEnabled
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
        <ChamaTransactionsHeader
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedFilter={selectedFilter}
          isDropdownOpen={showFilterDropdown}
          canViewGroupRecords={canViewGroupRecords}
          onToggleFilter={() => setShowFilterDropdown(!showFilterDropdown)}
          theme={theme}
        />

        <ChamaTransactionsFilterChips
          selectedFilter={selectedFilter}
          onSelectFilter={handleSelectFilter}
          theme={theme}
        />

        <ChamaTransactionsTable
          transactions={transactions}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
          chamaMembers={chamaMembers}
          onReceiptPress={handleIndividualReceipt}
          exportLoading={exportLoading}
          selectedFilter={selectedFilter}
          theme={theme}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {showFilterDropdown && (
        <ChamaTransactionsFilterDropdown
          selectedFilter={selectedFilter}
          onSelectFilter={handleSelectFilter}
          theme={theme}
        />
      )}

      <ChamaTransactionsExportModal
        visible={showExportModal}
        transactionsCount={transactions.length}
        exportLoading={exportLoading}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        theme={theme}
      />

      <ChamaTransactionsMemberSelectorModal
        visible={showMemberSelector}
        chamaMembers={chamaMembers}
        onClose={() => setShowMemberSelector(false)}
        onSelectMember={(memberId) => {
          handleDownload('pdf', 'member', memberId);
        }}
        theme={theme}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  containerBackground: {
    backgroundColor: colors.background,
  },
  pageScroll: {
    flex: 1,
  },
  bottomSpacer: {
    height: spacing.xxxl,
  },
});

export default ChamaTransactionsScreen;
