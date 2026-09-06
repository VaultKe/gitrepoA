import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';

const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

const useChamaDashboard = ({ route, navigation, onRouteChange }) => {
  const {
    theme,
    user,
    selectedChama,
    setSelectedChama,
    chamas,
    loadUserChamas: refreshChamasFromContext,
  } = useApp();

  // `chamas` from context is the single source of truth for "chamas I'm an
  // active member of": AppContext already fetches it (page size 50) and its
  // SET_CHAMAS reducer already filters out chamas whose membership_is_active
  // is false. This hook used to run its own separate fetch here with a
  // *different* page size (20) into its own local state -- two independent
  // copies of conceptually the same list, fetched differently, that could
  // disagree. When they did, the reconciliation effect below concluded a
  // legitimately active chama (just outside the smaller page) "wasn't found
  // any more" and cleared the selection -- which is what was fading Quick
  // Actions to 40% opacity and disabling it right after landing or switching.
  // Reading the one list context already maintains removes that disagreement
  // entirely, and the duplicate network call with it.
  const userChamas = chamas;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chamaFeatures, setChamaFeatures] = useState({
    allowMerryGoRound: false,
    allowWelfare: false,
    activeWalletTypes: [],
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
  const [userRole, setUserRole] = useState('member');

  // Ref to track current selectedChama to avoid stale closures in async functions
  const selectedChamaRef = useRef(selectedChama);
  useEffect(() => {
    selectedChamaRef.current = selectedChama;
  }, [selectedChama]);

  // Ref to track current chama ID to prevent race conditions
  const currentChamaIdRef = useRef(null);

  // Track in-flight statistics requests per chama to avoid duplicate network calls
  const statsRequestIdRef = useRef(0);
  const inFlightStatsRef = useRef(new Set());

  // Cache for chama data to enable fast switching
  const chamaDataCache = useRef(new Map());

  // Cache helper functions
  const getCachedChamaData = (chamaId) => {
    const cached = chamaDataCache.current.get(chamaId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY_TIME) {
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
    // Prevent switching to a chama where the user has left — check only
    // the per-chama membership flag.
    if (chama?.membership_is_active === false) {
      Alert.alert(
        'Not a Member',
        `You have left "${chama.name}". You can no longer access this chama.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Immediately update the selected chama for instant UI response
    setSelectedChama(chama);

    // Extract wallet types from chama permissions if available
    const permissions = chama?.permissions || {};
    const activeWalletTypes = Array.isArray(permissions.activeWalletTypes)
      ? permissions.activeWalletTypes
      : [];

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
        allowMerryGoRound: permissions.allowMerryGoRound ?? false,
        allowWelfare: permissions.allowWelfare ?? false,
        activeWalletTypes,
      });
    }

    // Always fetch fresh data in the background (but don't block UI)
    // Skip if we already have fresh cached data to avoid duplicate requests
    if (!cachedData) {
      setTimeout(() => {
        loadChamaStatistics(chama.id);
        loadChamaFeatures();
      }, 100); // Small delay to allow UI to update first
    } else {
      // Even with cached data, refresh features to ensure they are up to date
      setTimeout(() => {
        loadChamaFeatures();
      }, 100);
    }
  };

  // Preload data for multiple chamas in the background
  const preloadChamaData = async (chamasList) => {
    for (const chama of chamasList) {
      // Skip if already cached or if it's the currently selected chama
      if (getCachedChamaData(chama.id) || chama.id === selectedChama?.id) {
        continue;
      }

      try {
        // Load data for this chama without affecting UI
        const [statsResponse, chamaResponse] = await Promise.all([
          ApiService.getChamaStatistics(chama.id),
          ApiService.makeRequest(`/chamas/${chama.id}`)
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

          // Extract features from the chama data
          let chamaFeaturesData = {
            allowMerryGoRound: false,
            allowWelfare: false,
            activeWalletTypes: [],
          };

          if (chamaResponse.success && chamaResponse.data) {
            const chamaData = chamaResponse.data;
            const permissions = chamaData.permissions || {};
            const activeWalletTypes = Array.isArray(permissions.activeWalletTypes)
              ? permissions.activeWalletTypes
              : [];
            chamaFeaturesData = {
              allowMerryGoRound: permissions.allowMerryGoRound ?? false,
              allowWelfare: permissions.allowWelfare ?? false,
              activeWalletTypes,
            };
          }

          // Cache the preloaded data
          setCachedChamaData(chama.id, {
            realTimeData: preloadedRealTimeData,
            chamaStats: statsResponse.data,
            chamaFeatures: chamaFeaturesData,
          });
        }
      } catch (error) {
        // Silently fail preload
      }

      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const loadMemberRole = async (targetChamaId) => {
    const chamaId = targetChamaId || selectedChama?.id || selectedChama?.chamaId || selectedChama;
    if (!chamaId || !user?.id) return;
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) {
        setUserRole(response.data?.role || 'member');
      }
      // Membership status is already determined by the membershipIsActive flag
      // which is checked in loadUserChamas. A failed role fetch does not mean
      // the user has left the chama.
    } catch (error) {
      // Silently fail
    }
  };

  // Pulls the roster from context (see the userChamas comment above) rather
  // than fetching it itself.
  const loadUserChamas = async () => {
    try {
      setLoading(true);
      await refreshChamasFromContext();
    } catch (error) {
      // Context already logs the failure; nothing further to do here.
    } finally {
      setLoading(false);
    }
  };

  // There used to be a useEffect here reacting to `chamas` changing --
  // reselecting a default chama, and (before the previous fix) clearing the
  // selection outright when it didn't show up in whatever the roster's
  // latest fetch happened to return. Any effect keyed off that list firing
  // again on every refetch (mount, pull-to-refresh) kept catching a chama
  // the user had just explicitly picked and re-deciding things for it --
  // which is what was fading Quick Actions to 40% opacity and disabling it
  // right after choosing a chama, or right after landing on one. Removed
  // outright rather than narrowed further: selectedChama is now only ever
  // changed by an explicit action -- switchToChama (tapping a chama in
  // ChamaSelectorCard, which also refuses one the user has actually left)
  // -- never by a passive effect second-guessing a choice already made.
  // Landing here with nothing selected yet (no chama tapped in
  // MyChamasScreen first) means picking one from the selector card, same as
  // switching to a different one later.

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
          allowMerryGoRound: permissions.allowMerryGoRound ?? false,
          allowWelfare: permissions.allowWelfare ?? false,
          activeWalletTypes,
        });
        // Refresh selected chama with latest data from this single source of truth
        setSelectedChama(chama);
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

    let chamaId = targetChamaId;
    if (!chamaId) {
      if (typeof currentChama === 'string') {
        chamaId = currentChama;
      } else if (currentChama?.id) {
        chamaId = currentChama.id;
      } else if (currentChama?.chamaId) {
        chamaId = currentChama.chamaId;
      } else {
        return;
      }
    }

    // Deduplicate: skip if a request for this chama is already in flight
    if (inFlightStatsRef.current.has(chamaId)) {
      return;
    }

    inFlightStatsRef.current.add(chamaId);
    try {
      // Get comprehensive chama statistics only; chama details are refreshed via loadChamaFeatures
      const [statsResponse] = await Promise.all([
        ApiService.getChamaStatistics(chamaId),
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

    } catch (error) {
      // Don't show error to user, just log it
    } finally {
      inFlightStatsRef.current.delete(chamaId);
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

  // Load user chamas on mount
  useEffect(() => {
    loadUserChamas();
  }, []);

  return {
    // State
    userChamas,
    loading,
    refreshing,
    chamaFeatures,
    chamaStats,
    realTimeData,
    userRole,
    selectedChama,
    statsLoading,
    // Handlers
    switchToChama,
    onRefresh,
    formatCurrency,
    getUserRole,
    loadUserChamas,
    loadChamaFeatures,
    loadChamaStatistics,
    loadMemberRole,
    preloadChamaData,
    // Navigation
    navigation,
    onRouteChange,
  };
};

export default useChamaDashboard;
