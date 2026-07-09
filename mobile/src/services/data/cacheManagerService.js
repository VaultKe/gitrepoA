import cacheManager from './cacheManager';
import dataFetcher from './dataFetcher';
import optimisticUpdateHandler from './optimisticUpdateHandler';
import realtimeUpdateHandler from './realtimeUpdateHandler';

const DATA_DEPENDENCIES = {
  'user-dashboard': ['profile', 'wallet', 'chamas', 'transactions', 'notifications'],
  'chama-dashboard': ['chamas', 'meetings'],
  'marketplace': ['products-complete', 'marketplace-categories', 'cart', 'orders', 'wishlist'],
  'chat': ['chat-rooms', 'chat-messages-preload'],
  'admin': ['users-complete', 'all-chamas', 'system-analytics', 'learning-analytics', 'marketplace-analytics', 'support-requests'],
  'wallet': ['wallet', 'transactions', 'recent-contacts'],
  'notifications': ['notifications', 'unread-count'],
};

class CacheManagerService {
  constructor() {
    this.isPreloading = false;
    this.preloadProgress = 0;
    this.preloadCallbacks = [];
    this.criticalDataLoaded = false;
    this.lastSyncTime = 0;
    
    this.initializeService();
  }

  async initializeService() {
    await this.loadPersistentCache();
    realtimeUpdateHandler.setupRealtimeUpdates();
  }

  async loadPersistentCache() {
  }

  async getData(dataType, options = {}) {
    return dataFetcher.getData(dataType, options);
  }

  async optimisticUpdate(dataType, updateData, apiCall) {
    return optimisticUpdateHandler.optimisticUpdate(dataType, updateData, apiCall);
  }

  async prefetchForPage(pageName, priority = 'normal') {
    const dependencies = DATA_DEPENDENCIES[pageName] || [];
    
    if (dependencies.length === 0) {
      return;
    }

    const prefetchPromises = dependencies.map(async (dataType) => {
      try {
        const cached = await this.getData(dataType, { skipAPI: true });
        if (cached.success && cached.source !== 'api') {
          return;
        }
        await this.getData(dataType);
      } catch (error) {
      }
    });

    if (priority === 'high') {
      await Promise.all(prefetchPromises);
    } else {
      Promise.all(prefetchPromises).catch(() => {});
    }
  }

  clearCache(dataType) {
    return cacheManager.clearCache(dataType);
  }

  async clearAllCaches() {
    return cacheManager.clearAllCaches();
  }

  getPerformanceMetrics() {
    return {
      ...dataFetcher.getPerformanceMetrics(),
      ...optimisticUpdateHandler.getPerformanceMetrics(),
      lastSyncTime: this.lastSyncTime,
    };
  }

  registerRealtimeHandler(dataType, handler) {
    realtimeUpdateHandler.registerRealtimeHandler(dataType, handler);
  }

  addDataChangeListener(dataType, callback) {
    realtimeUpdateHandler.addDataChangeListener(dataType, callback);
  }

  removeDataChangeListener(dataType, callback) {
    realtimeUpdateHandler.removeDataChangeListener(dataType, callback);
  }

  getDataDependencies() {
    return DATA_DEPENDENCIES;
  }
}

export default new CacheManagerService();