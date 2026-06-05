import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import { spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';

const AccountManagementScreen = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const modules = [
    {
      title: 'Loans',
      icon: 'card',
      color: colors.primary,
      route: 'LoanManagement',
      bg: colors.primary + '20',
    },
    {
      title: 'Welfare',
      icon: 'heart',
      color: colors.warning,
      route: 'WelfareDisbursement',
      bg: colors.warning + '20',
    },
    {
      title: 'Savings',
      icon: 'wallet',
      color: colors.secondary,
      route: 'SavingsWithdrawal',
      bg: colors.secondary + '20',
    },
    {
      title: 'Merry-go-round',
      icon: 'refresh-circle',
      color: colors.primary,
      route: 'MaryGoRoundDisbursement',
      bg: colors.primary + '20',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stat Cards 2x2 Grid */}
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

        {/* Management Modules */}
        <View style={styles.navigationContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Management Modules</Text>

          <View style={styles.navigationGrid}>
            {modules.map((mod, idx) => (
              <TouchableOpacity
                key={mod.title}
                style={styles.navCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate(mod.route, { chamaId })}
              >
                <View style={[styles.navIcon, { backgroundColor: mod.bg }]}>
                  <Ionicons name={mod.icon} size={32} color={mod.color} />
                </View>
                <Text style={[styles.navTitle, { color: colors.text }]}>{mod.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// 🎨 SECURE ACCOUNT MANAGEMENT STYLES
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
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: borderRadius.lg,
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
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
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
    textAlign: 'center',
  },
  navigationGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navCard: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    flex: 1,
  },
  navIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  navTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
});

export default AccountManagementScreen;