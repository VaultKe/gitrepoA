import { Platform } from 'react-native';

export const MEETING_API_BASE_URL = __DEV__
  ? Platform.select({
      web: 'http://localhost:8082/api/v1',
      default: 'http://10.0.2.2:8082/api/v1',
    })
  : 'https://gitrepoa-1.onrender.com/api/v1';

export const WS_BASE_URL = __DEV__
  ? Platform.select({
      web: 'ws://localhost:8082',
      default: 'ws://10.0.2.2:8082',
    })
  : 'wss://gitrepoa-1.onrender.com';

export const getMeetingApiUrl = () => MEETING_API_BASE_URL;
export const getMeetingWsUrl = (roomId, token = null) => {
  const base = `${WS_BASE_URL}/api/v1/rooms/${roomId}/signal`;
  if (token) {
    return `${base}?token=${encodeURIComponent(token)}`;
  }
  return base;
};
