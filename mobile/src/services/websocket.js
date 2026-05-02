import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, WS_URL } from '../config/environment';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 2;
    this.reconnectInterval = 3000;
    this.messageHandlers = new Map();
    this.roomSubscriptions = new Set();
    this.pingInterval = null;
    this.dataUpdateHandlers = new Map();
    this.isRealtimeEnabled = true;
    this.lastDataSync = new Map();
    this.pollingInterval = null;
  }

  async connect() {
    if (!this.isRealtimeEnabled) return false;

    try {
      return await this._establishConnection();
    } catch (error) {
      this.startPollingFallback();
      return false;
    }
  }

  async _establishConnection() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return false;

      if (!API_BASE_URL) return false;
      const wsUrl = `${WS_URL}/api/v1/ws?token=${encodeURIComponent(token)}`;
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

  disconnect() {
    this.isConnected = false;
    this.reconnectAttempts = 0;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;

    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);

    this.roomSubscriptions.forEach(roomId => {
      this.joinRoom(roomId);
    });
  }

  onMessage(event) {
    try {
      if (!event || event.data === undefined || event.data === null) return;
      if (typeof event.data !== 'string') return;
      if (!event.data.trim()) return;

      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'connected':
          this.subscribeToDataUpdates();
          break;
        case 'pong':
          break;
        case 'new_message':
          this.handleNewMessage(message);
          break;
        case 'message_read':
          break;
        case 'user_typing':
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
      }

      this.messageHandlers.forEach((handler, type) => {
        if (message.type === type) {
          handler(message);
        }
      });
    } catch (error) {}
  }

  onClose(event) {
    this.isConnected = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    }
  }

  onError(error) {
    if (typeof window !== 'undefined' && window.location &&
        window.location.hostname.includes('tunnelmole.net')) {
      if (this.reconnectAttempts >= 2) {
        this.maxReconnectAttempts = 0;
      }
    }
  }

  send(message) {
    if (this.ws && this.isConnected) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  joinRoom(roomId) {
    this.roomSubscriptions.add(roomId);
    this.send({ type: 'join_room', roomId });
  }

  leaveRoom(roomId) {
    this.roomSubscriptions.delete(roomId);
    this.send({ type: 'leave_room', roomId });
  }

  registerMessageHandler(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  unregisterMessageHandler(type) {
    this.messageHandlers.delete(type);
  }

  handleNewMessage(message) {
    this.messageHandlers.forEach((handler, type) => {
      if (type === 'new_message') {
        try {
          handler(message);
        } catch (handlerError) {}
      }
    });
  }

  handleDataUpdate(message) {
    const { dataType, action, data } = message;
    const handler = this.dataUpdateHandlers.get(dataType);

    if (handler) {
      handler({ action, data, timestamp: Date.now() });
    }

    this.lastDataSync.set(dataType, Date.now());
  }

  handleNotificationUpdate(message) {
    this.handleDataUpdate({
      dataType: 'notifications',
      action: message.action || 'new',
      data: message.data
    });
  }

  handleWalletUpdate(message) {
    this.handleDataUpdate({
      dataType: 'wallet',
      action: message.action || 'update',
      data: message.data
    });
  }

  handleChamaUpdate(message) {
    this.handleDataUpdate({
      dataType: 'chamas',
      action: message.action || 'update',
      data: message.data
    });
  }

  handleTransactionUpdate(message) {
    this.handleDataUpdate({
      dataType: 'transactions',
      action: message.action || 'new',
      data: message.data
    });
  }

  registerDataUpdateHandler(dataType, handler) {
    this.dataUpdateHandlers.set(dataType, handler);
  }

  unregisterDataUpdateHandler(dataType) {
    this.dataUpdateHandlers.delete(dataType);
  }

  setRealtimeEnabled(enabled) {
    this.isRealtimeEnabled = enabled;

    if (!enabled && this.isConnected) {
      this.disconnect();
    } else if (enabled && !this.isConnected) {
      this.connect();
    }
  }

  getLastSyncTime(dataType) {
    return this.lastDataSync.get(dataType) || 0;
  }

  startPollingFallback() {
    if (this.pollingInterval) return;
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollCriticalUpdates();
      } catch (error) {}
    }, 15000);
  }

  async pollCriticalUpdates() {
    try {
      const ApiService = (await import('./api')).default;
      const [notificationsResult, unreadCountResult] = await Promise.allSettled([
        ApiService.getNotifications(10, 0),
        ApiService.getUnreadNotificationCount(),
      ]);

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
    } catch (error) {}
  }

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

const webSocketService = new WebSocketService();
export default webSocketService;