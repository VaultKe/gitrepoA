import { Platform } from 'react-native';

export const MEETING_API_BASE_URL = __DEV__
  ? Platform.select({
      web: 'https://livemeeting-service.onrender.com/api/v1',
      default: 'https://livemeeting-service.onrender.com/api/v1',
    })
  : 'https://livemeeting-service.onrender.com/api/v1';

export const WS_BASE_URL = __DEV__
  ? Platform.select({
      web: 'wss://livemeeting-service.onrender.com',
      default: 'wss://livemeeting-service.onrender.com',
    })
  : 'wss://livemeeting-service.onrender.com';

export const getMeetingApiUrl = () => MEETING_API_BASE_URL;
export const getMeetingWsUrl = (roomId, token = null) => {
  const base = `${WS_BASE_URL}/api/v1/rooms/${roomId}/signal`;
  if (token) {
    return `${base}?token=${encodeURIComponent(token)}`;
  }
  return base;
};
