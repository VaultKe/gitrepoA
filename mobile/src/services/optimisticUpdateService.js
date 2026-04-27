import lightningDataService from './lightningDataService';
import ApiService from './api';

/**
 * Optimistic Update Service
 * Provides instant UI updates with automatic rollback on failure
 */
class OptimisticUpdateService {
  constructor() {
    this.pendingUpdates = new Map();
    this.updateQueue = [];
    this.isProcessing = false;
  }

  /**
   * NOTIFICATION OPERATIONS - Instant feedback
   */
  async markNotificationAsRead(notificationId) {
    return await lightningDataService.optimisticUpdate(
      'notifications',
      {
        action: 'update',
        data: { id: notificationId, isRead: true, readAt: new Date().toISOString() }
      },
      () => ApiService.markNotificationAsRead(notificationId)
    );
  }

  async deleteNotification(notificationId) {
    return await lightningDataService.optimisticUpdate(
      'notifications',
      {
        action: 'remove',
        id: notificationId
      },
      () => ApiService.deleteNotification(notificationId)
    );
  }

  async markAllNotificationsAsRead() {
    return await lightningDataService.optimisticUpdate(
      'notifications',
      {
        action: 'bulk_update',
        update: { isRead: true, readAt: new Date().toISOString() }
      },
      () => ApiService.markAllNotificationsAsRead()
    );
  }

  /**
   * WALLET OPERATIONS - Instant balance updates
   */
  async initiateDeposit(amount, paymentMethod, description) {
    const tempTransaction = {
      id: `temp_${Date.now()}`,
      type: 'deposit',
      amount: amount,
      status: 'pending',
      description: description || `Deposit via ${paymentMethod}`,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    return await lightningDataService.optimisticUpdate(
      'transactions',
      {
        action: 'add',
        data: tempTransaction
      },
      async () => {
        const result = await ApiService.initiateDeposit(amount, paymentMethod, description);
        if (result.success) {
          // Update wallet balance optimistically
          const currentWallet = await lightningDataService.getData('wallet');
          if (currentWallet.success) {
            const updatedWallet = {
              ...currentWallet.data,
              balance: currentWallet.data.balance + amount
            };
            await lightningDataService.updateAllCaches('wallet', updatedWallet);
          }
        }
        return result;
      }
    );
  }



  /**
   * CHAMA OPERATIONS - Instant membership updates
   */
  async joinChama(chamaId) {
    return await lightningDataService.optimisticUpdate(
      'chamas',
      {
        action: 'update',
        data: { 
          id: chamaId, 
          userMembership: 'pending',
          memberCount: (await this.getCurrentMemberCount(chamaId)) + 1
        }
      },
      () => ApiService.joinChama(chamaId)
    );
  }

  async leaveChama(chamaId) {
    return await lightningDataService.optimisticUpdate(
      'chamas',
      {
        action: 'update',
        data: { 
          id: chamaId, 
          userMembership: null,
          memberCount: (await this.getCurrentMemberCount(chamaId)) - 1
        }
      },
      () => ApiService.leaveChama(chamaId)
    );
  }

  /**
   * PROFILE OPERATIONS - Instant profile updates
   */
  async updateProfile(profileData) {
    return await lightningDataService.optimisticUpdate(
      'profile',
      profileData,
      () => ApiService.updateProfile(profileData)
    );
  }

  /**
   * CHAT OPERATIONS - Instant message sending
   */
  async sendMessage(roomId, messageData) {
    const tempMessage = {
      id: `temp_${Date.now()}`,
      roomId,
      content: messageData.content,
      type: messageData.type || 'text',
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      timestamp: new Date().toISOString(),
      status: 'sending',
      isOptimistic: true,
    };

    return await lightningDataService.optimisticUpdate(
      `chat-messages-${roomId}`,
      {
        action: 'add',
        data: tempMessage
      },
      () => ApiService.sendMessage(roomId, messageData)
    );
  }

  /**
   * BATCH OPERATIONS - Multiple optimistic updates
   */
  async batchUpdate(updates) {
    console.log('⚡ Executing batch optimistic updates:', updates.length);
    
    const results = await Promise.allSettled(
      updates.map(update => this.executeOptimisticUpdate(update))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;

    console.log(`✅ Batch update completed: ${successful} successful, ${failed} failed`);
    
    return {
      success: failed === 0,
      results,
      stats: { successful, failed, total: results.length }
    };
  }

  async executeOptimisticUpdate(update) {
    const { dataType, updateData, apiCall } = update;
    return await lightningDataService.optimisticUpdate(dataType, updateData, apiCall);
  }

  /**
   * HELPER METHODS
   */
  async getCurrentMemberCount(chamaId) {
    try {
      const chamasData = await lightningDataService.getData('chamas');
      if (chamasData.success && Array.isArray(chamasData.data)) {
        const chama = chamasData.data.find(c => c.id === chamaId);
        return chama?.memberCount || 0;
      }
    } catch (error) {
      console.warn('Failed to get current member count:', error);
    }
    return 0;
  }

  /**
   * QUEUE MANAGEMENT - Handle offline scenarios
   */
  async queueUpdate(update) {
    this.updateQueue.push({
      ...update,
      timestamp: Date.now(),
      retries: 0,
    });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.updateQueue.length === 0) return;

    this.isProcessing = true;
    console.log(`🔄 Processing update queue: ${this.updateQueue.length} items`);

    while (this.updateQueue.length > 0) {
      const update = this.updateQueue.shift();
      
      try {
        await this.executeOptimisticUpdate(update);
        console.log('✅ Queued update processed successfully');
      } catch (error) {
        console.error('❌ Queued update failed:', error);
        
        // Retry logic
        if (update.retries < 3) {
          update.retries++;
          this.updateQueue.push(update);
          console.log(`🔄 Retrying update (attempt ${update.retries + 1})`);
        } else {
          console.error('❌ Update failed after 3 retries, discarding');
        }
      }
    }

    this.isProcessing = false;
    console.log('✅ Update queue processing completed');
  }

  /**
   * STATUS AND METRICS
   */
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
    console.log('🧹 Update queue cleared');
  }
}

export default new OptimisticUpdateService();
