import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAMAS_CACHE_KEY = 'cached_user_chamas';
const CHAMAS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// "My Chamas" must only ever show chamas the current user is an ACTIVE member
// of. The backend already enforces this, but the instant-display cache below is
// a second place the list comes from — so every read is filtered here too, and
// the cache envelope records which user it belongs to so a different account on
// the same device can never be shown the previous account's chamas.
const isActiveMembership = (chama) =>
  !!chama && chama.membership_is_active !== false;

const useMyChamas = ({ navigation, route }) => {
  const { theme, user, switchToChamaDashboard } = useApp();

  const [chamas, setChamas] = useState([]);
  const [filteredChamas, setFilteredChamas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const loadCachedChamas = async () => {
    try {
      // Without a known user we cannot prove the cache belongs to this account.
      if (!user?.id) {
        return false;
      }
      const cached = await AsyncStorage.getItem(CHAMAS_CACHE_KEY);
      if (cached) {
        const { data, timestamp, userId } = JSON.parse(cached);
        // Reject a cache written by (or before we tracked) a different account.
        if (userId !== user.id) {
          await AsyncStorage.removeItem(CHAMAS_CACHE_KEY);
          return false;
        }
        if (Date.now() - timestamp < CHAMAS_CACHE_TTL) {
          setChamas((data || []).filter(isActiveMembership));
          return true;
        }
      }
    } catch (error) {
      // Silent fail for cache read
    }
    return false;
  };

  const cacheChamas = async (data) => {
    try {
      if (!user?.id) {
        return;
      }
      await AsyncStorage.setItem(CHAMAS_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
        userId: user.id,
      }));
    } catch (error) {
      // Silent fail for cache write
    }
  };

  useEffect(() => {
    const initialize = async () => {
      // Drop anything from a previous account before showing/fetching.
      setChamas([]);
      setFilteredChamas([]);
      await loadCachedChamas();
      await loadUserChamas();
    };
    initialize();
  }, [user?.id]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [chamas, searchQuery, selectedCategory]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.refresh) {
        loadUserChamas();
        navigation.setParams({ refresh: undefined });
      }
    }, [route.params?.refresh])
  );

  const loadUserChamas = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getUserChamas(50, 0);

      if (response.success) {
        const data = (response.data || []).filter(isActiveMembership);
        setChamas(data);
        await cacheChamas(data);
      } else {
        throw new Error(response.error || 'Failed to load chamas');
      }
    } catch (error) {
      console.error('Failed to load user chamas:', error);
      setChamas([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserChamas();
    } catch (error) {
      console.warn('My Chamas refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const applyFiltersAndSort = () => {
    // Only active memberships belong on "My Chamas" — never a chama the user
    // has left or was removed from, and never one from another account.
    let filtered = chamas.filter(isActiveMembership);

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(chama => {
        if (selectedCategory === 'contribution') {
          return chama.category === 'contribution';
        } else if (selectedCategory === 'chama') {
          return chama.category !== 'contribution';
        }
        return true;
      });
    }

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(chama => {
        const name = (chama.name || '').toLowerCase();
        const description = (chama.description || '').toLowerCase();
        const county = (chama.county || '').toLowerCase();
        const town = (chama.town || '').toLowerCase();
        return name.includes(searchLower) ||
               description.includes(searchLower) ||
               county.includes(searchLower) ||
               town.includes(searchLower);
      });
    }

    // Default sorting by recent (with null safety)
    filtered.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    setFilteredChamas(filtered);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getUserRole = (chama) => {
    if (chama.createdBy === user?.id) {
      return 'chairperson';
    }
    return 'member';
  };

  return {
    theme,
    user,
    switchToChamaDashboard,
    chamas,
    filteredChamas,
    loading,
    refreshing,
    searchQuery,
    setSearchQuery,
    showFilterDropdown,
    setShowFilterDropdown,
    selectedCategory,
    setSelectedCategory,
    loadUserChamas,
    onRefresh,
    formatCurrency,
    getUserRole,
  };
};

export default useMyChamas;
