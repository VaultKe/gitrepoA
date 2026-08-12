/**
 * Chat Endpoints - Unified WebSocket-based API
 *
 * All operations now use ChatService (WebSocket) for real-time communication.
 * Business logic fully handled by backend.
 */

import chatService from '../chat/ChatService';
import { makeRequest } from './client';

// ==================== Room Operations ====================

/**
 * Get all chat rooms for the authenticated user
 */
export const getChatRooms = async () => {
  try {
    const rooms = await chatService.getRooms();
    return { success: true, data: rooms };
  } catch (error) {
    console.error('getChatRooms error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a single chat room
 */
export const getChatRoom = async (roomId) => {
  try {
    const room = await chatService.getRoom(roomId);
    return { success: true, data: room };
  } catch (error) {
    console.error('getChatRoom error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a new chat room (private, group, chama, support)
 */
export const createChatRoom = async (roomData) => {
  try {
    const room = await chatService.createRoom(roomData);
    return { success: true, data: room };
  } catch (error) {
    console.error('createChatRoom error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Join a chat room (subscribe to updates)
 */
export const joinChatRoom = async (roomId) => {
  try {
    await chatService.joinRoom(roomId);
    return { success: true };
  } catch (error) {
    console.error('joinChatRoom error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== Message Operations ====================

/**
 * Get messages for a room
 */
export const getChatMessages = async (roomId, limit = 50, offset = 0, beforeMessageId) => {
  try {
    const messages = await chatService.getMessages(roomId, limit, offset, beforeMessageId);
    return { success: true, data: messages };
  } catch (error) {
    console.error('getChatMessages error:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Send a text message
 */
export const sendMessage = async (roomId, messageData) => {
   try {
     const message = await chatService.sendMessage(
       roomId,
       messageData.content,
       messageData.type || 'text',
       messageData.metadata || {}
     );
     return { success: true, data: message };
   } catch (error) {
     console.error('[WS DEBUG] sendMessage API error:', error);
     return { success: false, error: error.message };
   }
 };

/**
 * Upload image for chat messages
 */
export const uploadChatImage = async (imageUri) => {
  try {
    const formData = new FormData();
    if (imageUri) {
      const filename = imageUri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('image', {
        uri: imageUri,
        name: filename,
        type: type,
      });
    }
    
    const result = await makeRequest('/wa/chat/upload/image', {
      method: 'POST',
      body: formData,
    });
    return result;
  } catch (error) {
    console.error('uploadChatImage error:', error);
    throw error;
  }
};

/**
 * Mark a message as read
 */
export const markMessageAsRead = async (roomId, messageId) => {
  try {
    await chatService.markMessageAsRead(roomId, messageId);
    return { success: true };
  } catch (error) {
    console.error('markMessageAsRead error:', error);
    return { success: false, error: error.message };
  }
};

// ==================== Room Members ====================

/**
 * Get room members (still using REST as it's a one-time fetch)
 */
export const getChatRoomMembers = async (roomId) => {
  try {
    return await makeRequest(`/wa/chat/rooms/${roomId}/members`);
  } catch (error) {
    console.error('getChatRoomMembers error:', error);
    return { success: false, error: error.message, data: [] };
  }
};

// ==================== Room Management ====================

export const getChatRoomDetails = async (roomId) => {
  try {
    const room = await chatService.getRoom(roomId);
    return { success: true, data: room };
  } catch (error) {
    console.error('getChatRoomDetails error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteChatRoom = async (roomId) => {
  try {
    await chatService.leaveRoom(roomId);
    // Remove from local cache so it disappears from the list immediately.
    const room = chatService.getRoom(roomId);
    if (room) {
      chatService._updateRoom({ ...room, isActive: false });
    }
    return { success: true };
  } catch (error) {
    console.error('deleteChatRoom error:', error);
    return { success: false, error: error.message };
  }
};

export const clearChatRoom = async (roomId) => {
  // Clear local message cache for the room.
  try {
    chatService.messages.set(roomId, []);
    chatService._schedulePersist();
    return { success: true };
  } catch (error) {
    console.error('clearChatRoom error:', error);
    return { success: false, error: error.message };
  }
};
