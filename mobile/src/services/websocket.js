import AsyncStorage from '@react-native-async-storage/async-storage';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 2; // Reduced for tunnel environments
    this.reconnectInterval = 3000;
    this.messageHandlers = new Map();
    this.roomSubscriptions = new Set();
    this.pingInterval = null;
    this.dataUpdateHandlers = new Map();
    this.isRealtimeEnabled = true;
    this.lastDataSync = new Map();
  }

  // Connect to WebSocket server
  async connect() {
    // Enable WebSocket for comprehensive real-time data updates
    if (!this.isRealtimeEnabled) {
      return false;
    }

    try {
      return await this._establishConnection();
    } catch (error) {
      // Fallback to polling for critical updates
      this.startPollingFallback();
      return false;
    }
  }

  async _establishConnection() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        return false;
      }

      let wsUrl;

      // Always use the production backend for WebSocket connections
      wsUrl = `wss://gitrepoa-1.onrender.com/api/v1/ws?token=${encodeURIComponent(token)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onclose = this.onClose.bind(this);
      this.ws.onerror = this.onError.bind(this);

      return true;
    } catch (error) {
      return false;
    }
  }

  // Legacy connect method (disabled for production)
  async _legacyConnect() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        return false;
      }

      // Clean WebSocket URL configuration
      let wsUrl;
      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;

        // Enable WebSocket for real-time messaging in all environments
         if (hostname.includes('tunnelmole.net')) {
           wsUrl = `wss://gitrepoa-1.onrender.com/api/v1/ws?token=${encodeURIComponent(token)}`;
         } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
          // If accessing via localhost, use localhost backend
          wsUrl = `ws://gitrepoa-1.onrender.com/api/v1/ws?token=${encodeURIComponent(token)}`;
        } else {
          // Default to tunnel (will likely fail)
          wsUrl = `wss://gitrepoa-1.onrender.com/api/v1/ws?token=${encodeURIComponent(token)}`;
        }
      } else {
        // Fallback for non-web environments
        wsUrl = `wss://gitrepoa-1.onrender.com/api/v1/ws?token=${encodeURIComponent(token)}`;
      }


      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onclose = this.onClose.bind(this);
      this.ws.onerror = this.onError.bind(this);

      return true;
    } catch (error) {
      console.error('WebSocket connection error:', error);
      return false;
    }
  }

  // Disconnect from WebSocket server
  disconnect() {
    this.isConnected = false;
    this.reconnectAttempts = 0;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // WebSocket event handlers
  onOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Start ping interval to keep connection alive
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000); // Ping every 30 seconds

    // Re-subscribe to rooms
    this.roomSubscriptions.forEach(roomId => {
      this.joinRoom(roomId);
    });
  }

  onMessage(event) {
    try {
      // Check if event and event.data exist
      if (!event || event.data === undefined || event.data === null) {
        return;
      }

      // Check if data is valid string before parsing
      if (typeof event.data !== 'string') {
        return;
      }

      // Skip empty or whitespace-only messages
      if (!event.data.trim()) {
        return;
      }

      const message = JSON.parse(event.data);

      // Handle different message types
      switch (message.type) {
        case 'connected':
          this.subscribeToDataUpdates();
          break;
        case 'pong':
          // Pong response to ping
          break;
        case 'new_message':
          this.handleNewMessage(message);
          break;
        case 'message_read':
          this.handleMessageRead(message);
          
          break;
        case 'user_typing':
          this.handleUserTyping(message);
          break;
        case 'data_update':
          this.handleDataUpdate(message);
          break;
        case 'notification_update':
          this.handleNotificationUpdate(message);
          break;
        case 'wallet_update':
          this.handleWalletUpdate(message);
          break;
        case 'chama_update':
          this.handleChamaUpdate(message);
          break;
        case 'transaction_update':
          this.handleTransactionUpdate(message);
          break;
        default:
      }

      // Call registered handlers
      this.messageHandlers.forEach((handler, type) => {
        if (message.type === type) {
          handler(message);
        }
      });
    } catch (error) {
      // Don't throw error, just ignore invalid messages
    }
  }

  onClose(event) {
    this.isConnected = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Attempt to reconnect if not intentionally closed
    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    }
  }

  onError(error) {

    // Check if we're in a tunnel environment
    if (typeof window !== 'undefined' && window.location &&
        window.location.hostname.includes('tunnelmole.net')) {
      if (this.reconnectAttempts >= 2) {
        this.maxReconnectAttempts = 0; // Stop further attempts
      }
    }
  }

  // Send message to WebSocket server
  send(message) {
    if (this.ws && this.isConnected) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }
  }

  // Join a chat room
  joinRoom(roomId) {
    this.roomSubscriptions.add(roomId);
    this.send({
      type: 'join_room',
      roomId: roomId,
    });
  }

  // Leave a chat room
  leaveRoom(roomId) {
    this.roomSubscriptions.delete(roomId);
    this.send({
      type: 'leave_room',
      roomId: roomId,
    });
  }

  // Register message handler
  registerMessageHandler(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  // Unregister message handler
  unregisterMessageHandler(type) {
    this.messageHandlers.delete(type);
  }

  // Handle new message (pre-decrypted from backend)
  async handleNewMessage(message) {

    // Emit to registered handlers (messages are pre-decrypted by backend)
    this.messageHandlers.forEach((handler, type) => {
      if (type === 'new_message') {
        try {
          handler(message);
        } catch (handlerError) {
        }
      }
    });
  }

  // Decrypt message content
  async decryptMessageContent(messageData) {
    try {
      // Import encryption service dynamically
      const encryptedChatService = await import('./encryptedChat');

      // Check if content looks like encrypted data
      if (typeof messageData.content === 'string') {
        // Try to parse as JSON first
        let contentToParse = messageData.content;
        try {
          const parsed = JSON.parse(contentToParse);
          if (parsed.ciphertext || parsed.iv) {
            // This looks like encrypted data
            const result = await encryptedChatService.default.receiveMessage({
              ...messageData,
              content: parsed
            });

            if (result.success && result.content) {
              return result.content;
            }
          }
        } catch (parseError) {
          // Not JSON, might be plain text
          // console.log('📝 WebSocket message content is plain text');
          return messageData.content;
        }
      }

      // If content is already an object, try to decrypt it
      if (typeof messageData.content === 'object' && messageData.content.ciphertext) {
        const result = await encryptedChatService.default.receiveMessage(messageData);
        if (result.success && result.content) {
          return result.content;
        }
      }

      // Return original content if no decryption needed
      return messageData.content;

    } catch (error) {
      console.error('❌ WebSocket message decryption failed:', error);
      return null;
    }
  }

  // Handle message read
  handleMessageRead(message) {
    // console.log('👁️ Message read:', message);
    // This will be handled by the registered handlers
  }

  // Handle user typing
  handleUserTyping(message) {
    // console.log('⌨️ User typing:', message);
    // This will be handled by the registered handlers
  }

  // Send typing indicator
  sendTyping(roomId, isTyping) {
    this.send({
      type: 'typing',
      roomId: roomId,
      isTyping: isTyping,
    });
  }

  // Subscribe to data updates
  subscribeToDataUpdates() {
    // console.log('📡 Subscribing to real-time data updates...');
    this.send({
      type: 'subscribe_data_updates',
      subscriptions: [
        'notifications',
        'wallet',
        'chamas',
        'transactions',
        'chat_messages'
      ]
    });
  }

  // Handle comprehensive data updates
  handleDataUpdate(message) {
    // console.log('📊 Data update received:', message.dataType);

    const { dataType, action, data } = message;
    const handler = this.dataUpdateHandlers.get(dataType);

    if (handler) {
      handler({ action, data, timestamp: Date.now() });
    }

    // Update last sync time
    this.lastDataSync.set(dataType, Date.now());
  }

  // Handle notification updates
  handleNotificationUpdate(message) {
    // console.log('🔔 Notification update received:', message);
    this.handleDataUpdate({
      dataType: 'notifications',
      action: message.action || 'new',
      data: message.data
    });
  }

  // Handle wallet updates
  handleWalletUpdate(message) {
    // console.log('💰 Wallet update received:', message);
    this.handleDataUpdate({
      dataType: 'wallet',
      action: message.action || 'update',
      data: message.data
    });
  }

  // Handle chama updates
  handleChamaUpdate(message) {
    // console.log('👥 Chama update received:', message);
    this.handleDataUpdate({
      dataType: 'chamas',
      action: message.action || 'update',
      data: message.data
    });
  }

  // Handle transaction updates
  handleTransactionUpdate(message) {
    // console.log('💳 Transaction update received:', message);
    this.handleDataUpdate({
      dataType: 'transactions',
      action: message.action || 'new',
      data: message.data
    });
  }

  // Register data update handler
  registerDataUpdateHandler(dataType, handler) {
    // console.log(`📡 Registering data update handler for: ${dataType}`);
    this.dataUpdateHandlers.set(dataType, handler);
  }

  // Unregister data update handler
  unregisterDataUpdateHandler(dataType) {
    // console.log(`📡 Unregistering data update handler for: ${dataType}`);
    this.dataUpdateHandlers.delete(dataType);
  }

  // Enable/disable real-time updates
  setRealtimeEnabled(enabled) {
    this.isRealtimeEnabled = enabled;
    // console.log(`📡 Real-time updates ${enabled ? 'enabled' : 'disabled'}`);

    if (!enabled && this.isConnected) {
      this.disconnect();
    } else if (enabled && !this.isConnected) {
      this.connect();
    }
  }

  // Get last sync time for data type
  getLastSyncTime(dataType) {
    return this.lastDataSync.get(dataType) || 0;
  }

  // Polling fallback when WebSocket fails
  startPollingFallback() {
    if (this.pollingInterval) return;

    // console.log('🔄 Starting polling fallback for real-time updates...');

    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollCriticalUpdates();
      } catch (error) {
        console.error('❌ Polling fallback error:', error);
      }
    }, 15000); // Poll every 15 seconds
  }

  async pollCriticalUpdates() {
    // console.log('📡 Polling for critical updates...');

    try {
      // Import here to avoid circular dependency
      const ApiService = (await import('./api')).default;

      // Poll critical data that needs real-time updates
      const [notificationsResult, unreadCountResult] = await Promise.allSettled([
        ApiService.getNotifications(10, 0),
        ApiService.getUnreadNotificationCount(),
      ]);

      // Process notifications
      if (notificationsResult.status === 'fulfilled' && notificationsResult.value.success) {
        const handler = this.dataUpdateHandlers.get('notifications');
        if (handler) {
          handler({
            action: 'refresh',
            data: notificationsResult.value.data,
            timestamp: Date.now(),
          });
        }
      }

      // Process unread count
      if (unreadCountResult.status === 'fulfilled' && unreadCountResult.value.success) {
        const handler = this.dataUpdateHandlers.get('unread-count');
        if (handler) {
          handler({
            action: 'update',
            data: unreadCountResult.value.data,
            timestamp: Date.now(),
          });
        }
      }

    } catch (error) {
      console.error('❌ Critical updates polling failed:', error);
    }
  }

  stopPollingFallback() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      // console.log('🛑 Polling fallback stopped');
    }
  }

  // Enhanced disconnect method
  disconnect() {
    // console.log('🔌 Disconnecting from WebSocket');
    this.isConnected = false;
    this.reconnectAttempts = 0;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.pollingInterval) {
      this.stopPollingFallback();
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      isRealtimeEnabled: this.isRealtimeEnabled,
      dataHandlers: Array.from(this.dataUpdateHandlers.keys()),
      lastSyncTimes: Object.fromEntries(this.lastDataSync),
      hasPollingFallback: !!this.pollingInterval,
    };
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;