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
      // Resolve session ID for backend REST calls
      if (!openWASocketService.sessionID) {
        console.log('[ChatService] initialize: resolving session ID...');
        const resolved = await openWASocketService.resolveSessionID();
        if (resolved) {
          openWASocketService.sessionID = resolved;
          openWASocketService._sessionResolved = true;
          console.log('[ChatService] initialize: resolved session ID:', resolved);
        } else {
          console.warn('[ChatService] initialize: could not resolve session ID');
        }
      }

      // No socket connection needed; chat uses backend REST only.
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
      // If we don't have a session ID yet, try to resolve one
      if (!openWASocketService.sessionID && openWASocketService.enabled) {
        console.log('[ChatService] getRooms: resolving session ID...');
        const resolved = await openWASocketService.resolveSessionID();
        if (resolved) {
          openWASocketService.sessionID = resolved;
          openWASocketService._sessionResolved = true;
          console.log('[ChatService] getRooms: resolved session ID:', resolved);
        } else {
          console.warn('[ChatService] getRooms: could not resolve session ID');
        }
      }

      if (!openWASocketService.sessionID) {
        console.warn('[ChatService] getRooms: no session ID available');
        return this.rooms;
      }

      console.log('[ChatService] getRooms: fetching chats for session:', openWASocketService.sessionID);
      const payload = await openWASocketService.getChats(openWASocketService.sessionID);
      const chats = Array.isArray(payload?.data) ? payload.data : [];
      console.log('[ChatService] getRooms: received', chats.length, 'chats');
      this.rooms = chats.map(chat => {
        const id = chat.id || chat.chatId || chat.waChatId;
        const name = chat.name || chat.chatName || chat.title || 'Chat';
        const isGroup = chat.isGroup || chat.is_group || false;
        const kind = chat.kind || chat.type || (isGroup ? 'group' : 'private');
        const timestamp = chat.timestamp || chat.lastMessageAt || chat.createdAt;
        return {
          id,
          chatId: id,
          name,
          type: kind,
          isGroup,
          lastMessage: chat.lastMessage || chat.last_message || chat.body || null,
          lastMessageAt: timestamp ? new Date(timestamp).getTime() : Date.now(),
          unreadCount: chat.unreadCount || chat.unread_count || 0,
          ...chat,
        };
      });
      return this.rooms;
    } catch (error) {
      console.warn('[ChatService] getRooms failed:', error.message);
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
    // OpenWA does not need a create-room proxy; chats are created on first send.
    // Return a stub room object for UI compatibility.
    const room = {
      id: roomData.recipientId || roomData.name || `room_${Date.now()}`,
      name: roomData.name || 'New Chat',
      type: roomData.type || 'private',
      chatId: roomData.recipientId || roomData.name,
      lastMessageAt: Date.now(),
    };
    this.rooms.push(room);
    return room;
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
      const data = await openWASocketService.getMessages(openWASocketService.sessionID, roomId, limit, offset);
      const messages = Array.isArray(data?.data) ? data.data : [];
      messages.forEach(m => this._upsertMessage(roomId, m));
      return this.messages.get(roomId) || messages;
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
      const chatId = roomId;
      if (!chatId) throw new Error('Missing chatId');

      if (type === 'image') {
        // For images, we still need the backend upload endpoint because OpenWA
        // expects a URL or base64. Keep the existing upload flow if available.
        const ApiService = (await import('../api')).default;
        const uploadResp = await ApiService.makeRequest('/wa/chat/upload/image', {
          method: 'POST',
          body: { imageUri: metadata.imageUri },
        });
        if (uploadResp.success && uploadResp.data?.url) {
          const response = await openWASocketService.sendTextMessage(openWASocketService.sessionID, chatId, metadata.caption || content);
          if (response?.data) {
            this._upsertMessage(roomId, response.data);
            return response.data;
          }
        }
        throw new Error(uploadResp.error || 'Image upload failed');
      }

      const response = await openWASocketService.sendTextMessage(openWASocketService.sessionID, chatId, content);
      if (response?.data) {
        this._upsertMessage(roomId, response.data);
        return response.data;
      }
      throw new Error('Send message failed');
    } catch (error) {
      console.error('sendMessage error:', error);
      throw error;
    }
  }

  async sendImage(roomId, imageUri, caption = '') {
    return this.sendMessage(roomId, caption, 'image', { imageUri });
  }

  async markMessageAsRead(roomId, messageId) {
    // OpenWA marks entire chats as read, not individual messages.
    await this.markRoomAsRead(roomId);
  }

  async markRoomAsRead(roomId) {
    try {
      await openWASocketService.markChatRead(openWASocketService.sessionID, roomId);
      const roomMessages = this.messages.get(roomId) || [];
      roomMessages.forEach(m => { m.isRead = true; m.status = 'read'; });
      this._notifyMessageSubscribers(roomId, { type: 'room_read', roomId });
    } catch (error) {
      console.error('Mark read error:', error);
    }
  }

  async deleteMessage(roomId, messageId) {
    // OpenWA does not expose per-message delete in the standard REST API.
    // Remove locally to keep UI responsive.
    this._removeMessage(roomId, messageId);
  }

  async setTyping(roomId, isTyping) {
    try {
      await openWASocketService.sendTyping(openWASocketService.sessionID, roomId, isTyping ? 'typing' : 'paused');
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

  _normalizeMessage(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const direction = raw.direction || (raw.from === raw.to ? 'outgoing' : 'incoming');
    const isOwn = direction === 'outgoing';
    const normalized = {
      ...raw,
      content: raw.body ?? raw.content ?? '',
      senderId: isOwn ? 'me' : (raw.from || raw.author || 'them'),
      direction,
      isOwn,
      status: raw.status || (isOwn ? 'sent' : 'received'),
      timestamp: raw.timestamp || (raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now()),
    };
    if (normalized.imageUrl === undefined && raw.mediaPath) {
      normalized.imageUrl = raw.mediaPath;
    }
    if (normalized.metadata && typeof normalized.metadata !== 'object') {
      normalized.metadata = {};
    }
    return normalized;
  }

  _upsertMessage(roomId, message) {
    const normalized = this._normalizeMessage(message);
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, []);
    }
    const list = this.messages.get(roomId);
    const idx = list.findIndex(m => m.id === normalized.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...normalized };
    } else {
      list.push(normalized);
    }
    this._notifyMessageSubscribers(roomId, normalized);
  }
}

const chatService = new ChatService();
export default chatService;
