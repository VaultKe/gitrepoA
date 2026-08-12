import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OPENWA_ENABLED,
  OPENWA_API_URL,
  OPENWA_API_KEY,
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
    this.socket = null;
    this.isConnected = false;
    this.subscriptions = new Map(); // requestId -> { resolve, reject, timeout }
    this.eventHandlers = new Map();
    this.sessionID = OPENWA_DEFAULT_SESSION_ID;
    this.subscribedEvents = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 3000;
    this._connectPromise = null;
    this._sessionResolved = false;
    this.userID = null;
  }

  get enabled() {
    return !!OPENWA_ENABLED && !!OPENWA_API_URL && !!OPENWA_API_KEY;
  }

  get connectionStatus() {
    return {
      isConnected: this.isConnected,
      socketConnected: !!this.socket?.connected,
      sessionID: this.sessionID,
      subscribedEvents: Array.from(this.subscribedEvents),
      reconnectAttempts: this.reconnectAttempts,
      userID: this.userID,
    };
  }

  setUserID(userID) {
    this.userID = userID || null;
    this._sessionResolved = false;
  }

  async connect() {
    if (!this.enabled) {
      console.warn('[OpenWA WS] Disabled: OPENWA_ENABLED=false or missing OPENWA_API_URL/OPENWA_API_KEY');
      return false;
    }

    if (this.isConnected && this.socket?.connected) {
      return true;
    }

    if (this._connectPromise) {
      return this._connectPromise;
    }

    this._connectPromise = (async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          console.warn('[OpenWA WS] No auth token, cannot connect');
          return false;
        }

        // Close existing connection if any
        if (this.socket) {
          try {
            this.socket.disconnect();
          } catch (e) {
            // ignore
          }
          this.socket = null;
          this.isConnected = false;
        }

        // Resolve session ID from OpenWA if not already resolved
        if (!this._sessionResolved) {
          const resolved = await this.resolveSessionID();
          if (resolved) {
            this.sessionID = resolved;
            this._sessionResolved = true;
            console.log('[OpenWA WS] Resolved session ID:', this.sessionID);
          } else {
            console.warn('[OpenWA WS] Could not resolve OpenWA session, using fallback:', this.sessionID);
          }
        }

        const wsUrl = OPENWA_API_URL.replace(/^https?/, 'ws');
        const eventsUrl = `${wsUrl}/events`;

        console.log('[OpenWA WS] Connecting to', eventsUrl);

        this.socket = io(eventsUrl, {
          auth: {
            apiKey: OPENWA_API_KEY,
          },
          headers: {
            Authorization: `Bearer ${token}`,
            'X-User-Token': token,
          },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectInterval,
          reconnectionDelayMax: 30000,
          timeout: 20000,
        });

        this.socket.on('connect', () => {
          console.log('[OpenWA WS] Connected, socket id:', this.socket.id);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this._resubscribe();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[OpenWA WS] Disconnected:', reason);
          this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('[OpenWA WS] Connection error:', error.message);
          this.isConnected = false;
        });

        this.socket.on('message', (msg) => {
          this._handleMessage(msg);
        });

        return true;
      } catch (error) {
        console.error('[OpenWA WS] connect() failed:', error);
        this.isConnected = false;
        return false;
      } finally {
        this._connectPromise = null;
      }
    })();

    return this._connectPromise;
  }

  async resolveSessionID() {
    if (!OPENWA_API_URL || !OPENWA_API_KEY) {
      return null;
    }

    const token = await AsyncStorage.getItem('authToken');

    // 1) Prefer the backend's session registry so we get per-user mappings.
    if (token) {
      try {
        const baseUrl = API_BASE_URL || OPENWA_API_URL.replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/api/v1/wa/sessions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (response.ok) {
          const payload = await response.json();
          const sessions = Array.isArray(payload.data) ? payload.data : [];
          if (this.userID && sessions.length > 0) {
            const userSession = sessions.find(
              s => s.name === 'vaultke-user-' + this.userID && s.status === 'ready'
            );
            if (userSession && userSession.sessionId) {
              return userSession.sessionId;
            }
          }
          const defaultSession = sessions.find(s => s.isDefault && s.status === 'ready');
          if (defaultSession && defaultSession.sessionId) {
            return defaultSession.sessionId;
          }
          const anyReady = sessions.find(s => s.status === 'ready');
          if (anyReady && anyReady.sessionId) {
            return anyReady.sessionId;
          }
        }
      } catch (error) {
        console.warn('[OpenWA WS] resolveSessionID backend error:', error.message);
      }
    }

    // 2) Fallback: ask OpenWA directly.
    try {
      const baseUrl = OPENWA_API_URL.replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/api/sessions`, {
        headers: {
          'X-API-Key': OPENWA_API_KEY,
        },
      });

      if (!response.ok) {
        console.warn('[OpenWA WS] resolveSessionID failed:', response.status);
        return null;
      }

      const sessions = await response.json();
      if (!Array.isArray(sessions)) {
        return null;
      }

      const ready = sessions.find(s => s.status === 'ready');
      if (ready && ready.id) {
        return ready.id;
      }

      if (sessions.length > 0 && sessions[0].id) {
        return sessions[0].id;
      }

      return null;
    } catch (error) {
      console.warn('[OpenWA WS] resolveSessionID error:', error.message);
      return null;
    }
  }

  disconnect() {
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.subscribedEvents.clear();

    // Reject all pending subscriptions
    this.subscriptions.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('OpenWA socket disconnected'));
    });
    this.subscriptions.clear();

    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (e) {
        // ignore
      }
      this.socket = null;
    }
  }

  subscribe(events, sessionId) {
    const targetSession = sessionId || this.sessionID;
    const eventsArray = Array.isArray(events) ? events : [events];

    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('OpenWA socket not connected'));
        return;
      }

      const requestId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const timeout = setTimeout(() => {
        this.subscriptions.delete(requestId);
        reject(new Error('OpenWA subscribe timeout'));
      }, 15000);

      this.subscriptions.set(requestId, { resolve, reject, timeout });

      this.socket.emit('message', {
        type: 'subscribe',
        sessionId: targetSession,
        events: eventsArray,
        requestId,
      });
    });
  }

  unsubscribe(events, sessionId) {
    const targetSession = sessionId || this.sessionID;
    const eventsArray = Array.isArray(events) ? events : [events];

    if (!this.socket || !this.isConnected) {
      return Promise.resolve();
    }

    const requestId = `unsub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.subscriptions.delete(requestId);
        resolve();
      }, 5000);

      this.subscriptions.set(requestId, { resolve, reject: () => {}, timeout });

      this.socket.emit('message', {
        type: 'unsubscribe',
        sessionId: targetSession,
        events: eventsArray,
        requestId,
      });
    });
  }

  ping() {
    if (!this.socket || !this.isConnected) {
      return Promise.reject(new Error('OpenWA socket not connected'));
    }

    const requestId = `ping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.subscriptions.delete(requestId);
        reject(new Error('OpenWA ping timeout'));
      }, 5000);

      this.subscriptions.set(requestId, { resolve, reject, timeout });

      this.socket.emit('message', {
        type: 'ping',
        requestId,
      });
    });
  }

  onEvent(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName).add(handler);

    return () => {
      const handlers = this.eventHandlers.get(eventName);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  offEvent(eventName, handler) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  _handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    // Handle correlated request/response
    if (msg.requestId && this.subscriptions.has(msg.requestId)) {
      const pending = this.subscriptions.get(msg.requestId);
      clearTimeout(pending.timeout);
      this.subscriptions.delete(msg.requestId);

      if (msg.type === 'error') {
        pending.reject(new Error(msg.message || 'OpenWA request failed'));
      } else {
        pending.resolve(msg);
      }
      return;
    }

    // Handle live events
    if (msg.type === 'event' && msg.payload) {
      const { event, sessionId, data } = msg.payload;
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler({ event, sessionId, data, timestamp: msg.timestamp });
          } catch (handlerError) {
            console.error('[OpenWA WS] event handler error for', event, handlerError);
          }
        });
      }

      // Also notify wildcard handlers
      const wildcardHandlers = this.eventHandlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => {
          try {
            handler({ event, sessionId, data, timestamp: msg.timestamp });
          } catch (handlerError) {
            console.error('[OpenWA WS] wildcard handler error', handlerError);
          }
        });
      }
      return;
    }

    // Handle other message types (subscribed, unsubscribed, pong, error)
    if (msg.type === 'error') {
      console.error('[OpenWA WS] Server error:', msg.code, msg.message);
    }
  }

  async _resubscribe() {
    if (this.subscribedEvents.size === 0) return;

    const events = Array.from(this.subscribedEvents);
    try {
      await this.subscribe(events, this.sessionID);
      console.log('[OpenWA WS] Resubscribed to', events.length, 'events');
    } catch (error) {
      console.error('[OpenWA WS] Resubscribe failed:', error);
    }
  }

  async ensureSubscribed(events, sessionId) {
    const targetSession = sessionId || this.sessionID;
    const eventsArray = Array.isArray(events) ? events : [events];

    for (const event of eventsArray) {
      this.subscribedEvents.add(event);
    }

    if (this.isConnected && this.socket?.connected) {
      try {
        await this.subscribe(eventsArray, targetSession);
      } catch (error) {
        console.error('[OpenWA WS] Subscribe failed:', error);
      }
    } else {
      await this.connect();
      if (this.isConnected) {
        try {
          await this.subscribe(eventsArray, targetSession);
        } catch (error) {
          console.error('[OpenWA WS] Subscribe after connect failed:', error);
        }
      }
    }
  }

  async ensureUnsubscribed(events, sessionId) {
    const targetSession = sessionId || this.sessionID;
    const eventsArray = Array.isArray(events) ? events : [events];

    for (const event of eventsArray) {
      this.subscribedEvents.delete(event);
    }

    if (this.isConnected && this.socket?.connected) {
      try {
        await this.unsubscribe(eventsArray, targetSession);
      } catch (error) {
        console.error('[OpenWA WS] Unsubscribe failed:', error);
      }
    }
  }

  setSessionID(sessionId) {
    if (this.sessionID !== sessionId) {
      this.subscribedEvents.clear();
      this.sessionID = sessionId;
    }
  }
}

const openWASocketService = new OpenWASocketService();
export default openWASocketService;
export { OPENWA_EVENTS };
