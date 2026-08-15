import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import ApiService from '../../../services/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import PageRefreshButton from '../../../components/common/PageRefreshButton';

const SavingsOverviewScreen = ({ navigation, route }) => {
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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'history'
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

          // Find current user's savings
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
      const savingsWalletID = `wallet-${currentChamaId}-savings`;
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
    React.useCallback(() => {
      if (isActiveRef.current && currentChamaId) {
        fetchSavingsData();
      }
    }, [fetchSavingsData, currentChamaId])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSavingsData(true);
  }, [fetchSavingsData]);

  const formatCurrency = (amount) => {
    const val = amount || 0;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  };

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

  const renderTableHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: colors.primary }]}>
      <View style={[styles.cell, styles.nameCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Member</Text>
      </View>
      <View style={[styles.cell, styles.balanceCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>My Savings</Text>
      </View>
      <View style={[styles.cell, styles.statusCell]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Status</Text>
      </View>
    </View>
  );

  const renderRow = ({ item, index }) => {
    const rowBg = index % 2 === 0 ? colors.background : colors.surface;
    const memberName = item.member_name || item.memberName || 'Unknown Member';

    return (
      <View style={[styles.tableRow, { backgroundColor: rowBg, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <View style={[styles.cell, styles.nameCell]}>
          <Text style={[styles.cellText, styles.nameText, { color: colors.text }]} numberOfLines={1}>
            {memberName}
          </Text>
        </View>
        <View style={[styles.cell, styles.balanceCell]}>
          <Text style={[styles.cellText, { color: colors.success, fontWeight: '600' }]}>
            {formatCurrency(item.balance)}
          </Text>
        </View>
        <View style={[styles.cell, styles.statusCell]}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {(item.status || 'active').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Unable to Load Savings
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => { setError(null); fetchSavingsData(true); }}
          >
            <Ionicons name="refresh" size={16} color={colors.white} />
            <Text style={[styles.retryText, { color: colors.white }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="wallet-outline" size={64} color={colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No Savings Accounts Found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          No savings accounts have been created for this chama yet.
        </Text>
      </View>
    );
  };

  const renderHistoryRow = ({ item, index }) => {
    const rowBg = index % 2 === 0 ? colors.background : colors.surface;
    
    return (
      <View style={[styles.tableRow, { backgroundColor: rowBg, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <View style={[styles.cell, { flex: 1.5, alignItems: 'flex-start' }]}>
          <Text style={[styles.cellText, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
            {item.created_at ? formatDate(item.created_at) : '-'}
          </Text>
        </View>
        <View style={[styles.cell, { flex: 1.5, alignItems: 'center' }]}>
          <Text style={[styles.cellText, { color: colors.success, fontWeight: '600' }]}>
            +{formatCurrency(item.amount)}
          </Text>
        </View>
        <View style={[styles.cell, { flex: 2, alignItems: 'flex-start' }]}>
          <Text style={[styles.cellText, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.description || '-'}
          </Text>
        </View>
        <View style={[styles.cell, { flex: 1.5, alignItems: 'center' }]}>
          <Text style={[styles.cellText, { color: colors.textSecondary }]}>
            {item.payment_method || 'wallet'}
          </Text>
        </View>
      </View>
    );
  };

  const renderHistoryHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomWidth: 2, borderBottomColor: colors.success }]}>
      <View style={[styles.cell, { flex: 1.5 }]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Date</Text>
      </View>
      <View style={[styles.cell, { flex: 1.5 }]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Amount</Text>
      </View>
      <View style={[styles.cell, { flex: 2 }]}>
        <Text style={[styles.headerText, { color: colors.text, textAlign: 'left' }]}>Description</Text>
      </View>
      <View style={[styles.cell, { flex: 1.5 }]}>
        <Text style={[styles.headerText, { color: colors.text }]}>Method</Text>
      </View>
    </View>
  );

  const renderHistoryEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Transactions Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        No savings transactions have been recorded yet.
      </Text>
    </View>
  );

  const renderTabButton = (tabName, label, iconName) => (
    <TouchableOpacity
      onPress={() => setActiveTab(tabName)}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 2,
        borderBottomColor: activeTab === tabName ? colors.primary : colors.border,
      }}
    >
      <Ionicons 
        name={iconName} 
        size={20} 
        color={activeTab === tabName ? colors.primary : colors.textSecondary} 
      />
      <Text style={{
        fontSize: 12,
        fontWeight: activeTab === tabName ? '600' : '400',
        color: activeTab === tabName ? colors.primary : colors.textSecondary,
        marginTop: spacing.xs / 2,
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        {/* User's Personal Savings Banner */}
        {userSavings && (
          <View style={{
            marginHorizontal: spacing.md,
            marginTop: spacing.md,
            padding: spacing.md,
            backgroundColor: colors.success + '15',
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.success + '30',
          }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>
              My Savings Balance
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.success }}>
              {formatCurrency(userSavings.balance || 0)}
            </Text>
          </View>
        )}

        {/* Tab Navigation */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          marginTop: spacing.md,
          marginHorizontal: spacing.md,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
        }}>
          {renderTabButton('overview', 'Overview', 'bar-chart-outline')}
          {renderTabButton('history', 'History', 'document-text-outline')}
        </View>

        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, flex: 1 }}>
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden', flex: 1 }}>
            <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  {activeTab === 'overview' ? 'Members Savings Overview' : 'Savings Transaction History'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  {activeTab === 'history' && (
                    <TouchableOpacity
                      onPress={handleExportSavings}
                      disabled={exporting}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.success,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: borderRadius.md,
                        gap: spacing.xs,
                      }}
                    >
                      <Ionicons name="download" size={16} color={colors.white} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.white }}>
                        {exporting ? 'Exporting...' : 'Export'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ContributeScreen', {
                      chamaId: currentChamaId,
                      contributionType: 'savings',
                    })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.primary,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      borderRadius: borderRadius.md,
                      gap: spacing.xs,
                    }}
                  >
                    <Ionicons name="wallet" size={16} color={colors.white} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.white }}>
                      Save
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onRefresh}
                    disabled={refreshing || loading}
                    style={{ padding: spacing.xs }}
                  >
                    <Ionicons
                      name="refresh"
                      size={18}
                      color={refreshing || loading ? colors.textTertiary : colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {activeTab === 'overview' && (
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Ionicons name="people" size={14} color={colors.primary} />
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {memberCount} Member{memberCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Ionicons name="wallet" size={14} color={colors.success} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.success }}>
                      Total: {formatCurrency(totalBalance)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {activeTab === 'overview' ? (
              <>
                {renderTableHeader()}
                <FlatList
                  data={savingsData}
                  renderItem={renderRow}
                  keyExtractor={(item) => item.id?.toString()}
                  contentContainerStyle={{ paddingBottom: spacing.sm }}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={[colors.primary]}
                      tintColor={colors.primary}
                    />
                  }
                  ListEmptyComponent={
                    !loading ? renderEmptyState() : null
                  }
                  scrollEnabled={true}
                />
              </>
            ) : (
              <>
                {renderHistoryHeader()}
                <FlatList
                  data={savingsTransactions}
                  renderItem={renderHistoryRow}
                  keyExtractor={(item) => item.id?.toString()}
                  contentContainerStyle={{ paddingBottom: spacing.sm }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    !transactionsLoading ? renderHistoryEmptyState() : <LoadingSpinner />
                  }
                  scrollEnabled={true}
                />
              </>
            )}
          </Card>
        </View>

        {loading && !refreshing && <LoadingSpinner />}

        <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 2.2,
    alignItems: 'flex-start',
  },
  balanceCell: {
    flex: 1.8,
    alignItems: 'center',
  },
  statusCell: {
    flex: 1.5,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  nameText: {
    fontWeight: '600',
    textAlign: 'left',
  },
  cellText: {
    fontSize: 12,
    textAlign: 'center',
  },
  cellSubText: {
    fontSize: 10,
    textAlign: 'left',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  retryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default SavingsOverviewScreen;
