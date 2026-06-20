import React, { useState, useEffect } from 'react';
import {
  View,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
  const canViewGroup = canViewGroupRecords();

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

  const isPrivateTransaction = (item) => {
    return item?.privacy === 'private' ||
           item?.isPrivate === true ||
           item?.metadata?.privacy === 'private' ||
           item?.metadata?.isPrivate === true;
  };

  const getUserRelatedIds = (item) => {
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
  };

  const isUserTransaction = (item) => {
    if (!user?.id) return false;
    return getUserRelatedIds(item).has(String(user.id));
  };

  const applyRoleBasedFiltering = (allData) => {
    if (canViewGroup && viewMode === 'group') {
      return allData;
    }

    return allData.filter(item => {
      if (isPrivateTransaction(item) && !isUserTransaction(item)) {
        return false;
      }

      return isUserTransaction(item);
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
  }, [currentChamaId, selectedFilter, viewMode, currentPage, canViewGroup, user?.id]);

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
  }, [viewMode, selectedFilter, canViewGroup, user?.id]);

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
  };

  const handleExport = async (format) => {
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
      Alert.alert('Error', 'Failed to export records');
    } finally {
      setExportLoading(false);
    }
  };

  const getReceiptId = (transaction) => {
    return `RCP-${String(transaction?.id || transaction?.transaction_id || transaction?.reference || Date.now()).substring(0, 8).toUpperCase()}`;
  };

  const getReceiptFileName = (receiptId) => {
    return `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;
  };

  const getReceiptBodyHTML = (html) => {
    const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return match ? match[1].trim() : html;
  };

  const openReceiptPrintWindow = (html, title, receiptId) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.open) {
      return { success: false, error: 'Print is not available on this device' };
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return { success: false, error: 'Popup blocked. Allow popups to print receipts.' };
    }

    const isFullHTMLDocument = /<!DOCTYPE html>[\s\S]*<\/html>/i.test(html) || /<html[\s\S]*<\/html>/i.test(html);
    const documentHTML = isFullHTMLDocument
      ? html
      : `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif !important; color: #000 !important; background: white !important; }
              section { page-break-after: always; }
              section:last-child { page-break-after: auto; }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;

    printWindow.document.open();
    printWindow.document.write(documentHTML);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 500);

    return { success: true, fileName: getReceiptFileName(receiptId) };
  };

  const printReceiptHTML = async (html, title, receiptId) => {
    if (Platform.OS === 'web') {
      return openReceiptPrintWindow(getReceiptBodyHTML(html), title, receiptId);
    }

    if (!Print?.printAsync) {
      return { success: false, error: 'Print is not available on this device' };
    }

    await Print.printAsync({ html, base64: false });
    return { success: true, fileName: getReceiptFileName(receiptId) };
  };

  const shareReceiptHTML = async (html, fileName) => {
    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      if (navigator.share && window.File) {
        const file = new File([blob], fileName, { type: 'text/html' });
        await navigator.share({
          title: 'Transaction Reports',
          text: 'Transaction reports from VaultKe',
          files: [file],
        });
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setTimeout(() => URL.revokeObjectURL(url), 100);
      return { success: true, fileName };
    }

    if (!Sharing.isAvailableAsync || !FileSystem.documentDirectory) {
      throw new Error('Sharing is not available on this device');
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    const uri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, html, { encoding: FileSystem.EncodingType.UTF8 });

    await Sharing.shareAsync(uri, {
      mimeType: 'text/html',
      dialogTitle: 'Share transaction reports',
      UTI: 'public.html',
    });

    return { success: true, fileName, uri };
  };

  const buildReceiptHTML = (transaction) => {
    return generatePDFOptimizedReceiptHTML(
      transaction,
      selectedChama?.name || 'Chama',
      getMemberNameFromTransaction(transaction, chamaMembers),
      COMPANY_INFO
    );
  };

  const escapeReportHTML = (value) => {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  };

  const getReportValue = (...values) => {
    return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') ?? '';
  };

  const formatReportDate = (transaction) => {
    const dateValue = transaction.date || transaction.createdAt || transaction.created_at || transaction.timestamp;
    if (!dateValue) return 'N/A';

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Nairobi',
    });
  };

  const formatReportAmount = (transaction, fractionDigits = 0) => {
    const type = (transaction.type || transaction.transaction_type || '').toLowerCase();
    const rawAmount = getReportValue(
      transaction.amount,
      transaction.transaction_amount,
      transaction.total_amount,
      transaction.metadata?.amount,
      transaction.metadata?.transaction_amount,
      transaction.metadata?.total_amount
    );
    const numericAmount = parseFloat(String(rawAmount).replace(/[KES,\s]/g, '')) || 0;
    const sign = ['contribution', 'deposit', 'welfare_contribution'].includes(type) ? '+' : '-';
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: fractionDigits,
    }).format(Math.abs(numericAmount));

    return fractionDigits > 0 ? formattedAmount : `${sign} ${formattedAmount}`;
  };

  const getReportNumericAmount = (transaction) => {
    const rawAmount = getReportValue(
      transaction.amount,
      transaction.transaction_amount,
      transaction.total_amount,
      transaction.metadata?.amount,
      transaction.metadata?.transaction_amount,
      transaction.metadata?.total_amount
    );

    return Math.abs(parseFloat(String(rawAmount).replace(/[KES,\s]/g, '')) || 0);
  };

  const getReportNumericFees = (transaction) => {
    const rawFees = getReportValue(
      transaction.fees,
      transaction.transaction_fees,
      transaction.fee,
      transaction.metadata?.fees,
      transaction.metadata?.transaction_fees,
      transaction.metadata?.fee
    );

    return Math.abs(parseFloat(String(rawFees).replace(/[KES,\s]/g, '')) || 0);
  };

  const isCompletedTransaction = (transaction) => {
    const status = String(transaction.status || '').toLowerCase();
    return ['completed', 'paid', 'success', 'successful', 'approved'].includes(status);
  };

  const formatSummaryAmount = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatReportType = (transaction) => {
    const type = transaction.type || transaction.transaction_type || 'Transaction';
    return String(type).replace(/_/g, ' ').toUpperCase();
  };

  const getReportDescription = (transaction) => {
    return getReportValue(
      transaction.description,
      transaction.transaction_description,
      transaction.memo,
      transaction.purpose,
      `${transaction.type || transaction.transaction_type || 'Transaction'} transaction`
    );
  };

  const buildCombinedReceiptsHTML = (receiptTransactions) => {
    const rows = receiptTransactions.map((transaction) => {
      return `
        <tr>
          <td>${escapeReportHTML(formatReportDate(transaction))}</td>
          <td>${escapeReportHTML(getMemberNameFromTransaction(transaction, chamaMembers))}</td>
          <td>${escapeReportHTML(getReportDescription(transaction))}</td>
          <td>${escapeReportHTML(formatReportType(transaction))}</td>
          <td style="text-align: right; font-weight: bold;">${escapeReportHTML(formatReportAmount(transaction, 2))}</td>
          <td style="text-align: right;">${escapeReportHTML(formatSummaryAmount(getReportNumericFees(transaction)))}</td>
          <td style="text-align: center;">${escapeReportHTML(transaction.status || 'completed')}</td>
          <td>${escapeReportHTML(transaction.reference || transaction.ref || transaction.transaction_id || transaction.id || 'N/A')}</td>
        </tr>
      `;
    }).join('');

    const completedTransactions = receiptTransactions.filter(isCompletedTransaction);
    const totalAmount = completedTransactions.reduce((sum, transaction) => sum + getReportNumericAmount(transaction), 0);
    const totalFees = completedTransactions.reduce((sum, transaction) => sum + getReportNumericFees(transaction), 0);
    const grandTotal = totalAmount + totalFees;

    const chamaName = selectedChama?.name || 'Chama';
    const generatedAt = new Date().toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi',
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Transaction Report - ${escapeReportHTML(chamaName)}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif !important; font-size: 9px !important; line-height: 1.2 !important; color: #000 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .container { width: 100% !important; }
            .report-title { text-align: center; font-size: 14px !important; font-weight: bold; margin: 15px 0 !important; text-transform: uppercase; letter-spacing: 1px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 15px !important; font-size: 8px !important; line-height: 1.1; }
            table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 15px !important; font-size: 9px !important; }
            th { background: #e8e8e8 !important; border: 1px solid #000 !important; padding: 6px 4px !important; text-align: center !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 8px !important; }
            td { border: 1px solid #000 !important; padding: 6px 4px !important; font-size: 9px !important; vertical-align: top !important; }
            .footer { border-top: 2px solid #000 !important; padding-top: 10px !important; margin-top: 15px !important; text-align: center !important; font-size: 8px !important; line-height: 1.2; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <div style="flex: 1;">
                  <div style="font-size: 14px; font-weight: bold; color: #000; margin-bottom: 2px;">${escapeReportHTML(COMPANY_INFO.name)}</div>
                  <div style="font-size: 12px; font-weight: bold; color: #000; margin-bottom: 4px;">${escapeReportHTML(chamaName)}</div>
                  <div style="font-size: 8px; color: #000; line-height: 1.1;">
                    ${escapeReportHTML(COMPANY_INFO.address)}<br>
                    Tel: ${escapeReportHTML(COMPANY_INFO.phone)} | Email: ${escapeReportHTML(COMPANY_INFO.email)}
                  </div>
                </div>
                <div style="text-align: right; font-size: 8px; color: #000; line-height: 1.1;">
                  Report No: BULK-${escapeReportHTML(new Date().toISOString().split('T')[0])}<br>
                  Generated: ${escapeReportHTML(generatedAt)}
                </div>
              </div>
              <div style="text-align: center; font-size: 14px; font-weight: bold; color: #000; margin: 15px 0; text-transform: uppercase; letter-spacing: 1px;">TRANSACTION RECEIPT</div>
              <div style="border-bottom: 2px solid #000; margin: 10px 0 15px 0;"></div>
            </div>
            <table border="1" cellpadding="6" cellspacing="0" style="width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; margin-bottom: 15px !important; font-size: 9px !important;">
              <thead>
                <tr>
                  <th style="width: 12%;">DATE</th>
                  <th style="width: 14%;">NAME</th>
                  <th style="width: 20%;">DESCRIPTION</th>
                  <th style="width: 10%;">TYPE</th>
                  <th style="width: 12%;">AMOUNT</th>
                  <th style="width: 10%;">FEES</th>
                  <th style="width: 10%;">STATUS</th>
                  <th style="width: 12%;">REFERENCE</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <table border="1" cellpadding="6" cellspacing="0" style="width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; margin: 15px 0 !important; font-size: 8px !important;">
              <thead>
                <tr>
                  <th colspan="2" style="background: #e8e8e8 !important; border: 1px solid #000 !important; padding: 6px 4px !important; text-align: center !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 7px !important;">SUMMARY</th>
                  <th style="background: #e8e8e8 !important; border: 1px solid #000 !important; padding: 6px 4px !important; text-align: center !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 7px !important;">AMOUNT (KES)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="2" style="border: 1px solid #000 !important; padding: 6px 4px !important; text-align: left !important; font-size: 8px !important;">Total Transaction Amount</td>
                  <td style="border: 1px solid #000 !important; padding: 6px 4px !important; text-align: right !important; font-weight: bold !important; font-size: 8px !important;">${escapeReportHTML(formatSummaryAmount(totalAmount))}</td>
                </tr>
                <tr>
                  <td colspan="2" style="border: 1px solid #000 !important; padding: 6px 4px !important; text-align: left !important; font-size: 8px !important;">Total Transaction Fees</td>
                  <td style="border: 1px solid #000 !important; padding: 6px 4px !important; text-align: right !important; font-weight: bold !important; font-size: 8px !important;">${escapeReportHTML(formatSummaryAmount(totalFees))}</td>
                </tr>
                <tr style="background: #f0f0f0 !important; font-weight: bold !important;">
                  <td colspan="2" style="border: 1px solid #000 !important; border-top: 2px solid #000 !important; padding: 6px 4px !important; text-align: left !important; font-size: 8px !important;"><strong>GRAND TOTAL</strong></td>
                  <td style="border: 1px solid #000 !important; border-top: 2px solid #000 !important; padding: 6px 4px !important; text-align: right !important; font-weight: bold !important; font-size: 8px !important;"><strong>${escapeReportHTML(formatSummaryAmount(grandTotal))}</strong></td>
                </tr>
              </tbody>
            </table>
            <div class="footer">
              <div>This report was generated from VaultKe transaction records.</div>
              <div>Summary totals include completed transactions only.</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const getBulkReceiptTransactions = () => {
    return (transactions.length > 0 ? transactions : allRecords).filter(Boolean);
  };

  const handleBulkPrintReceipts = async () => {
    const receiptTransactions = getBulkReceiptTransactions();

    if (receiptTransactions.length === 0) {
      Alert.alert('No Data', 'No transaction reports found to print.', [{ text: 'OK' }]);
      return;
    }

    setExportLoading(true);
    try {
      const html = buildCombinedReceiptsHTML(receiptTransactions);
      const result = await printReceiptHTML(
        html,
        `Transaction Reports - ${selectedChama?.name || 'Chama'}`,
        'BULK'
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to print receipts');
      }

      Alert.alert(
        'Reports Ready',
        `${receiptTransactions.length} transaction report(s) opened for printing.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Bulk print error:', error);
      Alert.alert('Print Failed', error.message || 'Failed to print transaction reports.', [{ text: 'OK' }]);
    } finally {
      setExportLoading(false);
    }
  };

  const handleBulkShareReceipts = async () => {
    const receiptTransactions = getBulkReceiptTransactions();

    if (receiptTransactions.length === 0) {
      Alert.alert('No Data', 'No transaction reports found to share.', [{ text: 'OK' }]);
      return;
    }

    setExportLoading(true);
    try {
      const html = buildCombinedReceiptsHTML(receiptTransactions);
      const fileName = `VaultKe_Transaction_Reports_${new Date().toISOString().split('T')[0]}.html`;
      const result = await shareReceiptHTML(html, fileName);

      if (!result.success) {
        throw new Error(result.error || 'Failed to share receipts');
      }

      Alert.alert('Reports Shared', 'Transaction reports are ready to share.', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Bulk share error:', error);
      Alert.alert('Share Failed', error.message || 'Failed to share transaction reports.', [{ text: 'OK' }]);
    } finally {
      setExportLoading(false);
    }
  };

  const handleIndividualReceipt = async (transaction) => {
    try {
      setExportLoading(true);
      const receiptId = getReceiptId(transaction);
      const html = buildReceiptHTML(transaction);
      const result = await printReceiptHTML(
        html,
        `Transaction Receipt - ${receiptId}`,
        receiptId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate receipt');
      }

      Alert.alert(
        'Receipt Generated',
        'Transaction receipt has been opened successfully.',
        [{ text: 'OK' }]
      );
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
          onBulkPrintReceipts={handleBulkPrintReceipts}
          onBulkShareReceipts={handleBulkShareReceipts}
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
