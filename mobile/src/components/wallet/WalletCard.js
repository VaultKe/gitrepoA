import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Card from '../common/Card';
import Button from '../common/Button';

const WalletCard = ({
  wallet,
  onDeposit,
  onWithdraw,
  onViewTransactions,
  style,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getWalletIcon = () => {
    switch (wallet?.type) {
      case 'personal':
        return 'wallet';
      case 'chama':
        return 'people';
      case 'business':
        return 'business';
      default:
        return 'wallet';
    }
  };

  const getWalletTypeLabel = () => {
    switch (wallet?.type) {
      case 'personal':
        return 'Personal Wallet';
      case 'chama':
        return 'Chama Wallet';
      case 'business':
        return 'Business Wallet';
      default:
        return 'Wallet';
    }
  };

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(!isBalanceVisible);
  };

  const handleQuickAction = (action) => {
    if (wallet?.is_locked) {
      Alert.alert(
        'Wallet Locked',
        'This wallet is currently locked. Please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    switch (action) {
      case 'deposit':
        onDeposit?.(wallet);
        break;
      case 'withdraw':
        onWithdraw?.(wallet);
        break;
      case 'transactions':
        onViewTransactions?.(wallet);
        break;
    }
  };

  const renderBalance = () => {
    if (!isBalanceVisible) {
      return (
        <Text style={[styles.balanceAmount, { color: colors.text }]}>
          ••••••
        </Text>
      );
    }

    return (
      <Text style={[styles.balanceAmount, { color: colors.text }]}>
        {formatCurrency(wallet?.balance || 0)}
      </Text>
    );
  };

  const renderQuickActions = () => {
    return (
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: colors.primary }]}
          onPress={() => handleQuickAction('deposit')}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={[styles.quickActionText, { color: colors.white }]}>
            Deposit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: colors.secondary }]}
          onPress={() => handleQuickAction('withdraw')}
        >
          <Ionicons name="remove" size={20} color={colors.white} />
          <Text style={[styles.quickActionText, { color: colors.white }]}>
            Withdraw
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: colors.backgroundTertiary }]}
          onPress={() => handleQuickAction('transactions')}
        >
          <Ionicons name="list" size={20} color={colors.text} />
          <Text style={[styles.quickActionText, { color: colors.text }]}>
            History
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (!wallet) {
    return (
      <Card style={[styles.container, style]}>
        <View style={styles.emptyState}>
          <Ionicons name="wallet-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No wallet found
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={[styles.container, style]} variant="outlined">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.walletInfo}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
            <Ionicons 
              name={getWalletIcon()} 
              size={24} 
              color={colors.white} 
            />
          </View>
          <View style={styles.walletDetails}>
            <Text style={[styles.walletType, { color: colors.text }]}>
              {getWalletTypeLabel()}
            </Text>
            <Text style={[styles.walletStatus, { color: colors.textSecondary }]}>
              {wallet.is_active ? 'Active' : 'Inactive'}
              {wallet.is_locked && ' • Locked'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={toggleBalanceVisibility}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isBalanceVisible ? 'eye' : 'eye-off'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Balance */}
      <View style={styles.balanceSection}>
        <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
          Available Balance
        </Text>
        {renderBalance()}
        <Text style={[styles.currency, { color: colors.textTertiary }]}>
          Kenyan Shilling
        </Text>
      </View>

      {/* Limits */}
      {(wallet.daily_limit || wallet.monthly_limit) && (
        <View style={styles.limitsSection}>
          {wallet.daily_limit && (
            <View style={styles.limitItem}>
              <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>
                Daily Limit
              </Text>
              <Text style={[styles.limitAmount, { color: colors.text }]}>
                {formatCurrency(wallet.daily_limit)}
              </Text>
            </View>
          )}
          {wallet.monthly_limit && (
            <View style={styles.limitItem}>
              <Text style={[styles.limitLabel, { color: colors.textSecondary }]}>
                Monthly Limit
              </Text>
              <Text style={[styles.limitAmount, { color: colors.text }]}>
                {formatCurrency(wallet.monthly_limit)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Quick Actions */}
      {wallet.is_active && !wallet.is_locked && renderQuickActions()}

      {/* Locked State */}
      {wallet.is_locked && (
        <View style={styles.lockedState}>
          <Ionicons name="lock-closed" size={20} color={colors.warning} />
          <Text style={[styles.lockedText, { color: colors.warning }]}>
            This wallet is currently locked
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  walletDetails: {
    flex: 1,
  },
  walletType: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  walletStatus: {
    fontSize: typography.fontSize.sm,
  },
  balanceSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  currency: {
    fontSize: typography.fontSize.sm,
  },
  limitsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  limitItem: {
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  limitAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    minHeight: 60,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
  },
  lockedState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  lockedText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
  },
});

export default WalletCard;
