import { useState, useEffect, useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import { useApp } from '../context/AppContext';
import { useChamaContext } from '../context/ChamaContext';
import ApiService from '../services/api';

const isMemberLeft = (member) => {
  if (!member) return false;
  const isActive = member?.is_active;
  return isActive === false || isActive === 0 || isActive === '0' || isActive === 'false';
};

const useAccountManagementScreen = ({ route, navigation }) => {
  const { chamaId: routeChamaId } = route.params;
  const { width } = useWindowDimensions();
  const { theme, user } = useApp();
  const { selectedChama, currentChamaId } = useChamaContext();

  const resolvedChamaId = routeChamaId || currentChamaId;

  const [userMembership, setUserMembership] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      color: theme === 'dark' ? '#4A90E2' : '#2563EB',
      onPress: () => navigation.navigate('LoanManagement', { chamaId: resolvedChamaId }),
      walletType: 'loans',
    },
    {
      title: 'Welfare',
      icon: 'heart',
      color: theme === 'dark' ? '#F59E0B' : '#D97706',
      onPress: () => navigation.navigate('WelfareDisbursement', { chamaId: resolvedChamaId }),
      walletType: 'welfare',
    },
    {
      title: 'Subscriptions',
      icon: 'repeat',
      color: theme === 'dark' ? '#3B82F6' : '#2563EB',
      onPress: () => navigation.navigate('SubscriptionManagement', { chamaId: resolvedChamaId }),
    },
    {
      title: 'Savings',
      icon: 'wallet',
      color: theme === 'dark' ? '#10B981' : '#059669',
      onPress: () => navigation.navigate('SavingsWithdrawal', { chamaId: resolvedChamaId }),
      walletType: 'savings',
    },
    {
      title: 'Merry-go-round',
      icon: 'refresh-circle',
      color: theme === 'dark' ? '#4A90E2' : '#2563EB',
      onPress: () => navigation.navigate('MaryGoRoundDisbursement', { chamaId: resolvedChamaId }),
      walletType: 'merry-go-round',
    },
    {
      title: 'Shares',
      icon: 'cube',
      color: '#8B5CF6',
      onPress: () => navigation.navigate('SharesManagement', { chamaId: resolvedChamaId }),
      walletType: 'shares',
    },
    {
      title: 'Dividends',
      icon: 'cash',
      color: theme === 'dark' ? '#10B981' : '#059669',
      onPress: () => navigation.navigate('DividendsManagement', { chamaId: resolvedChamaId }),
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
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
      setRefreshing(false);
    }
  }, [resolvedChamaId, user?.id]);

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const itemsPerRow = isDesktop ? 4 : isTablet ? 4 : 3;

  const mainModules = visibleModules.slice(0, -1);
  const lastModule = visibleModules[visibleModules.length - 1];

  return {
    resolvedChamaId,
    userMembership,
    membershipLoading,
    currentUserLeft,
    activeWalletTypes,
    visibleModules,
    modules,
    refreshing,
    isDesktop,
    isTablet,
    itemsPerRow,
    mainModules,
    lastModule,
    handleModulePress,
    onRefresh,
  };
};

export { useAccountManagementScreen, isMemberLeft };
export default useAccountManagementScreen;
