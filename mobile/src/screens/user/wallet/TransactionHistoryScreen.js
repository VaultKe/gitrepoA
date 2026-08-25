import React from 'react';
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
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ApiService from '../../../services/api';
import Card from '../../../components/common/Card';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import TransactionFilterBar from '../../../components/wallet/TransactionFilterBar';
import TransactionRow from '../../../components/wallet/TransactionRow';
import ReceiptActionModal from '../../../components/wallet/ReceiptActionModal';
import useTransactionHistoryScreen from '../../../hooks/useTransactionHistoryScreen';

const TransactionHistoryScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { width: screenWidth } = Dimensions.get('window');
  const getResponsiveTextSize = (baseSize) => {
    return screenWidth < 600 ? baseSize : screenWidth < 900 ? baseSize * 1.1 : baseSize * 1.2;
  };

  const screen = useTransactionHistoryScreen({ navigation });

  const {
    user,
    filter,
    setFilter,
    transactions,
    loading,
    refreshing,
    receiptLoading,
    showTransactionMenu,
    setShowTransactionMenu,
    showHeaderMenu,
    setShowHeaderMenu,
    filterTypes,
    filteredTransactions,
    formatDate,
    getReceiptFileName,
    buildUserInfo,
    loadAllUserTransactions,
    onRefresh,
  } = screen;

  const getTransactionColor = (type, amount) => {
    if (amount > 0) return colors.success;
    if (amount < 0) return colors.error;
    return colors.primary;
  };

  const downloadReceiptPDF = async (transactionId, fileName) => {
    const token = await ApiService.getAuthToken();
    const response = await fetch(
      `${ApiService.getApiBaseUrl()}/receipts/transactions/${encodeURIComponent(transactionId)}/download?format=pdf`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Receipt download failed: ${response.status} ${errorText}`);
    }

    if (Platform.OS === 'web') {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return { success: true, fileName, uri: url };
    }

    if (!FileSystem?.documentDirectory || !Sharing?.isAvailableAsync) {
      throw new Error('Download is not available on this device');
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Download is not available on this device');
    }

    const blob = await response.blob();
    const reader = new FileReader();
    const base64Data = await new Promise((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result.split(',')[1]);
        } else {
          reject(new Error('Failed to read PDF'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const uri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Download transaction receipt',
      UTI: 'com.adobe.pdf',
    });

    return { success: true, fileName, uri };
  };

  const handleInstantDownloadReceipt = async (transaction) => {
    if (!transaction) return;
    setReceiptLoading(true);
    try {
      const transactionId = transaction.id;
      if (!transactionId) {
        throw new Error('Transaction ID not found');
      }
      const receiptId = `RCP-${String(transactionId).substring(0, 8).toUpperCase()}`;
      const fileName = getReceiptFileName(receiptId);
      const result = await downloadReceiptPDF(transactionId, fileName);
      if (result.success) {
        Alert.alert('Downloaded', `Receipt saved as ${result.fileName}`, [{ text: 'OK', style: 'default' }], { cancelable: true });
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      Alert.alert('Download Failed', error.message || 'Unable to download receipt. Please try again.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrintReceipt = async (transaction) => {
    if (!transaction) return;
    setReceiptLoading(true);
    try {
      const transactionId = transaction.id;
      if (!transactionId) {
        throw new Error('Transaction ID not found');
      }
      const receiptId = `RCP-${String(transactionId).substring(0, 8).toUpperCase()}`;
      const fileName = getReceiptFileName(receiptId);
      const result = await downloadReceiptPDF(transactionId, fileName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to download PDF receipt');
      }

      if (Platform.OS === 'web') {
        Alert.alert('Print Ready', 'Transaction receipt has been opened for printing.', [{ text: 'OK' }]);
        return;
      }

      if (!FileSystem?.documentDirectory) {
        throw new Error('Print is not available on this device');
      }

      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Print receipt - ${receiptId}`,
        UTI: 'com.adobe.pdf',
      });

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
      const transactionId = transaction.id;
      if (!transactionId) {
        throw new Error('Transaction ID not found');
      }
      const receiptId = `RCP-${String(transactionId).substring(0, 8).toUpperCase()}`;
      const fileName = getReceiptFileName(receiptId);
      const result = await downloadReceiptPDF(transactionId, fileName);
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
    <TransactionRow
      item={item}
      index={index}
      colors={colors}
      getResponsiveTextSize={getResponsiveTextSize}
      getTransactionColor={getTransactionColor}
      formatDate={formatDate}
      onMenuToggle={setShowTransactionMenu}
      showTransactionMenu={showTransactionMenu}
    />
  );

  const selectedTransaction = filteredTransactions.find((t) => t.id === showTransactionMenu);

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
         <View style={{ flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.md }}>
          <Card variant="outlined" style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}>
            {loading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  Loading transactions...
                </Text>
              </View>
            )}
            <TransactionFilterBar
              filter={filter}
              setFilter={setFilter}
              filterTypes={filterTypes}
              colors={colors}
            />
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

          <PageRefreshButton
            onRefresh={onRefresh}
            refreshing={refreshing}
            color={colors.primary}
            bottom={64}
          />
        </View>

        <ReceiptActionModal
          visible={!!showTransactionMenu}
          onClose={() => setShowTransactionMenu(null)}
          onDownload={() => handleTransactionMenuAction(selectedTransaction, 'download')}
          onPrint={() => handleTransactionMenuAction(selectedTransaction, 'print')}
          onShare={() => handleTransactionMenuAction(selectedTransaction, 'share')}
          receiptLoading={receiptLoading}
          colors={colors}
        />
      </View>
    </View>
  );
};

export default TransactionHistoryScreen;
