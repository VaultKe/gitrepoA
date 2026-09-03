import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  useWindowDimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import { getUserFirstName } from '../../../utils/userUtils';
import WalletCard from '../../../components/wallet/WalletCard';
import Card from '../../../components/common/Card';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ApiService from '../../../services/api';
import {
  buildWalletTrendSeries,
  buildTrendSeries,
  buildContributionTrendSeries,
  getTrendPercent,
  getLastMonthsLabels,
  formatCompact,
  MiniAreaChart,
  WalletTrendChart,
} from './dashboardChartHelpers';

const EnhancedUserDashboard = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const {
    user,
    wallets,
    isSyncing,
    theme,
    refreshData,
  } = useApp();

  const colors = getThemeColors(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [maskStats, setMaskStats] = useState(false);
  const [userStats, setUserStats] = useState({
    totalChamas: 0,
    totalMeetings: 0,
    totalContributions: 0,
    walletBalance: 0,
  });
  const [walletTransactions, setWalletTransactions] = useState([]);

  useEffect(() => {
    const personalWallet = wallets.find(w => w.type === 'personal');
    if (personalWallet) {
      setSelectedWallet(personalWallet);
    }
  }, [wallets]);

  useEffect(() => {
    loadUserStatistics();
    loadWalletTransactions();
  }, []);

  const loadUserStatistics = async () => {
    try {
      const response = await ApiService.getUserStatistics();
      if (response.success) {
        const { wallet_stats, chama_stats, contribution_stats, meeting_stats } = response.data;
        setUserStats({
          totalChamas: chama_stats?.active_chamas || 0,
          totalMeetings: meeting_stats?.active_meetings || 0,
          totalContributions: contribution_stats?.total_contributions || 0,
          walletBalance: wallet_stats?.personal_balance || 0,
        });
      }
    } catch (error) {
      // Silently ignore statistics load errors - dashboard still works with defaults
    }
  };

  const loadWalletTransactions = async () => {
    try {
      const response = await ApiService.getTransactions(100, 0);
      if (response.success && Array.isArray(response.data)) {
        setWalletTransactions(response.data);
      } else {
        setWalletTransactions([]);
      }
    } catch (error) {
      console.warn('Failed to load wallet transactions for dashboard:', error);
      setWalletTransactions([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData(true);
      await loadUserStatistics();
      await loadWalletTransactions();
    } catch (error) {
      console.warn('Dashboard refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning'};
    if (hour < 17) return { text: 'Good afternoon'};
    return { text: 'Good evening'};
  };

  const quickActions = [
    {
      id: 1,
      title: 'Wallet',
      icon: 'wallet',
      color: colors.primary,
      onPress: () => navigation.navigate('Wallet'),
    },
    {
      id: 5,
      title: 'Groups',
      icon: 'people',
      color: colors.secondary,
      onPress: () => navigation.navigate('MyChamas'),
    },
    {
      id: 3,
      title: 'Meetings',
      icon: 'calendar',
      color: colors.primary,
      onPress: () => navigation.navigate('Meetings'),
    },
    {
      id: 4,
      title: 'Reminders',
      icon: 'notifications',
      color: colors.accent,
      onPress: () => navigation.navigate('Reminders'),
    },
    {
      id: 2,
      title: 'AI Assistant',
      icon: 'chatbubble-ellipses',
      color: colors.secondary,
      onPress: () => navigation.navigate('AIAssistant'),
    },
    {
      id: 6,
      title: 'Transactions',
      icon: 'receipt',
      color: colors.accent,
      onPress: () => navigation.navigate('TransactionHistory'),
    },
    {
      id: 7,
      title: 'Chat',
      icon: 'chatbubble',
      color: colors.secondary,
      onPress: () => navigation.navigate('Chat'),
    },
  ];

   const renderGreetingSection = () => {
     const greeting = getGreeting();
    return (
       <LinearGradient
         colors={[colors.primary, colors.secondary || colors.primary]}
         start={{ x: 0, y: 0 }}
         end={{ x: 1, y: 1 }}
         style={{ marginHorizontal: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, borderRadius: borderRadius.xl, position: 'relative' }}
       >
         <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
           <View style={{ flex: 1, paddingRight: spacing.sm }}>
             <Text style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.9)', marginBottom: spacing.xs }}>
               {greeting.text} {greeting.emoji}
             </Text>
             <Text style={{ fontSize: typography.fontSize.xl, fontWeight: 'bold', color: '#fff', marginBottom: spacing.xs }}>
               Welcome back, <Text style={{ fontWeight: '800' }}>{getUserFirstName(user)}</Text>
             </Text>
             <Text style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.85)' }}>
               Here's what's happening with your finances today
             </Text>
           </View>
          <Image source={require('../../../../assets/wallet.png')} style={{ width: 128, height: 128, resizeMode: 'contain' }} />
         </View>

         <TouchableOpacity
           onPress={() => setMaskStats(!maskStats)}
           style={{ position: 'absolute', right: spacing.sm, top: spacing.sm, padding: 8, borderRadius: 20, backgroundColor: colors.surface + '40', zIndex: 20 }}
         >
           <Ionicons name={maskStats ? 'eye-off' : 'eye'} size={18} color={colors.white} />
         </TouchableOpacity>
        </LinearGradient>
     );
   };

  const renderStats = () => {
    const StatTile = ({ icon, label, value, color, trendData, gradientId }) => {
      const trendPercent = trendData ? getTrendPercent(trendData) : null;
      const isPositive = (trendPercent || 0) >= 0;
      const hasSignal = trendData && trendData[trendData.length - 1] > 0;

      return (
        <View style={{ flex: 1, marginHorizontal: spacing.xs, marginBottom: spacing.sm, height: 152 }}>
          <View style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, height: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                <Ionicons name={icon} size={20} color={color} />
              </View>
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 }} numberOfLines={1}>{label}</Text>
            </View>

            <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'bold', color: colors.text, marginBottom: spacing.xs }}>
              {maskStats ? (typeof value === 'number' ? '•••' : '•••') : value}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {hasSignal ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={isPositive ? 'arrow-up' : 'arrow-down'} size={11} color={isPositive ? colors.success : (colors.error || '#EF4444')} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isPositive ? colors.success : (colors.error || '#EF4444'), marginLeft: 2 }}>
                    {Math.abs(trendPercent).toFixed(1)}%
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>No change</Text>
              )}

              {trendData ? (
                <MiniAreaChart data={trendData} color={color} gradientId={gradientId} width={72} height={36} />
              ) : null}
            </View>
          </View>
        </View>
      );
    };

    return (
      <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'semibold', color: colors.text, marginBottom: spacing.md }}>
            Your Statistics
          </Text>
          <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
            <StatTile
              icon="wallet"
              label="Wallet Balance"
              value={`Ksh ${userStats.walletBalance.toLocaleString()}`}
              color={colors.primary}
              trendData={buildWalletTrendSeries(userStats.walletBalance, walletTransactions, selectedWallet?.id, 6)}
              gradientId="statWallet"
            />
            <StatTile
              icon="people"
              label="Total Chamas"
              value={userStats.totalChamas}
              color={colors.secondary}
              trendData={buildTrendSeries(userStats.totalChamas, 6)}
              gradientId="statChamas"
            />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <StatTile
              icon="calendar"
              label="Active Meetings"
              value={userStats.totalMeetings}
              color={colors.warning}
              trendData={buildTrendSeries(userStats.totalMeetings, 6)}
              gradientId="statMeetings"
            />
            <StatTile
              icon="trending-up"
              label="Contributions"
              value={userStats.totalContributions}
              color={colors.success}
              trendData={buildContributionTrendSeries(walletTransactions, 6)}
              gradientId="statContributions"
            />
          </View>
        </View>
      </Card>
    );
  };

  const renderWalletTrend = () => {
    const currentBalance = userStats.walletBalance || 0;
    const points = 6;
    const series = buildWalletTrendSeries(currentBalance, walletTransactions, selectedWallet?.id, points);
    const labels = getLastMonthsLabels(points);
    const growthPercent = getTrendPercent(series);
    const isPositive = growthPercent >= 0;

    const cardMargin = spacing.sm;
    const cardPadding = spacing.md;
    const rightColWidth = 104;
    const yAxisWidth = 34;
    const innerWidth = width - cardMargin * 2 - cardPadding * 2 - spacing.sm * 2;
    const chartWidth = Math.max(innerWidth - rightColWidth - spacing.md - yAxisWidth, 100);
    const chartHeight = 130;
    const maxValue = Math.max(...series, 1);
    const gridLabels = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];

    return (
      <Card style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs }} variant="outlined">
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'semibold', color: colors.text }}>
                Wallet Overview
              </Text>
              <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                Your wallet balance over time
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('TransactionHistory')}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.lg, backgroundColor: colors.primary + '15' }}
            >
              <Text style={{ fontSize: typography.fontSize.xs, color: colors.primary, fontWeight: '600', marginRight: 4 }}>
                View Report
              </Text>
              <Ionicons name="arrow-forward" size={12} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
            <View style={{ justifyContent: 'space-between', height: chartHeight, marginRight: 4, width: yAxisWidth - 4 }}>
              {gridLabels.map((v, i) => (
                <Text key={i} style={{ fontSize: 9, color: colors.textSecondary }}>{formatCompact(v)}</Text>
              ))}
            </View>

            <View>
              <WalletTrendChart data={series} color={colors.primary} width={chartWidth} height={chartHeight} gradientId="walletOverview" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: chartWidth, marginTop: 4 }}>
                {labels.map((l, i) => (
                  <Text key={i} style={{ fontSize: 9, color: colors.textSecondary }}>{l}</Text>
                ))}
              </View>
            </View>

            <View style={{ width: rightColWidth, paddingLeft: spacing.sm, height: chartHeight, justifyContent: 'center' }}>
              <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>Current Balance</Text>
              <Text
                style={{ fontSize: typography.fontSize.base, fontWeight: 'bold', color: colors.text, marginTop: 2 }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {maskStats ? '•••' : formatCurrency(currentBalance)}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  backgroundColor: (isPositive ? colors.success : (colors.error || '#EF4444')) + '15',
                  paddingHorizontal: spacing.xs,
                  paddingVertical: 2,
                  borderRadius: borderRadius.md,
                  marginTop: spacing.xs,
                }}
              >
                <Ionicons name={isPositive ? 'arrow-up' : 'arrow-down'} size={10} color={isPositive ? colors.success : (colors.error || '#EF4444')} />
                <Text style={{ fontSize: 10, fontWeight: '600', color: isPositive ? colors.success : (colors.error || '#EF4444'), marginLeft: 2 }}>
                  {Math.abs(growthPercent).toFixed(1)}%
                </Text>
              </View>
              <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 2 }}>from last month</Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const renderQuickActions = () => {
    const isDesktop = width >= 1024;
    const isTablet = width >= 768;
    const itemsPerRow = isDesktop ? 4 : isTablet ? 3 : 3;

    const mainActions = quickActions.slice(0, -1);
    const lastAction = quickActions[quickActions.length - 1];

    return (
      <View style={{ marginHorizontal: spacing.sm, marginVertical: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
        <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'semibold', color: colors.text, marginBottom: spacing.md }}>
          Quick Actions
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {mainActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={{ width: `${100 / itemsPerRow - 2}%`, alignItems: 'center', marginBottom: spacing.md }}
              onPress={action.onPress}
            >
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.text, textAlign: 'center' }}>
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
          <TouchableOpacity
            onPress={lastAction.onPress}
            style={{ alignItems: 'center' }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
              <Ionicons name={lastAction.icon} size={24} color={lastAction.color} />
            </View>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.text, textAlign: 'center' }}>
              {lastAction.title}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isSyncing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {renderGreetingSection()}

          {selectedWallet && (
            <View style={{ paddingHorizontal: spacing.sm, marginVertical: spacing.xs }}>
              <WalletCard
                wallet={selectedWallet}
                onDeposit={() => navigation.navigate('Wallet')}
                onWithdraw={() => navigation.navigate('Wallet')}
                onViewTransactions={() => navigation.navigate('TransactionHistory')}
              />
            </View>
          )}

          {renderStats()}
          {renderWalletTrend()}
          {renderQuickActions()}
        </ScrollView>

        <PageRefreshButton
          onRefresh={onRefresh}
          refreshing={refreshing || isSyncing}
          color={colors.primary}
          bottom={64}
        />
      </View>
    </SafeAreaView>
  );
};
export default EnhancedUserDashboard;