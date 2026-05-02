import { makeRequest, makeRequestWithRetry } from './client';
import { storeUserData, removeAuthToken } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const login = async (credentials) => {
  const response = await makeRequest('/auth/login', {
    method: 'POST',
    body: credentials,
  });

  if (response.success && response.data?.token) {
    await storeUserData(response.data.user);
    const { setAuthToken } = await import('./auth');
    await setAuthToken(response.data.token);
  }

  return response;
};

const register = async (userData) => {
  const response = await makeRequest('/auth/register', {
    method: 'POST',
    body: userData,
  });

  if (response.success && response.data?.token) {
    await storeUserData(response.data.user);
    const { setAuthToken } = await import('./auth');
    await setAuthToken(response.data.token);
  }

  return response;
};

const logout = async () => {
  try {
    await makeRequest('/auth/logout', { method: 'POST' });
  } catch (error) {
  } finally {
    await removeAuthToken();
    await AsyncStorage.removeItem('userRole');
    await AsyncStorage.removeItem('userData');
  }
  return { success: true };
};

const forgotPassword = async (identifier) => {
  return await makeRequest('/auth/forgot-password', {
    method: 'POST',
    body: { identifier },
  });
};

const resetPassword = async (token, newPassword) => {
  return await makeRequest('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  });
};

const checkTokenStatus = async (token) => {
  return await makeRequest('/auth/check-token-status', {
    method: 'POST',
    body: { token },
  });
};

const sendEmailVerification = async (userId) => {
  return await makeRequest('/auth/send-email-verification', {
    method: 'POST',
    body: { userId },
  });
};

const verifyEmailCode = async (token) => {
  return await makeRequest('/auth/verify-email-code', {
    method: 'POST',
    body: { token },
  });
};

const checkEmailVerificationStatus = async (token) => {
  return await makeRequest('/auth/check-email-verification-status', {
    method: 'POST',
    body: { token },
  });
};

const refreshToken = async () => {
  return await makeRequest('/auth/refresh', { method: 'POST' });
};

const changePassword = async (passwordData) => {
  return await makeRequest('/auth/change-password', {
    method: 'POST',
    body: passwordData,
  });
};

const getLoginHistory = async (limit = 50, offset = 0) => {
  return await makeRequest(`/auth/login-history?limit=${limit}&offset=${offset}`);
};

const logoutAllDevices = async () => {
  return await makeRequest('/auth/logout-all-devices', { method: 'POST' });
};

const logoutSpecificDevice = async (sessionId) => {
  return await makeRequest(`/auth/logout-device/${sessionId}`, { method: 'POST' });
};

export {
  login,
  register,
  logout,
  forgotPassword,
  resetPassword,
  checkTokenStatus,
  sendEmailVerification,
  verifyEmailCode,
  checkEmailVerificationStatus,
  refreshToken,
  changePassword,
  getLoginHistory,
  logoutAllDevices,
  logoutSpecificDevice,
};