import openWASocketService, { OPENWA_EVENTS } from '../openwaSocket';

const CHAT_WS_EVENTS = {
  MESSAGE_RECEIVED: OPENWA_EVENTS.MESSAGE_RECEIVED,
  MESSAGE_ACK: OPENWA_EVENTS.MESSAGE_ACK,
  MESSAGE_REVOKED: OPENWA_EVENTS.MESSAGE_REVOKED,
  PRESENCE_UPDATE: OPENWA_EVENTS.PRESENCE_UPDATE,
  GROUP_UPDATE: OPENWA_EVENTS.GROUP_UPDATE,
};

class ChatService {
  constructor() {
    this.rooms = [];
    this.messages = new Map();
    this.typingUsers = new Map();
    this.messageSubscribers = new Map();
    this.roomSubscribers = new Map();
    this._listenersAttached = false;
  }

  async initialize() {
    try {
      if (openWASocketService.enabled && !openWASocketService.isConnected) {
        await openWASocketService.connect();
      }
      this._attachListeners();
      return true;
    } catch (error) {
      console.error('ChatService init error:', error);
      return false;
    }
  }

  setCurrentUser(user) {
    if (!user || !user.id) return;
    openWASocketService.setUserID(user.id);
  }

  _attachListeners() {
    if (this._listenersAttached) return;
    this._listenersAttached = true;

    openWASocketService.onEvent(CHAT_WS_EVENTS.MESSAGE_RECEIVED, (msg) => {
      const chatId = msg.data?.chatId || msg.sessionId;
      if (!chatId) return;
      const message = msg.data || {};
      if (message.id) {
        this._upsertMessage(chatId, message);
      }
    });

    openWASocketService.onEvent(CHAT_WS_EVENTS.MESSAGE_ACK, (msg) => {
      const messageId = msg.data?.messageId || msg.data?.id;
      const chatId = msg.data?.chatId || msg.sessionId;
      if (!messageId || !chatId) return;
      this._updateMessageStatus(chatId, messageId, 'delivered');
    });

    openWASocketService.onEvent(CHAT_WS_EVENTS.MESSAGE_REVOKED, (msg) => {
      const messageId = msg.data?.messageId || msg.data?.revokedId || msg.data?.id;
      const chatId = msg.data?.chatId || msg.sessionId;
      if (!messageId || !chatId) return;
      this._removeMessage(chatId, messageId);
    });

    openWASocketService.onEvent(CHAT_WS_EVENTS.PRESENCE_UPDATE, (msg) => {
      const chatId = msg.data?.chatId || msg.sessionId;
      const userId = msg.data?.participantId || msg.data?.from;
      const isTyping = msg.data?.state === 'composing';
      if (!chatId || !userId) return;

      if (!this.typingUsers.has(chatId)) {
        this.typingUsers.set(chatId, new Set());
      }
      const set = this.typingUsers.get(chatId);
      if (isTyping) set.add(userId); else set.delete(userId);
      this._notifyRoomSubscribers(chatId);
    });

    openWASocketService.onEvent(CHAT_WS_EVENTS.GROUP_UPDATE, (msg) => {
      const chatId = msg.data?.chatId || msg.sessionId;
      if (!chatId) return;
      this._notifyRoomSubscribers(chatId);
    });
  }

  async getRooms(forceRefresh = false) {
    try {
      const ApiService = (await import('../api')).default;
      const response = await ApiService.makeRequest('/wa/chat/rooms');
      if (response.success && Array.isArray(response.data)) {
        this.rooms = response.data;
        return this.rooms;
      }
      return this.rooms;
    } catch (error) {
      console.warn('getRooms failed:', error.message);
      return this.rooms;
    }
  }

  getRoom(roomId) {
    return this.rooms.find(r => r.id === roomId) || null;
  }

  getAllRooms() {
    return this.rooms;
  }

  async createRoom(roomData) {
    try {
      const ApiService = (await import('../api')).default;
      const response = await ApiService.makeRequest('/wa/chat/rooms', {
        method: 'POST',
        body: roomData,
      });
      if (response.success && response.data) {
        this.rooms.push(response.data);
        return response.data;
      }
      throw new Error(response.error || 'Failed to create room');
    } catch (error) {
      console.error('createRoom error:', error);
      throw error;
    }
  }

  joinRoom(roomId) {
    if (openWASocketService.enabled) {
      openWASocketService.ensureSubscribed([
        CHAT_WS_EVENTS.MESSAGE_RECEIVED,
        CHAT_WS_EVENTS.MESSAGE_ACK,
        CHAT_WS_EVENTS.MESSAGE_REVOKED,
        CHAT_WS_EVENTS.PRESENCE_UPDATE,
        CHAT_WS_EVENTS.GROUP_UPDATE,
      ]);
    }
  }

  leaveRoom(roomId) {
    // OpenWA socket subscriptions are global; no per-room unsubscribe needed.
  }

