import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ApiService from '../../../services/api';
import Card from '../../../components/common/Card';
import { generatePDFOptimizedReceiptHTML } from '../../../services/receiptService/html/template';
import { COMPANY_INFO } from '../../../services/receiptService/config';

export default function TransactionHistoryScreen() {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const { width: screenWidth } = Dimensions.get('window');
  const getResponsiveTextSize = (baseSize) => {
    return screenWidth < 600 ? baseSize : screenWidth < 900 ? baseSize * 1.1 : baseSize * 1.2;
  };

  const [filter, setFilter] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showTransactionMenu, setShowTransactionMenu] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      let apiTransactions = [];
      try {
        const response = await ApiService.getTransactions(50, 0);
        if (response.success) {
          if (Array.isArray(response.data)) {
            apiTransactions = response.data;
          } else if (response.data && typeof response.data === 'object') {
            apiTransactions = response.data.transactions || response.data.data || [];
          }
        }

        if (apiTransactions.length > 0 || response.success) {
          const formattedTransactions = apiTransactions.map(tx => ({
            ...tx,
            date: tx.createdAt || tx.created_at,
            amount: tx.type === 'deposit' || tx.type === 'contribution'
              ? Math.abs(parseFloat(tx.amount) || 0)
              : -Math.abs(parseFloat(tx.amount) || 0),
          }));
          setTransactions(formattedTransactions);
          return;
        }
      } catch (error) {
        console.warn('Failed to load transactions from API:', error);
      }

      try {
        const localData = await AsyncStorage.getItem('cachedTransactions');
        if (localData) {
          const localTransactions = JSON.parse(localData);
          const formattedTransactions = localTransactions.map(tx => ({
            ...tx,
            date: tx.createdAt || tx.created_at,
            amount: tx.type === 'deposit' || tx.type === 'contribution'
              ? Math.abs(parseFloat(tx.amount) || 0)
              : -Math.abs(parseFloat(tx.amount) || 0),
          }));
          setTransactions(formattedTransactions);
          return;
        }
      } catch (storageError) {
        console.warn('Failed to load transactions from local storage:', storageError);
      }

      setTransactions([]);
    } catch (error) {
      console.error('Error in loadTransactions:', error);
      Alert.alert('Error', 'Failed to load transaction history');
      setTransactions([]);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  }, [loadTransactions]);

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await loadTransactions();
      setLoading(false);
    };
    initializeData();
  }, [loadTransactions]);

  useFocusEffect(
    React.useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  const filterTypes = [
    { id: 'all', name: 'All', icon: 'list' },
    { id: 'deposit', name: 'Deposits', icon: 'arrow-down-circle' },
    { id: 'withdrawal', name: 'Withdrawals', icon: 'arrow-up-circle' },
    { id: 'transfer', name: 'Transfers', icon: 'swap-horizontal' },
  ];

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter(t => t.type === filter);

  const getTransactionColor = (type, amount) => {
    if (amount > 0) return colors.success;
    if (amount < 0) return colors.error;
    return colors.primary;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReceiptId = (transaction) => {
    return `RCP-${String(transaction?.id || transaction?.reference || Date.now()).substring(0, 8).toUpperCase()}`;
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

  const downloadReceiptHTML = async (html, fileName) => {
    if (Platform.OS === 'web') {
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

    if (!FileSystem?.documentDirectory || !Sharing?.isAvailableAsync) {
      throw new Error('Download is not available on this device');
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Download is not available on this device');
    }

    const uri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, html, { encoding: FileSystem.EncodingType.UTF8 });

    await Sharing.shareAsync(uri, {
      mimeType: 'text/html',
      dialogTitle: 'Download transaction receipt',
      UTI: 'public.html',
    });

    return { success: true, fileName, uri };
  };

  const shareReceiptHTML = async (html, fileName) => {
    return downloadReceiptHTML(html, fileName);
  };

  const buildUserInfo = () => {
    const firstName = user?.firstName || user?.first_name || '';
    const lastName = user?.lastName || user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'User';
    return {
      name: fullName,
      firstName,
      lastName,
      email: user?.email || '',
      phone: user?.phone || '',
      isPersonalTransaction: true,
    };
  };

  const buildReceiptHTML = (transaction) => {
    return generatePDFOptimizedReceiptHTML(transaction, 'Wallet', buildUserInfo().name, COMPANY_INFO);
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

  const formatReportAmount = (transaction) => {
    const rawAmount = getReportValue(transaction.amount, transaction.transaction_amount, transaction.metadata?.amount);
    const numericAmount = parseFloat(String(rawAmount).replace(/[KES,\s]/g, '')) || 0;
    const sign = numericAmount >= 0 ? '+' : '-';
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(Math.abs(numericAmount));

    return `${sign} ${formattedAmount}`;
  };

  const getReportSignedAmount = (transaction) => {
    const rawAmount = getReportValue(transaction.amount, transaction.transaction_amount, transaction.metadata?.amount);
    return parseFloat(String(rawAmount).replace(/[KES,\s]/g, '')) || 0;
  };

  const formatSummaryAmount = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatReportType = (transaction) => {
    return String(transaction.type || 'Transaction').replace(/_/g, ' ').toUpperCase();
  };

  const getReportDescription = (transaction) => {
    return getReportValue(
      transaction.description,
      transaction.transaction_description,
      transaction.memo,
      transaction.purpose,
      `${transaction.type || 'Transaction'} transaction`
    );
  };

  const isCompletedTransaction = (transaction) => {
    const status = String(transaction.status || '').toLowerCase();
    return ['completed', 'paid', 'success', 'successful', 'approved'].includes(status);
  };

  const buildCombinedReceiptsHTML = (receiptTransactions) => {
    const rows = receiptTransactions.map((transaction) => `
      <tr>
        <td>${escapeReportHTML(formatReportDate(transaction))}</td>
        <td>${escapeReportHTML(getReportDescription(transaction))}</td>
        <td>${escapeReportHTML(formatReportType(transaction))}</td>
        <td style="text-align: center;">${escapeReportHTML(transaction.status || 'N/A')}</td>
        <td style="text-align: right; font-weight: bold;">${escapeReportHTML(formatReportAmount(transaction))}</td>
        <td>${escapeReportHTML(transaction.reference || transaction.ref || transaction.id || 'N/A')}</td>
      </tr>
    `).join('');

    const completedTransactions = receiptTransactions.filter(isCompletedTransaction);
    const totalAmount = completedTransactions.reduce((sum, transaction) => sum + getReportSignedAmount(transaction), 0);
    const generatedAt = new Date().toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi',
    });
    const userName = buildUserInfo().name;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Wallet Transaction Report</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif !important; font-size: 11px !important; line-height: 1.3 !important; color: #000 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .container { width: 100% !important; }
            .report-title { text-align: center; font-size: 16px !important; font-weight: bold; margin: 15px 0 !important; text-transform: uppercase; letter-spacing: 1px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 15px !important; font-size: 9px !important; line-height: 1.2; }
            table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 15px !important; font-size: 10px !important; }
            th { background: #e8e8e8 !important; border: 1px solid #000 !important; padding: 7px 5px !important; text-align: center !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 9px !important; }
            td { border: 1px solid #000 !important; padding: 7px 5px !important; font-size: 10px !important; vertical-align: top !important; }
            .footer { border-top: 2px solid #000 !important; padding-top: 10px !important; margin-top: 15px !important; text-align: center !important; font-size: 9px !important; line-height: 1.3; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <div style="flex: 1;">
                  <div style="font-size: 15px; font-weight: bold; color: #000; margin-bottom: 2px;">${escapeReportHTML(COMPANY_INFO.name)}</div>
                  <div style="font-size: 12px; font-weight: bold; color: #000; margin-bottom: 4px;">Wallet Transaction Report</div>
                  <div style="font-size: 9px; color: #000; line-height: 1.2;">
                    User: ${escapeReportHTML(userName)}<br>
                    ${escapeReportHTML(COMPANY_INFO.address)}<br>
                    Tel: ${escapeReportHTML(COMPANY_INFO.phone)} | Email: ${escapeReportHTML(COMPANY_INFO.email)}
                  </div>
                </div>
                <div style="text-align: right; font-size: 9px; color: #000; line-height: 1.2;">
                  Report No: BULK-${escapeReportHTML(new Date().toISOString().split('T')[0])}<br>
                  Generated: ${escapeReportHTML(generatedAt)}
                </div>
              </div>
              <div style="text-align: center; font-size: 16px; font-weight: bold; color: #000; margin: 15px 0; text-transform: uppercase; letter-spacing: 1px;">ALL WALLET TRANSACTIONS</div>
              <div style="border-bottom: 2px solid #000; margin: 10px 0 15px 0;"></div>
            </div>
            <table border="1" cellpadding="7" cellspacing="0" style="width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; margin-bottom: 15px !important; font-size: 10px !important;">
              <thead>
                <tr>
                  <th style="width: 15%;">DATE</th>
                  <th style="width: 30%;">DESCRIPTION</th>
                  <th style="width: 12%;">TYPE</th>
                  <th style="width: 13%;">STATUS</th>
                  <th style="width: 15%;">AMOUNT</th>
                  <th style="width: 15%;">REFERENCE</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <table border="1" cellpadding="7" cellspacing="0" style="width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; margin: 15px 0 !important; font-size: 9px !important;">
              <thead>
                <tr>
                  <th colspan="2" style="background: #e8e8e8 !important; border: 1px solid #000 !important; padding: 7px 5px !important; text-align: center !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 8px !important;">SUMMARY</th>
                  <th style="background: #e8e8e8 !important; border: 1px solid #000 !important; padding: 7px 5px !important; text-align: center !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 8px !important;">AMOUNT (KES)</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background: #f0f0f0 !important; font-weight: bold !important;">
                  <td colspan="2" style="border: 1px solid #000 !important; padding: 7px 5px !important; text-align: left !important; font-size: 9px !important;">NET TOTAL</td>
                  <td style="border: 1px solid #000 !important; padding: 7px 5px !important; text-align: right !important; font-weight: bold !important; font-size: 9px !important;">${escapeReportHTML(formatSummaryAmount(totalAmount))}</td>
                </tr>
              </tbody>
            </table>
            <div class="footer">
              <div>This report was generated from VaultKe wallet transaction records.</div>
              <div>Summary totals include completed transactions only.</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleInstantDownloadReceipt = async (transaction) => {
    if (!transaction) return;
    setReceiptLoading(true);
    try {
      const receiptId = getReceiptId(transaction);
      const html = buildReceiptHTML(transaction);
      const fileName = getReceiptFileName(receiptId);
      const result = await downloadReceiptHTML(html, fileName);
      if (result.success) {
        Alert.alert('Downloaded', `Receipt saved as ${result.fileName}`, [{ text: 'OK', style: 'default' }], { cancelable: true });
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      Alert.alert('Download Failed', error.message || 'Unable to download receipt. Please try again.', [{ text: 'OK', style: 'default' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrintReceipt = async (transaction) => {
    if (!transaction) return;
    setReceiptLoading(true);
    try {
      const receiptId = getReceiptId(transaction);
      const html = buildReceiptHTML(transaction);
      const result = await printReceiptHTML(
        html,
        `Transaction Receipt - ${receiptId}`,
        receiptId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to print receipt');
      }

      Alert.alert('Print Ready', 'Transaction receipt has been opened for printing.', [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Failed to print receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleShareReceipt = async (transaction) => {
    if (!transaction) return;
    setReceiptLoading(true);
    try {
      const receiptId = getReceiptId(transaction);
      const html = buildReceiptHTML(transaction);
      const fileName = getReceiptFileName(receiptId);
      const result = await shareReceiptHTML(html, fileName);

      if (!result.success) {
        throw new Error(result.error || 'Failed to share receipt');
      }

      Alert.alert('Receipt Shared', 'Transaction receipt is ready to share.', [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Share Failed', error.message || 'Failed to share receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleBulkDownloadReceipts = async () => {
    if (transactions.length === 0) {
      Alert.alert('No Data', 'No transactions available to download');
      return;
    }

    setReceiptLoading(true);
    try {
      const html = buildCombinedReceiptsHTML(transactions);
      const fileName = `VaultKe_Wallet_Transaction_Reports_${new Date().toISOString().split('T')[0]}.html`;
      const result = await downloadReceiptHTML(html, fileName);

      if (!result.success) {
        throw new Error(result.error || 'Download failed');
      }

      Alert.alert('Downloaded', `${transactions.length} transaction report(s) downloaded.`, [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Download Failed', error.message || 'Unable to download transaction history. Please try again.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleBulkPrintReceipts = async () => {
    if (transactions.length === 0) {
      Alert.alert('No Data', 'No transactions available to print');
      return;
    }

    setReceiptLoading(true);
    try {
      const html = buildCombinedReceiptsHTML(transactions);
      const result = await printReceiptHTML(
        html,
        'Wallet Transaction Reports',
        'BULK'
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to print receipts');
      }

      Alert.alert('Reports Ready', `${transactions.length} transaction report(s) opened for printing.`, [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Failed to print transaction reports.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleReceiptAction = (transaction, action) => {
    switch (action) {
      case 'download':
        handleInstantDownloadReceipt(transaction);
        break;
      case 'print':
        handlePrintReceipt(transaction);
        break;
      case 'share':
        handleShareReceipt(transaction);
        break;
    }
  };

  const handleTransactionMenuAction = (transaction, action) => {
    setShowTransactionMenu(null);
    handleReceiptAction(transaction, action);
  };

  const renderTransactionHeader = () => (
    <View style={{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '10', borderBottomWidth: 2, borderBottomColor: colors.primary }}>
      <Text style={{ flex: 2.5, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textTransform: 'uppercase' }}>Description</Text>
      <Text style={{ flex: 1.4, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'center', textTransform: 'uppercase' }}>Date</Text>
      <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'center', textTransform: 'uppercase' }}>Status</Text>
      <Text style={{ flex: 1.8, fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.bold, color: colors.primary, textAlign: 'right', textTransform: 'uppercase' }}>Amount</Text>
    </View>
  );

  const renderTransaction = ({ item, index }) => (
    <View style={[{ flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
      <Text style={{ flex: 2.5, fontSize: getResponsiveTextSize(14), color: colors.text }} numberOfLines={1}>{item.description}</Text>
      <Text style={{ flex: 1.4, fontSize: getResponsiveTextSize(14), color: colors.textSecondary, textAlign: 'center' }}>{formatDate(item.date)}</Text>
      <Text style={{ flex: 1, fontSize: getResponsiveTextSize(14), color: item.status === 'completed' ? colors.success : colors.warning, textAlign: 'center' }}>{item.status}</Text>
      <View style={{ flex: 1.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: getResponsiveTextSize(14), fontWeight: typography.fontWeight.medium, color: getTransactionColor(item.type, item.amount), textAlign: 'right' }}>
          {item.amount > 0 ? '+' : ''}KES {Math.abs(item.amount).toLocaleString()}
        </Text>
        <TouchableOpacity
          style={{ padding: spacing.xs }}
          onPress={() => setShowTransactionMenu(showTransactionMenu === item.id ? null : item.id)}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <View style={[{ borderBottomWidth: 1, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.xs }}
              >
                {filterTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs, marginRight: spacing.xs, backgroundColor: colors.backgroundSecondary },
                      filter === type.id && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setFilter(type.id)}
                  >
                    <Ionicons
                      name={type.icon}
                      size={14}
                      color={filter === type.id ? colors.white : colors.textSecondary}
                    />
                    <Text style={[
                      { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: filter === type.id ? colors.white : colors.textSecondary },
                      filter === type.id && { fontWeight: '600' },
                    ]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {transactions.length > 0 && (
              <TouchableOpacity
                style={{ width: 36, height: 36, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundSecondary }}
                onPress={() => setShowHeaderMenu(!showHeaderMenu)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {showHeaderMenu && (
        <View style={{ position: 'absolute', top: 60, right: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, paddingVertical: spacing.xs, minWidth: 170, backgroundColor: colors.surface, borderColor: colors.border, zIndex: 1001, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}
            onPress={() => {
              setShowHeaderMenu(false);
              handleBulkDownloadReceipts();
            }}
            disabled={receiptLoading}
          >
            <Ionicons name="download" size={18} color={receiptLoading ? colors.textTertiary : colors.text} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: receiptLoading ? colors.textTertiary : colors.text }]}>Download All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}
            onPress={() => {
              setShowHeaderMenu(false);
              handleBulkPrintReceipts();
            }}
            disabled={receiptLoading}
          >
            <Ionicons name="print" size={18} color={receiptLoading ? colors.textTertiary : colors.text} />
            <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: receiptLoading ? colors.textTertiary : colors.text }]}>Print All</Text>
          </TouchableOpacity>
        </View>
      )}

      {showHeaderMenu && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}
          onPress={() => setShowHeaderMenu(false)}
          activeOpacity={1}
        />
      )}

      <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <Card variant="outlined" style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}>
          {loading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Loading transactions...
              </Text>
            </View>
          )}
          {renderTransactionHeader()}
          <FlatList
              data={filteredTransactions}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              renderItem={renderTransaction}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
                  <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
                  <Text style={[{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginTop: spacing.md }]}>
                    {transactions.length === 0 ? 'No transactions yet' : 'No transactions found'}
                  </Text>
                  <Text style={[{ fontSize: typography.fontSize.sm, marginTop: spacing.sm, textAlign: 'center', color: colors.textTertiary }]}>
                    {transactions.length === 0
                      ? 'Start by making a deposit or transfer'
                      : 'Try changing the filter above'
                    }
                  </Text>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: spacing.md }}
              style={{ flex: 1 }}
            />
        </Card>
      </View>

      <Modal
        visible={!!showTransactionMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTransactionMenu(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
          onPress={() => setShowTransactionMenu(null)}
          activeOpacity={1}
        >
          <View style={{ width: 220, borderRadius: borderRadius.xl, borderWidth: 1, backgroundColor: colors.surface, borderColor: colors.border, elevation: 20, overflow: 'hidden' }}>
            <View style={{ padding: spacing.md, borderBottomWidth: 1, alignItems: 'center', borderBottomColor: colors.border }}>
              <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Receipt Actions</Text>
            </View>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
              onPress={() => handleTransactionMenuAction(
                filteredTransactions.find(t => t.id === showTransactionMenu),
                'download'
              )}
              activeOpacity={0.7}
            >
              <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '20' }}>
                <Ionicons name="download-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.text, flex: 1 }]}>Download Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
              onPress={() => handleTransactionMenuAction(
                filteredTransactions.find(t => t.id === showTransactionMenu),
                'print'
              )}
              activeOpacity={0.7}
            >
              <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success + '20' }}>
                <Ionicons name="print-outline" size={18} color={colors.success} />
              </View>
              <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.text, flex: 1 }]}>Print Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md }}
              onPress={() => handleTransactionMenuAction(
                filteredTransactions.find(t => t.id === showTransactionMenu),
                'share'
              )}
              activeOpacity={0.7}
            >
              <View style={{ width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent + '20' }}>
                <Ionicons name="share-outline" size={18} color={colors.accent} />
              </View>
              <Text style={[{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.text, flex: 1 }]}>Share Receipt</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
