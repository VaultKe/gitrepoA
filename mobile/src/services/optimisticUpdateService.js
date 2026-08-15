import cacheManagerService from './data/cacheManagerService';
import ApiService from './api';

class OptimisticUpdateService {
  constructor() {
    this.pendingUpdates = new Map();
    this.updateQueue = [];
    this.isProcessing = false;
  }

  async markNotificationAsRead(notificationId) {
    return await cacheManagerService.optimisticUpdate(
      'notifications',
      {
        action: 'update',
        data: { id: notificationId, isRead: true, readAt: new Date().toISOString() }
      },
      () => ApiService.markNotificationAsRead(notificationId)
    );
  }

  async deleteNotification(notificationId) {
    return await cacheManagerService.optimisticUpdate(
      'notifications',
      {
        action: 'remove',
        id: notificationId
      },
      () => ApiService.deleteNotification(notificationId)
    );
  }

  async markAllNotificationsAsRead() {
    return await cacheManagerService.optimisticUpdate(
      'notifications',
      {
        action: 'bulk_update',
        update: { isRead: true, readAt: new Date().toISOString() }
      },
      () => ApiService.markAllNotificationsAsRead()
    );
  }

  async initiateDeposit(amount, paymentMethod, description) {
    const tempTransaction = {
      id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'deposit',
      amount: amount,
      status: 'pending',
      description: description || `Deposit via ${paymentMethod}`,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    return await cacheManagerService.optimisticUpdate(
      'transactions',
      {
        action: 'add',
        data: tempTransaction
      },
      async () => {
        const result = await ApiService.initiateDeposit(amount, paymentMethod, description);
        if (result.success) {
          const currentWallet = await cacheManagerService.getData('wallet');
          if (currentWallet.success) {
            const updatedWallet = {
              ...currentWallet.data,
              balance: currentWallet.data.balance + amount
            };
            await cacheManagerService.clearCache('wallet');
          }
        }
        return result;
      }
    );
  }

  async joinChama(chamaId) {
    return await cacheManagerService.optimisticUpdate(
      'chamas',
      {
        action: 'update',
        data: { 
          id: chamaId, 
          userMembership: 'pending',
        }
      },
      () => ApiService.joinChama(chamaId)
    );
  }

  async leaveChama(chamaId) {
    return await cacheManagerService.optimisticUpdate(
      'chamas',
      {
        action: 'update',
        data: { 
          id: chamaId, 
          userMembership: null,
        }
      },
      () => ApiService.leaveChama(chamaId)
    );
  }

  async updateProfile(profileData) {
    return await cacheManagerService.optimisticUpdate(
      'profile',
      profileData,
      () => ApiService.updateProfile(profileData)
    );
  }

  async sendMessage(roomId, messageData) {
    const tempMessage = {
      id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      roomId,
      content: messageData.content,
      type: messageData.type || 'text',
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      timestamp: new Date().toISOString(),
      status: 'sending',
      isOptimistic: true,
    };

    return await cacheManagerService.optimisticUpdate(
      `chat-messages-${roomId}`,
      {
        action: 'add',
        data: tempMessage
      },
      () => ApiService.sendMessage(roomId, messageData)
    );
  }

  async batchUpdate(updates) {
    const results = await Promise.allSettled(
      updates.map(update => this.executeOptimisticUpdate(update))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;

    return {
      success: failed === 0,
      results,
      stats: { successful, failed, total: results.length }
    };
  }

  async executeOptimisticUpdate(update) {
    const { dataType, updateData, apiCall } = update;
    return await cacheManagerService.optimisticUpdate(dataType, updateData, apiCall);
  }

  getStatus() {
    return {
      pendingUpdates: this.pendingUpdates.size,
      queueLength: this.updateQueue.length,
      isProcessing: this.isProcessing,
    };
  }

  clearQueue() {
    this.updateQueue = [];
    this.pendingUpdates.clear();
  }

  async addToCart(productId, quantity = 1) {
    return await cacheManagerService.optimisticUpdate(
      'cart',
      { action: 'add', data: { productId, quantity } },
      () => ApiService.addToCart(productId, quantity)
    );
  }

  async removeFromCart(cartItemId) {
    return await cacheManagerService.optimisticUpdate(
      'cart',
      { action: 'remove', id: cartItemId },
      () => ApiService.removeFromCart(cartItemId)
    );
  }

  async addToWishlist(productId) {
    return await cacheManagerService.optimisticUpdate(
      'wishlist',
      { action: 'add', data: { productId } },
      () => ApiService.addToWishlist(productId)
    );
  }
}

export default new OptimisticUpdateService();