import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../common/Card';

const WalletBalanceCard = ({
  balanceLoading,
  totalBalance,
  formatCurrency,
  onRefresh,
  onTopUp,
  onWithdraw,
  colors,
}) => {
  return (
    <Card style={{ margin: spacing.md }} variant="outlined">
      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <Text style={[{ fontSize: typography.fontSize.base, marginBottom: spacing.sm }, { color: colors.textSecondary }]}>
          Total Balance
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          {balanceLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[{ fontSize: typography.fontSize.sm, fontStyle: 'italic' }, { color: colors.textSecondary }]}>
                Updating...
              </Text>
            </View>
          ) : (
            <Text style={[{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold }, { color: colors.text }]}>
              {formatCurrency(totalBalance)}
            </Text>
          )}
          <TouchableOpacity
            onPress={onRefresh}
            style={[{ padding: spacing.sm, borderRadius: borderRadius.full }, { backgroundColor: colors.primary + '20' }]}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <TouchableOpacity
          style={[{ flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.lg }, { backgroundColor: colors.info + '20' }]}
          onPress={onTopUp}
        >
          <Ionicons name="add" size={24} color={colors.info} />
          <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.sm }, { color: colors.info }]}>
            Top Up
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[{ flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.lg }, { backgroundColor: colors.error + '20' }]}
          onPress={onWithdraw}
        >
          <Ionicons name="arrow-up-circle" size={24} color={colors.error} />
          <Text style={[{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginTop: spacing.sm }, { color: colors.error }]}>
            Withdraw
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

export default WalletBalanceCard;
