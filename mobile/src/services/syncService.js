class SyncService {
  constructor() {
    this.listeners = [];
  }

  addListener(listener) {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(syncData) {
    this.listeners.forEach(listener => {
      try {
        listener(syncData);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  async triggerSync() {
    const response = await fetch('/api/sync/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to trigger sync: ${response.statusText}`);
    }

    const result = await response.json();
    // Notify listeners of sync status change
    this.notifyListeners({ isSyncing: true });
    return result;
  }

  async getSyncStatus() {
    const response = await fetch('/api/sync/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get sync status: ${response.statusText}`);
    }

    const result = await response.json();
    // Notify listeners of sync status change
    this.notifyListeners({
      isOnline: result.isOnline !== undefined ? result.isOnline : null,
      isSyncing: result.isSyncing !== undefined ? result.isSyncing : null
    });
    return result;
  }

  async startAutoSync(intervalMinutes = 5) {
    const response = await fetch(`/api/sync/start-auto-sync?intervalMinutes=${intervalMinutes}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to start auto sync: ${response.statusText}`);
    }

    const result = await response.json();
    // Notify listeners of sync status change
    this.notifyListeners({ isSyncing: true });
    return result;
  }

  async stopAutoSync() {
    const response = await fetch('/api/sync/stop-auto-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to stop auto sync: ${response.statusText}`);
    }

    const result = await response.json();
    // Notify listeners of sync status change
    this.notifyListeners({ isSyncing: false });
    return result;
  }

  async getSyncQueue() {
    const response = await fetch('/api/sync/queue', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get sync queue: ${response.statusText}`);
    }

    return response.json();
  }
}

export default new SyncService();