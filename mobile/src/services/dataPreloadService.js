class DataPreloadService {
  async preloadAllData(userId, forceRefresh = false) {
    const response = await fetch(`/api/data-preload/preload-all?userId=${userId}&forceRefresh=${forceRefresh}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to preload data: ${response.statusText}`);
    }

    return response.json();
  }

  async getCachedData(dataType) {
    const response = await fetch(`/api/data-preload/cached/${dataType}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get cached data: ${response.statusText}`);
    }

    return response.json();
  }

  async clearCache() {
    const response = await fetch('/api/data-preload/clear-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to clear cache: ${response.statusText}`);
    }

    return response.json();
  }

  getPreloadStatus() {
    // This could be implemented as a backend call if needed
    return {
      isPreloading: false,
      lastPreloadTime: 0,
      cacheSize: 0,
      nextPreloadDue: 0,
    };
  }
}

export default new DataPreloadService();