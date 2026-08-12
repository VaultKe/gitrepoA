import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OPENWA_ENABLED,
  OPENWA_DEFAULT_SESSION_ID,
  API_BASE_URL,
} from '../config/environment';

const OPENWA_EVENTS = {
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_ACK: 'message.ack',
  MESSAGE_REVOKED: 'message.revoked',
  MESSAGE_REACTION: 'message.reaction',
  MESSAGE_EDITED: 'message.edited',
  SESSION_STATUS: 'session.status',
  SESSION_QR: 'session.qr',
  SESSION_AUTHENTICATED: 'session.authenticated',
  SESSION_DISCONNECTED: 'session.disconnected',
  SESSION_RESTRICTION: 'session.restriction',
  PRESENCE_UPDATE: 'presence.update',
  GROUP_JOIN: 'group.join',
  GROUP_LEAVE: 'group.leave',
  GROUP_UPDATE: 'group.update',
  GROUP_JOIN_REQUEST: 'group.join_request',
  CALL_RECEIVED: 'call.received',
  CALL_ACCEPTED: 'call.accepted',
  CALL_REJECTED: 'call.rejected',
  CALL_MISSED: 'call.missed',
  STATUS_RECEIVED: 'status.received',
};

class OpenWASocketService {
  constructor() {
    this.sessionID = OPENWA_DEFAULT_SESSION_ID;
    this.userID = null;
    this._sessionResolved = false;
    this.eventHandlers = new Map();
  }

  get enabled() {
    const envCheck = !!OPENWA_ENABLED && !!API_BASE_URL;
    if (!envCheck) {
      console.warn('[OpenWA] disabled because:', {
        OPENWA_ENABLED: !!OPENWA_ENABLED,
        API_BASE_URL: !!API_BASE_URL,
      });
    }
    return envCheck;
  }

  get connectionStatus() {
    return {
      isConnected: false,
      socketConnected: false,
      sessionID: this.sessionID,
      subscribedEvents: [],
      reconnectAttempts: 0,
      userID: this.userID,
    };
  }

  setUserID(userID) {
    this.userID = userID || null;
    this._sessionResolved = false;
  }

  async connect() {
    // No persistent socket connection needed; chat uses backend REST.
    return true;
  }

  disconnect() {
    // No-op: no socket to close.
  }

  subscribe() {
    return Promise.resolve();
  }

  unsubscribe() {
    return Promise.resolve();
  }

  ping() {
    return Promise.resolve();
  }

  onEvent() {
    // No-op: real-time events can be added later via polling or backend push.
  }

  offEvent() {
    // No-op.
  }

  _handleMessage() {
    // No-op.
  }

  async _resubscribe() {
    // No-op.
  }

  async ensureSubscribed() {
    // No-op.
  }

  async ensureUnsubscribed() {
    // No-op.
  }

  setSessionID(sessionId) {
    if (this.sessionID !== sessionId) {
      this.sessionID = sessionId;
      this._sessionResolved = true;
    }
  }

  async resolveSessionID() {
    console.log('[OpenWA] resolveSessionID called, userID:', this.userID);

    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.warn('[OpenWA] resolveSessionID missing auth token');
      return null;
    }

    // Use backend session registry only — backend owns the OpenWA API key.
    try {
      const baseUrl = API_BASE_URL.replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/wa/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      console.log('[OpenWA] resolveSessionID backend status:', response.status);
      if (response.ok) {
        const payload = await response.json();
        const sessions = Array.isArray(payload.data) ? payload.data : [];
        console.log('[OpenWA] resolveSessionID backend sessions count:', sessions.length, 'sample:', sessions.slice(0, 2));

        if (this.userID && sessions.length > 0) {
          const userSession = sessions.find(
            s => s.name === 'vaultke-user-' + this.userID && s.sessionId
          );
          console.log('[OpenWA] resolveSessionID userSession match:', userSession?.sessionId || null);
          if (userSession && userSession.sessionId) {
            return userSession.sessionId;
          }
        }

        const defaultSession = sessions.find(s => s.isDefault && s.sessionId);
        console.log('[OpenWA] resolveSessionID defaultSession match:', defaultSession?.sessionId || null);
        if (defaultSession && defaultSession.sessionId) {
          return defaultSession.sessionId;
        }

        const anySession = sessions.find(s => s.sessionId);
        console.log('[OpenWA] resolveSessionID anySession match:', anySession?.sessionId || null);
        if (anySession && anySession.sessionId) {
          return anySession.sessionId;
        }
      }
    } catch (error) {
      console.warn('[OpenWA] resolveSessionID backend error:', error.message);
    }

    return null;
  }

  async getChats(sessionId) {
    const token = await AsyncStorage.getItem('authToken');
    if (!token || !sessionId) {
      throw new Error('Missing auth or session ID');
    }

    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/wa/sessions/${encodeURIComponent(sessionId)}/chats?limit=100&offset=0`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const text = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(`OpenWA get chats failed: ${response.status} ${text}`);
    }

    return JSON.parse(text || '{}');
  }

  async getMessages(sessionId, chatId, limit = 50, offset = 0) {
    const token = await AsyncStorage.getItem('authToken');
    if (!token || !sessionId || !chatId) {
      throw new Error('Missing auth, session ID, or chat ID');
    }

    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const url = new URL(`${baseUrl}/wa/sessions/${encodeURIComponent(sessionId)}/chats/${encodeURIComponent(chatId)}/messages`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const text = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(`OpenWA get messages failed: ${response.status} ${text}`);
    }

    return JSON.parse(text || '{}');
  }

  async sendTextMessage(sessionId, chatId, text) {
    const token = await AsyncStorage.getItem('authToken');
    if (!token || !sessionId || !chatId) {
      throw new Error('Missing auth, session ID, or chat ID');
    }

    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/wa/sessions/${encodeURIComponent(sessionId)}/messages/send-text`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ chatId, text }),
    });

    const textResp = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(`OpenWA send message failed: ${response.status} ${textResp}`);
    }

    return JSON.parse(textResp || '{}');
  }

  async markChatRead(sessionId, chatId) {
    const token = await AsyncStorage.getItem('authToken');
    if (!token || !sessionId || !chatId) {
      return;
    }

    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    await fetch(`${baseUrl}/wa/sessions/${encodeURIComponent(sessionId)}/chats/read`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ chatId }),
    }).catch(() => {});
  }

  async sendTyping(sessionId, chatId, state = 'typing') {
    const token = await AsyncStorage.getItem('authToken');
    if (!token || !sessionId || !chatId) {
      return;
    }

    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    await fetch(`${baseUrl}/wa/sessions/${encodeURIComponent(sessionId)}/chats/typing`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ chatId, state }),
    }).catch(() => {});
  }
}

const openWASocketService = new OpenWASocketService();
export default openWASocketService;
export { OPENWA_EVENTS };
