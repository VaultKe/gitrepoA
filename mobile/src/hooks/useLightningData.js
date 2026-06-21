import { useState, useEffect, useCallback, useRef } from 'react';
import cacheDataService from '../services/cacheDataService';
import optimisticUpdateService from '../services/optimisticUpdateService';
import smartPrefetchService from '../services/smartPrefetchService';

/**
 * Lightning Data Hook
 * Provides instant data access with optimistic updates and smart prefetching
 */
export const useLightningData = (dataType, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [loadTime, setLoadTime] = useState(0);
  const mountedRef = useRef(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const {
    autoRefresh = true,
    refreshInterval = 60000, // 1 minute
    enableOptimistic = true,
    prefetchRelated = true,
  } = optionsRef.current;

  // Load data function
  const loadData = useCallback(async (forceRefresh = false, customOptions = {}) => {
    if (!mountedRef.current) return;

    try {
      setLoading(true);
      setError(null);

      const result = await cacheDataService.getData(dataType, {
        ...optionsRef.current,
        ...customOptions,
        forceRefresh,
      });

      if (!mountedRef.current) return;

      if (result.success) {
        setData(result.data);
        setSource(result.source);
        setLoadTime(result.loadTime);
        setError(null); // Clear any previous errors
      } else {
        // Create error object with additional details
        const errorObj = {
          message: result.error,
          serverDown: result.serverDown || false,
          corsError: result.corsError || false,
          serverError: result.serverError || false,
          originalError: result
        };

        setError(errorObj);
        setData(null);
        setSource('error');
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [dataType]);

  // Initial load with real-time setup
  useEffect(() => {
    loadData();

    // Set up real-time listener for chat-rooms
    if (dataType === 'chat-rooms') {
      const handleDataChange = (newData) => {
        if (mountedRef.current) {
          setData(newData);
          setSource('realtime-update');
          setLoadTime(0); // Instant update
        }
      };

      cacheDataService.addDataChangeListener(dataType, handleDataChange);

      // Cleanup listener on unmount
      return () => {
        cacheDataService.removeDataChangeListener(dataType, handleDataChange);
      };
    }
  }, []); // Empty deps - run once on mount

  // Auto refresh
  useEffect(() => {
    if (!optionsRef.current.autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, optionsRef.current.refreshInterval || 60000);

    return () => clearInterval(interval);
  }, []); // Empty deps - use ref values inside

  // Real-time updates
  useEffect(() => {
    const handleRealtimeUpdate = (update) => {
      if (!mountedRef.current) return;
      // Apply real-time update to local state using functional updates
      if (update.action === 'refresh') {
        setData(update.data);
        return;
      }

      setData((previousData) => {
        if (!previousData) return previousData;
  
        if (update.action === 'update') {
          if (Array.isArray(previousData)) {
            return previousData.map(item =>
              item.id === update.data.id ? { ...item, ...update.data } : item
            );
          }
          return { ...previousData, ...update.data };
        }
  
        if (update.action === 'bulk_update') {
          if (Array.isArray(previousData)) {
            return previousData.map(item => ({
              ...item,
              ...update.update
            }));
          }
          return { ...previousData, ...update.update };
        }
  
        if (update.action === 'add') {
          if (Array.isArray(previousData)) {
            return [update.data, ...previousData];
          }
          return previousData;
        }
  
        if (update.action === 'remove') {
          if (Array.isArray(previousData)) {
            return previousData.filter(item => item.id !== update.data.id);
          }
          return previousData;
        }
  
        return previousData;
      });
    };

    cacheDataService.registerRealtimeHandler(dataType, handleRealtimeUpdate);

    return () => {
      cacheDataService.registerRealtimeHandler(dataType, null);
    };
  }, [dataType]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Refresh function with options support
  const refresh = useCallback((refreshOptions = {}) => {
    const mergedOptions = { ...optionsRef.current, ...refreshOptions, forceRefresh: true };
    return loadData(true, mergedOptions);
  }, [loadData]);

  return {
    data,
    loading,
    error,
    source,
    loadTime,
    refresh,
    isFromCache: source !== 'api',
    isInstant: loadTime < 50,
  };
};

/**
 * Optimistic Update Hook
 * Provides instant UI updates with automatic rollback
 */
export const useOptimisticUpdate = () => {
  const [pendingUpdates, setPendingUpdates] = useState(new Set());

  const executeUpdate = useCallback(async (updateFn, rollbackFn) => {
    const updateId = `update_${Date.now()}_${Math.random()}`;
    
    try {
      setPendingUpdates(prev => new Set([...prev, updateId]));
      
      // Execute optimistic update
      const result = await updateFn();
      
      return result;
    } catch (error) {
      // Execute rollback if provided
      if (rollbackFn) {
        try {
          await rollbackFn();
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError);
        }
      }
      throw error;
    } finally {
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateId);
        return newSet;
      });
    }
  }, []);

  // Notification operations
  const markNotificationAsRead = useCallback((notificationId) => {
    return executeUpdate(
      () => optimisticUpdateService.markNotificationAsRead(notificationId)
    );
  }, [executeUpdate]);

  const deleteNotification = useCallback((notificationId) => {
    return executeUpdate(
      () => optimisticUpdateService.deleteNotification(notificationId)
    );
  }, [executeUpdate]);

  const markAllNotificationsAsRead = useCallback(() => {
    return executeUpdate(
      () => optimisticUpdateService.markAllNotificationsAsRead()
    );
  }, [executeUpdate]);

  // Marketplace operations
  const addToCart = useCallback((productId, quantity) => {
    return executeUpdate(
      () => optimisticUpdateService.addToCart(productId, quantity)
    );
  }, [executeUpdate]);

  const removeFromCart = useCallback((cartItemId) => {
    return executeUpdate(
      () => optimisticUpdateService.removeFromCart(cartItemId)
    );
  }, [executeUpdate]);

  const addToWishlist = useCallback((productId) => {
    return executeUpdate(
      () => optimisticUpdateService.addToWishlist(productId)
    );
  }, [executeUpdate]);

  // Profile operations
  const updateProfile = useCallback((profileData) => {
    return executeUpdate(
      () => optimisticUpdateService.updateProfile(profileData)
    );
  }, [executeUpdate]);

  return {
    pendingUpdates: pendingUpdates.size,
    hasPendingUpdates: pendingUpdates.size > 0,
    markNotificationAsRead,
    deleteNotification,
    markAllNotificationsAsRead,
    addToCart,
    removeFromCart,
    addToWishlist,
    updateProfile,
  };
};

/**
 * Smart Prefetch Hook
 * Handles intelligent prefetching based on user behavior
 */
export const useSmartPrefetch = (currentRoute) => {
  const [prefetchStats, setPrefetchStats] = useState(null);
  const previousRoute = useRef(null);

  useEffect(() => {
    if (previousRoute.current !== currentRoute) {
      // Navigation changed - trigger prefetching
      smartPrefetchService.onNavigationChange(currentRoute, previousRoute.current);
      previousRoute.current = currentRoute;
    }
  }, [currentRoute]);

  useEffect(() => {
    // Update prefetch stats periodically
    const interval = setInterval(() => {
      setPrefetchStats(smartPrefetchService.getStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const prefetchForPage = useCallback((pageName, priority = 'normal') => {
    return smartPrefetchService.executePrefetch(pageName, priority);
  }, []);

  const onUserHover = useCallback((element) => {
    smartPrefetchService.onUserHover(element, currentRoute);
  }, [currentRoute]);

  const onUserScroll = useCallback((scrollPosition) => {
    smartPrefetchService.onUserScroll(currentRoute, scrollPosition);
  }, [currentRoute]);

  return {
    prefetchStats,
    prefetchForPage,
    onUserHover,
    onUserScroll,
  };
};

/**
 * Performance Monitoring Hook
 * Tracks data loading performance and cache efficiency
 */
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const lightningMetrics = cacheDataService.getPerformanceMetrics();
      const prefetchStats = smartPrefetchService.getStats();
      
      setMetrics({
        lightning: lightningMetrics,
        prefetch: prefetchStats,
        combined: {
          totalCacheHitRate: (lightningMetrics.cacheHitRate + prefetchStats.hitRate) / 2,
          averageLoadTime: lightningMetrics.averageLoadTime,
          totalOptimisticUpdates: lightningMetrics.optimisticUpdates,
        }
      });
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const clearCaches = useCallback(() => {
    cacheDataService.clearAllCaches();
    smartPrefetchService.clearPatterns();
  }, []);

  return {
    metrics,
    clearCaches,
  };
};

/**
 * Multi-Data Hook
 * Load multiple data types simultaneously with dependencies
 */
export const useMultiData = (dataTypes, options = {}) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [loadTimes, setLoadTimes] = useState({});

  const loadAllData = useCallback(async () => {
    setLoading(true);
    
    const promises = dataTypes.map(async (dataType) => {
      try {
        const result = await cacheDataService.getData(dataType, options[dataType] || {});
        return { dataType, result };
      } catch (error) {
        return { dataType, error };
      }
    });

    const results = await Promise.allSettled(promises);
    
    const newData = {};
    const newErrors = {};
    const newLoadTimes = {};

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { dataType, result: dataResult, error } = result.value;
        
        if (error) {
          newErrors[dataType] = error;
        } else if (dataResult.success) {
          newData[dataType] = dataResult.data;
          newLoadTimes[dataType] = dataResult.loadTime;
        } else {
          newErrors[dataType] = dataResult.error;
        }
      } else {
        console.error('Multi-data load failed:', result.reason);
      }
    });

    setData(newData);
    setErrors(newErrors);
    setLoadTimes(newLoadTimes);
    setLoading(false);
  }, [dataTypes, options]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const refresh = useCallback(() => {
    return loadAllData();
  }, [loadAllData]);

  return {
    data,
    loading,
    errors,
    loadTimes,
    refresh,
    hasErrors: Object.keys(errors).length > 0,
    totalLoadTime: Object.values(loadTimes).reduce((sum, time) => sum + time, 0),
  };
};
