import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';

const AccountManagementScreen = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { width } = useWindowDimensions();
  const { theme } = useApp();
  const { selectedChama } = useChamaContext();
  const colors = getThemeColors(theme);

  const activeWalletTypes = Array.isArray(selectedChama?.permissions?.activeWalletTypes)
    ? selectedChama.permissions.activeWalletTypes
    : ['merry-go-round', 'welfare', 'savings', 'shares', 'dividends', 'loans'];

  const moduleWalletTypeMap = {
    'Loans': 'loans',
    'Welfare': 'welfare',
    'Savings': 'savings',
    'Merry-go-round': 'merry-go-round',
    'Shares': 'shares',
    'Dividends': 'dividends',
  };

  const modules = [
    {
      title: 'Loans',
      icon: 'card',
      color: colors.primary,
      onPress: () => navigation.navigate('LoanManagement', { chamaId }),
      walletType: 'loans',
    },
    {
      title: 'Welfare',
      icon: 'heart',
      color: colors.warning,
      onPress: () => navigation.navigate('WelfareDisbursement', { chamaId }),
      walletType: 'welfare',
    },
    {
      title: 'Subscriptions',
      icon: 'repeat',
      color: colors.info || colors.primary,
      onPress: () => navigation.navigate('SubscriptionManagement', { chamaId }),
    },
    {
      title: 'Savings',
      icon: 'wallet',
      color: colors.secondary,
      onPress: () => navigation.navigate('SavingsWithdrawal', { chamaId }),
      walletType: 'savings',
    },
    {
      title: 'Merry-go-round',
      icon: 'refresh-circle',
      color: colors.primary,
      onPress: () => navigation.navigate('MaryGoRoundDisbursement', { chamaId }),
      walletType: 'merry-go-round',
    },
    {
      title: 'Shares',
      icon: 'cube',
      color: '#8B5CF6',
      onPress: () => navigation.navigate('SharesManagement', { chamaId }),
      walletType: 'shares',
    },
    {
      title: 'Dividends',
      icon: 'cash',
      color: colors.success,
      onPress: () => navigation.navigate('DividendsManagement', { chamaId }),
      walletType: 'dividends',
    },
  ];

  const visibleModules = modules.filter(mod => {
    if (!mod.walletType) return true;
    return activeWalletTypes.includes(mod.walletType);
  });

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const itemsPerRow = isDesktop ? 4 : isTablet ? 4 : 3;

  const mainModules = visibleModules.slice(0, -1);
  const lastModule = visibleModules[visibleModules.length - 1];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stat Cards 2x2 Grid */}
        <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden', marginHorizontal: spacing.md }}>
          <View style={styles.statsContainer}>
            <View style={styles.statRow}>
              <Card variant="outlined" style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="card" size={24} color={colors.primary} />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: colors.text }]}>0</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active Loans</Text>
                </View>
              </Card>

              <Card variant="outlined" style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="heart" size={24} color={colors.warning} />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: colors.text }]}>0</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Welfare Funds</Text>
                </View>
              </Card>
            </View>

            <View style={styles.statRow}>
              <Card variant="outlined" style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="wallet" size={24} color={colors.secondary} />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: colors.text }]}>KES 0</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Savings</Text>
                </View>
              </Card>

              <Card variant="outlined" style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="refresh-circle" size={24} color={colors.info} />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: colors.text }]}>0</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>MGR Cycles</Text>
                </View>
              </Card>
            </View>
          </View>
        </Card>

        {/* Management Modules */}
        <Card variant="outlined" style={styles.navigationContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Management Modules</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {mainModules.map((mod) => (
              <TouchableOpacity
                key={mod.title}
                style={{ width: `${100 / itemsPerRow - 2}%`, alignItems: 'center', marginBottom: spacing.md }}
                onPress={mod.onPress}
              >
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                  <Ionicons name={mod.icon} size={24} color={mod.color} />
                </View>
                <Text style={{ fontSize: typography.fontSize.sm, color: colors.text, textAlign: 'center' }}>
                  {mod.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
            <TouchableOpacity
              onPress={lastModule.onPress}
              style={{ alignItems: 'center' }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <Ionicons name={lastModule.icon} size={24} color={lastModule.color} />
              </View>
              <Text style={{ fontSize: typography.fontSize.sm, color: colors.text, textAlign: 'center' }}>
                {lastModule.title}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  statsContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  statIcon: {
    marginBottom: spacing.sm,
  },
  statContent: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
  },
  navigationContainer: {
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
});

export default AccountManagementScreen;