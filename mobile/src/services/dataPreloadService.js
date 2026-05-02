import ApiService from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

class DataPreloadService {
  constructor() {
    this.isPreloading = false;
    this.preloadPromise = null;
    this.lastPreloadTime = 0;
    this.preloadInterval = 5 * 60 * 1000;
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultCacheTime = 2 * 60 * 1000;
  }

  async preloadAllData(userId, forceRefresh = false) {
    if (this.isPreloading && !forceRefresh) {
      return this.preloadPromise;
    }

    const now = Date.now();
    if (!forceRefresh && (now - this.lastPreloadTime) < this.preloadInterval) {
      return { success: true, cached: true };
    }

    this.isPreloading = true;
    console.log('🚀 Starting comprehensive data preload for user:', userId);

    this.preloadPromise = this._executePreload(userId);
    
    try {
      const result = await this.preloadPromise;
      this.lastPreloadTime = now;
      return result;
    } finally {
      this.isPreloading = false;
      this.preloadPromise = null;
    }
  }

  async _executePreload(userId) {
    try {
      const startTime = Date.now();

      const preloadResult = await ApiService.preloadAllUserData();
      
      if (!preloadResult.success) {
        return preloadResult;
      }

      const { data: apiData, meta } = preloadResult;

      await Promise.all([
        this._storeInCache(apiData),
        this._storeInAsyncStorage(apiData),
      ]);

      const endTime = Date.now();

      return {
        success: true,
        data: apiData,
        meta: {
          ...meta,
          totalTime: endTime - startTime,
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  async _storeInCache(apiData) {
    try {
      const now = Date.now();

      Object.entries(apiData).forEach(([key, value]) => {
        if (value?.success && value.data) {
          this.cache.set(key, value.data);
          this.cacheExpiry.set(key, now + this.defaultCacheTime);
        }
      });
    } catch (error) {
      console.error('Memory cache storage failed:', error);
    }
  }

  async _storeInAsyncStorage(apiData) {
    try {
      const storagePromises = [];

      if (apiData.unreadCount?.success) {
        storagePromises.push(
          AsyncStorage.setItem('unreadNotificationCount', 
            JSON.stringify(apiData.unreadCount.data))
        );
      }

      if (apiData.profile?.success) {
        storagePromises.push(
          AsyncStorage.setItem('cachedUserProfile', 
            JSON.stringify(apiData.profile.data))
        );
      }

      if (apiData.wallet?.success) {
        storagePromises.push(
          AsyncStorage.setItem('cachedWalletBalance', 
            JSON.stringify(apiData.wallet.data))
        );
      }

      await Promise.all(storagePromises);
    } catch (error) {
      console.error('AsyncStorage storage failed:', error);
    }
  }

  async getCachedData(dataType, fallbackToDatabase = true) {
    if (this.cache.has(dataType)) {
      const expiry = this.cacheExpiry.get(dataType);
      if (Date.now() < expiry) {
        return this.cache.get(dataType);
      } else {
        this.cache.delete(dataType);
        this.cacheExpiry.delete(dataType);
      }
    }

    return null;
  }

  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
    this.lastPreloadTime = 0;
  }

  getPreloadStatus() {
    return {
      isPreloading: this.isPreloading,
      lastPreloadTime: this.lastPreloadTime,
      cacheSize: this.cache.size,
      nextPreloadDue: this.lastPreloadTime + this.preloadInterval,
    };
  }
}

export default new DataPreloadService();
