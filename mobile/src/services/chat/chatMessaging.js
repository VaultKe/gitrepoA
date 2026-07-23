import websocketService from '../websocket';

export function attachMessaging(prototype) {
  prototype._getRoomsViaWebSocket = async function(forceRefresh = false) {
    if (!websocketService.isConnected) {
      throw new Error('WebSocket not connected');
    }
    const response = await websocketService.sendRequest({
      type: 'get_rooms',
      forceRefresh,
    }, 8000);
    this._updateRooms(response.data || []);
    return response.data || [];
  };

  prototype._getRoomsViaRest = async function(forceRefresh = false) {
    const ApiService = (await import('../api')).default;
    let rooms = [];

    try {
      const response = await ApiService.makeRequest('/chat/rooms');
      if (response.success) {
        rooms = response.data || [];
        this.rooms.clear();
        this._updateRooms(rooms);
      }
    } catch (e) {
      console.warn('REST getRooms failed:', e.message);
    }

    if (rooms.length === 0) {
      return Array.from(this.rooms.values());
    }

    return rooms;
  };

  prototype.getMessages = async function(roomId, limit = 50, offset = 0, beforeMessageId) {
    try {
      if (websocketService.isConnected) {
        const response = await websocketService.sendRequest({
          type: 'get_messages',
          roomId,
          limit,
          offset,
          before: beforeMessageId || undefined,
        });
        this._updateMessages(roomId, response.data || []);
        return this.messages.get(roomId) || [];
      }
      throw new Error('WebSocket not connected');
    } catch (error) {
      try {
        const ApiService = (await import('../api')).default;
        const params = new URLSearchParams({ limit: String(limit) });
        if (beforeMessageId) {
          params.set('before', beforeMessageId);
        }
        const response = await ApiService.makeRequest(`/chat/rooms/${roomId}/messages?${params.toString()}`);
        if (response.success) {
          this._updateMessages(roomId, response.data || []);
          return this.messages.get(roomId) || [];
        }
      } catch (restErr) {
        console.error('getMessages REST error:', restErr);
      }
      console.error('getMessages error:', error);
      return (this.messages.get(roomId) || []).slice(-limit);
    }
  };

  prototype.getRoomMessages = function(roomId) {
    return this.messages.get(roomId) || [];
  };

  prototype.sendMessage = async function(roomId, content, type = 'text', metadata = {}) {
    const tempId = this._generateTempId();
    const replyToId = metadata.replyToId;

    const optimisticMessage = {
      id: tempId,
      tempId,
      roomId,
      content,
      type,
      metadata,
      ...(replyToId && { replyToId }),
      ...(metadata.replyToData && { replyTo: metadata.replyToData }),
      status: 'sending',
      createdAt: Date.now(),
      senderId: await this._getCurrentUserId(),
    };

    this._addMessage(roomId, optimisticMessage);
    this.pendingMessages.set(tempId, optimisticMessage);
    this._notifyMessageSubscribers(roomId, optimisticMessage);

    try {
      const message = {
        type: 'send_message',
        roomId,
        content,
        messageType: type,
        metadata: { ...metadata, replyToId },
        clientMessageId: tempId,
      };

      if (websocketService.isConnected) {
        try {
          const response = await websocketService.sendRequest(message, 15000);
          this._reconcileSentMessage(roomId, tempId, response.data);
          return response.data;
        } catch (wsErr) {
          if (this.pendingMessages.has(tempId)) {
            throw wsErr;
          }
          return;
        }
      }

      const ApiService = (await import('../api')).default;
      const restResp = await ApiService.makeRequest(`/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        body: { content, type, replyToId, metadata: { ...metadata, replyToId } },
      });
      if (restResp.success) {
        this._reconcileSentMessage(roomId, tempId, restResp.data);
        return restResp.data;
      }
      throw new Error(restResp.error || 'Failed to send message');
    } catch (error) {
      console.error('sendMessage error:', error);
      this.pendingMessages.delete(tempId);
      this._updateMessageStatus(roomId, tempId, 'failed', error.message);
      this._removeMessage(roomId, tempId);
      throw error;
    }
  };

  prototype.sendImage = async function(roomId, imageUri, caption = '') {
    try {
      const metadata = {
        imageUri,
        type: 'image',
        size: await this._getImageSize(imageUri),
      };

      return await this.sendMessage(roomId, caption, 'image', metadata);
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };

  prototype.markMessageAsRead = async function(roomId, messageId) {
    try {
      const payload = { type: 'mark_read', roomId, messageId };
      if (websocketService.isConnected) {
        await websocketService.sendRequest(payload, 5000).catch(() => {});
      } else {
        await websocketService.send(payload);
      }

      this._markAsRead(roomId, messageId);
    } catch (error) {
      console.error('Mark read error:', error);
    }
  };

  prototype.markRoomAsRead = async function(roomId) {
    const roomMessages = this.messages.get(roomId) || [];
    const unread = roomMessages.filter(m => !m.isRead);

    await Promise.all(
      unread.map(m => this.markMessageAsRead(roomId, m.id))
    );
  };

  prototype.deleteMessage = async function(roomId, messageId) {
    try {
      websocketService.send({
        type: 'delete_message',
        roomId,
        messageId,
      });

      this._removeMessage(roomId, messageId);
    } catch (error) {
      console.error('deleteMessage error:', error);
      throw error;
    }
  };

  // ==================== Event Handlers ====================

  prototype._handleNewMessage = function(message) {
    const { roomId, data } = message;
    if (!roomId || !data) return;

    data.createdAt = this._toEpochMs(data.createdAt);
    data.metadata = this._normalizeMetadata(data.metadata);

    const pendingTempId = data.clientMessageId || data.id;
    const pending = this.pendingMessages.get(pendingTempId);

    if (pending) {
      if (data.id) this.processedMessageIds.add(data.id);
      data.status = 'delivered';
      const hasImageInData = data.metadata?.imageUri || data.metadata?.imageUrl || data.imageUrl;
      if (!hasImageInData) {
        const pendingImageUrl = pending.metadata?.imageUrl || pending.metadata?.imageUri;
        if (pendingImageUrl) {
          data.metadata = { ...data.metadata, imageUrl: pendingImageUrl };
        }
      }
      if (data.imageUrl && !data.metadata?.imageUri && !data.metadata?.imageUrl) {
        data.metadata = { ...data.metadata, imageUrl: data.imageUrl };
        delete data.imageUrl;
      }
      this._updateMessage(roomId, pendingTempId, data);
      this.pendingMessages.delete(pendingTempId);
      const merged = (this.messages.get(roomId) || []).find(
        m => m.tempId === pendingTempId || m.id === pendingTempId
      );
      this._notifyMessageSubscribers(roomId, merged || data);
      return;
    } else if (!this.processedMessageIds.has(data.id)) {
      this.processedMessageIds.add(data.id);

      if (this.processedMessageIds.size > 10000) {
        const toRemove = Array.from(this.processedMessageIds).slice(0, 1000);
        toRemove.forEach(id => this.processedMessageIds.delete(id));
      }

      data.status = 'delivered';
      if (data.imageUrl && !data.metadata?.imageUri && !data.metadata?.imageUrl) {
        data.metadata = { ...data.metadata, imageUrl: data.imageUrl };
        delete data.imageUrl;
      }
      this._addMessage(roomId, data);
    }

    this._notifyMessageSubscribers(roomId, data);
  };

  prototype._reconcileSentMessage = function(roomId, tempId, serverData) {
    if (!roomId || !serverData) return;

    const data = { ...serverData };
    data.createdAt = this._toEpochMs(data.createdAt);
    data.metadata = this._normalizeMetadata(data.metadata);
    data.status = 'delivered';

    const pending = this.pendingMessages.get(tempId);
    const hasImageInData = data.metadata?.imageUri || data.metadata?.imageUrl || data.imageUrl;
    if (!hasImageInData && pending) {
      const pendingImageUrl = pending.metadata?.imageUrl || pending.metadata?.imageUri;
      if (pendingImageUrl) {
        data.metadata = { ...data.metadata, imageUrl: pendingImageUrl };
      }
    }
    if (data.imageUrl && !data.metadata?.imageUri && !data.metadata?.imageUrl) {
      data.metadata = { ...data.metadata, imageUrl: data.imageUrl };
      delete data.imageUrl;
    }

    if (data.id) this.processedMessageIds.add(data.id);

    this._updateMessage(roomId, tempId, data);
    this.pendingMessages.delete(tempId);

    const merged = (this.messages.get(roomId) || []).find(
      m => m.tempId === tempId || m.id === data.id
    );
    this._notifyMessageSubscribers(roomId, merged || data);
  };

  prototype._handleDelivered = function(message) {
    const { roomId, data } = message;
    this._updateMessageStatus(roomId, data.messageId, 'delivered');
  };

  prototype._handleRead = function(message) {
    const { roomId, data } = message;
    this._updateMessageStatus(roomId, data.messageId, 'read');
    this._markAsRead(roomId, data.messageId, data.userId);
  };

  prototype._handleTyping = function(message) {
    const { roomId, data } = message;
    if (!this.typingUsers.has(roomId)) {
      this.typingUsers.set(roomId, new Set());
    }
    const typingSet = this.typingUsers.get(roomId);

    if (data.isTyping) {
      typingSet.add(data.userId);
    } else {
      typingSet.delete(data.userId);
    }

    this._notifyTypingSubscribers(roomId);
  };

  prototype._handleError = function(message) {
    const { roomId, data } = message;
    console.error(`Chat error in room ${roomId}:`, data.error);

    if (data.code === 'MESSAGE_FAILED') {
      const { messageId, error } = data;
      this._updateMessageStatus(roomId, messageId, 'failed', error);
    }
  };

  prototype._handleRoomUpdate = function(message) {
    const { roomId, data } = message;
    this._updateRoom(data);
    this._notifyRoomSubscribers(roomId);
  };

  prototype._handleRoomMembers = function(message) {
    const { roomId, data } = message;
    const room = this.rooms.get(roomId);
    if (room) {
      room.members = data.members || [];
      room.memberCount = room.members.length;
      this._notifyRoomSubscribers(roomId);
    }
  };

  prototype._handleDeleted = function(message) {
    const { roomId, data } = message;
    if (!roomId || !data) return;
    const messageId = data.messageId || data.id;
    if (!messageId) return;
    this._removeMessage(roomId, messageId);
    this.processedMessageIds.delete(messageId);
  };

  // ==================== Mutation Helpers ====================

  prototype._updateRooms = function(rooms) {
    rooms.forEach(room => this._updateRoom(room));
  };

  prototype._updateRoom = function(room) {
    this.rooms.set(room.id, {
      ...room,
      lastMessageAt: new Date(room.lastMessageAt || Date.now()),
    });
    this._schedulePersist();
  };

  prototype._updateMessages = function(roomId, messages) {
    const existing = this.messages.get(roomId) || [];
    const existingIds = new Set(existing.map(m => m.id));

    const normalizedMessages = messages.map(m => {
      const createdAt = this._toEpochMs(m.createdAt);
      const metadata = this._normalizeMetadata(m.metadata);
      if (m.imageUrl && !metadata.imageUri && !metadata.imageUrl) {
        return { ...m, createdAt, metadata: { ...metadata, imageUrl: m.imageUrl }, imageUrl: undefined };
      }
      return { ...m, createdAt, metadata };
    });

    const serverIds = new Set();
    const serverClientMessageIds = new Set();
    normalizedMessages.forEach(m => {
      if (m.id) serverIds.add(m.id);
      if (m.clientMessageId) serverClientMessageIds.add(m.clientMessageId);
    });

    const filteredExisting = existing.filter(m => {
      if (!m.tempId || m.tempId === m.id) return true;
      if (serverIds.has(m.id)) return false;
      if (serverClientMessageIds.has(m.tempId)) return false;
      return m.status === 'sending';
    });

    const newMessages = normalizedMessages.filter(m => !existingIds.has(m.id));

    const combined = [...filteredExisting, ...newMessages].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    this.messages.set(roomId, combined);
    this._schedulePersist();
  };

  prototype._addMessage = function(roomId, message) {
    const roomMessages = this.messages.get(roomId) || [];
    roomMessages.push(message);
    roomMessages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    this.messages.set(roomId, roomMessages);
    this._schedulePersist();
  };

  prototype._removeMessage = function(roomId, tempOrId) {
    const roomMessages = this.messages.get(roomId) || [];
    const filtered = roomMessages.filter(m => m.tempId !== tempOrId && m.id !== tempOrId);
    this.messages.set(roomId, filtered);
    this._notifySubscribersOfRemoval(roomId, tempOrId);
  };

  prototype._updateMessage = function(roomId, tempOrId, updates) {
    const messages = this.messages.get(roomId) || [];
    const index = messages.findIndex(m => m.tempId === tempOrId || m.id === tempOrId);
    if (index !== -1) {
      const existingMessage = messages[index];
      const mergedMetadata = updates.metadata
        ? { ...existingMessage.metadata, ...updates.metadata }
        : existingMessage.metadata;
      messages[index] = { ...existingMessage, ...updates, metadata: mergedMetadata, type: updates.type || existingMessage.type };
      if (updates.tempId !== undefined) {
        messages[index].tempId = updates.tempId;
      }
      this.messages.set(roomId, messages);
    }
  };

  prototype._updateMessageStatus = function(roomId, messageId, status, error = null) {
    const messages = this.messages.get(roomId) || [];
    const message = messages.find(m => m.id === messageId || m.tempId === messageId);
    if (message) {
      message.status = status;
      if (error) message.error = error;
      this._notifyMessageSubscribers(roomId, message);
    }
  };

  prototype._markAsRead = function(roomId, messageId, userId = null) {
    if (!this.readReceipts.has(roomId)) {
      this.readReceipts.set(roomId, new Set());
    }
    this.readReceipts.get(roomId).add(messageId);
    this._notifyRoomSubscribers(roomId);
  };

  // ==================== Subscriber Notification ====================

  prototype._addRoomSubscriber = function(roomId) {
    if (!this.roomSubscribers.has(roomId)) {
      this.roomSubscribers.set(roomId, new Set());
    }
  };

  prototype._removeRoomSubscriber = function(roomId) {
    const callbacks = this.roomSubscribers.get(roomId);
    if (callbacks && callbacks.size === 0) {
      this.roomSubscribers.delete(roomId);
    }
  };

  prototype._notifyRoomSubscribers = function(roomId) {
    const callbacks = this.roomSubscribers.get(roomId);
    const room = this.rooms.get(roomId);
    if (callbacks && room) {
      callbacks.forEach(cb => {
        try {
          cb(room);
        } catch (err) {
          console.error('Room subscriber error:', err);
        }
      });
    }
  };

  prototype._notifyMessageSubscribers = function(roomId, message) {
    const callbacks = this.messageSubscribers.get(roomId);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(message);
        } catch (err) {
          console.error('Message subscriber error:', err);
        }
      });
    }
  };

  prototype._notifySubscribersOfRemoval = function(roomId, messageId) {
    const callbacks = this.messageSubscribers.get(roomId);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb({ type: 'remove', id: messageId });
        } catch (err) {
          console.error('Removal subscriber error:', err);
        }
      });
    }
  };

  prototype._notifyTypingSubscribers = function(roomId) {
    const callbacks = this.messageSubscribers.get(roomId);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb({ type: 'typing', users: this.typingUsers.get(roomId) || new Set() });
        } catch (err) {
          console.error('Typing subscriber error:', err);
        }
      });
    }
  };

  // ==================== Utilities ====================

  prototype._toEpochMs = function(value) {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number') return value;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? Date.now() : parsed;
  };

  prototype._normalizeMetadata = function(value) {
    if (value === null || value === undefined) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return {};
      try {
        const parsed = JSON.parse(s);
        return (parsed && typeof parsed === 'object') ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  };

  prototype._generateTempId = function() {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  prototype._generateRequestId = function() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  prototype._getCurrentUserId = async function() {
    try {
      const userDataJson = await AsyncStorage.getItem('userData');
      if (userDataJson) {
        const userData = JSON.parse(userDataJson);
        if (userData && userData.id) {
          return userData.id;
        }
      }
      return 'anonymous';
    } catch (e) {
      console.error('Failed to get user ID:', e);
      return 'anonymous';
    }
  };

  prototype._getImageSize = function(uri) {
    return new Promise((resolve) => {
      if (uri.startsWith('data:')) {
        const base64Data = uri.split(',')[1];
        const size = Math.ceil(base64Data.length * 0.75);
        resolve(size);
      } else {
        resolve(0);
      }
    });
  };
}
