import ApiService from '../api';
import cacheManager from './cacheManager';

class DataFetcher {
  constructor() {
    this.errorCounts = new Map();
    this.lastErrorTime = new Map();
    this.performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
    };
  }

  async getData(dataType, options = {}) {
    const startTime = Date.now();
    const cacheKey = cacheManager.generateCacheKey(dataType, options);

    try {
      if (options.forceRefresh) {
        const apiData = await this.fetchFromAPI(dataType, { ...options, immediate: true });
        if (apiData.success && apiData.data) {
          await this.storeInAllCaches(cacheKey, dataType, apiData.data);
          return {
            success: true,
            data: apiData.data,
            source: 'force-refresh-api',
            loadTime: Date.now() - startTime
          };
        }
        return { success: false, error: apiData.error || 'Force refresh failed', loadTime: Date.now() - startTime };
      }

      if (this.shouldSkipAPICall(dataType)) {
        return { success: false, error: 'Skipped due to recent errors (backoff active)' };
      }

      const memoryData = cacheManager.getFromMemoryCache(cacheKey);
      if (memoryData) {
        this.performanceMetrics.cacheHits++;
        return { success: true, data: memoryData, source: 'memory', loadTime: Date.now() - startTime };
      }

      const persistentData = await cacheManager.getFromPersistentCache(cacheKey);
      if (persistentData) {
        cacheManager.setMemoryCache(cacheKey, persistentData);
        this.performanceMetrics.cacheHits++;
        return { success: true, data: persistentData, source: 'persistent', loadTime: Date.now() - startTime };
      }

      this.performanceMetrics.cacheMisses++;
      this.performanceMetrics.apiCalls++;
      
      const apiData = await this.fetchFromAPI(dataType, options);
      if (apiData.success) {
        await this.storeInAllCaches(cacheKey, dataType, apiData.data);
        return { success: true, data: apiData.data, source: 'api', loadTime: Date.now() - startTime };
      }

      return { success: false, error: 'Data not available', loadTime: Date.now() - startTime };

    } catch (error) {
      return { success: false, error: error.message, loadTime: Date.now() - startTime };
    }
  }

  async fetchFromAPI(dataType, options = {}) {
    if (!options.forceRefresh && this.shouldSkipAPICall(dataType)) {
      return { success: false, error: 'Skipped due to recent errors (backoff active)' };
    }

    try {
      const timeoutDuration = dataType === 'users-complete' ? 30000 : 15000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`API timeout for ${dataType}`)), timeoutDuration);
      });

      const apiPromise = this.executeApiCall(dataType, options);
      const result = await Promise.race([apiPromise, timeoutPromise]);

      this.resetAPIErrors(dataType);
      return result;

    } catch (error) {
      this.recordAPIError(dataType);
      return { success: false, error: error.message };
    }
  }

  async executeApiCall(dataType, options) {
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
        return await ApiService.getNotifications(100, 0);
      case 'unread-count':
        return await ApiService.getUnreadNotificationCount();
      case 'products':
        return await ApiService.getProducts({}, 100, 0);
      case 'cart':
        return await ApiService.getCart();
      case 'orders':
        return await ApiService.getOrders({ limit: 50 });
      case 'chat-rooms':
        return await ApiService.getChatRooms();
      case 'users-complete':
        return await ApiService.getAllUsersComplete();
      case 'system-analytics':
        return await ApiService.getSystemAnalytics('7d');
      case 'products-complete':
        return await ApiService.getAllProductsComplete();
      case 'marketplace-categories':
        return await ApiService.getMarketplaceCategories();
      case 'marketplace-analytics':
        return await ApiService.getMarketplaceAnalytics('7d');
      case 'meetings':
        return await ApiService.getUserMeetings(50, 0);
      case 'chama-members':
        if (!options.chamaId) return { success: false, error: 'chamaId is required', data: [] };
        return await ApiService.getChamaMembers(options.chamaId);
      case 'chama-transactions':
        if (!options.chamaId) return { success: false, error: 'chamaId is required', data: [] };
        return await ApiService.getChamaTransactions(options.chamaId, 50, 0);
      case 'support-requests':
        return await ApiService.getSupportRequests({ limit: 50 });
      case 'wishlist':
        return await ApiService.getWishlist();
      default:
        return { success: false, error: `Unknown data type: ${dataType}` };
    }
  }

  async getFromDatabaseCache(dataType, options = {}) {
    return null;
  }

  async storeInAllCaches(cacheKey, dataType, data) {
    cacheManager.setMemoryCache(cacheKey, data);
    await cacheManager.setPersistentCache(cacheKey, data);
  }

  shouldSkipAPICall(dataType) {
    const errorCount = this.errorCounts.get(dataType) || 0;
    const lastErrorTime = this.lastErrorTime.get(dataType) || 0;
    const now = Date.now();
    const backoffDelays = [60000, 300000, 900000, 1800000];
    const backoffDelay = backoffDelays[Math.min(errorCount - 1, backoffDelays.length - 1)] || 0;
    if (errorCount > 0 && (now - lastErrorTime) < backoffDelay) {
      return true;
    }
    return false;
  }

  recordAPIError(dataType) {
    const currentCount = this.errorCounts.get(dataType) || 0;
    this.errorCounts.set(dataType, currentCount + 1);
    this.lastErrorTime.set(dataType, Date.now());
  }

  resetAPIErrors(dataType) {
    if (this.errorCounts.has(dataType)) {
      this.errorCounts.delete(dataType);
      this.lastErrorTime.delete(dataType);
    }
  }

  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cacheHitRate: this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100,
    };
  }
}

export default new DataFetcher();