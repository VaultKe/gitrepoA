import AsyncStorage from '@react-native-async-storage/async-storage';

class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.memoryExpiry = new Map();
    
    this.cacheConfig = {
      memory: { ttl: 5 * 60 * 1000 },
      persistent: { ttl: 20 * 60 * 1000 },
    };
  }

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
        }
        await AsyncStorage.removeItem(`cache_${cacheKey}`);
      }
    } catch (error) {
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
      if (this.isQuotaError(error)) {
        await this.performEmergencyCleanup();
        try {
          await AsyncStorage.setItem(`cache_${cacheKey}`, JSON.stringify(cacheData));
        } catch (retryError) {
        }
      }
    }
  }

  isQuotaError(error) {
    const msg = (error.message || '').toLowerCase();
    return msg.includes('quota') || msg.includes('exceeded') || msg.includes('storage');
  }

  async performEmergencyCleanup() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('cache_') || key.startsWith('lightning_'));
      if (cacheKeys.length > 0) {
        const keysToRemove = cacheKeys.slice(0, Math.floor(cacheKeys.length * 0.75));
        await AsyncStorage.multiRemove(keysToRemove);
        keysToRemove.forEach(key => this.memoryCache.delete(key));
      }
    } catch (cleanupError) {
    }
  }

  async clearCache(dataType) {
    const cacheKey = this.generateCacheKey(dataType);
    this.memoryCache.delete(cacheKey);
    this.memoryExpiry.delete(cacheKey);
    try {
      await AsyncStorage.removeItem(`cache_${cacheKey}`);
    } catch (error) {
    }
  }

  async clearAllCaches() {
    this.memoryCache.clear();
    this.memoryExpiry.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
    }
  }

  async clearOldCacheData() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('cache_') || key.startsWith('lightning_'));
      if (cacheKeys.length > 10) {
        const keysToRemove = cacheKeys.slice(0, Math.floor(cacheKeys.length / 2));
        await AsyncStorage.multiRemove(keysToRemove);
        keysToRemove.forEach(key => this.memoryCache.delete(key));
      }
    } catch (error) {
    }
  }
}

export default new CacheManager();