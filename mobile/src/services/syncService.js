import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './api';

class SyncService {
  constructor() {
    this.isOnline = false;
    this.isSyncing = false;
    this.syncInterval = null;
    this.listeners = [];
    this.initializeNetworkMonitoring();
  }

  initializeNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      if (!wasOnline && this.isOnline) {
        this.triggerSync();
      }
      this.notifyListeners({ isOnline: this.isOnline });
    });
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  startAutoSync(intervalMinutes = 5) {
    this.stopAutoSync();
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.triggerSync();
      }
    }, intervalMinutes * 60 * 1000);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async triggerSync() {
    if (this.isSyncing || !this.isOnline) {
      return false;
    }

    let token;
    try {
      token = await AsyncStorage.getItem('authToken');
    } catch (err) {
      console.error('Failed to get auth token:', err);
      return false;
    }
    if (!token) {
      return false;
    }

    try {
      this.isSyncing = true;
      this.notifyListeners({ isSyncing: true });

      await this.uploadLocalChanges();

      await AsyncStorage.setItem('lastSyncTime', new Date().toISOString());
      this.notifyListeners({ syncCompleted: true, success: true });
      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      this.notifyListeners({ syncCompleted: true, success: false, error });
      return false;
    } finally {
      this.isSyncing = false;
      this.notifyListeners({ isSyncing: false });
    }
  }

  async getSyncQueue() {
    try {
      const queueJson = await AsyncStorage.getItem('sync_queue');
      return queueJson ? JSON.parse(queueJson) : [];
    } catch {
      return [];
    }
  }

  async saveSyncQueue(queue) {
    await AsyncStorage.setItem('sync_queue', JSON.stringify(queue));
  }

  async uploadLocalChanges() {
    const syncQueue = await this.getSyncQueue();
    console.log(`Found ${syncQueue.length} items to sync`);

    for (const item of syncQueue) {
      try {
        await this.processSyncItem(item);
        await this.markSyncComplete(item.id);
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        await this.markSyncFailed(item.id, error.message);
      }
    }
  }

  async processSyncItem(item) {
    const { table_name, operation, record_id, data } = item;
    const parsedData = data ? JSON.parse(data) : null;

    switch (table_name) {
      case 'users':
        await this.syncUser(operation, record_id, parsedData);
        break;
      case 'chamas':
        await this.syncChama(operation, record_id, parsedData);
        break;
      case 'transactions':
        await this.syncTransaction(operation, record_id, parsedData);
        break;
      case 'chat_messages':
        await this.syncChatMessage(operation, record_id, parsedData);
        break;
      case 'loans':
        await this.syncLoan(operation, record_id, parsedData);
        break;
      default:
        console.warn(`Unknown table for sync: ${table_name}`);
    }
  }

  async syncUser(operation, recordId, data) {
    switch (operation) {
      case 'UPDATE':
        await ApiService.updateProfile(data);
        break;
      default:
        console.warn(`Unsupported user operation: ${operation}`);
    }
  }

  async syncChama(operation, recordId, data) {
    switch (operation) {
      case 'INSERT':
        await ApiService.createChama(data);
        break;
      default:
        console.warn(`Unsupported chama operation: ${operation}`);
    }
  }

  async syncTransaction(operation, recordId, data) {
    switch (operation) {
      case 'INSERT':
        if (data.type === 'deposit') {
          await ApiService.initiateDeposit(data.amount, data.payment_method);
        } else if (data.type === 'withdrawal') {
          await ApiService.initiateWithdrawal(data.amount, data.payment_method);
        }
        break;
      default:
        console.warn(`Unsupported transaction operation: ${operation}`);
    }
  }

  async syncChatMessage(operation, recordId, data) {
    switch (operation) {
      case 'INSERT':
        await ApiService.sendMessage(data.room_id, {
          type: data.type,
          content: data.content,
          metadata: data.metadata ? JSON.parse(data.metadata) : null,
          replyToId: data.reply_to_id,
        });
        break;
      default:
        console.warn(`Unsupported chat message operation: ${operation}`);
    }
  }

  async syncLoan(operation, recordId, data) {
    switch (operation) {
      case 'INSERT':
        await ApiService.applyForLoan(data);
        break;
      default:
        console.warn(`Unsupported loan operation: ${operation}`);
    }
  }

  async markSyncComplete(itemId) {
    const queue = await this.getSyncQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    await this.saveSyncQueue(filtered);
  }

  async markSyncFailed(itemId, errorMessage) {
    const queue = await this.getSyncQueue();
    const item = queue.find(i => i.id === itemId);
    if (item) {
      item.attempts = (item.attempts || 0) + 1;
      item.error_message = errorMessage;
      if (item.attempts < 3) {
        await this.saveSyncQueue(queue);
      }
    }
  }

  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      autoSyncEnabled: this.syncInterval !== null,
    };
  }
}

export default new SyncService();