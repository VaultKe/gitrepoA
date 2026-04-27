import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './api';
import DatabaseService from './database';
import webSocketService from './websocket';

/**
 * Lightning-Fast Data Service
 * Multi-tier caching with instant data availability and real-time updates
 */
class LightningDataService {
  constructor() {
    // Multi-tier cache system
    this.memoryCache = new Map(); // L1: Instant access
    this.memoryExpiry = new Map();
    this.persistentCache = new Map(); // L2: AsyncStorage cache
    this.databaseCache = new Map(); // L3: SQLite cache
    
    // Cache configuration (optimized for tunnel latency)
    this.cacheConfig = {
      memory: { ttl: 5 * 60 * 1000 }, // 5 minutes (increased for tunnel)
      persistent: { ttl: 20 * 60 * 1000 }, // 20 minutes (increased for tunnel)
      database: { ttl: 2 * 60 * 60 * 1000 }, // 2 hours (increased for tunnel)
    };
    
    // Data dependencies and prefetch rules
    this.dataDependencies = {
      'user-dashboard': ['profile', 'wallet', 'chamas', 'transactions', 'notifications'],
      'chama-dashboard': ['chamas', 'meetings'], // chama-members and chama-transactions need specific chamaId
      'marketplace': ['products-complete', 'marketplace-categories', 'cart', 'orders', 'wishlist'],
      'chat': ['chat-rooms', 'chat-messages-preload'], // Preload rooms + recent messages
      'admin': ['users-complete', 'all-chamas', 'system-analytics', 'learning-analytics', 'marketplace-analytics', 'support-requests'],
      'wallet': ['wallet', 'transactions', 'recent-contacts'],
      'notifications': ['notifications', 'unread-count'],
    };
    
    // Optimistic update queue
    this.optimisticQueue = new Map();
    this.rollbackQueue = new Map();
    
    // Performance tracking
    this.performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      averageLoadTime: 0,
      optimisticUpdates: 0,
      rollbacks: 0,
    };
    
    // Real-time update handlers
    this.realtimeHandlers = new Map();

    // Real-time polling intervals
    this.pollingIntervals = new Map();
    this.dataChangeListeners = new Map();
    
    // Background sync status
    this.isSyncing = false;
    this.lastSyncTime = 0;
    this.syncInterval = 30 * 1000; // 30 seconds

    // Error tracking and backoff
    this.errorCounts = new Map();
    this.lastErrorTime = new Map();

    // Post-authentication preloading
    this.isPreloading = false;
    this.preloadProgress = 0;
    this.preloadCallbacks = [];
    this.criticalDataLoaded = false;

