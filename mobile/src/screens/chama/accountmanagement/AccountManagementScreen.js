import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { useChamaContext } from '../../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import ApiService from '../../../services/api';

const isMemberLeft = (member) => {
  if (!member) return false;
  const isActive = member?.is_active;
  return isActive === false || isActive === 0 || isActive === '0' || isActive === 'false';
};

const AccountManagementScreen = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { width } = useWindowDimensions();
  const { theme, user } = useApp();
  const { selectedChama, currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const resolvedChamaId = chamaId || currentChamaId;

  const [userMembership, setUserMembership] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(true);

  // Check if the current user is still an active member
  useEffect(() => {
    const checkMembership = async () => {
      try {
        const response = await ApiService.getChamaMember(resolvedChamaId, user?.id);
        if (response.success) {
          setUserMembership(response.data);
        } else {
          setUserMembership(null);
        }
      } catch (error) {
        setUserMembership(null);
      } finally {
        setMembershipLoading(false);
      }
    };

    if (resolvedChamaId && user?.id) {
      checkMembership();
    }
  }, [resolvedChamaId, user?.id]);

  const currentUserLeft = userMembership ? isMemberLeft(userMembership) : false;

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

  useEffect(() => {
    if (!membershipLoading && currentUserLeft) {
      Alert.alert(
        'Access Denied',
        'You are no longer a member of this chama. You cannot access account management features.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
        { cancelable: false }
      );
    }
  }, [membershipLoading, currentUserLeft, navigation]);

  const handleModulePress = (mod) => {
    if (currentUserLeft) {
      Alert.alert(
        'Access Denied',
        'You can no longer make or receive disbursements because you have left this chama.',
        [{ text: 'OK' }]
      );
      return;
    }
    mod.onPress();
  };

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