import websocketService from '../websocket';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WS_EVENTS = {
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SEND_MESSAGE: 'send_message',
  MARK_READ: 'mark_read',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  NEW_MESSAGE: 'new_message',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_READ: 'message_read',
  USER_TYPING: 'user_typing',
  ROOM_UPDATED: 'room_updated',
  ROOM_MEMBERS: 'room_members',
  ERROR: 'error',
};

class ChatService {
  constructor() {
    this.rooms = new Map();
    this.messages = new Map();
    this.pendingMessages = new Map();
    this.processedMessageIds = new Set();
    this.readReceipts = new Map();
    this.typingUsers = new Map();
    this._persistTimer = null;
    this._isOnline = true;

    this.roomSubscribers = new Map();
    this.messageSubscribers = new Map();

    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;

    this.typingTimeout = null;
    this.typingDebounceMs = 500;

    this._setupWebSocketHandlers();
    this._setupCleanup();
  }

  async initialize() {
    try {
      await this._loadFromCache();

      if (!websocketService.isConnected) {
        websocketService.connect();
      }

      return true;
    } catch (error) {
      console.error('ChatService init error:', error);
      return false;
    }
  }

  _setupWebSocketHandlers() {
    websocketService.registerMessageHandler('new_message', this._handleNewMessage.bind(this));
    websocketService.registerMessageHandler('message_read', this._handleRead.bind(this));
    websocketService.registerMessageHandler('user_typing', this._handleTyping.bind(this));
    websocketService.registerMessageHandler('room_updated', this._handleRoomUpdate.bind(this));
    websocketService.registerMessageHandler('room_members', this._handleRoomMembers.bind(this));
    websocketService.registerMessageHandler('message_deleted', this._handleDeleted.bind(this));
    websocketService.registerMessageHandler('error', this._handleError.bind(this));
  }

  _setupCleanup() {
    this.cleanup = () => {
      this._clearReconnectTimer();
      websocketService.unregisterMessageHandler('new_message');
      websocketService.unregisterMessageHandler('message_read');
      websocketService.unregisterMessageHandler('user_typing');
      websocketService.unregisterMessageHandler('room_updated');
      websocketService.unregisterMessageHandler('room_members');
      websocketService.unregisterMessageHandler('error');
    };
  }

  // ==================== Room Management ====================

  async getRooms(forceRefresh = false) {
    try {
      if (websocketService.isConnected) {
        return await this._getRoomsViaWebSocket(forceRefresh);
      }
      return await this._getRoomsViaRest(forceRefresh);
    } catch (error) {
      try {
        return await this._getRoomsViaRest(forceRefresh);
      } catch (e) {
        console.warn('REST getRooms failed, falling back to cache:', e.message);
        return Array.from(this.rooms.values());
      }
    }
  }

  async createRoom(roomData) {
    try {
      if (websocketService.isConnected) {
        try {
          const response = await websocketService.sendRequest({
            type: 'create_room',
            name: roomData.name,
            chamaId: roomData.chamaId,
            memberIds: roomData.memberIds,
            recipientId: roomData.recipientId,
            type: roomData.type,
          });
          if (response.success && response.data) {
            this._updateRoom(response.data);
            return response.data;
          }
        } catch (wsErr) {
          // fall through to REST
        }
      }

      const ApiService = (await import('../api')).default;
      const response = await ApiService.makeRequest('/chat/rooms', {
        method: 'POST',
        body: roomData,
      });

      if (response.success) {
        this._updateRoom(response.data);
        return response.data;
      }
      throw new Error(response.error || 'Failed to create room');
    } catch (error) {
      console.error('createRoom error:', error);
      throw error;
    }
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  joinRoom(roomId) {
    if (!websocketService.isConnected) {
      websocketService.connect();
    }
    websocketService.joinRoom(roomId);
  }

  leaveRoom(roomId) {
    websocketService.leaveRoom(roomId);
  }

  subscribeToRoom(roomId, callback) {
    if (!this.roomSubscribers.has(roomId)) {
      this.roomSubscribers.set(roomId, new Set());
    }
    this.roomSubscribers.get(roomId).add(callback);

    this.joinRoom(roomId);

    return () => {
      const callbacks = this.roomSubscribers.get(roomId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.leaveRoom(roomId);
        }
      }
    };
  }

  subscribeToMessages(roomId, callback) {
    if (!this.messageSubscribers.has(roomId)) {
      this.messageSubscribers.set(roomId, new Set());
    }
    this.messageSubscribers.get(roomId).add(callback);
    return () => {
      const callbacks = this.messageSubscribers.get(roomId);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  getUnreadCount(roomId) {
    const messages = this.messages.get(roomId) || [];
    const readReceipts = this.readReceipts.get(roomId) || new Set();
    return messages.filter(m => !readReceipts.has(m.id)).length;
  }

  getTypingUsers(roomId) {
    return this.typingUsers.get(roomId) || new Set();
  }

  setTyping(roomId, isTyping) {
    clearTimeout(this.typingTimeout);

    this.typingTimeout = setTimeout(async () => {
      try {
        await websocketService.send({
          type: isTyping ? WS_EVENTS.TYPING_START : WS_EVENTS.TYPING_STOP,
          roomId,
        });
      } catch (error) {
        // Ignore errors for typing indicators
      }
    }, this.typingDebounceMs);
  }

  _setupNetworkMonitoring() {
    // Network state is tracked via WebSocket connection status.
  }

  isOnline() {
    return websocketService.isConnected || this._isOnline;
  }

  setOnlineStatus(online) {
    this._isOnline = online;
  }

  _clearPersistTimer() {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
  }

  _clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  destroy() {
    if (this.cleanup) this.cleanup();
    this._clearReconnectTimer();
    this.rooms.clear();
    this.messages.clear();
    this.pendingMessages.clear();
    this.processedMessageIds.clear();
    this.typingUsers.clear();
    this.roomSubscribers.clear();
    this.messageSubscribers.clear();
  }
}

import { attachMessaging } from './chatMessaging';
import { attachPersistence } from './chatPersistence';

attachMessaging(ChatService.prototype);
attachPersistence(ChatService.prototype);

const chatService = new ChatService();
export default chatService;
