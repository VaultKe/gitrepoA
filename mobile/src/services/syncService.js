import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from './database';
import ApiService from './api';

class SyncService {
  constructor() {
    this.isOnline = false;
    this.isSyncing = false;
    this.syncInterval = null;
    this.listeners = [];

    // Initialize network monitoring
    this.initializeNetworkMonitoring();
  }

  initializeNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;

      // If we just came online, trigger sync
      if (!wasOnline && this.isOnline) {
        this.triggerSync();
      }

      // Notify listeners
      this.notifyListeners({ isOnline: this.isOnline });
    });
  }

  // Add listener for sync events
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

  // Start automatic sync
  startAutoSync(intervalMinutes = 5) {
    this.stopAutoSync();

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.triggerSync();
      }
    }, intervalMinutes * 60 * 1000);
  }

  // Stop automatic sync
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Trigger manual sync
  async triggerSync() {
    if (this.isSyncing || !this.isOnline) {
      return false;
    }

    // Check if user is authenticated before syncing
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.log('No auth token found, skipping sync');
      return false;
    }

    try {
      this.isSyncing = true;
      this.notifyListeners({ isSyncing: true });

      // Sync in order: upload local changes, then download remote changes
      await this.uploadLocalChanges();
      await this.downloadRemoteData();

      // Update last sync time
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

  // Upload local changes to server
  async uploadLocalChanges() {
    const syncQueue = await DatabaseService.getSyncQueue();
    console.log(`Found ${syncQueue.length} items to sync`);

    for (const item of syncQueue) {
      try {
        await this.processSyncItem(item);
        await DatabaseService.markSyncComplete(item.id);
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        await DatabaseService.markSyncFailed(item.id, error.message);
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

  // Sync specific entity types
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
      case 'UPDATE':
        // Chama updates would need specific endpoint
        console.warn('Chama update sync not implemented');
        break;
      default:
        console.warn(`Unsupported chama operation: ${operation}`);
    }
  }

  async syncTransaction(operation, recordId, data) {
    switch (operation) {
      case 'INSERT':
        // Handle different transaction types
        if (data.type === 'deposit') {
          await ApiService.initiateDeposit(data.amount, data.payment_method);
        } else if (data.type === 'withdrawal') {
          await ApiService.initiateWithdrawal(data.amount, data.payment_method);
        } else if (data.type === 'transfer') {
          await ApiService.transferMoney(data.to_wallet_id, data.amount, data.description);
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

  // Download remote data
  async downloadRemoteData() {
    try {
      // Get last sync time
      const lastSyncTime = await AsyncStorage.getItem('lastSyncTime');
      const since = lastSyncTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Last 7 days

      // Download user profile
      await this.downloadUserProfile();

      // Download chamas
      await this.downloadChamas();

      // Download wallet data
      await this.downloadWalletData();

      // Download notifications
      await this.downloadNotifications();

      // Download chat rooms and recent messages
      await this.downloadChatData();
    } catch (error) {
      console.error('Failed to download remote data:', error);
      throw error;
    }
  }

  async downloadUserProfile() {
    try {
      const response = await ApiService.getProfile();
      if (response.success && response.data?.user) {
        const user = response.data.user;
        user.synced = true;

        // Check if user exists locally
        const existingUser = await DatabaseService.findById('users', user.id);
        if (existingUser) {
          await DatabaseService.update('users', user.id, user);
        } else {
          await DatabaseService.insert('users', user);
        }
      }
    } catch (error) {
      // Don't log authentication errors as they're expected when not logged in
      if (error.message && error.message.includes('Invalid token')) {
      } else {
        console.error('Failed to download user profile:', error);
      }
    }
  }

  async downloadChamas() {
    try {
      const response = await ApiService.getChamas(50, 0);
      if (response.success && response.data) {
        for (const chama of response.data) {
          chama.synced = true;

          const existingChama = await DatabaseService.findById('chamas', chama.id);
          if (existingChama) {
            await DatabaseService.update('chamas', chama.id, chama);
          } else {
            await DatabaseService.insert('chamas', chama);
          }
        }
      }
    } catch (error) {
      if (error.message && error.message.includes('Invalid token')) {
      } else {
      }
    }
  }

  async downloadWalletData() {
    try {
      // Download wallet balance
      const balanceResponse = await ApiService.getWalletBalance();
      if (balanceResponse.success && balanceResponse.data) {
        // Update local wallet data
        // This would need to be implemented based on wallet structure
      }

      // Download recent transactions
      const transactionsResponse = await ApiService.getTransactions(50, 0);
      if (transactionsResponse.success && transactionsResponse.data) {
        for (const transaction of transactionsResponse.data) {
          transaction.synced = true;

          const existingTransaction = await DatabaseService.findById('transactions', transaction.id);
          if (existingTransaction) {
            await DatabaseService.update('transactions', transaction.id, transaction);
          } else {
            await DatabaseService.insert('transactions', transaction);
          }
        }
      }
    } catch (error) {
      if (error.message && error.message.includes('Invalid token')) {
        console.log('User not authenticated, skipping wallet data download');
      } else {
        console.error('Failed to download wallet data:', error);
      }
    }
  }

  async downloadNotifications() {
    try {
      const response = await ApiService.getNotifications(50, 0);
      if (response.success && response.data) {
        for (const notification of response.data) {
          notification.synced = true;

          const existingNotification = await DatabaseService.findById('notifications', notification.id);
          if (existingNotification) {
            await DatabaseService.update('notifications', notification.id, notification);
          } else {
            await DatabaseService.insert('notifications', notification);
          }
        }
      }
    } catch (error) {
      if (error.message && error.message.includes('Invalid token')) {
      } else {
        console.error('Failed to download notifications:', error);
      }
    }
  }

  async downloadChatData() {
    try {
      // Download chat rooms
      const roomsResponse = await ApiService.getChatRooms();
      if (roomsResponse.success && roomsResponse.data) {
        for (const room of roomsResponse.data) {
          room.synced = true;

          const existingRoom = await DatabaseService.findById('chat_rooms', room.id);
          if (existingRoom) {
            await DatabaseService.update('chat_rooms', room.id, room);
          } else {
            await DatabaseService.insert('chat_rooms', room);
          }

          // Download recent messages for each room
          try {
            const messagesResponse = await ApiService.getChatMessages(room.id, 50, 0);
            if (messagesResponse.success && messagesResponse.data) {
              for (const message of messagesResponse.data) {
                message.synced = true;

                const existingMessage = await DatabaseService.findById('chat_messages', message.id);
                if (existingMessage) {
                  await DatabaseService.update('chat_messages', message.id, message);
                } else {
                  await DatabaseService.insert('chat_messages', message);
                }
              }
            }
          } catch (error) {
            console.error(`Failed to download messages for room ${room.id}:`, error);
          }
        }
      }
    } catch (error) {
      if (error.message && error.message.includes('Invalid token')) {
      } else {
      }
    }
  }

  // Get sync status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      autoSyncEnabled: this.syncInterval !== null,
    };
  }

  // Force full sync (clear local data and re-download)
  async forceFullSync() {
    if (!this.isOnline) {
      throw new Error('Cannot perform full sync while offline');
    }

    try {
      this.isSyncing = true;
      this.notifyListeners({ isSyncing: true });

      // Clear all local data except user credentials
      await DatabaseService.clearAllData();

      // Re-download all data
      await this.downloadRemoteData();

      // Update last sync time
      await AsyncStorage.setItem('lastSyncTime', new Date().toISOString());

      console.log('Full sync completed successfully');
      this.notifyListeners({ syncCompleted: true, success: true, fullSync: true });

      return true;
    } catch (error) {
      console.error('Full sync failed:', error);
      this.notifyListeners({ syncCompleted: true, success: false, error, fullSync: true });
      throw error;
    } finally {
      this.isSyncing = false;
      this.notifyListeners({ isSyncing: false });
    }
  }
}

export default new SyncService();