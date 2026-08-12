import cacheManager from './cacheManager';
import dataFetcher from './dataFetcher';

class RealtimeUpdateHandler {
  constructor() {
    this.realtimeHandlers = new Map();
    this.pollingIntervals = new Map();
    this.dataChangeListeners = new Map();
  }

  setupRealtimeUpdates() {
    const dataTypes = ['notifications', 'wallet', 'chamas', 'transactions', 'products', 'orders', 'messages'];

    dataTypes.forEach(dataType => {
      this.startPolling(dataType);
    });
  }

  startPolling(dataType) {
    if (this.pollingIntervals.has(dataType)) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const currentData = cacheManager.getFromMemoryCache(cacheManager.generateCacheKey(dataType));
        const freshData = await dataFetcher.fetchFromAPI(dataType, { forceRefresh: true });

        if (freshData.success && freshData.data) {
          const hasChanged = !currentData ||
            JSON.stringify(currentData) !== JSON.stringify(freshData.data);

          if (hasChanged) {
            const cacheKey = cacheManager.generateCacheKey(dataType);
            cacheManager.setMemoryCache(cacheKey, freshData.data);
            await cacheManager.setPersistentCache(cacheKey, freshData.data);
            this.notifyDataChangeListeners(dataType, freshData.data);
          }
        }
      } catch (error) {
        // Silently ignore polling errors
      }
    }, 15000);

    this.pollingIntervals.set(dataType, pollInterval);
  }

  stopPolling(dataType) {
    const interval = this.pollingIntervals.get(dataType);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(dataType);
    }
  }

  registerRealtimeHandler(dataType, handler) {
    this.realtimeHandlers.set(dataType, handler);
  }

  addDataChangeListener(dataType, callback) {
    if (!this.dataChangeListeners.has(dataType)) {
      this.dataChangeListeners.set(dataType, new Set());
    }
    this.dataChangeListeners.get(dataType).add(callback);
    this.startPolling(dataType);
  }

  removeDataChangeListener(dataType, callback) {
    const listeners = this.dataChangeListeners.get(dataType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.dataChangeListeners.delete(dataType);
        this.stopPolling(dataType);
      }
    }
  }

  notifyDataChangeListeners(dataType, newData) {
    const listeners = this.dataChangeListeners.get(dataType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(newData);
        } catch (error) {
          // Ignore listener errors
        }
      });
    }
  }
}

export default new RealtimeUpdateHandler();
