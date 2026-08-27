import { makeRequest, makeRequestWithRetry } from './client';
import { storeUserData, removeAuthToken, setRefreshToken, getRefreshToken, removeRefreshToken } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetLoggingOut } from '../../utils/authLogout';

const login = async (credentials) => {
  // Clear any stale "logging out" guard so a login attempt is never blocked
  // after a previous logout. This is what allows re-authentication (phone or
  // email) within the same app session.
  resetLoggingOut();

  const response = await makeRequest('/auth/login', {
    method: 'POST',
    body: credentials,
  });

  if (response.success && response.data?.token) {
    await storeUserData(response.data.user);
    const { setAuthToken, getAuthToken } = await import('./auth');
    await setAuthToken(response.data.token);

    // Verify token persisted; if not, attempt a direct AsyncStorage fallback write
    try {
      const persisted = await getAuthToken();
      if (!persisted) {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        try {
          await AsyncStorage.setItem('authToken', response.data.token);
          console.warn('Auth token fallback: wrote token directly to AsyncStorage');
        } catch (e) {
          console.warn('Auth token fallback write failed:', e?.message || e);
        }
      }
    } catch (e) {
      console.warn('Auth token verification failed:', e?.message || e);
    }
    if (response.data.refreshToken) {
      await setRefreshToken(response.data.refreshToken);
      // Verify refresh token persisted; fallback to direct AsyncStorage write if needed
      try {
        const { getRefreshToken } = await import('./auth');
        const persistedRefresh = await getRefreshToken();
        if (!persistedRefresh) {
          const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
          try {
            await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
            console.warn('Refresh token fallback: wrote refreshToken directly to AsyncStorage');
          } catch (e) {
            console.warn('Refresh token fallback write failed:', e?.message || e);
          }
        }
      } catch (e) {
        console.warn('Refresh token verification failed:', e?.message || e);
      }
    }

    // Store current device info for login history reference
    try {
      const deviceInfo = await (await import('./deviceInfo')).default();
      await AsyncStorage.setItem('currentDeviceInfo', JSON.stringify({
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        deviceName: deviceInfo.deviceName,
        platform: deviceInfo.platform,
        osName: deviceInfo.osName,
        browserName: deviceInfo.browserName,
        loginTime: Date.now(),
      }));
    } catch (e) {
      console.warn('Failed to store current device info:', e?.message || e);
    }
  }

  return response;
};

const register = async (userData) => {
  // Same guard reset as login — allow fresh registration after a logout.
  resetLoggingOut();

  const response = await makeRequest('/auth/register', {
    method: 'POST',
    body: userData,
  });

  if (response.success && response.data?.token) {
    await storeUserData(response.data.user);
    const { setAuthToken, getAuthToken } = await import('./auth');
    await setAuthToken(response.data.token);

    // Verify token persisted; if not, attempt a direct AsyncStorage fallback write
    try {
      const persisted = await getAuthToken();
      if (!persisted) {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        try {
          await AsyncStorage.setItem('authToken', response.data.token);
          console.warn('Auth token fallback: wrote token directly to AsyncStorage');
        } catch (e) {
          console.warn('Auth token fallback write failed:', e?.message || e);
        }
      }
    } catch (e) {
      console.warn('Auth token verification failed:', e?.message || e);
    }
    if (response.data.refreshToken) {
      await setRefreshToken(response.data.refreshToken);
      // Verify refresh token persisted; fallback to direct AsyncStorage write if needed
      try {
        const { getRefreshToken } = await import('./auth');
        const persistedRefresh = await getRefreshToken();
        if (!persistedRefresh) {
          const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
          try {
            await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
            console.warn('Refresh token fallback: wrote refreshToken directly to AsyncStorage');
          } catch (e) {
            console.warn('Refresh token fallback write failed:', e?.message || e);
          }
        }
      } catch (e) {
        console.warn('Refresh token verification failed:', e?.message || e);
      }
    }

    // Store current device info for login history reference
    try {
      const deviceInfo = await (await import('./deviceInfo')).default();
      await AsyncStorage.setItem('currentDeviceInfo', JSON.stringify({
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        deviceName: deviceInfo.deviceName,
        platform: deviceInfo.platform,
        osName: deviceInfo.osName,
        browserName: deviceInfo.browserName,
        loginTime: Date.now(),
      }));
    } catch (e) {
      console.warn('Failed to store current device info:', e?.message || e);
    }
  }

  return response;
};

const logout = async () => {
  try {
    const refreshToken = await getRefreshToken();
    await makeRequest('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : undefined,
    });
  } catch (error) {
  } finally {
    await removeAuthToken();
    await removeRefreshToken();
    await AsyncStorage.removeItem('userRole');
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('currentDeviceInfo');
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
  const plainRefreshToken = await getRefreshToken();
  if (!plainRefreshToken) {
    throw new Error('No refresh token available');
  }
  return await makeRequest('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: plainRefreshToken },
  });
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