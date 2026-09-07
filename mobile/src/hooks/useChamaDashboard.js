import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';

const useChamaDashboard = ({ route, navigation, onRouteChange }) => {
  const {
    user,
    selectedChama,
    setSelectedChama,
    chamas,
    loadUserChamas: refreshChamasFromContext,
  } = useApp();

  // Single source of truth for "chamas I'm an active member of".
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

  // The chama that has already had its data loaded — so re-renders and roster
  // refreshes never re-trigger a load (that was the flicker).
  const loadedIdRef = useRef(null);
  const inFlightStatsRef = useRef(new Set());
  const currentChamaIdRef = useRef(null);

  const loadMemberRole = async (chamaId) => {
    if (!chamaId || !user?.id) return;
    try {
      const response = await ApiService.getMemberRole(chamaId, user.id);
      if (response.success) setUserRole(response.data?.role || 'member');
    } catch (error) {
      // A failed role fetch does not mean the user has left the chama.
    }
  };

  const loadUserChamas = async () => {
    try {
      setLoading(true);
      await refreshChamasFromContext();
    } catch (error) {
      // Context already logs the failure.
    } finally {
      setLoading(false);
    }
  };

  // Loads the chama's feature flags into LOCAL state only. It deliberately does
  // NOT touch `selectedChama` — replacing that object on every load churned the
  // whole dashboard and made it flicker. The selection made upstream stands.
  const loadChamaFeatures = async (chamaId) => {
    if (!chamaId) return;
    try {
      const response = await ApiService.makeRequest(`/chamas/${chamaId}`);
      if (response.success && response.data) {
        const permissions = response.data.permissions || {};
        setChamaFeatures({
          allowMerryGoRound: permissions.allowMerryGoRound ?? false,
          allowWelfare: permissions.allowWelfare ?? false,
          activeWalletTypes: Array.isArray(permissions.activeWalletTypes) ? permissions.activeWalletTypes : [],
        });
      }
    } catch (error) {
      // Keep whatever features are already shown.
    }
  };

  const loadChamaStatistics = async (chamaId) => {
    if (!chamaId) return;
    if (inFlightStatsRef.current.has(chamaId)) return;

    currentChamaIdRef.current = chamaId;
    inFlightStatsRef.current.add(chamaId);
    setStatsLoading(true);
    try {
      const statsResponse = await ApiService.getChamaStatistics(chamaId);
      if (currentChamaIdRef.current !== chamaId) return; // selection changed
      if (statsResponse.success && statsResponse.data) {
        const stats = statsResponse.data;
        setChamaStats(stats);
        const f = stats.financial_stats || {};
        const m = stats.member_stats || {};
        const a = stats.activity_stats || {};
        const ci = stats.chama_info || {};
        const us = stats.user_stats || {};

        const next = {
          walletBalance: ci.wallet_balance || ci.total_funds || 0,
          totalContributions: f.total_contributions || 0,
          contributionCount: f.total_transactions || 0,
          totalMembers: m.active_members || m.total_members || ci.current_members || 0,
          totalMeetings: a.total_meetings || 0,
          upcomingMeetings: a.upcoming_meetings || 0,
          ongoingMeetings: a.ongoing_meetings || 0,
          completedMeetings: a.completed_meetings || 0,
          totalTransactions: f.total_transactions || 0,
          averageContribution: f.average_contribution || 0,
          userRole: us.role || 'member',
          userTransactionCount: us.total_transactions || 0,
          userContributionCount: us.contribution_count || 0,
        };

        // Only re-render when a figure actually moved — a background refresh
        // returning identical numbers should be invisible.
        setRealTimeData((prev) => {
          const same =
            prev.walletBalance === next.walletBalance &&
            prev.totalContributions === next.totalContributions &&
            prev.totalMembers === next.totalMembers &&
            prev.totalMeetings === next.totalMeetings &&
            prev.upcomingMeetings === next.upcomingMeetings &&
            prev.userRole === next.userRole;
          return same ? prev : { ...next, lastUpdated: new Date().toISOString() };
        });
      }
    } catch (error) {
      // Don't surface.
    } finally {
      inFlightStatsRef.current.delete(chamaId);
      setStatsLoading(false);
    }
  };

  // Load the selected chama's data ONCE, the first time it becomes the
  // selection. The chama is chosen upstream (My Chamas / Chama Details) and
  // stays put for the whole session unless the user goes back and picks a
  // different one — so nothing here re-decides or re-fetches on a re-render or
  // a roster refresh.
  useEffect(() => {
    const id = selectedChama?.id;
    if (!id || loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    loadMemberRole(id);
    loadChamaFeatures(id);
    loadChamaStatistics(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChama?.id]);

  // Fallback: only if we somehow land with nothing selected (a cold reopen
  // straight onto this tab). Uses the route param, else the first chama.
  useEffect(() => {
    if (selectedChama?.id) return;
    if (!chamas.length) return;
    const params = route?.params || {};
    const pick =
      params.chama ||
      (params.chamaId && chamas.find((c) => c.id === params.chamaId)) ||
      chamas[0];
    if (pick) setSelectedChama(pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChama?.id, chamas.length, route?.params?.chamaId]);

  // Quiet 30s stats refresh (only re-renders when a number changed).
  useEffect(() => {
    const id = selectedChama?.id;
    if (!id) return undefined;
    const interval = setInterval(() => loadChamaStatistics(id), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChama?.id]);

  // Refresh the roster once on mount (does not re-trigger a chama load).
  useEffect(() => {
    loadUserChamas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserChamas();
    const id = selectedChama?.id;
    if (id) {
      await Promise.all([loadChamaFeatures(id), loadChamaStatistics(id)]);
    }
    setRefreshing(false);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount || 0);

  const getUserRole = (chama) => {
    if (realTimeData.userRole && realTimeData.userRole !== 'not_member') {
      return realTimeData.userRole.charAt(0).toUpperCase() + realTimeData.userRole.slice(1);
    }
    if (!chama || !user) return 'Member';
    if (chama.created_by === user.id) return 'Chairman';
    return 'Member';
  };

  return {
    userChamas,
    loading,
    refreshing,
    chamaFeatures,
    chamaStats,
    realTimeData,
    userRole,
    selectedChama,
    statsLoading,
    onRefresh,
    formatCurrency,
    getUserRole,
    loadUserChamas,
    loadChamaFeatures,
    loadChamaStatistics,
    loadMemberRole,
    navigation,
    onRouteChange,
  };
};

export default useChamaDashboard;
