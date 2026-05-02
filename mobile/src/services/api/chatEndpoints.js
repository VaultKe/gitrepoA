/**
 * Chat Endpoints - Unified WebSocket-based API
 *
 * All operations now use ChatService (WebSocket) for real-time communication.
 * Business logic fully handled by backend.
 */

import chatService from '../chat/ChatService';

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
export const getChatMessages = async (roomId, limit = 50, offset = 0) => {
  try {
    const messages = await chatService.getMessages(roomId, limit, offset);
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
    console.error('sendMessage error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send an image message (placeholder - image upload not yet implemented)
 */
export const sendMessageWithImage = async (roomId, messageData) => {
  // TODO: Implement image upload via backend
  console.warn('Image messaging not yet implemented');
  return { success: false, error: 'Image messaging not implemented' };
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
import { makeRequest } from './client';

export const getChatRoomMembers = async (roomId) => {
  try {
    return await makeRequest(`/chat/rooms/${roomId}/members`);
  } catch (error) {
    console.error('getChatRoomMembers error:', error);
    return { success: false, error: error.message, data: [] };
  }
};

// ==================== Room Management ====================

export const getChatRoomDetails = async (roomId) => {
  try {
    const room = await chatService.getRoom(roomId, true);
    return { success: true, data: room };
  } catch (error) {
    console.error('getChatRoomDetails error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteChatRoom = async (roomId) => {
  // Not implemented in WS yet; could use REST fallback
  console.warn('deleteChatRoom not implemented');
  return { success: false, error: 'Not implemented' };
};

export const clearChatRoom = async (roomId) => {
  // Not implemented in WS yet
  console.warn('clearChatRoom not implemented');
  return { success: false, error: 'Not implemented' };
};
