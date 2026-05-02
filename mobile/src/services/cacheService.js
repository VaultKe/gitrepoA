import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache Service
 * Handles multi-tier caching system (memory, persistent, database)
 */
class CacheService {
  constructor() {
    // Multi-tier cache system
    this.memoryCache = new Map(); // L1: Instant access
    this.memoryExpiry = new Map();
    this.persistentCache = new Map(); // L2: AsyncStorage cache
    this.databaseCache = new Map(); // L3: SQLite cache
    
    // Cache configuration
    this.cacheConfig = {
      memory: { ttl: 5 * 60 * 1000 }, // 5 minutes
      persistent: { ttl: 20 * 60 * 1000 }, // 20 minutes
      database: { ttl: 2 * 60 * 60 * 1000 }, // 2 hours
    };
  }

  /**
   * Generate cache key based on data type and options
   */
  generateCacheKey(dataType, options = {}) {
    const optionsStr = Object.keys(options).length > 0 ? JSON.stringify(options) : '';
    return `${dataType}${optionsStr}`;
  }

  /**
   * Memory cache operations
   */
  getFromMemoryCache(cacheKey) {
    const expiry = this.memoryExpiry.get(cacheKey);
    if (expiry && Date.now() > expiry) {
      this.memoryCache.delete(cacheKey);
      this.memoryExpiry.delete(cacheKey);
      return null;
    }
    return this.memoryCache.get(cacheKey);
  }

  setMemoryCache(cacheKey, data, ttlOverride = null) {
    const ttl = ttlOverride || this.cacheConfig.memory.ttl;
    this.memoryCache.set(cacheKey, data);
    this.memoryExpiry.set(cacheKey, Date.now() + ttl);
  }

  /**
   * Persistent cache operations (AsyncStorage)
   */
  async getFromPersistentCache(cacheKey) {
    try {
      const cached = await AsyncStorage.getItem(`cache_${cacheKey}`);
      if (cached) {
        const { data, expiry } = JSON.parse(cached);
        if (Date.now() < expiry) {
          return data;
        } else {
          await AsyncStorage.removeItem(`cache_${cacheKey}`);
        }
      }
    } catch (error) {
      // Silent failure for cache reads
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
        await this.clearOldPersistentCache();
        try {
          await AsyncStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
            data,
            expiry: Date.now() + this.cacheConfig.persistent.ttl,
          }));
        } catch (retryError) {
          // Give up silently - memory cache is sufficient
        }
      }
      // Silent failure for cache writes
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
      }
    } catch (error) {
      // Silent failure
    }
  }

  /**
   * Check if error is storage quota related
   */
  isQuotaError(error) {
    const msg = (error.message || '').toLowerCase();
    return msg.includes('quota') || msg.includes('exceeded') || msg.includes('storage');
  }

  /**
   * Cache clearing operations
   */
  async clearCache(dataType) {
    const cacheKey = this.generateCacheKey(dataType);
    
    // Clear from memory cache
    this.memoryCache.delete(cacheKey);
    this.memoryExpiry.delete(cacheKey);
    
    // Clear from persistent cache
    try {
      await AsyncStorage.removeItem(`cache_${cacheKey}`);
    } catch (error) {
      // Silent failure
    }
  }

  async invalidateCache(dataType) {
    try {
      // Find ALL cache keys that start with this dataType
      const keysToDelete = [];

      // L1 Cache (Memory) - find all matching keys
      for (const [key] of this.memoryCache) {
        if (key.startsWith(dataType)) {
          keysToDelete.push(key);
        }
      }

      // Clear from all cache levels for each key
      for (const cacheKey of keysToDelete) {
        // L1 Cache (Memory)
        this.memoryCache.delete(cacheKey);
        this.memoryExpiry.delete(cacheKey);

        // L2 Cache (AsyncStorage)
        await AsyncStorage.removeItem(`cache_${cacheKey}`);
        this.persistentCache.delete(cacheKey);
      }

      // Also clear the base key without options
      const baseCacheKey = this.generateCacheKey(dataType);
      if (!keysToDelete.includes(baseCacheKey)) {
        this.memoryCache.delete(baseCacheKey);
        this.memoryExpiry.delete(baseCacheKey);
        await AsyncStorage.removeItem(`cache_${baseCacheKey}`);
        this.persistentCache.delete(baseCacheKey);
      }
    } catch (error) {
      // Silent failure
    }
  }

  async clearAllCaches() {
    // Clear memory cache
    this.memoryCache.clear();
    this.memoryExpiry.clear();
    
    // Clear persistent cache
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      // Silent failure
    }
  }
}

export default new CacheService();