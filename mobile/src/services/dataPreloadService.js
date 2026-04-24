import ApiService from './api';
import DatabaseService from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';

class DataPreloadService {
  constructor() {
    this.isPreloading = false;
    this.preloadPromise = null;
    this.lastPreloadTime = 0;
    this.preloadInterval = 5 * 60 * 1000; // 5 minutes
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultCacheTime = 2 * 60 * 1000; // 2 minutes
  }

  // Main preload function that loads all essential data
  async preloadAllData(userId, forceRefresh = false) {
    // Prevent multiple simultaneous preloads
    if (this.isPreloading && !forceRefresh) {
      console.log('🔄 Preload already in progress, returning existing promise');
      return this.preloadPromise;
    }

    // Check if recent preload exists and is still valid
    const now = Date.now();
    if (!forceRefresh && (now - this.lastPreloadTime) < this.preloadInterval) {
      console.log('🚀 Using recent preload data, skipping refresh');
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

      // Use the comprehensive API preload method
      const preloadResult = await ApiService.preloadAllUserData();
      
      if (!preloadResult.success) {
        console.error('❌ API preload failed:', preloadResult.error);
        return preloadResult;
      }

      const { data: apiData, meta } = preloadResult;

      // Store all data in local database and cache simultaneously
      await Promise.all([
        this._storeInDatabase(userId, apiData),
        this._storeInCache(apiData),
        this._storeInAsyncStorage(apiData),
      ]);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`✅ Complete data preload finished in ${totalTime}ms`);
      console.log(`📊 API calls: ${meta.loadTime}ms, Storage: ${totalTime - meta.loadTime}ms`);

      return {
        success: true,
        data: apiData,
        meta: {
          ...meta,
          totalTime,
          storageTime: totalTime - meta.loadTime,
        }
      };

    } catch (error) {
      console.error('❌ Data preload execution failed:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  // Store data in local database for offline access
  async _storeInDatabase(userId, apiData) {
    if (!DatabaseService.isInitialized) {
      console.warn('⚠️ Database not initialized, skipping database storage');
      return;
    }

    try {
      console.log('💾 Storing preloaded data in database...');

      const storePromises = [];

      // Store chamas
      if (apiData.chamas?.success && apiData.chamas.data) {
        storePromises.push(this._storeChamasInDB(apiData.chamas.data));
      }

      // Store transactions
      if (apiData.transactions?.success && apiData.transactions.data) {
        storePromises.push(this._storeTransactionsInDB(userId, apiData.transactions.data));
      }

      // Store notifications
      if (apiData.notifications?.success && apiData.notifications.data) {
        storePromises.push(this._storeNotificationsInDB(userId, apiData.notifications.data));
      }

      // Store products
      if (apiData.products?.success && apiData.products.data) {
        storePromises.push(this._storeProductsInDB(apiData.products.data));
      }

      // Store cart items
      if (apiData.cart?.success && apiData.cart.data?.items) {
        storePromises.push(this._storeCartInDB(userId, apiData.cart.data.items));
      }

      // Store orders
      if (apiData.orders?.success && apiData.orders.data) {
        storePromises.push(this._storeOrdersInDB(userId, apiData.orders.data));
      }

      // Store chat rooms
      if (apiData.chatRooms?.success && apiData.chatRooms.data) {
        storePromises.push(this._storeChatRoomsInDB(apiData.chatRooms.data));
      }

      await Promise.all(storePromises);
      console.log('✅ Database storage completed');

    } catch (error) {
      console.error('❌ Database storage failed:', error);
    }
  }

  // Store data in memory cache for instant access
  async _storeInCache(apiData) {
    try {
      console.log('🧠 Storing preloaded data in memory cache...');
      const now = Date.now();

      Object.entries(apiData).forEach(([key, value]) => {
        if (value?.success && value.data) {
          this.cache.set(key, value.data);
          this.cacheExpiry.set(key, now + this.defaultCacheTime);
        }
      });

      console.log('✅ Memory cache storage completed');
    } catch (error) {
      console.error('❌ Memory cache storage failed:', error);
    }
  }

  // Store critical data in AsyncStorage for persistence
  async _storeInAsyncStorage(apiData) {
    try {
      console.log('📱 Storing critical data in AsyncStorage...');

      const storagePromises = [];

      // Store unread notification count
      if (apiData.unreadCount?.success) {
        storagePromises.push(
          AsyncStorage.setItem('unreadNotificationCount', 
            JSON.stringify(apiData.unreadCount.data))
        );
      }

      // Store user profile
      if (apiData.profile?.success) {
        storagePromises.push(
          AsyncStorage.setItem('cachedUserProfile', 
            JSON.stringify(apiData.profile.data))
        );
      }

      // Store wallet balance
      if (apiData.wallet?.success) {
        storagePromises.push(
          AsyncStorage.setItem('cachedWalletBalance', 
            JSON.stringify(apiData.wallet.data))
        );
      }

      await Promise.all(storagePromises);
      console.log('✅ AsyncStorage storage completed');

    } catch (error) {
      console.error('❌ AsyncStorage storage failed:', error);
    }
  }

  // Helper methods for database storage
  async _storeChamasInDB(chamas) {
    if (!Array.isArray(chamas)) return;
    
    for (const chama of chamas) {
      await DatabaseService.insertOrUpdate('chamas', chama, 'id');
    }
  }

  async _storeTransactionsInDB(userId, transactions) {
    if (!Array.isArray(transactions)) return;
    
    for (const transaction of transactions) {
      await DatabaseService.insertOrUpdate('transactions', {
        ...transaction,
        user_id: userId,
      }, 'id');
    }
  }

  async _storeNotificationsInDB(userId, notifications) {
    if (!Array.isArray(notifications)) return;
    
    for (const notification of notifications) {
      await DatabaseService.insertOrUpdate('notifications', {
        ...notification,
        user_id: userId,
      }, 'id');
    }
  }

  async _storeProductsInDB(products) {
    if (!Array.isArray(products)) return;
    
    for (const product of products) {
      await DatabaseService.insertOrUpdate('products', product, 'id');
    }
  }

  async _storeCartInDB(userId, cartItems) {
    if (!Array.isArray(cartItems)) return;
    
    // Clear existing cart items for this user
    await DatabaseService.deleteWhere('cart_items', 'user_id = ?', [userId]);
    
    // Insert new cart items
    for (const item of cartItems) {
      await DatabaseService.insert('cart_items', {
        ...item,
        user_id: userId,
      });
    }
  }

  async _storeOrdersInDB(userId, orders) {
    if (!Array.isArray(orders)) return;
    
    for (const order of orders) {
      await DatabaseService.insertOrUpdate('orders', order, 'id');
    }
  }

  async _storeChatRoomsInDB(chatRooms) {
    if (!Array.isArray(chatRooms)) return;
    
    for (const room of chatRooms) {
      await DatabaseService.insertOrUpdate('chat_rooms', room, 'id');
    }
  }

  // Get cached data with fallback to database
  async getCachedData(dataType, fallbackToDatabase = true) {
    // Check memory cache first
    if (this.cache.has(dataType)) {
      const expiry = this.cacheExpiry.get(dataType);
      if (Date.now() < expiry) {
        console.log(`🚀 Returning ${dataType} from memory cache`);
        return this.cache.get(dataType);
      } else {
        // Cache expired, remove it
        this.cache.delete(dataType);
        this.cacheExpiry.delete(dataType);
      }
    }

    // Fallback to database if requested
    if (fallbackToDatabase && DatabaseService.isInitialized) {
      console.log(`📂 Loading ${dataType} from database`);
      return await this._loadFromDatabase(dataType);
    }

    return null;
  }

  async _loadFromDatabase(dataType) {
    try {
      switch (dataType) {
        case 'chamas':
          return await DatabaseService.findAll('chamas');
        case 'transactions':
          return await DatabaseService.findAll('transactions', '', [], 'created_at DESC', 100);
        case 'notifications':
          return await DatabaseService.findAll('notifications', '', [], 'created_at DESC', 100);
        case 'products':
          return await DatabaseService.findAll('products', '', [], 'created_at DESC', 100);
        case 'cart':
          return await DatabaseService.findAll('cart_items');
        case 'orders':
          return await DatabaseService.findAll('orders', '', [], 'created_at DESC', 50);
        case 'chatRooms':
          return await DatabaseService.findAll('chat_rooms');
        default:
          return null;
      }
    } catch (error) {
      console.error(`❌ Failed to load ${dataType} from database:`, error);
      return null;
    }
  }

  // Clear all caches
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
    this.lastPreloadTime = 0;
    console.log('🧹 All caches cleared');
  }

  // Get preload status
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
