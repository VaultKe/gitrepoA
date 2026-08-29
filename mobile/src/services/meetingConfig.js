import { Platform } from 'react-native';

const PROD_API_URL = 'https://livemeeting-service.onrender.com/api/v1';

export const MEETING_API_BASE_URL = __DEV__
  ? Platform.select({
      web: 'http://localhost:8086/api/v1',
      default: 'http://localhost:8086/api/v1',
    }) ?? 'http://localhost:8086/api/v1'
  : PROD_API_URL;

// The WebSocket scheme MUST match the HTTP scheme of the API base URL so that
// wss pairs with https and ws pairs with http. The meeting service runs plain
// HTTP (ListenAndServe, no TLS) in development, so the WS URL has to be ws://
// -- using wss:// against a non-TLS server fails the TLS handshake and the
// signaling socket never opens, which is why participants could not see each
// other at all.
const apiBase = String(MEETING_API_BASE_URL);
const wsScheme = apiBase.startsWith('https') ? 'wss' : 'ws';
const wsHost = apiBase.replace(/^https?:\/\//, '').replace(/\/api\/v1$/, '');
export const WS_BASE_URL = `${wsScheme}://${wsHost}`;

export const getMeetingApiUrl = () => MEETING_API_BASE_URL;
export const getMeetingWsUrl = (roomId, token = null) => {
  const base = `${WS_BASE_URL}/api/v1/rooms/${roomId}/signal`;
  if (token) {
    return `${base}?token=${encodeURIComponent(token)}`;
  }
  return base;
};
