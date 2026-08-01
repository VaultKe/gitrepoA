import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, REQUEST_TIMEOUT } from '../../config/environment';
import { getDeviceInfo as collectDeviceInfo } from '../deviceInfo';

const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem('authToken');
  } catch (error) {
    console.warn('getAuthToken failed:', error?.message || error);
    return null;
  }
};

const setAuthToken = async (token) => {
  try {
    await AsyncStorage.setItem('authToken', token);
  } catch (error) {
    console.warn('setAuthToken failed:', error?.message || error);
  }
};

const removeAuthToken = async () => {
  try {
    await AsyncStorage.removeItem('authToken');
  } catch (error) {
    console.warn('removeAuthToken failed:', error?.message || error);
  }
};

const getRefreshToken = async () => {
  try {
    return await AsyncStorage.getItem('refreshToken');
  } catch (error) {
    console.warn('getRefreshToken failed:', error?.message || error);
    return null;
  }
};

const setRefreshToken = async (token) => {
  try {
    await AsyncStorage.setItem('refreshToken', token);
  } catch (error) {
    console.warn('setRefreshToken failed:', error?.message || error);
  }
};

const removeRefreshToken = async () => {
  try {
    await AsyncStorage.removeItem('refreshToken');
  } catch (error) {
    console.warn('removeRefreshToken failed:', error?.message || error);
  }
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

// Delegates to the richer device-info collector that captures real hardware
// details (model, manufacturer, OS version, a stable per-device id, etc.)
// using Expo device APIs. Returns a promise.
const getDeviceInfo = async () => {
  try {
    return await collectDeviceInfo();
  } catch (e) {
    return {
      deviceId: 'unknown',
      userAgent: 'VaultKe-Mobile-App/1.0',
      platform: 'mobile',
      language: 'en',
      locale: 'en',
      timezone: 'UTC',
      deviceType: 'mobile',
      deviceName: 'Mobile Device - VaultKe App',
      browserName: 'VaultKe App',
      osName: 'Mobile OS',
      osVersion: '',
      manufacturer: '',
      brand: '',
      model: '',
      appVersion: '',
      screenResolution: '',
      connectionType: 'unknown',
    };
  }
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