    this.initializeService();
  }

  async initializeService() {
    // console.log('⚡ Initializing Lightning Data Service...');
    
    // Load persistent cache from AsyncStorage
    await this.loadPersistentCache();
    
    // Setup real-time updates
    this.setupRealtimeUpdates();
    
    // Start background sync
    this.startBackgroundSync();
    
    // console.log('✅ Lightning Data Service initialized');
  }

  /**
   * INSTANT DATA ACCESS - Multi-tier cache system
   */
  async getData(dataType, options = {}) {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(dataType, options);

    try {
      // FORCE REFRESH: Skip all caching and force fresh API call
      if (options.forceRefresh) {
        // console.log(`🔄 FORCE REFRESH: ${dataType} - bypassing all caches and forcing fresh API call`);

        // Fetch fresh data from API (don't clear cache here, it's already cleared by optimistic update)
        const apiData = await this.fetchFromAPI(dataType, { ...options, immediate: true });

        if (apiData.success && apiData.data) {
          // Store fresh data in all cache levels
          await this.storeInAllCaches(cacheKey, dataType, apiData.data);
          // console.log(`✅ FORCE REFRESH: ${dataType} refreshed successfully from API`);

          return {
            success: true,
            data: apiData.data,
            source: 'force-refresh-api',
            loadTime: Date.now() - startTime
          };
        } else {
          console.error(`❌ FORCE REFRESH: ${dataType} API call failed:`, apiData.error);
          return { success: false, error: apiData.error || 'Force refresh failed', loadTime: Date.now() - startTime };
        }
      }

      // IMMEDIATE API HANDLING: Skip all caching for critical data types (except categories which should cache failures)
      if (dataType === 'chat-rooms' || dataType === 'users-complete' || dataType === 'products-complete') {
        // console.log(`⚡ IMMEDIATE: ${dataType} direct API fetch (bypassing cache)...`);

        // Clear any existing cache to force fresh data
        if (dataType === 'users-complete') {
          // console.log('🧹 IMMEDIATE: Clearing users cache to force fresh data...');
          this.memoryCache.delete(cacheKey);
        } else if (dataType === 'products-complete') {
          // console.log('🧹 IMMEDIATE: Clearing products cache to force fresh data...');
          this.memoryCache.delete(cacheKey);
        }

        const apiData = await this.fetchFromAPI(dataType, { ...options, immediate: true });

        // console.log(`🔍 IMMEDIATE: API response for ${dataType}:`, {
        //   success: apiData.success,
        //   dataLength: Array.isArray(apiData.data) ? apiData.data.length : 'not array',
        //   error: apiData.error || 'none'
        // });

        if (apiData.success && apiData.data) {
          // console.log(`⚡ IMMEDIATE: Got ${apiData.data.length} ${dataType} from API`);

          // Start real-time polling for updates (non-blocking)
          if (dataType === 'chat-rooms') {
            setTimeout(() => this.startChatRoomsPolling(dataType), 100);
          }

          return {
            success: true,
            data: apiData.data,
            source: 'immediate-api',
            loadTime: Date.now() - startTime,
            isRealTime: dataType === 'chat-rooms',
            immediate: true
          };
        } else {
          console.error(`❌ IMMEDIATE: API failed for ${dataType}:`, apiData.error);

          // Enhanced fallback strategy - check all cache levels
          let fallbackData = null;

          // Try memory cache first
          const memoryData = this.getFromMemoryCache(cacheKey);
          if (memoryData && Array.isArray(memoryData) && memoryData.length > 0) {
            fallbackData = memoryData;
            console.log(`⚡ IMMEDIATE: Using memory cache fallback: ${memoryData.length} ${dataType}`);
          }

          // Try persistent cache if memory cache is empty
          if (!fallbackData) {
            const persistentData = await this.getFromPersistentCache(cacheKey);
            if (persistentData && Array.isArray(persistentData) && persistentData.length > 0) {
              fallbackData = persistentData;
              console.log(`⚡ IMMEDIATE: Using persistent cache fallback: ${persistentData.length} ${dataType}`);
            }
          }

          if (fallbackData) {
            return {
              success: true,
              data: fallbackData,
              source: 'immediate-cache-fallback',
              loadTime: Date.now() - startTime,
              isStale: true // Indicate this is cached data
            };
          }

          return { success: false, data: [], source: 'immediate-failed', loadTime: Date.now() - startTime, error: apiData.error };
        }
      }

      // Normal processing for NON-chat-rooms data types
      if (dataType !== 'chat-rooms') {
        // L1: Memory cache (instant)
        const memoryData = this.getFromMemoryCache(cacheKey);
        if (memoryData) {
          this.performanceMetrics.cacheHits++;
          // console.log(`⚡ L1 Cache HIT: ${dataType} (${Date.now() - startTime}ms)`);
          return { success: true, data: memoryData, source: 'memory', loadTime: Date.now() - startTime };
        }
      }

      // L2: Persistent cache (very fast) - for non-chat-rooms data
      const persistentData = await this.getFromPersistentCache(cacheKey);
      if (persistentData) {
        // Promote to memory cache
        this.setMemoryCache(cacheKey, persistentData);
        this.performanceMetrics.cacheHits++;
        // console.log(`⚡ L2 Cache HIT: ${dataType} (${Date.now() - startTime}ms)`);
        return { success: true, data: persistentData, source: 'persistent', loadTime: Date.now() - startTime };
      }

      // L3: Database cache (fast)
      const databaseData = await this.getFromDatabaseCache(dataType, options);
      if (databaseData) {
        // Promote to higher cache levels
        this.setMemoryCache(cacheKey, databaseData);
        this.setPersistentCache(cacheKey, databaseData);
        this.performanceMetrics.cacheHits++;
        // console.log(`⚡ L3 Cache HIT: ${dataType} (${Date.now() - startTime}ms)`);
        return { success: true, data: databaseData, source: 'database', loadTime: Date.now() - startTime };
      }

      // L4: API call (slower, but cached immediately)
      this.performanceMetrics.cacheMisses++;
      this.performanceMetrics.apiCalls++;
      // console.log(`🌐 Cache MISS: ${dataType}, fetching from API...`);
      
      const apiData = await this.fetchFromAPI(dataType, options);
      if (apiData.success) {
        // Store in all cache levels
        await this.storeInAllCaches(cacheKey, dataType, apiData.data);
        // console.log(`✅ API fetch: ${dataType} (${Date.now() - startTime}ms)`);
        return { success: true, data: apiData.data, source: 'api', loadTime: Date.now() - startTime };
      }

      return { success: false, error: 'Data not available', loadTime: Date.now() - startTime };

    } catch (error) {
      console.error(`❌ getData failed for ${dataType}:`, error);
      return { success: false, error: error.message, loadTime: Date.now() - startTime };
    }
  }

  /**
   * AGGRESSIVE PREFETCHING - Load data before it's needed
   */
  async prefetchForPage(pageName, priority = 'normal') {
    // console.log(`🚀 Prefetching data for page: ${pageName}`);
    const dependencies = this.dataDependencies[pageName] || [];
    
    if (dependencies.length === 0) {
      // console.log(`No dependencies defined for page: ${pageName}`);
      return;
    }

    const prefetchPromises = dependencies.map(async (dataType) => {
      try {
        // Check if data is already cached
        const cached = await this.getData(dataType, { skipAPI: true });
        if (cached.success && cached.source !== 'api') {
          // console.log(`✅ ${dataType} already cached`);
          return;
        }

        // Prefetch from API
        // console.log(`🔄 Prefetching ${dataType}...`);
        await this.getData(dataType);
      } catch (error) {
        console.warn(`⚠️ Prefetch failed for ${dataType}:`, error);
      }
    });

    if (priority === 'high') {
      // Wait for all high-priority prefetches
      await Promise.all(prefetchPromises);
    } else {
      // Fire and forget for normal priority
      Promise.all(prefetchPromises).catch(console.warn);
    }
  }

  /**
   * OPTIMISTIC UPDATES - Instant UI updates with rollback
   */
  async optimisticUpdate(dataType, updateData, apiCall) {
    const updateId = `${dataType}_${Date.now()}_${Math.random()}`;
    // console.log(`⚡ Optimistic update: ${dataType} (${updateId})`);
    
    try {
      // Store original data for rollback
      const originalData = await this.getData(dataType);
      this.rollbackQueue.set(updateId, originalData.data);
      
      // Apply optimistic update to all cache levels
      const optimisticData = this.applyOptimisticUpdate(originalData.data, updateData);
      await this.updateAllCaches(dataType, optimisticData);
      
      // Track optimistic update
      this.optimisticQueue.set(updateId, { dataType, updateData, timestamp: Date.now() });
      this.performanceMetrics.optimisticUpdates++;
      
      // Execute API call in background
      try {
        const apiResult = await apiCall();
        
        if (apiResult.success) {
          // For delete operations, invalidate related caches and force fresh data
          if (updateData.action === 'remove') {
            // console.log(`🗑️ CACHE INVALIDATION: Clearing caches after successful deletion`);

            // Invalidate notification-related caches
            if (dataType === 'notifications') {
              await this.invalidateCache('notifications');
              await this.invalidateCache('unread-count');

              // Force fresh data fetch after a short delay
              setTimeout(async () => {
                // console.log(`🔄 FORCE REFRESH: Fetching fresh data after deletion`);
                try {
                  // Force refresh notifications data
                  const notificationsResult = await this.getData('notifications', { forceRefresh: true });
                  // console.log(`✅ FORCE REFRESH: Notifications refreshed successfully`, notificationsResult.success);

                  // Force refresh unread count
                  const unreadCountResult = await this.getData('unread-count', { forceRefresh: true });
                  // console.log(`✅ FORCE REFRESH: Unread count refreshed successfully`, unreadCountResult.success);
                } catch (error) {
                  console.error('❌ Force refresh failed:', error);
                  // Don't throw the error to prevent rollback
                }
              }, 100);
            }
          }

          // API success - update with real data if provided
          if (apiResult.data) {
            await this.updateAllCaches(dataType, apiResult.data);
          }
          // console.log(`✅ Optimistic update confirmed: ${dataType}`);
        } else {
          // API failed - rollback
          await this.rollbackOptimisticUpdate(updateId, dataType);
        }
        
        // Clean up
        this.optimisticQueue.delete(updateId);
        this.rollbackQueue.delete(updateId);
        
        return apiResult;
        
      } catch (apiError) {
        // API error - rollback
        await this.rollbackOptimisticUpdate(updateId, dataType);
        throw apiError;
      }
      
    } catch (error) {
      console.error(`❌ Optimistic update failed: ${dataType}`, error);
      throw error;
    }
  }

  /**
   * REAL-TIME UPDATES - WebSocket integration
   */
  setupRealtimeUpdates() {
    // console.log('📡 Setting up real-time updates...');
    
    // Register WebSocket handlers for different data types
    const dataTypes = ['notifications', 'wallet', 'chamas', 'transactions', 'products', 'orders', 'messages'];
    
    dataTypes.forEach(dataType => {
      webSocketService.registerDataUpdateHandler(dataType, async (update) => {
        // console.log(`📡 Real-time update received: ${dataType}`, update);
        
        try {
          // Update all cache levels with real-time data
          await this.handleRealtimeUpdate(dataType, update);
          
          // Notify registered handlers
          const handler = this.realtimeHandlers.get(dataType);
          if (handler) {
            handler(update);
          }
          
        } catch (error) {
          console.error(`❌ Real-time update failed for ${dataType}:`, error);
        }
      });
    });
    
    // Enable WebSocket real-time updates
    webSocketService.setRealtimeEnabled(true);
  }

  /**
   * BACKGROUND SYNC - Keep data fresh
   */
  startBackgroundSync() {
    // console.log('🔄 Starting background sync...');
    
    setInterval(async () => {
      if (this.isSyncing) return;
      
      try {
        this.isSyncing = true;
        await this.performBackgroundSync();
        this.lastSyncTime = Date.now();
      } catch (error) {
        console.error('❌ Background sync failed:', error);
      } finally {
        this.isSyncing = false;
      }
    }, this.syncInterval);
  }

  async performBackgroundSync() {
    // console.log('🔄 Performing background sync...');
    
    // Sync critical data types
    const criticalData = ['notifications', 'wallet', 'unread-count'];
    
    const syncPromises = criticalData.map(async (dataType) => {
      try {
        const result = await this.fetchFromAPI(dataType);
        if (result.success) {
          await this.updateAllCaches(dataType, result.data);
        }
      } catch (error) {
        console.warn(`⚠️ Background sync failed for ${dataType}:`, error);
      }
    });
    
    await Promise.allSettled(syncPromises);
    // console.log('✅ Background sync completed');
  }

  // Helper methods for cache management
  generateCacheKey(dataType, options = {}) {
    const optionsStr = Object.keys(options).length > 0 ? JSON.stringify(options) : '';
    return `${dataType}${optionsStr}`;
  }

  getFromMemoryCache(cacheKey) {
    const expiry = this.memoryExpiry.get(cacheKey);
    if (expiry && Date.now() > expiry) {
      this.memoryCache.delete(cacheKey);
      this.memoryExpiry.delete(cacheKey);
      return null;
    }
    return this.memoryCache.get(cacheKey);
  }

  setMemoryCache(cacheKey, data) {
    this.memoryCache.set(cacheKey, data);
    this.memoryExpiry.set(cacheKey, Date.now() + this.cacheConfig.memory.ttl);
  }

  async getFromPersistentCache(cacheKey) {
    try {
      const cached = await AsyncStorage.getItem(`cache_${cacheKey}`);
      if (cached) {
        const { data, expiry } = JSON.parse(cached);
        if (Date.now() < expiry) {
          return data;
        } else {
          AsyncStorage.removeItem(`cache_${cacheKey}`);
        }
      }
    } catch (error) {
      console.warn('Persistent cache read error:', error);
    }
    return null;
  }

  async setPersistentCache(cacheKey, data) {
    try {
      const cacheData = {
        data,
        expiry: Date.now() + this.cacheConfig.persistent.ttl,
      };
      await AsyncStorage.setItem(`cache_${cacheKey}`, JSON.stringify(cacheData));
    } catch (error) {
      if (error.message.includes('quota') || error.message.includes('exceeded')) {
        console.warn('🧹 Storage quota exceeded, clearing old cache entries...');
        await this.clearOldPersistentCache();

        // Try again after clearing
        try {
          await AsyncStorage.setItem(`cache_${cacheKey}`, JSON.stringify(cacheData));
          // console.log('✅ Cache stored after cleanup');
        } catch (retryError) {
          console.warn('❌ Cache storage failed even after cleanup:', retryError);
        }
      } else {
        console.warn('Persistent cache write error:', error);
      }
    }
  }

  async clearOldPersistentCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      const now = Date.now();

      const keysToRemove = [];

      for (const key of cacheKeys) {
        try {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            const { expiry } = JSON.parse(cached);
            if (now > expiry) {
              keysToRemove.push(key);
            }
          }
        } catch (parseError) {
          // If we can't parse it, remove it
          keysToRemove.push(key);
        }
      }

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        // console.log(`🧹 Removed ${keysToRemove.length} expired cache entries`);
      }
    } catch (error) {
      console.warn('Failed to clear old cache:', error);
    }
  }

  async getFromDatabaseCache(dataType, options = {}) {
    if (!DatabaseService.isInitialized) return null;

    try {
      switch (dataType) {
        case 'profile':
          return await DatabaseService.findOne('users', 'id = ?', [options.userId]);
        case 'chamas':
          return await DatabaseService.findAll('chamas', '', [], 'updated_at DESC', 50);
        case 'transactions':
          return await DatabaseService.findAll('transactions', '', [], 'created_at DESC', 100);
        case 'notifications':
          return await DatabaseService.findAll('notifications', '', [], 'created_at DESC', 100);
        case 'products':
          return await DatabaseService.findAll('products', '', [], 'created_at DESC', 100);
        case 'cart':
          return await DatabaseService.findAll('cart_items', 'user_id = ?', [options.userId]);
        case 'orders':
          return await DatabaseService.findAll('orders', '', [], 'created_at DESC', 50);
        case 'chat-rooms':
          return await DatabaseService.findAll('chat_rooms', '', [], 'updated_at DESC');
        case 'users-complete':
          return await DatabaseService.findAll('users', '', [], 'created_at DESC');
        case 'system-analytics':
          return await DatabaseService.findOne('system_analytics', 'id = ?', [1]);
        case 'learning-analytics':
          return await DatabaseService.findOne('learning_analytics', 'id = ?', [1]);
        case 'products-complete':
          return await DatabaseService.findAll('products', '', [], 'created_at DESC');
        case 'marketplace-categories':
          return await DatabaseService.findAll('marketplace_categories', '', [], 'name ASC');
        case 'marketplace-analytics':
          return await DatabaseService.findOne('marketplace_analytics', 'id = ?', [1]);
        default:
          return null;
      }
    } catch (error) {
      console.warn(`Database cache error for ${dataType}:`, error);
      return null;
    }
  }

  // Check if we should skip API call due to recent errors
  shouldSkipAPICall(dataType) {
    const errorCount = this.errorCounts.get(dataType) || 0;
    const lastErrorTime = this.lastErrorTime.get(dataType) || 0;
    const now = Date.now();

    // Exponential backoff: 1min, 5min, 15min, 30min
    const backoffDelays = [60000, 300000, 900000, 1800000];
    const backoffDelay = backoffDelays[Math.min(errorCount - 1, backoffDelays.length - 1)] || 0;

    if (errorCount > 0 && (now - lastErrorTime) < backoffDelay) {
      console.log(`⏳ Skipping ${dataType} API call due to backoff (${errorCount} errors, ${Math.round((backoffDelay - (now - lastErrorTime)) / 1000)}s remaining)`);
      return true;
    }

    return false;
  }

  // Record API error for backoff tracking
  recordAPIError(dataType) {
    const currentCount = this.errorCounts.get(dataType) || 0;
    this.errorCounts.set(dataType, currentCount + 1);
    this.lastErrorTime.set(dataType, Date.now());
    console.log(`❌ Recorded error for ${dataType} (count: ${currentCount + 1})`);
  }

  // Reset error count on successful API call
  resetAPIErrors(dataType) {
    if (this.errorCounts.has(dataType)) {
      console.log(`✅ Reset error count for ${dataType}`);
      this.errorCounts.delete(dataType);
      this.lastErrorTime.delete(dataType);
    }
  }

  async fetchFromAPI(dataType, options = {}) {
    // console.log(`🌐 Fetching ${dataType} from API...`);

    // Check if we should skip due to recent errors (unless forced)
    if (!options.forceRefresh && this.shouldSkipAPICall(dataType)) {
      return { success: false, error: 'Skipped due to recent errors (backoff active)' };
    }

    try {
      // Add timeout to prevent hanging - increased for users-complete
      const timeoutDuration = dataType === 'users-complete' ? 30000 : 15000; // 30s for users, 15s for others
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`API timeout for ${dataType}`)), timeoutDuration);
      });

      const apiPromise = (async () => {
        switch (dataType) {
          case 'profile':
            return await ApiService.getProfile();
          case 'wallet':
            return await ApiService.getWalletBalance();
          case 'chamas':
            return await ApiService.getUserChamas(50, 0);
          case 'transactions':
            return await ApiService.getTransactions(100, 0);
          case 'notifications':
            // console.log(`🌐 API CALL: Getting notifications...`);
            return await ApiService.getNotifications(100, 0);
          case 'unread-count':
            // consbetter designole.log(`🌐 API CALL: Getting unread count...`);
            return await ApiService.getUnreadNotificationCount();
        case 'products':
          return await ApiService.getProducts({}, 100, 0);
        case 'cart':
          return await ApiService.getCart();
        case 'orders':
          return await ApiService.getOrders({ limit: 50 });
        case 'chat-rooms':
          // IMMEDIATE: Direct API call with instant UI update
          // console.log('🚀 IMMEDIATE: Fetching chat rooms directly from backend...');
          const chatRoomsResponse = await ApiService.getChatRooms();

          // // console.log('🔍 IMMEDIATE: Raw API response for chat-rooms:', {
          //   success: chatRoomsResponse.success,
          //   dataType: typeof chatRoomsResponse.data,
          //   dataLength: Array.isArray(chatRoomsResponse.data) ? chatRoomsResponse.data.length : 'not array',
          //   firstItem: chatRoomsResponse.data?.[0]?.name || 'no name',
          //   immediate: true
          // });

          // IMMEDIATE: Update memory cache first for instant UI access
          if (chatRoomsResponse.success && chatRoomsResponse.data) {
            // console.log(`⚡ IMMEDIATE: Updating memory cache with ${chatRoomsResponse.data.length} chat rooms`);
            const cacheKey = this.generateCacheKey('chat-rooms');
            this.setMemoryCache(cacheKey, chatRoomsResponse.data);

            // IMMEDIATE: Notify all listeners instantly
            this.notifyDataChangeListeners('chat-rooms', chatRoomsResponse.data);

            // Background storage (non-blocking)
            this.storeInAllCaches(cacheKey, 'chat-rooms', chatRoomsResponse.data).catch(error => {
              console.warn('⚠️ Background storage failed (non-critical):', error.message);
            });

            // console.log(`✅ IMMEDIATE: ${chatRoomsResponse.data.length} chat rooms ready for UI`);
          } else {
            console.warn('⚠️ IMMEDIATE: Chat rooms API response failed');

            // Check for server errors
            if (chatRoomsResponse.serverDown) {
              console.error('🚨 IMMEDIATE: Backend server is down');
            } else if (chatRoomsResponse.corsError) {
              console.error('🚨 IMMEDIATE: CORS error - backend unreachable');
            }
          }

          return chatRoomsResponse;

        case 'users-complete':
          // FAST: Get ALL users without pagination for complete user management
          // console.log('🚀 FAST: Fetching ALL users for admin management...');
          const usersResponse = await ApiService.getAllUsersComplete();

          // console.log('🔍 FAST: Raw users API response:', {
          //   success: usersResponse.success,
          //   totalCount: usersResponse.totalCount,
          //   dataLength: Array.isArray(usersResponse.data) ? usersResponse.data.length : 'not array',
          //   hasDuplicates: usersResponse.hasDuplicates,
          //   firstUser: usersResponse.data?.[0]?.firstName || 'no first user'
          // });

          // IMMEDIATE: Update memory cache for instant UI access
          if (usersResponse.success && usersResponse.data) {
            // console.log(`⚡ FAST: Updating memory cache with ${usersResponse.data.length} users`);
            const cacheKey = this.generateCacheKey('users-complete');
            this.setMemoryCache(cacheKey, usersResponse.data);

            // IMMEDIATE: Notify listeners for instant UI update
            this.notifyDataChangeListeners('users-complete', usersResponse.data);

            // Background storage (non-blocking)
            this.storeInAllCaches(cacheKey, 'users-complete', usersResponse.data).catch(error => {
              console.warn('⚠️ Background user storage failed (non-critical):', error.message);
            });

            // console.log(`✅ FAST: ${usersResponse.data.length} users ready for UI (${usersResponse.hasDuplicates ? 'duplicates removed' : 'no duplicates'})`);
          } else {
            console.warn('⚠️ FAST: Users API response failed');
          }

          return usersResponse;

        case 'system-analytics':
          // REAL: Get system analytics with real data from backend
          // console.log('📊 REAL: Fetching system analytics...');
          const analyticsResponse = await ApiService.getSystemAnalytics('7d');

          // console.log('📊 REAL: System analytics API response:', {
          //   success: analyticsResponse.success,
          //   hasData: !!analyticsResponse.data,
          //   source: analyticsResponse.source || 'api',
          //   error: analyticsResponse.error || 'none'
          // });

          // IMMEDIATE: Update memory cache for instant UI access
          if (analyticsResponse.success && analyticsResponse.data) {
            // console.log('⚡ REAL: Updating memory cache with system analytics');
            const cacheKey = this.generateCacheKey('system-analytics');
            this.setMemoryCache(cacheKey, analyticsResponse.data);

            // IMMEDIATE: Notify listeners for instant UI update
            this.notifyDataChangeListeners('system-analytics', analyticsResponse.data);

            // Background storage (non-blocking)
            this.storeInAllCaches(cacheKey, 'system-analytics', analyticsResponse.data).catch(error => {
              console.warn('⚠️ Background analytics storage failed (non-critical):', error.message);
            });

            // console.log('✅ REAL: System analytics ready for UI');
          } else {
            console.warn('⚠️ REAL: System analytics API response failed');
          }

          return analyticsResponse;

        case 'learning-analytics':
          // REAL: Get learning analytics with real data from backend
          // console.log('📚 REAL: Fetching learning analytics...');
          const learningAnalyticsResponse = await ApiService.getLearningAnalytics();

          // console.log('📚 REAL: Learning analytics API response:', {
          //   success: learningAnalyticsResponse.success,
          //   hasData: !!learningAnalyticsResponse.data,
          //   source: learningAnalyticsResponse.source || 'api',
          //   error: learningAnalyticsResponse.error || 'none'
          // });

          // IMMEDIATE: Update memory cache for instant UI access
          if (learningAnalyticsResponse.success && learningAnalyticsResponse.data) {
            // console.log('⚡ REAL: Updating memory cache with learning analytics');
            const cacheKey = this.generateCacheKey('learning-analytics');
            this.setMemoryCache(cacheKey, learningAnalyticsResponse.data);

            // IMMEDIATE: Notify listeners for instant UI update
            this.notifyDataChangeListeners('learning-analytics', learningAnalyticsResponse.data);

            // Background storage (non-blocking)
            this.storeInAllCaches(cacheKey, 'learning-analytics', learningAnalyticsResponse.data).catch(error => {
              console.warn('⚠️ Background learning analytics storage failed (non-critical):', error.message);
            });

            // console.log('✅ REAL: Learning analytics ready for UI');
          } else {
            console.warn('⚠️ REAL: Learning analytics API response failed');
          }

          return learningAnalyticsResponse;

        case 'products-complete':
          // REAL: Get ALL products for complete marketplace management
          // console.log('🛒 REAL: Fetching ALL products for marketplace...');
          const productsResponse = await ApiService.getAllProductsComplete();

          // console.log('🛒 REAL: Products API response:', {
          //   success: productsResponse.success,
          //   hasData: !!productsResponse.data,
          //   totalCount: productsResponse.totalCount,
          //   error: productsResponse.error || 'none'
          // });

          // IMMEDIATE: Update memory cache for instant UI access
          if (productsResponse.success && productsResponse.data) {
            // console.log('⚡ REAL: Updating memory cache with products');
            const cacheKey = this.generateCacheKey('products-complete');
            this.setMemoryCache(cacheKey, productsResponse.data);

            // IMMEDIATE: Notify listeners for instant UI update
            this.notifyDataChangeListeners('products-complete', productsResponse.data);

            // Background storage (non-blocking)
            this.storeInAllCaches(cacheKey, 'products-complete', productsResponse.data).catch(error => {
              console.warn('⚠️ Background products storage failed (non-critical):', error.message);
            });

            // console.log('✅ REAL: Products ready for UI');
          } else {
            console.warn('⚠️ REAL: Products API response failed');
          }

          return productsResponse;

        case 'marketplace-categories':
          // REAL: Smart categories handling with 404 caching
          // console.log('🏷️ REAL: Fetching marketplace categories...');

          // Check if we've already determined the endpoint doesn't exist
          const categoriesFailureKey = 'marketplace-categories-404-cached';
          const cachedFailure = this.memoryCache.get(categoriesFailureKey);

          if (cachedFailure) {
            // console.log('🏷️ REAL: Categories endpoint known to be missing, using cached fallback');
            return cachedFailure;
          }

          const categoriesResponse = await ApiService.getMarketplaceCategories();

          // console.log('🏷️ REAL: Categories API response:', {
          //   success: categoriesResponse.success,
          //   hasData: !!categoriesResponse.data,
          //   categoriesCount: Array.isArray(categoriesResponse.data) ? categoriesResponse.data.length : 'not array',
          //   source: categoriesResponse.source,
          //   error: categoriesResponse.error || 'none'
          // });

          // IMMEDIATE: Update memory cache for instant UI access
          if (categoriesResponse.success && categoriesResponse.data) {
            // console.log('⚡ REAL: Updating memory cache with categories');
            const cacheKey = this.generateCacheKey('marketplace-categories');
            this.setMemoryCache(cacheKey, categoriesResponse.data);

            // IMMEDIATE: Notify listeners for instant UI update
            this.notifyDataChangeListeners('marketplace-categories', categoriesResponse.data);

            // Background storage (non-blocking)
            this.storeInAllCaches(cacheKey, 'marketplace-categories', categoriesResponse.data).catch(error => {
              console.warn('⚠️ Background categories storage failed (non-critical):', error.message);
            });

            // console.log('✅ REAL: Categories ready for UI');
          } else {
            console.warn('⚠️ REAL: Categories API response failed, caching failure to prevent retries');

            // Cache the failure response to prevent repeated API calls
            this.memoryCache.set(categoriesFailureKey, categoriesResponse, 5 * 60 * 1000); // Cache for 5 minutes
          }

          return categoriesResponse;

        case 'marketplace-analytics':
          // REAL: Get marketplace analytics with real data from backend
          // console.log('🛒 REAL: Fetching marketplace analytics...');
          const marketplaceAnalyticsResponse = await ApiService.getMarketplaceAnalytics('7d');

          // console.log('🛒 REAL: Marketplace analytics API response:', {
          //   success: marketplaceAnalyticsResponse.success,
          //   hasData: !!marketplaceAnalyticsResponse.data,
          //   source: marketplaceAnalyticsResponse.source || 'api',
          //   error: marketplaceAnalyticsResponse.error || 'none'
          // });

          // IMMEDIATE: Update memory cache for instant UI access
          if (marketplaceAnalyticsResponse.success && marketplaceAnalyticsResponse.data) {
            // console.log('⚡ REAL: Updating memory cache with marketplace analytics');
            const cacheKey = this.generateCacheKey('marketplace-analytics');
            this.setMemoryCache(cacheKey, marketplaceAnalyticsResponse.data);

            // IMMEDIATE: Notify listeners for instant UI update
            this.notifyDataChangeListeners('marketplace-analytics', marketplaceAnalyticsResponse.data);

            // Background storage (non-blocking)
            this.storeInAllCaches(cacheKey, 'marketplace-analytics', marketplaceAnalyticsResponse.data).catch(error => {
              console.warn('⚠️ Background marketplace analytics storage failed (non-critical):', error.message);
            });

            // console.log('✅ REAL: Marketplace analytics ready for UI');
          } else {
            console.warn('⚠️ REAL: Marketplace analytics API response failed');
          }

          return marketplaceAnalyticsResponse;

        case 'chat-messages-preload':
          // Enhanced message preloading with decryption
          // console.log('🔄 Preloading and decrypting chat messages...');
          try {
            // Get chat rooms first
            const roomsResponse = await ApiService.getChatRooms();
            if (!roomsResponse.success || !roomsResponse.data) {
              return { success: true, data: [] };
            }

            // Get the 3 most recent rooms (reduced to prevent storage issues)
            const recentRooms = roomsResponse.data
              .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
              .slice(0, 3);

            // console.log(`📨 Preloading messages for ${recentRooms.length} recent rooms...`);

            // Preload and decrypt messages for each room
            const messagePromises = recentRooms.map(async (room) => {
              try {
                const messagesResponse = await ApiService.getChatMessages(room.id, 15, 0); // Reduced to 15 messages
                if (messagesResponse.success && messagesResponse.data) {
                  // console.log(`📥 Got ${messagesResponse.data.length} messages for room ${room.name || room.id}`);

                  // Decrypt messages immediately
                  const decryptedMessages = await this.decryptMessagesForRoom(messagesResponse.data, room.id);

                  // Store decrypted messages in memory cache only (avoid storage quota)
                  const roomCacheKey = `chat-messages-${room.id}`;
                  this.setMemoryCache(roomCacheKey, decryptedMessages);

                  // console.log(`✅ Preloaded & decrypted ${decryptedMessages.length} messages for room: ${room.name || room.id}`);
                  return { roomId: room.id, messages: decryptedMessages };
                }
                return { roomId: room.id, messages: [] };
              } catch (error) {
                console.warn(`⚠️ Failed to preload messages for room ${room.id}:`, error.message);
                return { roomId: room.id, messages: [] };
              }
            });

            const preloadedMessages = await Promise.all(messagePromises);
            const totalMessages = preloadedMessages.reduce((sum, room) => sum + room.messages.length, 0);

            // console.log(`✅ Preloaded & decrypted ${totalMessages} total messages across ${recentRooms.length} rooms`);
            return { success: true, data: preloadedMessages };
          } catch (error) {
            console.warn('⚠️ Chat messages preload failed:', error.message);
            return { success: true, data: [] };
          }
        case 'meetings':
          return await ApiService.getUserMeetings(50, 0);
        case 'chama-members':
          if (!options.chamaId) {
            console.warn('⚠️ chama-members requested without chamaId');
            return { success: false, error: 'chamaId is required for chama-members', data: [] };
          }
          return await ApiService.getChamaMembers(options.chamaId);
        case 'chama-transactions':
          if (!options.chamaId) {
            console.warn('⚠️ chama-transactions requested without chamaId');
            return { success: false, error: 'chamaId is required for chama-transactions', data: [] };
          }
          return await ApiService.getChamaTransactions(options.chamaId, 50, 0);
        case 'all-users':
          return await ApiService.getAllUsersForAdmin(50, 0);
        case 'all-chamas':
          return await ApiService.getAllChamasForAdmin(100, 0);
        case 'support-requests':
          return await ApiService.getSupportRequests({ limit: 50 });
        case 'recent-messages':
          try {
            // Get recent messages across all chat rooms
            const chatRoomsResponse = await ApiService.getChatRooms();
            if (chatRoomsResponse.success && chatRoomsResponse.data) {
              // Get messages from the first few active rooms
              const activeRooms = chatRoomsResponse.data.slice(0, 5);
              const messagePromises = activeRooms.map(room =>
                ApiService.getChatMessages(room.id, 10, 0).catch(() => ({ success: false, data: [] }))
              );
              const messagesResults = await Promise.all(messagePromises);
              const allMessages = messagesResults
                .filter(result => result.success)
                .flatMap(result => result.data || [])
                .sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at))
                .slice(0, 20);
              return { success: true, data: allMessages };
            }
            return { success: false, data: [] };
          } catch (error) {
            console.warn('⚠️ Recent messages failed, returning empty array');
            return { success: true, data: [] };
          }
        case 'contacts':
          try {
            // Get contacts from chat rooms
            const contactsFromRooms = await ApiService.getChatRooms();

            let allContacts = [];
            if (contactsFromRooms.success && contactsFromRooms.data) {
              // Extract unique users from chat rooms
              const roomContacts = contactsFromRooms.data
                .flatMap(room => room.members || [])
                .filter((contact, index, self) =>
                  index === self.findIndex(c => c.id === contact.id)
                );
              allContacts = [...allContacts, ...roomContacts];
            }

            // Remove duplicates
            const uniqueContacts = allContacts.filter((contact, index, self) =>
              index === self.findIndex(c => c.id === contact.id)
            );

            return { success: true, data: uniqueContacts };
          } catch (error) {
            console.warn('⚠️ Contacts fetch failed, returning empty array');
            return { success: true, data: [] };
          }
        case 'wishlist':
          return await ApiService.getWishlist();
        default:
          throw new Error(`Unknown data type: ${dataType}`);
        }
      })();

      // Race between API call and timeout
      const result = await Promise.race([apiPromise, timeoutPromise]);
      // console.log(`✅ API SUCCESS: ${dataType} fetched successfully`);

      // Reset error count on successful API call
      this.resetAPIErrors(dataType);

      return result;

    } catch (error) {
      console.error(`❌ API fetch failed for ${dataType}:`, error);

      // Record error for backoff tracking
      this.recordAPIError(dataType);

      return { success: false, error: error.message };
    }
  }

  async storeInAllCaches(cacheKey, dataType, data) {
    // Store in memory cache
    this.setMemoryCache(cacheKey, data);

    // Store in persistent cache
    await this.setPersistentCache(cacheKey, data);

    // Store in database cache
    await this.storeDatabaseCache(dataType, data);
  }

  async storeDatabaseCache(dataType, data) {
    if (!DatabaseService.isInitialized || !data) return;

    try {
      switch (dataType) {
        case 'chamas':
          if (Array.isArray(data)) {
            for (const chama of data) {
              await DatabaseService.insertOrUpdate('chamas', chama, 'id');
            }
          }
          break;
        case 'transactions':
          if (Array.isArray(data)) {
            for (const transaction of data) {
              await DatabaseService.insertOrUpdate('transactions', transaction, 'id');
            }
          }
          break;
        case 'notifications':
          if (Array.isArray(data)) {
            for (const notification of data) {
              await DatabaseService.insertOrUpdate('notifications', notification, 'id');
            }
          }
          break;
        case 'products':
          if (Array.isArray(data)) {
            for (const product of data) {
              await DatabaseService.insertOrUpdate('products', product, 'id');
            }
          }
          break;
        case 'cart':
          if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
              await DatabaseService.insertOrUpdate('cart_items', item, 'id');
            }
          }
          break;
        case 'orders':
          if (Array.isArray(data)) {
            for (const order of data) {
              await DatabaseService.insertOrUpdate('orders', order, 'id');
            }
          }
          break;
        case 'chat-rooms':
          if (Array.isArray(data)) {
            for (const room of data) {
              await DatabaseService.insertOrUpdate('chat_rooms', room, 'id');
            }
          }
          break;
        case 'users-complete':
          if (Array.isArray(data)) {
            for (const user of data) {
              await DatabaseService.insertOrUpdate('users', user, 'id');
            }
          }
          break;
        case 'system-analytics':
          if (data && typeof data === 'object') {
            await DatabaseService.insertOrUpdate('system_analytics', { id: 1, ...data }, 'id');
          }
          break;
        case 'learning-analytics':
          if (data && typeof data === 'object') {
            await DatabaseService.insertOrUpdate('learning_analytics', { id: 1, ...data }, 'id');
          }
          break;
        case 'products-complete':
          if (Array.isArray(data)) {
            for (const product of data) {
              await DatabaseService.insertOrUpdate('products', product, 'id');
            }
          }
          break;
        case 'marketplace-categories':
          if (Array.isArray(data)) {
            for (const category of data) {
              await DatabaseService.insertOrUpdate('marketplace_categories', category, 'id');
            }
          }
          break;
        case 'marketplace-analytics':
          if (data && typeof data === 'object') {
            await DatabaseService.insertOrUpdate('marketplace_analytics', { id: 1, ...data }, 'id');
          }
          break;
      }
    } catch (error) {
      console.warn(`Database storage failed for ${dataType}:`, error);
    }
  }

  async updateAllCaches(dataType, data) {
    const cacheKey = this.generateCacheKey(dataType);
    await this.storeInAllCaches(cacheKey, dataType, data);
  }

  applyOptimisticUpdate(originalData, updateData) {
    if (Array.isArray(originalData)) {
      // Handle array updates (add, update, remove, bulk_update)
      if (updateData.action === 'add') {
        return [updateData.data, ...originalData];
      } else if (updateData.action === 'update') {
        return originalData.map(item =>
          item.id === updateData.data.id ? { ...item, ...updateData.data } : item
        );
      } else if (updateData.action === 'bulk_update') {
        // Handle bulk updates - apply update to all items
        return originalData.map(item => ({
          ...item,
          ...updateData.update
        }));
      } else if (updateData.action === 'remove') {
        return originalData.filter(item => item.id !== updateData.id);
      }
    } else if (typeof originalData === 'object') {
      // Handle object updates
      return { ...originalData, ...updateData };
    }

    return updateData;
  }

  async rollbackOptimisticUpdate(updateId, dataType) {
    // console.log(`🔄 Rolling back optimistic update: ${dataType} (${updateId})`);

    const originalData = this.rollbackQueue.get(updateId);
    if (originalData) {
      await this.updateAllCaches(dataType, originalData);
      this.performanceMetrics.rollbacks++;
    }

    this.optimisticQueue.delete(updateId);
    this.rollbackQueue.delete(updateId);
  }

  async invalidateCache(dataType) {
    // console.log(`🗑️ Invalidating cache for: ${dataType}`);

    try {
      // Find ALL cache keys that start with this dataType
      const keysToDelete = [];

      // L1 Cache (Memory) - find all matching keys
      for (const [key] of this.memoryCache) {
        if (key.startsWith(dataType)) {
          keysToDelete.push(key);
        }
      }

      // console.log(`🗑️ CACHE INVALIDATION: Found ${keysToDelete.length} cache keys to clear for ${dataType}:`, keysToDelete);

      // Clear from all cache levels for each key
      for (const cacheKey of keysToDelete) {
        // L1 Cache (Memory)
        this.memoryCache.delete(cacheKey);
        this.memoryExpiry.delete(cacheKey);
        // console.log(`🗑️ CLEARED L1: ${cacheKey}`);

        // L2 Cache (AsyncStorage)
        await AsyncStorage.removeItem(`l2_${cacheKey}`);
        this.persistentCache.delete(cacheKey);
        // console.log(`🗑️ CLEARED L2: ${cacheKey}`);

        // L3 Cache (SQLite/Database) - if available
        if (this.databaseService) {
          try {
            await this.databaseService.deleteItem(cacheKey);
            // console.log(`🗑️ CLEARED L3: ${cacheKey}`);
          } catch (dbError) {
            console.warn(`⚠️ Database cache clear failed for ${cacheKey}:`, dbError);
          }
        }
        this.databaseCache.delete(cacheKey);
      }

      // Also clear the base key without options (in case it wasn't found above)
      const baseCacheKey = this.generateCacheKey(dataType);
      if (!keysToDelete.includes(baseCacheKey)) {
        this.memoryCache.delete(baseCacheKey);
        this.memoryExpiry.delete(baseCacheKey);
        await AsyncStorage.removeItem(`l2_${baseCacheKey}`);
        this.persistentCache.delete(baseCacheKey);
        this.databaseCache.delete(baseCacheKey);
        // console.log(`🗑️ CLEARED BASE KEY: ${baseCacheKey}`);
      }

      // Verify cache is actually cleared
      const remainingKeys = [];
      for (const [key] of this.memoryCache) {
        if (key.startsWith(dataType)) {
          remainingKeys.push(key);
        }
      }

      if (remainingKeys.length > 0) {
        console.error(`❌ CACHE INVALIDATION FAILED! Still found ${remainingKeys.length} keys:`, remainingKeys);
      } else {
        // console.log(`✅ Cache completely invalidated for: ${dataType} (${keysToDelete.length} keys cleared)`);
      }
    } catch (error) {
      console.error(`❌ Failed to invalidate cache for ${dataType}:`, error);
    }
  }

  async handleRealtimeUpdate(dataType, update) {
    // console.log(`📡 Processing real-time update: ${dataType}`, update);

    const { action, data, update: bulkUpdate } = update;
    const currentData = await this.getData(dataType);

    if (currentData.success) {
      let updatedData;

      if (action === 'create' || action === 'add') {
        updatedData = Array.isArray(currentData.data)
          ? [data, ...currentData.data]
          : data;
      } else if (action === 'update') {
        updatedData = Array.isArray(currentData.data)
          ? currentData.data.map(item => item.id === data.id ? { ...item, ...data } : item)
          : { ...currentData.data, ...data };
      } else if (action === 'bulk_update') {
        updatedData = Array.isArray(currentData.data)
          ? currentData.data.map(item => ({ ...item, ...bulkUpdate }))
          : { ...currentData.data, ...bulkUpdate };
      } else if (action === 'delete' || action === 'remove') {
        updatedData = Array.isArray(currentData.data)
          ? currentData.data.filter(item => item.id !== data.id)
          : null;
      } else {
        updatedData = data;
      }

      await this.updateAllCaches(dataType, updatedData);
    }
  }

  async loadPersistentCache() {
    // console.log('📂 Loading persistent cache...');
    // This could be expanded to preload critical cache entries
  }

  // Register real-time update handler
  registerRealtimeHandler(dataType, handler) {
    this.realtimeHandlers.set(dataType, handler);
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cacheHitRate: this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100,
      memoryCacheSize: this.memoryCache.size,
      optimisticQueueSize: this.optimisticQueue.size,
      lastSyncTime: this.lastSyncTime,
    };
  }

  // Get preloaded messages for a specific room
  async getPreloadedMessages(roomId) {
    const cacheKey = `chat-messages-${roomId}`;

    // Try memory cache first
    const memoryData = this.getFromMemoryCache(cacheKey);
    if (memoryData && Array.isArray(memoryData) && memoryData.length > 0) {
      // console.log(`⚡ Using preloaded messages for room ${roomId}: ${memoryData.length} messages`);
      return { success: true, data: memoryData, source: 'preloaded-memory' };
    }

    // Try persistent cache
    const persistentData = await this.getFromPersistentCache(cacheKey);
    if (persistentData && persistentData.data && Array.isArray(persistentData.data) && persistentData.data.length > 0) {
      // console.log(`⚡ Using preloaded messages for room ${roomId}: ${persistentData.data.length} messages`);
      // Store in memory for faster access
      this.setMemoryCache(cacheKey, persistentData.data);
      return { success: true, data: persistentData.data, source: 'preloaded-persistent' };
    }

    // console.log(`ℹ️ No preloaded messages found for room ${roomId}`);
    return { success: false, data: [] };
  }

  // Decrypt messages for a specific room
  async decryptMessagesForRoom(messages, roomId) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    // console.log(`🔓 Decrypting ${messages.length} messages for room ${roomId}...`);

    try {
      // Import encryption service
      const encryptedChatService = await import('./encryptedChat');

      // Decrypt messages in parallel for better performance
      const decryptionPromises = messages.map(async (message, index) => {
        try {
          // Create a copy of the message to avoid modifying original
          const messageToDecrypt = { ...message };

          // Handle different message content formats
          let decryptedContent = null;

          if (typeof message.content === 'string') {
            try {
              // Try to parse as JSON first
              const parsedContent = JSON.parse(message.content);
              if (parsedContent.ciphertext && parsedContent.iv) {
                // This is encrypted data
                const result = await encryptedChatService.default.receiveMessage({
                  ...messageToDecrypt,
                  content: parsedContent
                });

                if (result.success && result.content) {
                  decryptedContent = result.content;
                } else {
                  console.warn(`⚠️ Decryption failed for message ${index + 1}:`, result.error);
                  decryptedContent = message.content; // Use original as fallback
                }
              } else {
                // Not encrypted, use as-is
                decryptedContent = message.content;
              }
            } catch (parseError) {
              // Not JSON, treat as plain text
              decryptedContent = message.content;
            }
          } else if (typeof message.content === 'object' && message.content.ciphertext) {
            // Already parsed encrypted object
            const result = await encryptedChatService.default.receiveMessage(messageToDecrypt);
            if (result.success && result.content) {
              decryptedContent = result.content;
            } else {
              decryptedContent = '[Encrypted message]';
            }
          } else {
            // Unknown format, use as-is
            decryptedContent = message.content || '[No content]';
          }

          // Return message with decrypted content
          return {
            ...messageToDecrypt,
            displayContent: decryptedContent,
            isDecrypted: true,
            decryptedAt: Date.now()
          };

        } catch (error) {
          console.warn(`⚠️ Failed to decrypt message ${index + 1}:`, error.message);
          return {
            ...message,
            displayContent: message.content || '[Decryption failed]',
            isDecrypted: false,
            decryptionError: error.message
          };
        }
      });

      const decryptedMessages = await Promise.all(decryptionPromises);
      const successCount = decryptedMessages.filter(m => m.isDecrypted).length;

      // console.log(`✅ Successfully decrypted ${successCount}/${messages.length} messages for room ${roomId}`);
      return decryptedMessages;

    } catch (error) {
     // Return original messages with fallback display content
      return messages.map(message => ({
        ...message,
        displayContent: message.content || '[Decryption unavailable]',
        isDecrypted: false,
        decryptionError: error.message
      }));
    }
  }

  // Removed fallback functions - chat should only show real data from database

  // Store data in all cache levels - BULLETPROOF VERSION
  async storeInAllCaches(cacheKey, dataType, data) {
    // ALWAYS store in memory cache first (this never fails)
    try {
      this.setMemoryCache(cacheKey, data);
    } catch (memError) {
      console.warn(`Memory cache failed for ${dataType}:`, memError.message);
    }

    // Try persistent storage with bulletproof error handling
    const persistentKey = `cache_${cacheKey}`;
    const storageData = {
      data,
      timestamp: Date.now(),
      dataType
    };

    try {
      await AsyncStorage.setItem(persistentKey, JSON.stringify(storageData));
      // console.log(`💾 Stored ${dataType} in all cache levels`);
      return; // Success - exit early
    } catch (error) {
      // Silent handling - don't spam logs with storage errors
      if (this.isQuotaError(error)) {
        // Try one cleanup attempt, then give up gracefully
        try {
          await this.performEmergencyCleanup();
          await AsyncStorage.setItem(persistentKey, JSON.stringify(storageData));
          // console.log(`💾 Stored ${dataType} after cleanup`);
        } catch (finalError) {
          // Give up silently - memory cache is sufficient
          // console.log(`ℹ️ Using memory-only cache for ${dataType}`);
        }
      }
    }
  }

  // Check if error is storage quota related
  isQuotaError(error) {
    const msg = (error.message || '').toLowerCase();
    return msg.includes('quota') || msg.includes('exceeded') || msg.includes('storage');
  }

  // Emergency cleanup - remove 75% of cache entries
  async performEmergencyCleanup() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('cache_') || key.startsWith('lightning_'));

      if (cacheKeys.length > 0) {
        const keysToRemove = cacheKeys.slice(0, Math.floor(cacheKeys.length * 0.75));
        await AsyncStorage.multiRemove(keysToRemove);
        keysToRemove.forEach(key => this.memoryCache.delete(key));
        // console.log(`🧹 Emergency cleanup: removed ${keysToRemove.length} cache entries`);
      }
    } catch (cleanupError) {
      // Even cleanup can fail - that's fine, we'll use memory cache
    }
  }

  // Clear specific cache entry
  async clearCache(dataType) {
    const cacheKey = this.generateCacheKey(dataType);
    // console.log(`🧹 Clearing cache for: ${dataType} (key: ${cacheKey})`);

    // Clear from memory cache
    this.memoryCache.delete(cacheKey);
    this.memoryExpiry.delete(cacheKey);

    // Clear from persistent cache
    try {
      await AsyncStorage.removeItem(`cache_${cacheKey}`);
    } catch (error) {
      console.warn(`Failed to clear persistent cache for ${dataType}:`, error);
    }
  }

  // Simplified cache cleanup - no complex logic, just remove old entries
  async clearOldCacheData() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('cache_') || key.startsWith('lightning_'));

      if (cacheKeys.length > 10) {
        // Remove oldest 50% of entries
        const keysToRemove = cacheKeys.slice(0, Math.floor(cacheKeys.length / 2));
        await AsyncStorage.multiRemove(keysToRemove);
        keysToRemove.forEach(key => this.memoryCache.delete(key));
        // console.log(`🧹 Cleaned ${keysToRemove.length} old cache entries`);
      }
    } catch (error) {
      // Silent failure - cleanup is not critical
    }
  }

  // Start real-time polling for chat rooms
  startChatRoomsPolling(dataType) {
    // Don't start multiple polling intervals
    if (this.pollingIntervals.has(dataType)) {
      return;
    }

    // console.log(`🔄 Starting real-time polling for ${dataType}...`);

    const pollInterval = setInterval(async () => {
      try {
        // console.log(`🔄 Polling ${dataType} for updates...`);
        const currentData = this.getFromMemoryCache(this.generateCacheKey(dataType));
        const freshData = await this.fetchFromAPI(dataType, { forceRefresh: true });

        if (freshData.success && freshData.data) {
          // Check if data has changed
          const hasChanged = !currentData ||
                           JSON.stringify(currentData) !== JSON.stringify(freshData.data);

          if (hasChanged) {
            // console.log(`🔄 ${dataType} data changed, updating cache and notifying listeners...`);

            // Update cache
            const cacheKey = this.generateCacheKey(dataType);
            await this.storeInAllCaches(cacheKey, dataType, freshData.data);

            // Notify all listeners
            this.notifyDataChangeListeners(dataType, freshData.data);
          } else {
            // console.log(`✅ ${dataType} data unchanged`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Polling error for ${dataType}:`, error.message);
      }
    }, 5000); // Poll every 5 seconds for real-time updates

    this.pollingIntervals.set(dataType, pollInterval);
    // console.log(`✅ Real-time polling started for ${dataType}`);
  }

  // Stop polling for a data type
  stopPolling(dataType) {
    const interval = this.pollingIntervals.get(dataType);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(dataType);
      // console.log(`🛑 Stopped polling for ${dataType}`);
    }
  }

  // Add data change listener
  addDataChangeListener(dataType, callback) {
    if (!this.dataChangeListeners.has(dataType)) {
      this.dataChangeListeners.set(dataType, new Set());
    }
    this.dataChangeListeners.get(dataType).add(callback);
    // console.log(`👂 Added listener for ${dataType} changes`);
  }

  // Remove data change listener
  removeDataChangeListener(dataType, callback) {
    const listeners = this.dataChangeListeners.get(dataType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.dataChangeListeners.delete(dataType);
        // Stop polling if no listeners
        this.stopPolling(dataType);
      }
    }
  }

  // Notify all listeners of data changes
  notifyDataChangeListeners(dataType, newData) {
    const listeners = this.dataChangeListeners.get(dataType);
    if (listeners) {
      // console.log(`📢 IMMEDIATE: Notifying ${listeners.size} listeners of ${dataType} changes`);
      listeners.forEach(callback => {
        try {
          callback(newData);
        } catch (error) {
          console.error(`❌ Listener callback error for ${dataType}:`, error);
        }
      });
    }
  }

  // IMMEDIATE: Direct chat rooms loader (bypasses all caching layers)
  async getImmediateChatRooms() {
    // console.log('⚡ IMMEDIATE: Direct chat rooms fetch...');
    try {
      const response = await ApiService.getChatRooms();
      if (response.success && response.data) {
        // console.log(`⚡ IMMEDIATE: Direct fetch got ${response.data.length} rooms`);

        // Update memory cache immediately
        const cacheKey = this.generateCacheKey('chat-rooms');
        this.setMemoryCache(cacheKey, response.data);

        // Notify listeners immediately
        this.notifyDataChangeListeners('chat-rooms', response.data);

        return {
          success: true,
          data: response.data,
          source: 'immediate-direct',
          loadTime: 0
        };
      }
      return { success: false, data: [], source: 'immediate-failed' };
    } catch (error) {
      console.error('❌ IMMEDIATE: Direct fetch failed:', error);
      return { success: false, data: [], source: 'immediate-error', error: error.message };
    }
  }

  // IMMEDIATE: Direct users loader (bypasses all caching layers)
  async getImmediateUsers() {
    // console.log('⚡ IMMEDIATE: Direct users fetch...');
    try {
      // Clear any existing cache first
      const cacheKey = this.generateCacheKey('users-complete');
      this.memoryCache.delete(cacheKey);
      // console.log('🧹 IMMEDIATE: Cleared users cache before fresh fetch');

      const response = await ApiService.getAllUsersComplete();

      // console.log('🔍 IMMEDIATE: Direct users API response:', {
        // success: response.success,
        // dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
        // totalCount: response.totalCount,
        // error: response.error || 'none'
      // });

      if (response.success && response.data) {
        // console.log(`⚡ IMMEDIATE: Direct fetch got ${response.data.length} users`);
// 
        // Update memory cache immediately
        this.setMemoryCache(cacheKey, response.data);

        // Notify listeners immediately
        this.notifyDataChangeListeners('users-complete', response.data);

        return {
          success: true,
          data: response.data,
          source: 'immediate-direct',
          loadTime: 0,
          totalCount: response.totalCount,
          hasDuplicates: response.hasDuplicates
        };
      }

      console.warn('⚠️ IMMEDIATE: Direct users fetch failed:', response.error);
      return { success: false, data: [], source: 'immediate-failed', error: response.error };
    } catch (error) {
      console.error('❌ IMMEDIATE: Direct users fetch failed:', error);
      return { success: false, data: [], source: 'immediate-error', error: error.message };
    }
  }

  // IMMEDIATE: Direct products loader (bypasses all caching layers)
  async getImmediateProducts() {
    // console.log('⚡ IMMEDIATE: Direct products fetch...');
    try {
      // Clear any existing cache first
      const cacheKey = this.generateCacheKey('products-complete');
      this.memoryCache.delete(cacheKey);
      // console.log('🧹 IMMEDIATE: Cleared products cache before fresh fetch');

      const response = await ApiService.getAllProductsComplete();

      // console.log('🔍 IMMEDIATE: Direct products API response:', {
      //   success: response.success,
      //   dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
      //   totalCount: response.totalCount,
      //   error: response.error || 'none'
      // });

      if (response.success && response.data) {
        // console.log(`⚡ IMMEDIATE: Direct fetch got ${response.data.length} products`);

        // Update memory cache immediately
        this.setMemoryCache(cacheKey, response.data);

        // Notify listeners immediately
        this.notifyDataChangeListeners('products-complete', response.data);

        return {
          success: true,
          data: response.data,
          source: 'immediate-direct',
          loadTime: 0,
          totalCount: response.totalCount,
          hasDuplicates: response.hasDuplicates
        };
      }

      console.warn('⚠️ IMMEDIATE: Direct products fetch failed:', response.error);
      return { success: false, data: [], source: 'immediate-failed', error: response.error };
    } catch (error) {
      console.error('❌ IMMEDIATE: Direct products fetch failed:', error);
      return { success: false, data: [], source: 'immediate-error', error: error.message };
    }
  }

  // IMMEDIATE: Direct categories loader (bypasses all caching layers)
  async getImmediateCategories() {
    // console.log('⚡ IMMEDIATE: Direct categories fetch...');
    try {
      // Clear any existing cache first
      const cacheKey = this.generateCacheKey('marketplace-categories');
      this.memoryCache.delete(cacheKey);
      // console.log('🧹 IMMEDIATE: Cleared categories cache before fresh fetch');

      const response = await ApiService.getMarketplaceCategories();

      // console.log('🔍 IMMEDIATE: Direct categories API response:', {
      //   success: response.success,
      //   dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
      //   source: response.source,
      //   error: response.error || 'none'
      // // });

      if (response.success && response.data) {
        // console.log(`⚡ IMMEDIATE: Direct fetch got ${response.data.length} categories`);

        // Update memory cache immediately
        this.setMemoryCache(cacheKey, response.data);

        // Notify listeners immediately
        this.notifyDataChangeListeners('marketplace-categories', response.data);

        return {
          success: true,
          data: response.data,
          source: 'immediate-direct',
          loadTime: 0
        };
      }

      console.warn('⚠️ IMMEDIATE: Direct categories fetch failed:', response.error);
      return { success: false, data: [], source: 'immediate-failed', error: response.error };
    } catch (error) {
      console.error('❌ IMMEDIATE: Direct categories fetch failed:', error);
      return { success: false, data: [], source: 'immediate-error', error: error.message };
    }
  }

  // Clear cache for specific data type
  clearCacheForType(dataType) {
    const cacheKey = this.generateCacheKey(dataType);
    this.memoryCache.delete(cacheKey);
    // console.log(`🧹 Cleared cache for ${dataType}`);
  }

  // Clear all caches
  async clearAllCaches() {
    // console.log('🧹 Clearing all caches...');

    this.memoryCache.clear();
    this.memoryExpiry.clear();

    // Clear persistent cache
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('Failed to clear persistent cache:', error);
    }
  }
}

export default new LightningDataService();
