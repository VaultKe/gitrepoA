import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMeetingApiUrl } from '../services/meetingConfig';

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

let authToken = null;

export const setMeetingAuthToken = async (token) => {
  authToken = token;
  if (token) {
    await AsyncStorage.setItem('meetingAuthToken', token);
  } else {
    await AsyncStorage.removeItem('meetingAuthToken');
  }
};

export const getMeetingAuthToken = async () => {
  if (authToken) return authToken;
  try {
    const stored = await AsyncStorage.getItem('meetingAuthToken');
    if (stored) {
      authToken = stored;
    }
    return authToken;
  } catch (e) {
    return null;
  }
};

export const clearMeetingAuthToken = async () => {
  authToken = null;
  await AsyncStorage.removeItem('meetingAuthToken');
};

// Helper to get the main app auth token directly
const getMainAppAuthToken = async () => {
  try {
    // Try the main app's auth token storage
    const mainToken = await AsyncStorage.getItem('authToken');
    if (mainToken) {
      console.log('[MeetingAPI] Found main app auth token');
      return mainToken;
    }
    
    // Also check userData as fallback
    const userDataStr = await AsyncStorage.getItem('userData');
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        if (userData.token) {
          console.log('[MeetingAPI] Found token in userData');
          return userData.token;
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    
    console.warn('[MeetingAPI] No auth token found in any storage');
    return null;
  } catch (e) {
    console.warn('[MeetingAPI] Error getting auth token:', e);
    return null;
  }
};

const getAuthHeader = async () => {
  // First try the meeting-specific token
  let token = await getMeetingAuthToken();
  
  // If not found, try the main app's token
  if (!token) {
    token = await getMainAppAuthToken();
    if (token) {
      // Cache it for future requests
      await setMeetingAuthToken(token);
    }
  }
  
  if (token) {
    const authHeader = { Authorization: `Bearer ${token}` };
    console.log('[MeetingAPI] Request headers:', JSON.stringify(authHeader));
    return authHeader;
  }
  
  console.warn('[MeetingAPI] No auth token available - request will fail with 401');
  return {};
};

export const meetingApi = {
  async createRoom(data) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to create room');
    }

    return response.json();
  },

  async getRoom(roomId) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}`, {
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to get room');
    }

    return response.json();
  },

  async joinRoom(roomId, data) {
    const headers = {
      'Content-Type': 'application/json',
      ...await getAuthHeader(),
    };
    
    console.log('[MeetingAPI] joinRoom request:', {
      url: `${getMeetingApiUrl()}/rooms/${roomId}/join`,
      headers: { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'none' },
      body: data,
    });
    
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      console.error('[MeetingAPI] joinRoom failed:', response.status, error);
      throw new Error(error.error || 'Failed to join room');
    }

    return response.json();
  },

  async leaveRoom(roomId) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to leave room');
    }

    return response.json();
  },

  async endRoom(roomId) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}/end`, {
      method: 'POST',
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to end room');
    }

    return response.json();
  },

  // Everyone who joined this room at any point, including those who left --
  // what a finished meeting's attendance record needs.
  async getAttendance(roomId) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}/attendance`, {
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to get attendance');
    }

    return response.json();
  },

  async getParticipants(roomId) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}/participants`, {
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to get participants');
    }

    return response.json();
  },

  async updateParticipant(roomId, updates) {
    // Backend uses JWT userID to identify the participant, no participantId in URL
    const url = `${getMeetingApiUrl()}/rooms/${roomId}/participants`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeader(),
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to update participant');
    }

    return response.json();
  },

  async getStats() {
    const response = await fetch(`${getMeetingApiUrl()}/stats`, {
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to get stats');
    }

    return response.json();
  },

  async sendChatMessage(roomId, content, messageType = 'text') {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeader(),
      },
      body: JSON.stringify({ content, messageType }),
    });

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to send message');
    }

    return response.json();
  },

  async getChatMessages(roomId, limit = 50, offset = 0) {
    const response = await fetch(
      `${getMeetingApiUrl()}/rooms/${roomId}/chat?limit=${limit}&offset=${offset}`,
      {
        headers: await getAuthHeader(),
      }
    );

    if (!response.ok) {
      const error = await parseJsonSafe(response);
      throw new Error(error.error || 'Failed to get messages');
    }

    return response.json();
  },
};
