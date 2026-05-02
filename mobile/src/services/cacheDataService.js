import cacheManagerService from './data/cacheManagerService';
import cacheManager from './data/cacheManager';
import dataPreloadService from './dataPreloadService';

class CacheDataService {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = 30 * 1000;
  }

  async getData(dataType, options = {}) {
    return cacheManagerService.getData(dataType, options);
  }

  async optimisticUpdate(dataType, updateData, apiCall) {
    return cacheManagerService.optimisticUpdate(dataType, updateData, apiCall);
  }

  async prefetchForPage(pageName, priority = 'normal') {
    return cacheManagerService.prefetchForPage(pageName, priority);
  }

  async invalidateCache(dataType) {
    return cacheManagerService.clearCache(dataType);
  }

  async updateAllCaches(dataType, data) {
    const cacheKey = cacheManager.generateCacheKey(dataType);
    cacheManager.setMemoryCache(cacheKey, data);
    await cacheManager.setPersistentCache(cacheKey, data);
  }

  async getPreloadedMessages(roomId) {
    const cacheKey = `chat-messages-${roomId}`;
    const memoryData = cacheManager.getFromMemoryCache(cacheKey);
    if (memoryData && Array.isArray(memoryData) && memoryData.length > 0) {
      return { success: true, data: memoryData, source: 'preloaded-memory' };
    }
    return { success: false, data: [] };
  }

  registerRealtimeHandler(dataType, handler) {
    cacheManagerService.registerRealtimeHandler(dataType, handler);
  }

  addDataChangeListener(dataType, callback) {
    cacheManagerService.addDataChangeListener(dataType, callback);
  }

  removeDataChangeListener(dataType, callback) {
    cacheManagerService.removeDataChangeListener(dataType, callback);
  }

  getPerformanceMetrics() {
    return cacheManagerService.getPerformanceMetrics();
  }

  async getImmediateChatRooms() {
    const ApiService = (await import('./api')).default;
    
    try {
      const response = await ApiService.getChatRooms();
      if (response.success && response.data) {
        const cacheKey = cacheManager.generateCacheKey('chat-rooms');
        cacheManager.setMemoryCache(cacheKey, response.data);
        cacheManagerService.addDataChangeListener('chat-rooms', (data) => {});
        return { success: true, data: response.data, source: 'immediate-direct' };
      }
      return { success: false, data: [], source: 'immediate-failed' };
    } catch (error) {
      return { success: false, data: [], source: 'immediate-error' };
    }
  }

  async getImmediateUsers() {
    const ApiService = (await import('./api')).default;
    
    try {
      const cacheKey = cacheManager.generateCacheKey('users-complete');
      cacheManager.memoryCache.delete(cacheKey);
      
      const response = await ApiService.getAllUsersComplete();
      if (response.success && response.data) {
        cacheManager.setMemoryCache(cacheKey, response.data);
        return { success: true, data: response.data, source: 'immediate-direct', totalCount: response.totalCount };
      }
      return { success: false, data: [], source: 'immediate-failed' };
    } catch (error) {
      return { success: false, data: [], source: 'immediate-error' };
    }
  }

  async getImmediateProducts() {
    const ApiService = (await import('./api')).default;
    
    try {
      const cacheKey = cacheManager.generateCacheKey('products-complete');
      cacheManager.memoryCache.delete(cacheKey);
      
      const response = await ApiService.getAllProductsComplete();
      if (response.success && response.data) {
        cacheManager.setMemoryCache(cacheKey, response.data);
        return { success: true, data: response.data, source: 'immediate-direct', totalCount: response.totalCount };
      }
      return { success: false, data: [], source: 'immediate-failed' };
    } catch (error) {
      return { success: false, data: [], source: 'immediate-error' };
    }
  }

  async getImmediateCategories() {
    const ApiService = (await import('./api')).default;
    
    try {
      const cacheKey = cacheManager.generateCacheKey('marketplace-categories');
      cacheManager.memoryCache.delete(cacheKey);
      
      const response = await ApiService.getMarketplaceCategories();
      if (response.success && response.data) {
        cacheManager.setMemoryCache(cacheKey, response.data);
        return { success: true, data: response.data, source: 'immediate-direct' };
      }
      return { success: false, data: [], source: 'immediate-failed' };
    } catch (error) {
      return { success: false, data: [], source: 'immediate-error' };
    }
  }

  clearCacheForType(dataType) {
    const cacheKey = cacheManager.generateCacheKey(dataType);
    cacheManager.memoryCache.delete(cacheKey);
    cacheManager.memoryExpiry.delete(cacheKey);
  }

  async clearAllCaches() {
    await cacheManagerService.clearAllCaches();
  }

  async preloadAllData(userId, forceRefresh = false) {
    return await dataPreloadService.preloadAllData(userId, forceRefresh);
  }

  get dataDependencies() {
    return cacheManagerService.getDataDependencies();
  }

  resetAPIErrors(dataType) {
    return cacheManagerService.resetAPIErrors(dataType);
  }
}

export default new CacheDataService();