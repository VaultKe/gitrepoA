import dataFetcher from './dataFetcher';
import cacheManager from './cacheManager';

class OptimisticUpdateHandler {
  constructor() {
    this.optimisticQueue = new Map();
    this.rollbackQueue = new Map();
    this.performanceMetrics = {
      optimisticUpdates: 0,
      rollbacks: 0,
    };
  }

  async optimisticUpdate(dataType, updateData, apiCall) {
    const updateId = `${dataType}_${Date.now()}_${Math.random()}`;

    try {
      const originalData = await dataFetcher.getData(dataType);
      this.rollbackQueue.set(updateId, originalData.data);

      const optimisticData = this.applyOptimisticUpdate(originalData.data, updateData);
      const cacheKey = cacheManager.generateCacheKey(dataType);
      cacheManager.setMemoryCache(cacheKey, optimisticData);

      this.optimisticQueue.set(updateId, { dataType, updateData, timestamp: Date.now() });
      this.performanceMetrics.optimisticUpdates++;

      try {
        const apiResult = await apiCall();

        if (apiResult.success) {
          if (updateData.action === 'remove' && dataType === 'notifications') {
            await this.handlePostDeleteCacheInvalidation();
          }
          if (apiResult.data) {
            await this.updateAllCaches(dataType, apiResult.data);
          }
        } else {
          await this.rollbackOptimisticUpdate(updateId, dataType);
        }

        this.optimisticQueue.delete(updateId);
        this.rollbackQueue.delete(updateId);

        return apiResult;

      } catch (apiError) {
        await this.rollbackOptimisticUpdate(updateId, dataType);
        throw apiError;
      }

    } catch (error) {
      throw error;
    }
  }

  async rollbackOptimisticUpdate(updateId, dataType) {
    const originalData = this.rollbackQueue.get(updateId);
    if (originalData) {
      await this.updateAllCaches(dataType, originalData);
      this.performanceMetrics.rollbacks++;
    }
    this.optimisticQueue.delete(updateId);
    this.rollbackQueue.delete(updateId);
  }

  applyOptimisticUpdate(originalData, updateData) {
    if (Array.isArray(originalData)) {
      if (updateData.action === 'add') {
        return [updateData.data, ...originalData];
      } else if (updateData.action === 'update') {
        return originalData.map(item =>
          item.id === updateData.data.id ? { ...item, ...updateData.data } : item
        );
      } else if (updateData.action === 'bulk_update') {
        return originalData.map(item => ({
          ...item,
          ...updateData.update
        }));
      } else if (updateData.action === 'remove') {
        return originalData.filter(item => item.id !== updateData.id);
      }
    } else if (typeof originalData === 'object') {
      return { ...originalData, ...updateData };
    }
    return updateData;
  }

  async updateAllCaches(dataType, data) {
    const cacheKey = cacheManager.generateCacheKey(dataType);
    cacheManager.setMemoryCache(cacheKey, data);
    await cacheManager.setPersistentCache(cacheKey, data);
  }

  async handlePostDeleteCacheInvalidation() {
    await this.invalidateCache('notifications');
    await this.invalidateCache('unread-count');
    
    setTimeout(async () => {
      try {
        await dataFetcher.getData('notifications', { forceRefresh: true });
        await dataFetcher.getData('unread-count', { forceRefresh: true });
      } catch (error) {
      }
    }, 100);
  }

  async invalidateCache(dataType) {
    const keysToDelete = [];
    const baseKey = cacheManager.generateCacheKey(dataType);
    
    for (const [key] of cacheManager.memoryCache) {
      if (key.startsWith(baseKey)) {
        keysToDelete.push(key);
      }
    }

    for (const cacheKey of keysToDelete) {
      cacheManager.memoryCache.delete(cacheKey);
      cacheManager.memoryExpiry.delete(cacheKey);
      try {
        await cacheManager.clearCache(dataType);
      } catch (error) {
      }
    }
  }

  getPerformanceMetrics() {
    return this.performanceMetrics;
  }
}

export default new OptimisticUpdateHandler();