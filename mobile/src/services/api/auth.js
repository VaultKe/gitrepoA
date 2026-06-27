import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, REQUEST_TIMEOUT } from '../../config/environment';

const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem('authToken');
  } catch (error) {
    return null;
  }
};

const setAuthToken = async (token) => {
  try {
    await AsyncStorage.setItem('authToken', token);
  } catch (error) {}
};

const removeAuthToken = async () => {
  try {
    await AsyncStorage.removeItem('authToken');
  } catch (error) {}
};

const getRefreshToken = async () => {
  try {
    return await AsyncStorage.getItem('refreshToken');
  } catch (error) {
    return null;
  }
};

const setRefreshToken = async (token) => {
  try {
    await AsyncStorage.setItem('refreshToken', token);
  } catch (error) {}
};

const removeRefreshToken = async () => {
  try {
    await AsyncStorage.removeItem('refreshToken');
  } catch (error) {}
};

const sanitizeHeaderValue = (value) => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[\r\n\t]/g, ' ')
    .trim()
    .substring(0, 200);
};

const getDeviceInfo = () => {
  if (typeof navigator === 'undefined') {
    return {
      userAgent: 'VaultKe-Mobile-App/1.0',
      platform: 'mobile',
      language: 'en',
      timezone: 'UTC',
      deviceType: 'mobile',
      deviceName: 'Mobile Device - VaultKe App',
      browserName: 'VaultKe App',
      osName: 'Mobile OS',
    };
  }

  const userAgent = navigator.userAgent || 'VaultKe-App/1.0';
  let deviceInfo = {
    userAgent: userAgent,
    language: navigator.language || 'en',
    timezone: 'UTC',
    deviceType: 'unknown',
    deviceName: 'Unknown Device',
    browserName: 'Unknown Browser',
    osName: 'Unknown OS',
  };

  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceInfo.deviceType = 'mobile';
    if (/iphone/i.test(ua)) {
      deviceInfo.deviceName = 'iPhone';
      deviceInfo.osName = 'iOS';
    } else if (/ipad/i.test(ua)) {
      deviceInfo.deviceName = 'iPad';
      deviceInfo.osName = 'iPadOS';
    } else if (/android/i.test(ua)) {
      deviceInfo.deviceName = 'Android Device';
      deviceInfo.osName = 'Android';
    }
  } else {
    deviceInfo.deviceType = 'desktop';
    if (/windows/i.test(ua)) {
      deviceInfo.deviceName = 'Windows PC';
      deviceInfo.osName = 'Windows';
    } else if (/macintosh|mac os x/i.test(ua)) {
      deviceInfo.deviceName = 'Mac';
      deviceInfo.osName = 'macOS';
    } else if (/linux/i.test(ua)) {
      deviceInfo.deviceName = 'Linux PC';
      deviceInfo.osName = 'Linux';
    }
  }

  if (/edg\//i.test(ua)) {
    deviceInfo.browserName = 'Microsoft Edge';
  } else if (/chrome/i.test(ua) && !/edg/i.test(ua)) {
    deviceInfo.browserName = 'Google Chrome';
  } else if (/firefox/i.test(ua)) {
    deviceInfo.browserName = 'Mozilla Firefox';
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    deviceInfo.browserName = 'Safari';
  } else if (/opera/i.test(ua)) {
    deviceInfo.browserName = 'Opera';
  }

  deviceInfo.deviceName = `${deviceInfo.deviceName} - ${deviceInfo.browserName}`;

  try {
    deviceInfo.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (e) {
    deviceInfo.timezone = 'UTC';
  }

  try {
    if (typeof screen !== 'undefined') {
      deviceInfo.screenResolution = `${screen.width}x${screen.height}`;
      deviceInfo.deviceName = `${deviceInfo.deviceName} - ${deviceInfo.screenResolution}`;
    }
  } catch (e) {
  }

  try {
    if (navigator.connection) {
      deviceInfo.connectionType = navigator.connection.effectiveType || 'unknown';
    }
  } catch (e) {
  }

  return deviceInfo;
};

const clearLargeUserData = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const largeDataKeys = keys.filter(key =>
      key.includes('userData') ||
      key.includes('cached') ||
      key.includes('avatar') ||
      key.includes('offlineUsers')
    );
    if (largeDataKeys.length > 0) {
      await AsyncStorage.multiRemove(largeDataKeys);
    }
  } catch (error) {
  }
};

const storeUserData = async (rawUserData) => {
  await clearLargeUserData();
  const compressedUserData = {
    id: rawUserData.id,
    firstName: rawUserData.firstName,
    lastName: rawUserData.lastName,
    email: rawUserData.email,
    phone: rawUserData.phone,
    role: rawUserData.role,
    avatar: rawUserData.avatar,
    status: rawUserData.status,
    isEmailVerified: rawUserData.isEmailVerified,
    isPhoneVerified: rawUserData.isPhoneVerified,
  };

  const compressedSize = JSON.stringify(compressedUserData).length;
  if (compressedSize > 2048) {
    const ultraMinimalUserData = {
      id: rawUserData.id,
      firstName: rawUserData.firstName,
      lastName: rawUserData.lastName,
      email: rawUserData.email,
      role: rawUserData.role,
    };
    const ultraMinimalSize = JSON.stringify(ultraMinimalUserData).length;
    if (ultraMinimalSize > 512) {
      const absoluteMinimalData = {
        id: rawUserData.id,
        firstName: rawUserData.firstName,
        lastName: rawUserData.lastName,
        email: rawUserData.email,
        role: rawUserData.role,
      };
      await AsyncStorage.setItem('userData', JSON.stringify(absoluteMinimalData));
      await AsyncStorage.setItem('userRole', absoluteMinimalData.role || 'user');
      return absoluteMinimalData;
    } else {
      await AsyncStorage.setItem('userData', JSON.stringify(ultraMinimalUserData));
      await AsyncStorage.setItem('userRole', ultraMinimalUserData.role || 'user');
      return ultraMinimalUserData;
    }
  } else {
    await AsyncStorage.setItem('userData', JSON.stringify(compressedUserData));
    await AsyncStorage.setItem('userRole', compressedUserData.role || 'user');
    return compressedUserData;
  }
};

export {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
  sanitizeHeaderValue,
  getDeviceInfo,
  clearLargeUserData,
  storeUserData,
  API_BASE_URL,
  REQUEST_TIMEOUT,
};