import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import { getUserFirstName } from '../../../utils/userUtils';
import WalletCard from '../../../components/wallet/WalletCard';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';

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
  const [userStats, setUserStats] = useState({
    totalChamas: 0,
    totalMeetings: 0,
    totalContributions: 0,
    walletBalance: 0,
  });

  useEffect(() => {
    const personalWallet = wallets.find(w => w.type === 'personal');
    if (personalWallet) {
      setSelectedWallet(personalWallet);
    }
  }, [wallets]);

  useEffect(() => {
    loadUserStatistics();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData(true);
    await loadUserStatistics();
    setRefreshing(false);
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
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
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

  const renderGreetingSection = () => (
    <Card
      style={{
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
        marginBottom: spacing.xs,
        borderRadius: 0,
        borderBottomLeftRadius: borderRadius.lg,
        borderBottomRightRadius: borderRadius.lg,
      }}
      variant="outlined"
    >
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.lg }}>
        <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs }}>
          {getGreeting()}
        </Text>
        <Text style={{ fontSize: typography.fontSize['3xl'], fontWeight: 'bold', color: colors.text, marginBottom: spacing.xs }}>
          Welcome back, {getUserFirstName(user)}
        </Text>
        <Text style={{ fontSize: typography.fontSize.base, color: colors.textSecondary }}>
          Here's what's happening with your finances today
        </Text>
      </View>
    </Card>
  );

  const renderStats = () => {
    const StatTile = ({ icon, label, value, color }) => (
      <View style={{ flex: 1, marginHorizontal: spacing.xs, marginBottom: spacing.sm }}>
        <View style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, height: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 }}>{label}</Text>
          </View>
          <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'bold', color: colors.text }}>{value}</Text>
        </View>
      </View>
    );

    return (
      <Card style={{ marginHorizontal: spacing.md, marginVertical: spacing.xs }} variant="outlined">
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'semibold', color: colors.text, marginBottom: spacing.md }}>
            Your Statistics
          </Text>
          <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
            <StatTile icon="wallet" label="Wallet Balance" value={`Ksh ${userStats.walletBalance.toLocaleString()}`} color={colors.primary} />
            <StatTile icon="people" label="Total Chamas" value={userStats.totalChamas} color={colors.secondary} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <StatTile icon="calendar" label="Active Meetings" value={userStats.totalMeetings} color={colors.warning} />
            <StatTile icon="trending-up" label="Contributions" value={userStats.totalContributions} color={colors.success} />
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
      <View style={{ marginHorizontal: spacing.md, marginVertical: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
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
          <View style={{ paddingHorizontal: spacing.md, marginVertical: spacing.xs }}>
            <WalletCard
              wallet={selectedWallet}
              onDeposit={() => navigation.navigate('Wallet')}
              onWithdraw={() => navigation.navigate('Wallet')}
              onViewTransactions={() => navigation.navigate('TransactionHistory')}
            />
          </View>
        )}

        {renderStats()}
        {renderQuickActions()}
      </ScrollView>
    </SafeAreaView>
  );
};
export default EnhancedUserDashboard;
