import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ApiService from '../services/api';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import { useFocusEffect } from '@react-navigation/native';
import { getThemeColors } from '../utils/theme';
import { formatCurrency, formatDate } from '../utils/savingsHelpers';

const useSavingsOverviewScreen = ({ navigation, route }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);

  const [savingsData, setSavingsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [error, setError] = useState(null);
  const [userSavings, setUserSavings] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [savingsTransactions, setSavingsTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const isActiveRef = useRef(true);

  const fetchSavingsData = useCallback(async (isRefresh = false) => {
    if (!currentChamaId) return;
    if (!isRefresh) setLoading(true);

    try {
      setError(null);
      const response = await ApiService.getEligibleSavingsMembers(currentChamaId);
      if (response.success && response.data) {
        const accounts = response.data || [];

        const enriched = accounts.map((account) => {
          const memberName = account.name || account.member_name || account.memberName || 'Unknown Member';
          const isCurrentUser = account.id === user?.id;
          return {
            ...account,
            member_name: memberName,
            memberName: memberName,
            isCurrentUser,
          };
        });

        if (isActiveRef.current) {
          setSavingsData(enriched);
          const total = enriched.reduce((sum, acc) => sum + (acc.balance || 0), 0);
          setTotalBalance(total);
          setMemberCount(enriched.length);

          const currentUserSavings = enriched.find(acc => acc.isCurrentUser);
          if (currentUserSavings) {
            setUserSavings(currentUserSavings);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching savings data:', error);
      if (isActiveRef.current) {
        setError('Failed to load savings data. Please try again.');
      }
    } finally {
      if (isActiveRef.current) {
        setLoading(false);
      }
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, [currentChamaId, user?.id]);

  const fetchSavingsTransactions = useCallback(async () => {
    if (!currentChamaId) return;
    setTransactionsLoading(true);

    try {
      const response = await ApiService.getSubWalletTransactions(currentChamaId, 'savings');
      if (response.success && response.data) {
        setSavingsTransactions(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching savings transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  }, [currentChamaId]);

  useEffect(() => {
    isActiveRef.current = true;
    fetchSavingsData();

    return () => {
      isActiveRef.current = false;
    };
  }, [fetchSavingsData]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchSavingsTransactions();
    }
  }, [activeTab, fetchSavingsTransactions]);

  useFocusEffect(
    useCallback(() => {
      if (isActiveRef.current && currentChamaId) {
        fetchSavingsData();
      }
    }, [fetchSavingsData, currentChamaId])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSavingsData(true);
  }, [fetchSavingsData]);

  const handleExportSavings = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const blob = await ApiService.exportSavingsTransactions(currentChamaId);

      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = `SavingsTransactions_${currentChamaId.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const fileName = `SavingsTransactions_${currentChamaId.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.xlsx`;
        const fileUri = FileSystem.documentDirectory + fileName;

        const base64data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
              resolve(result.split(',')[1]);
            } else {
              reject(new Error('Failed to read blob'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        await FileSystem.writeAsStringAsync(fileUri, base64data, {
          encoding: FileSystem.EncodingType.Base64
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Savings',
            UTI: 'org.openxmlformats.spreadsheetml.sheet',
          });
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Export Failed', error.message || 'Could not export savings transactions.');
    } finally {
      setExporting(false);
    }
  };

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'eligible':
        return colors.success;
      case 'active':
        return colors.primary;
      case 'pending':
        return colors.warning;
      case 'locked':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  return {
    theme,
    user,
    colors: getThemeColors(theme),
    currentChamaId,
    savingsData,
    loading,
    refreshing,
    totalBalance,
    memberCount,
    error,
    userSavings,
    exporting,
    activeTab,
    setActiveTab,
    savingsTransactions,
    transactionsLoading,
    onRefresh,
    fetchSavingsData,
    handleExportSavings,
    getStatusColor,
    formatCurrency,
    formatDate,
  };
};

export default useSavingsOverviewScreen;
