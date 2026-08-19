import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import useSavingsOverviewScreen from '../../../hooks/useSavingsOverviewScreen';
import UserSavingsBanner from '../../../components/savings/UserSavingsBanner';
import TabButton from '../../../components/savings/TabButton';
import SavingsOverviewTable from '../../../components/savings/SavingsOverviewTable';
import SavingsHistoryTable from '../../../components/savings/SavingsHistoryTable';

const SavingsOverviewScreen = ({ navigation, route }) => {
  const {
    colors,
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
    formatCurrency,
    formatDate,
  } = useSavingsOverviewScreen({ navigation, route });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <UserSavingsBanner
          colors={colors}
          userSavings={userSavings}
          formatCurrency={formatCurrency}
        />

        <View style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          marginTop: spacing.md,
          marginHorizontal: spacing.md,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
        }}>
          <TabButton
            colors={colors}
            activeTab={activeTab}
            tabName="overview"
            label="Overview"
            iconName="bar-chart-outline"
            onPress={() => setActiveTab('overview')}
          />
          <TabButton
            colors={colors}
            activeTab={activeTab}
            tabName="history"
            label="History"
            iconName="document-text-outline"
            onPress={() => setActiveTab('history')}
          />
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
              <SavingsOverviewTable
                colors={colors}
                savingsData={savingsData}
                loading={loading}
                error={error}
                refreshing={refreshing}
                onRefresh={onRefresh}
                fetchSavingsData={fetchSavingsData}
                formatCurrency={formatCurrency}
              />
            ) : (
              <SavingsHistoryTable
                colors={colors}
                savingsTransactions={savingsTransactions}
                transactionsLoading={transactionsLoading}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
              />
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
});

export default SavingsOverviewScreen;