  async getMessages(roomId, limit = 50, offset = 0, beforeMessageId) {
    try {
      const ApiService = (await import('../api')).default;
      const params = new URLSearchParams({ limit: String(limit) });
      if (beforeMessageId) params.set('before', beforeMessageId);
      const response = await ApiService.makeRequest(`/wa/chat/rooms/${roomId}/messages?${params.toString()}`);
      if (response.success && Array.isArray(response.data)) {
        response.data.forEach(m => this._upsertMessage(roomId, m));
        return this.messages.get(roomId) || response.data;
      }
      return this.messages.get(roomId) || [];
    } catch (error) {
      console.error('getMessages error:', error);
      return this.messages.get(roomId) || [];
    }
  }

  getRoomMessages(roomId) {
    return this.messages.get(roomId) || [];
  }

  async sendMessage(roomId, content, type = 'text', metadata = {}) {
    try {
      const ApiService = (await import('../api')).default;
      const response = await ApiService.makeRequest(`/wa/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        body: { content, type, metadata },
      });
      if (response.success && response.data) {
        this._upsertMessage(roomId, response.data);
        return response.data;
      }
      throw new Error(response.error || 'Failed to send message');
    } catch (error) {
      console.error('sendMessage error:', error);
      throw error;
    }
  }

  async sendImage(roomId, imageUri, caption = '') {
    return this.sendMessage(roomId, caption, 'image', { imageUri });
  }

  async markMessageAsRead(roomId, messageId) {
    try {
      const ApiService = (await import('../api')).default;
      await ApiService.makeRequest(`/wa/chat/rooms/${roomId}/read`, {
        method: 'POST',
      }).catch(() => {});
      this._updateMessageStatus(roomId, messageId, 'read');
    } catch (error) {
      console.error('Mark read error:', error);
    }
  }

  async markRoomAsRead(roomId) {
    const roomMessages = this.messages.get(roomId) || [];
    await Promise.all(roomMessages.map(m => this.markMessageAsRead(roomId, m.id)));
  }

  async deleteMessage(roomId, messageId) {
    try {
      const ApiService = (await import('../api')).default;
      await ApiService.makeRequest(`/wa/chat/rooms/${roomId}/messages/${messageId}`, {
        method: 'DELETE',
      });
      this._removeMessage(roomId, messageId);
    } catch (error) {
      console.error('deleteMessage error:', error);
      throw error;
    }
  }

  async setTyping(roomId, isTyping) {
    try {
      const ApiService = (await import('../api')).default;
      await ApiService.makeRequest(`/wa/chat/rooms/${roomId}/typing`, {
        method: 'POST',
        body: { isTyping },
      });
    } catch (error) {
      // Ignore typing errors
    }
  }

  getUnreadCount(roomId) {
    const messages = this.messages.get(roomId) || [];
    return messages.filter(m => !m.isRead && m.status !== 'read').length;
  }

  getTypingUsers(roomId) {
    return this.typingUsers.get(roomId) || new Set();
  }

  subscribeToRoom(roomId, callback) {
    if (!this.roomSubscribers.has(roomId)) {
      this.roomSubscribers.set(roomId, new Set());
    }
    this.roomSubscribers.get(roomId).add(callback);
    this.joinRoom(roomId);
    return () => {
      const cbs = this.roomSubscribers.get(roomId);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) this.leaveRoom(roomId);
      }
    };
  }

  subscribeToMessages(roomId, callback) {
    if (!this.messageSubscribers.has(roomId)) {
      this.messageSubscribers.set(roomId, new Set());
    }
    this.messageSubscribers.get(roomId).add(callback);
    return () => {
      const cbs = this.messageSubscribers.get(roomId);
      if (cbs) cbs.delete(callback);
    };
  }

  isOnline() {
    return openWASocketService.isConnected;
  }

  destroy() {
    this.rooms = [];
    this.messages.clear();
    this.typingUsers.clear();
    this.roomSubscribers.clear();
    this.messageSubscribers.clear();
    this._listenersAttached = false;
  }

  _upsertMessage(roomId, message) {
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, []);
    }
    const list = this.messages.get(roomId);
    const idx = list.findIndex(m => m.id === message.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...message };
    } else {
      list.push(message);
    }
    this._notifyMessageSubscribers(roomId, message);
  }

  _updateMessageStatus(roomId, messageId, status) {
    const list = this.messages.get(roomId) || [];
    const msg = list.find(m => m.id === messageId);
    if (msg) {
      msg.status = status;
      this._notifyMessageSubscribers(roomId, msg);
    }
  }

  _removeMessage(roomId, messageId) {
    const list = this.messages.get(roomId) || [];
    const idx = list.findIndex(m => m.id === messageId);
    if (idx >= 0) {
      list.splice(idx, 1);
      this._notifyMessageSubscribers(roomId, { type: 'remove', id: messageId });
    }
  }

  _notifyMessageSubscribers(roomId, message) {
    const cbs = this.messageSubscribers.get(roomId);
    if (cbs) cbs.forEach(cb => { try { cb(message); } catch (e) { console.error('Message subscriber error:', e); } });
  }

  _notifyRoomSubscribers(roomId) {
    const cbs = this.roomSubscribers.get(roomId);
    const room = this.getRoom(roomId);
    if (cbs && room) cbs.forEach(cb => { try { cb(room); } catch (e) { console.error('Room subscriber error:', e); } });
  }
}

const chatService = new ChatService();
export default chatService;
