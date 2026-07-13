import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ApiService from '../../../services/api';

const { width } = Dimensions.get('window');

const ChamaDashboard = ({ navigation, onRouteChange, route }) => {
  const { theme, user, selectedChama, setSelectedChama, chamas } = useApp();
  const colors = getThemeColors(theme);

  const [userChamas, setUserChamas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chamaFeatures, setChamaFeatures] = useState({
    allowMerryGoRound: true,
    allowWelfare: true,
    activeWalletTypes: ['merry-go-round', 'welfare', 'savings', 'shares', 'dividends', 'loans'],
  });
  const [chamaStats, setChamaStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [realTimeData, setRealTimeData] = useState({
    walletBalance: 0,
    totalContributions: 0,
    totalMembers: 0,
    totalMeetings: 0,
    lastUpdated: null,
  });

  // Ref to track current chama ID to prevent race conditions
  const currentChamaIdRef = useRef(null);

  // Cache for chama data to enable fast switching
  const chamaDataCache = useRef(new Map());
  const cacheExpiryTime = 5 * 60 * 1000; // 5 minutes

  // Cache helper functions
  const getCachedChamaData = (chamaId) => {
    const cached = chamaDataCache.current.get(chamaId);
    if (cached && (Date.now() - cached.timestamp) < cacheExpiryTime) {
      return cached.data;
    }
    return null;
  };

  const setCachedChamaData = (chamaId, data) => {
    chamaDataCache.current.set(chamaId, {
      data,
      timestamp: Date.now()
    });
  };

  // Fast chama switching function
  const switchToChama = (chama) => {
    // Immediately update the selected chama for instant UI response
    setSelectedChama(chama);

    // Extract wallet types from chama permissions if available
    const permissions = chama?.permissions || {};
    const activeWalletTypes = Array.isArray(permissions.activeWalletTypes)
      ? permissions.activeWalletTypes
      : ['merry-go-round', 'welfare', 'savings', 'shares', 'dividends', 'loans'];

    // Check if we have cached data for this chama
    const cachedData = getCachedChamaData(chama.id);
    if (cachedData) {
      // Use cached data immediately for instant switching
      setRealTimeData(cachedData.realTimeData);
      setChamaStats(cachedData.chamaStats);
      setChamaFeatures({
        ...cachedData.chamaFeatures,
        activeWalletTypes,
      });
    } else {
      // No cached data, show loading and fetch fresh data
      setStatsLoading(true);
      // Set features immediately from chama data
      setChamaFeatures({
        allowMerryGoRound: permissions.allowMerryGoRound ?? true,
        allowWelfare: permissions.allowWelfare ?? true,
        activeWalletTypes,
      });
    }

    // Always fetch fresh data in the background (but don't block UI)
    setTimeout(() => {
      loadChamaStatistics(chama.id);
    }, 100); // Small delay to allow UI to update first
  };

  // Preload data for multiple chamas in the background
  const preloadChamaData = async (chamas) => {
    for (const chama of chamas) {
      // Skip if already cached or if it's the currently selected chama
      if (getCachedChamaData(chama.id) || chama.id === selectedChama?.id) {
        continue;
      }

      try {
        // Load data for this chama without affecting UI
        const [statsResponse] = await Promise.all([
          ApiService.getChamaStatistics(chama.id)
        ]);

        if (statsResponse.success && statsResponse.data) {
          const stats = statsResponse.data;
          const financialStats = stats.financial_stats || {};
          const memberStats = stats.member_stats || {};
          const activityStats = stats.activity_stats || {};
          const chamaInfo = stats.chama_info || {};
          const userStats = stats.user_stats || {};

          const preloadedRealTimeData = {
            walletBalance: chamaInfo.wallet_balance || chamaInfo.total_funds || 0,
            totalContributions: financialStats.total_contributions || 0,
            contributionCount: financialStats.total_transactions || 0,
            totalMembers: memberStats.active_members || memberStats.total_members || chamaInfo.current_members || 0,
            totalMeetings: activityStats.total_meetings || 0,
            upcomingMeetings: activityStats.upcoming_meetings || 0,
            ongoingMeetings: activityStats.ongoing_meetings || 0,
            completedMeetings: activityStats.completed_meetings || 0,
            totalTransactions: financialStats.total_transactions || 0,
            averageContribution: financialStats.average_contribution || 0,
            userRole: userStats.role || 'member',
            userTransactionCount: userStats.total_transactions || 0,
            userContributionCount: userStats.contribution_count || 0,
            lastUpdated: new Date().toISOString(),
          };

          // Cache the preloaded data
          setCachedChamaData(chama.id, {
            realTimeData: preloadedRealTimeData,
            chamaStats: statsResponse.data,
            chamaFeatures: {
              allowMerryGoRound: true,
              allowWelfare: true,
              activeWalletTypes: [],
            }
          });
        }
      } catch (error) {

      }

      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // Handle chama selection from navigation params (when coming from chama list)
  useEffect(() => {
    if (route?.params?.chamaId && route?.params?.chama) {
      const chamaFromParams = route.params.chama;
      setSelectedChama(chamaFromParams);
    } else if (route?.params?.chamaId && !selectedChama) {
      // If we have chamaId but no chama object, try to find it in userChamas
      const foundChama = userChamas.find(c => c.id === route.params.chamaId);
      if (foundChama) {
        setSelectedChama(foundChama);
      }
    }
  }, [route?.params, userChamas]);

  useEffect(() => {
    loadUserChamas();
  }, []);

  useEffect(() => {
    if (selectedChama) {
      const chamaId = selectedChama?.id || selectedChama?.chamaId || selectedChama;
      currentChamaIdRef.current = chamaId;
      loadChamaFeatures();
      loadChamaStatistics();
    } else {
      currentChamaIdRef.current = null;
    }
  }, [selectedChama]);

  // Auto-refresh statistics every 30 seconds when screen is active
  useEffect(() => {
    if (!selectedChama) return;

    // Get the current chama ID to prevent stale closures
    const currentChamaId = selectedChama?.id || selectedChama?.chamaId || selectedChama;

    const interval = setInterval(() => {
      loadChamaStatistics(currentChamaId);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [selectedChama?.id || selectedChama?.chamaId || selectedChama]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (selectedChama) {
        const currentChamaId = selectedChama?.id || selectedChama?.chamaId || selectedChama;
        loadChamaStatistics(currentChamaId);
      }
    }, [selectedChama?.id || selectedChama?.chamaId || selectedChama])
  );

  const loadUserChamas = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getUserChamas(20, 0);
      if (response.success) {
        const userChamasData = response.data || [];
        setUserChamas(userChamasData);

        // If no chama is currently selected and we have chamas, select the first one
        if (userChamasData.length > 0 && !selectedChama) {
          setSelectedChama(userChamasData[0]);
        }

        // If we have a selected chama, make sure it's still in the list (in case it was deleted)
        if (selectedChama && !userChamasData.find(c => c.id === selectedChama.id)) {
          setSelectedChama(null);
        }

        // Preload data for other chamas in the background for faster switching
        setTimeout(() => {
          preloadChamaData(userChamasData);
        }, 2000); // Wait 2 seconds after initial load
      }
    } catch (error) {

      // Set empty array on error to show empty state
      setUserChamas([]);
    } finally {
      setLoading(false);
    }
  };

  const loadChamaFeatures = async () => {
    try {
      if (!selectedChama) {

        return;
      }

      // Extract chamaId properly
      let chamaId;
      if (typeof selectedChama === 'string') {
        chamaId = selectedChama;
      } else if (selectedChama && selectedChama.id) {
        chamaId = selectedChama.id;
      } else {

        return;
      }

      // Ensure chamaId is a string
      chamaId = String(chamaId);
      const response = await ApiService.makeRequest(`/chamas/${chamaId}`);
      if (response.success && response.data) {
        const chama = response.data;
        const permissions = chama.permissions || {};
        const activeWalletTypes = Array.isArray(permissions.activeWalletTypes)
          ? permissions.activeWalletTypes
          : [];
        setChamaFeatures({
          allowMerryGoRound: permissions.allowMerryGoRound ?? true,
          allowWelfare: permissions.allowWelfare ?? true,
          activeWalletTypes,
        });
      }
    } catch (error) {

      // Keep default features on error
    }
  };

  const loadChamaStatistics = async (targetChamaId = null) => {
    // Use provided chamaId or extract from selectedChama
    const currentChama = selectedChama;
    if (!currentChama && !targetChamaId) {

      return;
    }

    try {
      setStatsLoading(true);

      // Extract chamaId properly
      let chamaId = targetChamaId;
      if (!chamaId) {
        if (typeof currentChama === 'string') {
          chamaId = currentChama;
        } else if (currentChama.id) {
          chamaId = currentChama.id;
        } else if (currentChama.chamaId) {
          chamaId = currentChama.chamaId;
        } else {
          throw new Error('Invalid chama ID format');
        }
      }
      // Get comprehensive chama statistics
      const [statsResponse, chamaResponse] = await Promise.all([
        ApiService.getChamaStatistics(chamaId),
        ApiService.getChamaById(chamaId)
      ]);

      // Check if the chama is still the same (prevent race conditions)
      if (currentChamaIdRef.current !== chamaId) {
        return;
      }
      if (statsResponse.success && statsResponse.data) {
        setChamaStats(statsResponse.data);

        // Update real-time data from statistics
        const stats = statsResponse.data;
        const financialStats = stats.financial_stats || {};
        const memberStats = stats.member_stats || {};
        const activityStats = stats.activity_stats || {};
        const chamaInfo = stats.chama_info || {};
        const userStats = stats.user_stats || {};

        const newRealTimeData = {
          walletBalance: chamaInfo.wallet_balance || chamaInfo.total_funds || 0,
          totalContributions: financialStats.total_contributions || 0,
          contributionCount: financialStats.total_transactions || 0, // Number of contribution transactions
          totalMembers: memberStats.active_members || memberStats.total_members || chamaInfo.current_members || 0,
          totalMeetings: activityStats.total_meetings || 0, // All meetings (completed + upcoming + ongoing)
          upcomingMeetings: activityStats.upcoming_meetings || 0,
          ongoingMeetings: activityStats.ongoing_meetings || 0,
          completedMeetings: activityStats.completed_meetings || 0,
          totalTransactions: financialStats.total_transactions || 0,
          averageContribution: financialStats.average_contribution || 0,
          userRole: userStats.role || 'member',
          userTransactionCount: userStats.total_transactions || 0,
          userContributionCount: userStats.contribution_count || 0,
          lastUpdated: new Date().toISOString(),
        };

        setRealTimeData(newRealTimeData);

        // Cache the data for fast switching
        setCachedChamaData(chamaId, {
          realTimeData: newRealTimeData,
          chamaStats: statsResponse.data,
          chamaFeatures: chamaFeatures // Use current features or fetch fresh ones
        });
      }

      // Update selected chama with fresh data if available (only if data actually changed)
      if (chamaResponse.success && chamaResponse.data) {
        const newChamaData = chamaResponse.data;
        // Only update if the chama data has actually changed to prevent infinite loops
        if (!selectedChama ||
            selectedChama.id !== newChamaData.id ||
            selectedChama.name !== newChamaData.name ||
            selectedChama.total_funds !== newChamaData.total_funds ||
            selectedChama.current_members !== newChamaData.current_members) {
          setSelectedChama(newChamaData);
        }
      }

    } catch (error) {

      // Don't show error to user, just log it
    } finally {
      setStatsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserChamas();
    if (selectedChama) {
      await Promise.all([
        loadChamaFeatures(),
        loadChamaStatistics()
      ]);
    }
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getUserRole = (chama) => {
    // Use real-time data if available
    if (realTimeData.userRole && realTimeData.userRole !== 'not_member') {
      return realTimeData.userRole.charAt(0).toUpperCase() + realTimeData.userRole.slice(1);
    }

    if (!chama || !user) return 'Member';

    // Fallback to simplified role detection
    if (chama.created_by === user.id) {
      return 'Chairman';
    }

    return 'Member';
  };

  const renderChamaSelector = () => {
    // Don't show selector if we have no chamas and no selected chama (empty state will show)
    if (userChamas.length === 0 && !selectedChama) return null;

    // If we have a selected chama but userChamas is still loading, show a simple header
    if (userChamas.length === 0 && selectedChama) {
      return (
        <Card style={[styles.selectorCard, { marginVertical: spacing.xs }]} variant="outlined">
          <Text style={[styles.selectorTitle, { color: colors.text }]}>
            {selectedChama.name}
          </Text>
          <Text style={[styles.chamaChipText, { color: colors.textSecondary }]}>
            {getUserRole(selectedChama)}
          </Text>
        </Card>
      );
    }

    // Show full selector when we have multiple chamas
    return (
      <Card style={[styles.selectorCard, { marginVertical: spacing.xs }]} variant="outlined">
        <Text style={[styles.selectorTitle, { color: colors.text }]}>
          Select Chama
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {userChamas.map((chama) => (
            <TouchableOpacity
              key={chama.id}
              style={[
                styles.chamaChip,
                {
                  backgroundColor: selectedChama?.id === chama.id ? colors.primary : colors.surface,
                  borderColor: selectedChama?.id === chama.id ? colors.primary : colors.border,
                }
              ]}
              onPress={() => {
                switchToChama(chama);
              }}
            >
              <Text
                style={[
                  styles.chamaChipText,
                  {
                    color: selectedChama?.id === chama.id ? colors.white : colors.text,
                  }
                ]}
              >
                {chama.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Card>
    );
  };

  const renderQuickStats = () => {
    if (!selectedChama) return null;

    const StatTile = ({ icon, label, value, color }) => (
      <View style={{ flex: 1, marginHorizontal: spacing.xs, marginBottom: spacing.sm }}>
        <View style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, height: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 }}>{label}</Text>
          </View>
          <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'bold', color: colors.text }}>{value}</Text>
        </View>
      </View>
    );

    return (
      <Card style={styles.statsCard} variant="outlined">
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: typography.fontSize.lg, fontWeight: 'semibold', color: colors.text, marginBottom: spacing.md }}>
            {selectedChama.name} Overview
          </Text>
          <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
            <StatTile icon="wallet" label={selectedChama?.category === 'contribution' ? 'Group Wallet' : 'Chama Wallet'} value={formatCurrency(realTimeData.walletBalance)} color={colors.primary} />
            <StatTile icon="people" label="Members" value={`${realTimeData.totalMembers}/${selectedChama.max_members || 50}`} color={colors.secondary} />
          </View>
          <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
            <StatTile icon="calendar" label="Meetings" value={realTimeData.totalMeetings || 0} color={colors.warning} />
            <StatTile icon="trending-up" label="Contributions" value={realTimeData.contributionCount || 0} color={colors.success} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <StatTile icon="shield-checkmark" label="Your Role" value={getUserRole(selectedChama)} color={colors.info} />
            <StatTile icon="swap-horizontal" label="Your Transactions" value={realTimeData.userTransactionCount || 0} color={colors.primary} />
          </View>
        </View>
      </Card>
    );
  };

  const renderQuickActions = () => {
    // Determine if current chama is a contribution group
    const isContributionGroup = selectedChama?.category === 'contribution';

    const actions = [
      {
        id: 'members',
        title: 'Members',
        icon: 'people',
        color: colors.secondary,
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('members', 'ChamaMembersScreen');
            } else {
              navigation.navigate('ChamaMembersScreen', {
                chamaId: selectedChama.id,
                chama: selectedChama
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'contributions',
        title: isContributionGroup ? 'Contribute' : 'Pay',
        icon: 'wallet',
        color: colors.primary,
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('contributions', 'ContributeScreen');
            } else {
              navigation.navigate('ContributeScreen', {
                chamaId: selectedChama.id,
                chama: selectedChama
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'savings',
        title: 'Savings',
        icon: 'cash',
        color: '#10B981',
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('savings', 'SavingsOverview');
            } else {
              navigation.navigate('SavingsOverview', {
                chamaId: selectedChama.id,
                chama: selectedChama,
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'transactions',
        title: 'Transactions',
        icon: 'receipt',
        color: colors.success,
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('transactions', 'ChamaTransactionsScreen');
            } else {
              navigation.navigate('ChamaTransactionsScreen', {
                chamaId: selectedChama.id,
                chama: selectedChama
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'shares',
        title: 'Shares',
        icon: 'cube',
        color: '#8B5CF6',
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('shares', 'SharesScreen');
            } else {
              navigation.navigate('SharesScreen', {
                chamaId: selectedChama.id,
                chama: selectedChama,
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'dividends',
        title: 'Dividends',
        icon: 'cash',
        color: colors.success,
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('dividends', 'DividendsScreen');
            } else {
              navigation.navigate('DividendsScreen', {
                chamaId: selectedChama.id,
                chama: selectedChama,
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'loans',
        title: 'Loans',
        icon: 'card',
        color: '#6366F1', // Indigo color
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('loans', 'ChamaLoansScreen');
            } else {
              navigation.navigate('ChamaLoansScreen', {
                chamaId: selectedChama.id,
                chama: selectedChama
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'meetings',
        title: 'Meetings',
        icon: 'calendar',
        color: '#8B5CF6', // Purple color
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('meetings', 'ChamaMeetingsScreen');
            } else {
              navigation.navigate('ChamaMeetingsScreen', {
                chamaId: selectedChama.id,
                chama: selectedChama
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'merry-go-round',
        title: 'Merry-Go-Round',
        icon: 'refresh-circle',
        color: '#F59E0B', // Amber color
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('merry-go-round', 'MerryGoRoundScreen');
            } else {
              navigation.navigate('MerryGoRoundScreen', {
                chamaId: selectedChama.id,
                chama: selectedChama
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'welfare',
        title: 'Welfare',
        icon: 'heart',
        color: '#EC4899', // Pink color
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('welfare', 'WelfareScreen');
            } else {
              navigation.navigate('WelfareScreen', {
                chamaId: selectedChama.id,
                chama: selectedChama
              });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'polls-voting',
        title: 'Polls & Voting',
        icon: 'checkmark-circle',
        color: '#8B5CF6', // Violet color
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('polls-voting', 'PollsVotingScreen');
            } else {
              navigation.navigate('PollsVotingScreen', { chamaId: selectedChama.id });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'account-management',
        title: 'Account Management',
        icon: 'business',
        color: '#F59E0B', // Amber color
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('account-management', 'AccountManagementScreen');
            } else {
              navigation.navigate('AccountManagementScreen', { chamaId: selectedChama.id });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'chat',
        title: 'Group Chat',
        icon: 'chatbubbles',
        color: '#3B82F6', // Blue color
        onPress: async () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('chat', 'ChatRoom');
            } else {
              try {
                // Use the chama-specific endpoint so the backend enforces a
                // single chat room per chama and avoids duplicate rooms.
                const response = await ApiService.createChamaChatRoom(selectedChama.id);

                if (response.success) {
                  const room = response.data;
                  navigation.navigate('ChatRoom', {
                    roomId: room.id,
                    roomName: room.name || `${selectedChama.name} Group Chat`,
                    roomType: 'group',
                    chamaId: selectedChama.id
                  });
                } else {
                  Alert.alert('Error', response.error || 'Failed to access group chat');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to access group chat');
              }
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
      {
        id: 'settings',
        title: 'Settings',
        icon: 'settings',
        color: '#6B7280', // Gray color
        onPress: () => {
          if (selectedChama) {
            if (onRouteChange) {
              onRouteChange('settings', 'ChamaSettings');
            } else {
              navigation.navigate('ChamaSettings', { chamaId: selectedChama.id });
            }
          } else {
            Alert.alert('No Chama Selected', 'Please select a chama first');
          }
        },
      },
    ];

    // Filter actions based on feature toggles and chama type
    const filteredActions = actions.filter(action => {
      // For contribution groups, only show specific actions
      if (isContributionGroup) {
        const allowedForContributionGroups = [
          'contributions', // Contribute
          'transactions',  // Transactions
          'members',       // Members
          'meetings'       // Meetings
        ];
        return allowedForContributionGroups.includes(action.id);
      }

      // For regular chamas, apply wallet type filters
      const walletTypeMap = {
        'savings': 'savings',
        'shares': 'shares',
        'dividends': 'dividends',
        'loans': 'loans',
        'merry-go-round': 'merry-go-round',
        'welfare': 'welfare',
      };

      if (walletTypeMap[action.id]) {
        return chamaFeatures.activeWalletTypes.includes(walletTypeMap[action.id]);
      }

      // Legacy permission checks for backward compatibility
      switch (action.id) {
        case 'merry-go-round':
          return chamaFeatures.allowMerryGoRound;
        case 'welfare':
          return chamaFeatures.allowWelfare;
        default:
          return true; // Show all other actions
      }
    });

    const mainActions = filteredActions;

    return (
      <Card style={[styles.actionsCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.xs }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Quick Actions
        </Text>

        <View style={styles.actionsGrid}>
          {mainActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionItem}
              onPress={action.onPress}
              disabled={!selectedChama}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={[styles.actionText, { color: colors.text }]}>
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Chamas Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Join or create a chama to start managing group finances
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
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


        {userChamas.length === 0 && !selectedChama ? (
          renderEmptyState()
        ) : (
          <>
            {renderChamaSelector()}
            {renderQuickStats()}
            {renderQuickActions()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  homeButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
    borderRadius: borderRadius.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
  },
  listButton: {
    padding: spacing.sm,
  },
  selectorCard: {
    paddingTop: 32,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  selectorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  chamaChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    borderWidth: 1,
  },
  chamaChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statsCard: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  statsHeaderLeft: {
    flex: 1,
  },
  statsHeaderRight: {
    alignItems: 'flex-end',
  },
  refreshButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  lastUpdated: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statTile: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statTileIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statTileLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  statTileValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'left',
  },
  statTileSubtext: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'left',
  },
  statsSection: {
    paddingHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  statTileContainer: {
    flex: 1,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  statTile: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    height: '100%',
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statTileIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statTileLabel: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  statTileValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
  },
  actionsCard: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionItem: {
    width: `${100 / 4 - 2}%`,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  // Contribution group specific styles (2x2 grid for 4 actions)
  actionsGridContribution: {
    justifyContent: 'space-around', // Better spacing for 2x2 grid
    paddingHorizontal: spacing.lg, // More padding for better centering
    alignItems: 'flex-start', // Align items to top
  },
  actionItemContribution: {
    width: '45%', // 2 items per row (45% x 2 = 90% + gaps = 100%)
    padding: spacing.md, // More padding for larger touch targets
    marginBottom: spacing.lg, // More space between rows
    minHeight: 80, // Consistent height for all action items
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionTitle: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
    lineHeight: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyActions: {
    width: '100%',
    gap: spacing.md,
  },
  emptyButton: {
    width: '100%',
  },
});

export default ChamaDashboard;
