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

        {/* Navigation Icons */}
        <View style={styles.navigationContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Management Modules</Text>

          <View style={styles.navigationGrid}>
            <TouchableOpacity style={[styles.navIcon, { backgroundColor: colors.primary + '20' }]} onPress={() => navigation.navigate('LoanManagement', { chamaId })}>
              <Card style={styles.navIcon}>
                  <Ionicons name="card" size={32} color={colors.primary} />
              </Card>
                <Text style={[styles.navTitle, { color: colors.text }]}>Loans</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.navIcon, { backgroundColor: colors.primary + '20' }]} onPress={() => navigation.navigate('WelfareDisbursement', { chamaId })}>
              <Card style={styles.navIcon}>
                  <Ionicons name="heart" size={32} color={colors.warning} />
              </Card>
                <Text style={[styles.navTitle, { color: colors.text }]}>Welfare</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.navIcon, { backgroundColor: colors.primary + '20' }]} onPress={() => navigation.navigate('SavingsWithdrawal', { chamaId })}>
              <Card style={styles.navIcon}>
                  <Ionicons name="wallet" size={32} color={colors.secondary} />
              </Card>
               <Text style={[styles.navTitle, { color: colors.text }]}>Savings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.navIcon, { backgroundColor: colors.primary + '20' }]} onPress={() => navigation.navigate('MaryGoRoundDisbursement', { chamaId })}>
              <Card style={styles.navIcon}>
                  <Ionicons name="refresh-circle" size={32} color={colors.primary} />
              </Card>
                <Text style={[styles.navTitle, { color: colors.text }]}>Merry-go-round</Text>
            </TouchableOpacity>
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
    backgroundColor: 'white',
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
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  navCard: {
    flex: 0.48,
    margin: spacing.sm,
  },
  navCardContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  navIcon: {
    width: 60,
    height: 60,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  navTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  navSubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default AccountManagementScreen;