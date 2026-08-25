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
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import useAccountManagementScreen, { isMemberLeft } from '../../../hooks/useAccountManagementScreen';

const AccountManagementScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useAccountManagementScreen({ route, navigation });

  const {
    userMembership,
    membershipLoading,
    currentUserLeft,
    visibleModules,
    refreshing,
    itemsPerRow,
    mainModules,
    lastModule,
    handleModulePress,
    onRefresh,
  } = screen;

  const { resolvedChamaId } = screen;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Stat Cards 2x2 Grid */}
          <Card variant="outlined" style={{ borderRadius: 8, overflow: 'hidden', marginHorizontal: spacing.sm }}>
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
                    <Ionicons name="refresh-circle" size={24} color={colors.info || colors.primary} />
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
                   onPress={() => handleModulePress(mod)}
                   disabled={currentUserLeft}
                   activeOpacity={currentUserLeft ? 1 : 0.7}
                 >
                   <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: currentUserLeft ? colors.error : colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, opacity: currentUserLeft ? 0.5 : 1 }}>
                     <Ionicons name={mod.icon} size={24} color={currentUserLeft ? colors.error : mod.color} />
                   </View>
                   <Text style={{
                     fontSize: typography.fontSize.sm,
                     color: currentUserLeft ? colors.error : colors.text,
                     textAlign: 'center',
                     textDecorationLine: currentUserLeft ? 'line-through' : 'none',
                   }}>
                     {mod.title}
                   </Text>
                 </TouchableOpacity>
               ))}
            </View>
            <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
              <TouchableOpacity
                 onPress={() => handleModulePress(lastModule)}
                 style={{ alignItems: 'center' }}
                 disabled={currentUserLeft}
                 activeOpacity={currentUserLeft ? 1 : 0.7}
               >
                 <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: currentUserLeft ? colors.error : colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, opacity: currentUserLeft ? 0.5 : 1 }}>
                   <Ionicons name={lastModule.icon} size={24} color={currentUserLeft ? colors.error : lastModule.color} />
                 </View>
                 <Text style={{
                   fontSize: typography.fontSize.sm,
                   color: currentUserLeft ? colors.error : colors.text,
                   textAlign: 'center',
                   textDecorationLine: currentUserLeft ? 'line-through' : 'none',
                 }}>
                   {lastModule.title}
                 </Text>
               </TouchableOpacity>
            </View>
            </Card>
        </ScrollView>
        <PageRefreshButton onRefresh={onRefresh} refreshing={refreshing} color={colors.primary} bottom={64} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
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
