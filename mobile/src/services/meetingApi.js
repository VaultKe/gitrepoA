import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMeetingApiUrl } from '../services/meetingConfig';

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

const getAuthHeader = async () => {
  const token = await getMeetingAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
      const error = await response.json();
      throw new Error(error.error || 'Failed to create room');
    }

    return response.json();
  },

  async getRoom(roomId) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}`, {
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get room');
    }

    return response.json();
  },

  async joinRoom(roomId, data) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
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
      const error = await response.json();
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
      const error = await response.json();
      throw new Error(error.error || 'Failed to end room');
    }

    return response.json();
  },

  async getParticipants(roomId) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}/participants`, {
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get participants');
    }

    return response.json();
  },

  async updateParticipant(roomId, updates) {
    const response = await fetch(`${getMeetingApiUrl()}/rooms/${roomId}/participants`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeader(),
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update participant');
    }

    return response.json();
  },

  async getStats() {
    const response = await fetch(`${getMeetingApiUrl()}/stats`, {
      headers: await getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
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
      const error = await response.json();
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
      const error = await response.json();
      throw new Error(error.error || 'Failed to get messages');
    }

    return response.json();
  },
};
