import React from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import WalletBalanceCard from '../../../components/wallet/WalletBalanceCard';
import WalletQuickActions from '../../../components/wallet/WalletQuickActions';
import useWalletScreen from '../../../hooks/useWalletScreen';

const WalletScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useWalletScreen({ navigation });

  const {
    balanceLoading,
    totalBalance,
    formatCurrency,
    loadRealTimeBalance,
    refreshing,
    onRefresh,
    getWalletIcon,
    getWalletColor,
    getTransactionIcon,
    getTransactionColor,
  } = screen;

  return (
    <SafeAreaView style={[{ flex: 1 }, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <WalletBalanceCard
            balanceLoading={balanceLoading}
            totalBalance={totalBalance}
            formatCurrency={formatCurrency}
            onRefresh={loadRealTimeBalance}
            onTopUp={() => navigation.navigate('Deposit')}
            onWithdraw={() => navigation.navigate('Withdraw')}
            colors={colors}
          />
          <WalletQuickActions
            onHistory={() => navigation.navigate('TransactionHistory')}
            onAIAdvisor={() => navigation.navigate('AIAssistant')}
            colors={colors}
          />
        </ScrollView>

        <PageRefreshButton
          onRefresh={onRefresh}
          refreshing={refreshing}
          color={colors.primary}
          bottom={64}
        />
      </View>
    </SafeAreaView>
  );
};

export default WalletScreen;
