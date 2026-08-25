import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAMAS_CACHE_KEY = 'cached_user_chamas';
const CHAMAS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
      const cached = await AsyncStorage.getItem(CHAMAS_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CHAMAS_CACHE_TTL) {
          const activeOnly = (data || []).filter(chama => {
            const active = chama.membership_is_active;
            return active !== false && active !== 0 && active !== '0' && active !== 'false';
          });
          setChamas(activeOnly);
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
      await AsyncStorage.setItem(CHAMAS_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      // Silent fail for cache write
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await loadCachedChamas();
      await loadUserChamas();
    };
    initialize();
  }, []);

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
        const data = (response.data || []).filter(chama => {
          const active = chama.membership_is_active;
          return active !== false && active !== 0 && active !== '0' && active !== 'false';
        });
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
    let filtered = [...chamas];

    // Filter out chamas where the user has left (membership is inactive)
    filtered = filtered.filter(chama => {
      const active = chama.membership_is_active;
      return active !== false && active !== 0 && active !== '0' && active !== 'false';
    });

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
