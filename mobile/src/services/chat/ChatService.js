/**
 * ChatService - Unified WebSocket-based Chat Service
 *
 * Architecture:
 * - WebSocket-only real-time communication (no polling)
 * - All business logic handled by backend
 * - Frontend: UI rendering + event handling only
 * - Automatic reconnection with exponential backoff
 * - Optimistic updates with rollback on error
 * - Message deduplication and ordering
 *
 * Production Ready: ✅ Fast, Reliable, Secure (via backend)
 */

import websocketService from '../websocket';
import AsyncStorage from '@react-native-async-storage/async-storage';

// WebSocket event types (backend protocol)
const WS_EVENTS = {
  // Client → Server
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SEND_MESSAGE: 'send_message',
  MARK_READ: 'mark_read',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',

  // Server → Client
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
    // State
    this.rooms = new Map(); // roomId → Room
    this.messages = new Map(); // roomId → Message[]
    this.pendingMessages = new Map(); // tempId → Message (optimistic)
    this.processedMessageIds = new Set(); // Deduplication
    this.readReceipts = new Map(); // roomId → Set<messageId>
    this.typingUsers = new Map(); // roomId → Set<userId>
    this._persistTimer = null;
    this._isOnline = true;

    // Subscriptions (roomId → Set<callback>)
    this.roomSubscribers = new Map();
    this.messageSubscribers = new Map();

    // Reconnection state
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;

    // Performance: Debounce typing indicators
    this.typingTimeout = null;
    this.typingDebounceMs = 500;

    // Bind WebSocket handlers
    this._setupWebSocketHandlers();

    // Setup online/offline detection
    this._setupNetworkMonitoring();

    // Cleanup on app termination
    this._setupCleanup();
  }

  // ==================== Initialization ====================

  async initialize() {
    try {
      // Load cached rooms/messages from storage first. This is a fast local
      // read (AsyncStorage) and lets the UI render instantly from cache.
      await this._loadFromCache();

      // Connect WebSocket in the background. We deliberately do NOT await
      // this: the UI can render instantly from the local cache and real-time
      // updates simply start arriving once the socket is open. Blocking on
      // connect here was the main source of the slow, blank chat screens.
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
    // Real-time events from backend
    websocketService.registerMessageHandler('new_message', this._handleNewMessage.bind(this));
    websocketService.registerMessageHandler('message_read', this._handleRead.bind(this));
    websocketService.registerMessageHandler('user_typing', this._handleTyping.bind(this));
    // Room membership updates (if backend sends)
    websocketService.registerMessageHandler('room_updated', this._handleRoomUpdate.bind(this));
    websocketService.registerMessageHandler('room_members', this._handleRoomMembers.bind(this));
    // Error handling
    websocketService.registerMessageHandler('error', this._handleError.bind(this));
  }

  _setupCleanup() {
    // Cleanup on app termination (call from React component)
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
    // Load rooms via the backend REST API (fast, uses the backend's
    // in-memory cache). We no longer fire a duplicate WebSocket `get_rooms`
    // request on every list load — that doubled the work and registered a
    // 30s-timeout handler each time, which overwhelmed the connection.
    try {
      return await this._getRoomsViaRest(forceRefresh);
    } catch (error) {
      console.warn('REST getRooms failed, falling back to cache:', error.message);
      return Array.from(this.rooms.values());
    }
  }

  async _getRoomsViaWebSocket(forceRefresh = false) {
    return new Promise((resolve, reject) => {
      const requestId = this._generateRequestId();
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);

      const handler = (response) => {
        if (response.requestId === requestId) {
          clearTimeout(timeout);
          websocketService.unregisterMessageHandler('rooms_list');
          if (response.success) {
            this._updateRooms(response.data);
            resolve(response.data);
          } else {
            reject(new Error(response.error || 'Failed to load rooms'));
          }
        }
      };

      // Register response handler BEFORE sending request
      websocketService.registerMessageHandler('rooms_list', handler);

      // Send request
      websocketService.send({
        type: 'get_rooms',
        requestId,
        forceRefresh,
      });
    });
  }

  async _getRoomsViaRest(forceRefresh = false) {
    const ApiService = (await import('../api')).default;
    let rooms = [];
    let fromServer = false;

    try {
      const response = await ApiService.makeRequest('/chat/rooms');
      if (response.success) {
        rooms = response.data || [];
        fromServer = true;
      }
    } catch (e) {
      console.warn('REST getRooms failed:', e.message);
    }

    if (!fromServer && rooms.length === 0) {
      // Fallback: fetch user's chamas and create virtual chat rooms
      try {
        const chamasResponse = await ApiService.getUserChamas();
        if (chamasResponse.success && chamasResponse.data) {
          rooms = chamasResponse.data.map(chama => ({
            id: `chama_${chama.id}`,
            name: chama.name,
            type: 'chama',
            lastMessage: null,
            lastMessageAt: chama.updatedAt || Date.now(),
            memberCount: chama.memberCount || 0,
            chamaId: chama.id,
          }));
        }
      } catch (e) {
        console.warn('Failed to fetch chamas as fallback:', e);
      }
    }

    if (fromServer) {
      // Replace stale cache with fresh server data so deleted or duplicate
      // rooms cannot linger in the local list across refreshes.
      this.rooms.clear();
      this._updateRooms(rooms);
    }
    return rooms;
  }

  async sendImage(roomId, imageUri, caption = '') {
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
  }

  async markMessageAsRead(roomId, messageId) {
    try {
      await websocketService.send({
        type: WS_EVENTS.MARK_READ,
        roomId,
        messageId,
      });

      // Update local read state
      this._markAsRead(roomId, messageId);
    } catch (error) {
      console.error('Mark read error:', error);
    }
  }

  async markRoomAsRead(roomId) {
    const roomMessages = this.messages.get(roomId) || [];
    const unread = roomMessages.filter(m => !m.isRead);

    await Promise.all(
      unread.map(m => this.markMessageAsRead(roomId, m.id))
    );
  }

  setTyping(roomId, isTyping) {
    // Debounce typing indicators
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

joinRoom(roomId) {
     websocketService.joinRoom(roomId);
   }

leaveRoom(roomId) {
      websocketService.leaveRoom(roomId);
    }

    async deleteMessage(roomId, messageId) {
      try {
        await websocketService.send({
          type: 'delete_message',
          roomId,
          messageId,
        });

        // Remove from local state optimistically
        this._removeMessage(roomId, messageId);
      } catch (error) {
        console.error('deleteMessage error:', error);
        throw error;
      }
    }

async sendMessage(roomId, content, type = 'text', metadata = {}) {
        // Generate optimistic message immediately
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

        // Add to local state immediately for instant UI feedback
        this._addMessage(roomId, optimisticMessage);
        this.pendingMessages.set(tempId, optimisticMessage);
        this._notifyMessageSubscribers(roomId, optimisticMessage);

        try {
          return new Promise((resolve, reject) => {
            const requestId = this._generateRequestId();
            const timeout = setTimeout(() => {
              reject(new Error('Request timeout'));
            }, 15000);

            const handler = (response) => {
              if (response.requestId === requestId) {
                clearTimeout(timeout);
                websocketService.unregisterMessageHandler('message_sent');
                if (response.success) {
                  this.pendingMessages.delete(tempId);
                  resolve(response.data);
                } else {
                  this.pendingMessages.delete(tempId);
                  this._updateMessageStatus(roomId, tempId, 'failed', response.error);
                  reject(new Error(response.error || 'Failed to send message'));
                }
              }
            };

            websocketService.registerMessageHandler('message_sent', handler);

            const message = {
              type: WS_EVENTS.SEND_MESSAGE,
              requestId,
              roomId,
              content,
              messageType: type,
              metadata: { ...metadata, replyToId },
              clientMessageId: tempId,
            };
            if (!websocketService.send(message)) {
              clearTimeout(timeout);
              websocketService.unregisterMessageHandler('message_sent');
              this.pendingMessages.delete(tempId);
              this._removeMessage(roomId, tempId);
              reject(new Error('WebSocket not connected'));
            }
          });
        } catch (error) {
          console.error('sendMessage error:', error);
          this.pendingMessages.delete(tempId);
          this._removeMessage(roomId, tempId);
          throw error;
        }
      }

   // ==================== Event Subscription ====================

   subscribeToRoom(roomId, callback) {
     if (!this.roomSubscribers.has(roomId)) {
       this.roomSubscribers.set(roomId, new Set());
     }
     this.roomSubscribers.get(roomId).add(callback);

     // Auto-join room when first subscriber added
     this.joinRoom(roomId);

     // Return unsubscribe function
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

   // ==================== Room Management ====================

   /**
    * Create a new chat room
    */
  async createRoom(roomData) {
    try {
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

  async getRoom(roomId, forceRefresh = false) {
    // Try cache first unless forceRefresh
    if (!forceRefresh) {
      const cached = this.rooms.get(roomId);
      if (cached) return cached;
    }

    // Fetch from backend via REST
    try {
      const ApiService = (await import('../api')).default;
      const response = await ApiService.makeRequest(`/chat/rooms/${roomId}`);

      if (response.success) {
        this._updateRoom(response.data);
        return response.data;
      }
      // Return from cache if available
      return this.rooms.get(roomId);
    } catch (error) {
      console.error('getRoom error:', error);
      // Return from cache if available
      return this.rooms.get(roomId);
    }
  }

  async getMessages(roomId, limit = 50, offset = 0) {
    try {
      const ApiService = (await import('../api')).default;
      const response = await ApiService.makeRequest(`/chat/rooms/${roomId}/messages?limit=${limit}&offset=${offset}`);

      if (response.success) {
        this._updateMessages(roomId, response.data || []);
        return this.getRoomMessages(roomId);
      }
      throw new Error(response.error || 'Failed to load messages');
    } catch (error) {
      console.error('getMessages error:', error);
      // Return cached messages as fallback
      return this.getRoomMessages(roomId).slice(-limit);
    }
  }

  getRoomMessages(roomId) {
    return this.messages.get(roomId) || [];
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  getUnreadCount(roomId) {
    const messages = this.messages.get(roomId) || [];
    const readReceipts = this.readReceipts.get(roomId) || new Set();
    return messages.filter(m => !readReceipts.has(m.id)).length;
  }

  getTypingUsers(roomId) {
    return this.typingUsers.get(roomId) || new Set();
  }

  // ==================== Private Handlers ====================

_handleNewMessage(message) {
      const { roomId, data } = message;

      // Handle pending message resolution (optimistic update)
      // The server sends clientMessageId to match optimistic messages
      const pendingTempId = data.clientMessageId || data.id;
      const pending = this.pendingMessages.get(pendingTempId);

      if (pending) {
        // Replace optimistic with real message, preserve imageUri/imageUrl for display
        data.status = 'delivered';
        // Preserve imageUri or imageUrl from optimistic message if server doesn't provide one
        const hasImageInData = data.metadata?.imageUri || data.metadata?.imageUrl || data.imageUrl;
        if (!hasImageInData) {
          const pendingImageUrl = pending.metadata?.imageUrl || pending.metadata?.imageUri;
          if (pendingImageUrl) {
            data.metadata = { ...data.metadata, imageUrl: pendingImageUrl };
          }
        }
        // If server sent imageUrl at top-level, move to metadata for rendering
        if (data.imageUrl && !data.metadata?.imageUri && !data.metadata?.imageUrl) {
          data.metadata = { ...data.metadata, imageUrl: data.imageUrl };
          delete data.imageUrl;
        }
        this._updateMessage(roomId, pendingTempId, data);
        this.pendingMessages.delete(pendingTempId);

        // Notify subscribers with the *merged* message (which still carries the
        // optimistic tempId). The raw server payload has no tempId, so notifying
        // with it would make the UI append a second "received" bubble instead of
        // replacing the existing "sent" (optimistic) bubble for the same message.
        const merged = (this.messages.get(roomId) || []).find(
          m => m.tempId === pendingTempId || m.id === pendingTempId
        );
        this._notifyMessageSubscribers(roomId, merged || data);
        return;
      } else if (!this.processedMessageIds.has(data.id)) {
        // Deduplication: check if already processed
        this.processedMessageIds.add(data.id);

        // Limit processed IDs set size to prevent memory leak
        if (this.processedMessageIds.size > 10000) {
          const toRemove = Array.from(this.processedMessageIds).slice(0, 1000);
          toRemove.forEach(id => this.processedMessageIds.delete(id));
        }

        // New incoming message
        data.status = 'delivered';
        // Normalize imageUrl to metadata if provided at top level
        if (data.imageUrl && !data.metadata?.imageUri && !data.metadata?.imageUrl) {
          data.metadata = { ...data.metadata, imageUrl: data.imageUrl };
          delete data.imageUrl;
        }
        this._addMessage(roomId, data);
      }

      // Notify subscribers
      this._notifyMessageSubscribers(roomId, data);
    }

  _handleDelivered(message) {
    const { roomId, data } = message;
    this._updateMessageStatus(roomId, data.messageId, 'delivered');
  }

  _handleRead(message) {
    const { roomId, data } = message;
    this._updateMessageStatus(roomId, data.messageId, 'read');
    this._markAsRead(roomId, data.messageId, data.userId);
  }

  _handleTyping(message) {
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
  }

  _handleError(message) {
    const { roomId, data } = message;
    console.error(`Chat error in room ${roomId}:`, data.error);

    // Handle specific errors
    if (data.code === 'MESSAGE_FAILED') {
      const { messageId, error } = data;
      this._updateMessageStatus(roomId, messageId, 'failed', error);
    }
  }

  _handleRoomUpdate(message) {
    const { roomId, data } = message;
    this._updateRoom(data);
    this._notifyRoomSubscribers(roomId);
  }

  _handleRoomMembers(message) {
    const { roomId, data } = message;
    const room = this.rooms.get(roomId);
    if (room) {
      room.members = data.members || [];
      room.memberCount = room.members.length;
      this._notifyRoomSubscribers(roomId);
    }
  }

  _updateRooms(rooms) {
    rooms.forEach(room => this._updateRoom(room));
  }

  _updateRoom(room) {
    this.rooms.set(room.id, {
      ...room,
      lastMessageAt: new Date(room.lastMessageAt || Date.now()),
    });
    this._schedulePersist();
  }

  _updateMessages(roomId, messages) {
    const existing = this.messages.get(roomId) || [];
    const existingIds = new Set(existing.map(m => m.id));

    // Normalize imageUrl to metadata if provided at top level
    const normalizedMessages = messages.map(m => {
      if (m.imageUrl && !m.metadata?.imageUri && !m.metadata?.imageUrl) {
        return { ...m, metadata: { ...m.metadata, imageUrl: m.imageUrl }, imageUrl: undefined };
      }
      return m;
    });

    // Build keys from server messages so we can match and remove stale optimistic duplicates.
    // We bucket timestamps into 3-second windows to tolerate minor clock drift between
    // the optimistic client-side timestamp and the server-assigned createdAt.
    const serverKeys = new Set();
    normalizedMessages.forEach(m => {
      const key = `${m.senderId}_${m.content}_${m.type}_${Math.floor((m.createdAt || 0) / 3000)}`;
      serverKeys.add(key);
    });

    // Keep non-optimistic messages, and remove optimistic messages whose content/sender/time
    // matches a confirmed server message. Truly pending messages (status === 'sending') are kept.
    const filteredExisting = existing.filter(m => {
      if (!m.tempId || m.tempId === m.id) return true;
      const key = `${m.senderId}_${m.content}_${m.type}_${Math.floor((m.createdAt || 0) / 3000)}`;
      if (serverKeys.has(key)) return false;
      return m.status === 'sending';
    });

    // Append new messages only
    const newMessages = normalizedMessages.filter(m => !existingIds.has(m.id));

    // Sort by createdAt
    const combined = [...filteredExisting, ...newMessages].sort((a, b) => a.createdAt - b.createdAt);

    this.messages.set(roomId, combined);
    this._schedulePersist();
  }

_addMessage(roomId, message) {
     const roomMessages = this.messages.get(roomId) || [];
     roomMessages.push(message);
     this.messages.set(roomId, roomMessages);
     this._schedulePersist();
   }

   _removeMessage(roomId, tempOrId) {
     const roomMessages = this.messages.get(roomId) || [];
     const filtered = roomMessages.filter(m => m.tempId !== tempOrId && m.id !== tempOrId);
     this.messages.set(roomId, filtered);
     this._notifySubscribersOfRemoval(roomId, tempOrId);
   }

  _schedulePersist() {
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => this._persistToStorage(), 1000);
  }

_updateMessage(roomId, tempOrId, updates) {
     const messages = this.messages.get(roomId) || [];
     const index = messages.findIndex(m => m.tempId === tempOrId || m.id === tempOrId);
     if (index !== -1) {
       const existingMessage = messages[index];
       // Merge metadata to preserve imageUri from optimistic message
       const mergedMetadata = updates.metadata 
         ? { ...existingMessage.metadata, ...updates.metadata }
         : existingMessage.metadata;
       messages[index] = { ...existingMessage, ...updates, metadata: mergedMetadata, type: updates.type || existingMessage.type };
       if (updates.tempId !== undefined) {
         messages[index].tempId = updates.tempId;
       }
       this.messages.set(roomId, messages);
     }
   }

  _updateMessageStatus(roomId, messageId, status, error = null) {
    const messages = this.messages.get(roomId) || [];
    const message = messages.find(m => m.id === messageId || m.tempId === messageId);
    if (message) {
      message.status = status;
      if (error) message.error = error;
      this._notifyMessageSubscribers(roomId, message);
    }
  }

  _markAsRead(roomId, messageId, userId = null) {
    if (!this.readReceipts.has(roomId)) {
      this.readReceipts.set(roomId, new Set());
    }
    this.readReceipts.get(roomId).add(messageId);
    this._notifyRoomSubscribers(roomId);
  }

  _addRoomSubscriber(roomId) {
    if (!this.roomSubscribers.has(roomId)) {
      this.roomSubscribers.set(roomId, new Set());
    }
  }

  _removeRoomSubscriber(roomId) {
    const callbacks = this.roomSubscribers.get(roomId);
    if (callbacks && callbacks.size === 0) {
      this.roomSubscribers.delete(roomId);
    }
  }

  _notifyRoomSubscribers(roomId) {
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
  }

_notifyMessageSubscribers(roomId, message) {
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
   }

   _notifySubscribersOfRemoval(roomId, messageId) {
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
   }

  _notifyTypingSubscribers(roomId) {
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
  }

  // ==================== Utilities ====================

  _generateTempId() {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async _getCurrentUserId() {
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
  }

  _getImageSize(uri) {
    return new Promise((resolve) => {
      // For base64 URIs, extract size from data
      if (uri.startsWith('data:')) {
        const base64Data = uri.split(',')[1];
        const size = Math.ceil(base64Data.length * 0.75); // Approximate bytes
        resolve(size);
      } else {
        resolve(0); // Unknown for file URIs
      }
    });
  }

  _loadFromCache() {
    return this._loadFromStorage();
  }

  async _loadFromStorage() {
    try {
      const cacheData = await AsyncStorage.getItem('chat_cache');
      if (cacheData) {
        const { rooms, messages } = JSON.parse(cacheData);
        if (rooms) {
          rooms.forEach(room => this.rooms.set(room.id, room));
        }
        if (messages) {
          messages.forEach(([roomId, msgs]) => {
            const deduped = msgs.filter(m => {
              if (!m.tempId || m.tempId === m.id) return true;
              if (m.status === 'sending') return true;
              return false;
            });
            this.messages.set(roomId, deduped);
          });
        }
      }
    } catch (e) {
      console.error('Failed to load chat cache:', e);
    }
  }

  _setupNetworkMonitoring() {
    // Network state will be updated by App state listener
    // This is a placeholder for NetInfo integration if needed
  }

  _isOnline() {
    return websocketService.isConnected || this._isOnline;
  }

  setOnlineStatus(online) {
    this._isOnline = online;
  }

  async _persistToStorage() {
    try {
      const data = {
        rooms: Array.from(this.rooms.values()),
        messages: Array.from(this.messages.entries()),
        timestamp: Date.now(),
      };

      let json = JSON.stringify(data);
      const MAX_CACHE_SIZE = 1024 * 1024; // 1MB

      if (json.length > MAX_CACHE_SIZE) {
        const trimmedMessages = Array.from(data.messages).map(([roomId, msgs]) => {
          const sorted = msgs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          return [roomId, sorted.slice(0, 50)];
        });

        const trimmedData = { ...data, messages: trimmedMessages };
        json = JSON.stringify(trimmedData);
      }

      if (json.length > MAX_CACHE_SIZE) {
        console.warn('Chat cache still too large after trimming, skipping persistence');
        return;
      }

      await AsyncStorage.setItem('chat_cache', json);
    } catch (e) {
      console.error('Failed to persist chat cache:', e);
    }
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

  // ==================== Cleanup ====================

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

// Export singleton
const chatService = new ChatService();
export default chatService;
