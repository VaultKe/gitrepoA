import { API_BASE_URL, REQUEST_TIMEOUT, getAuthToken, getDeviceInfo, sanitizeHeaderValue } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerAppLogout } from '../../utils/authLogout';

const makeRequest = async (endpoint, options = {}) => {
  const token = await getAuthToken();
  const isFormData = options.body instanceof FormData;
  const deviceInfo = getDeviceInfo();

  const config = {
    method: 'GET',
    headers: {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      'X-Timezone': sanitizeHeaderValue(deviceInfo.timezone),
      'X-Language': sanitizeHeaderValue(deviceInfo.language),
      'X-Device-Type': sanitizeHeaderValue(deviceInfo.deviceType),
      'X-Device-Name': sanitizeHeaderValue(deviceInfo.deviceName),
      'X-Browser-Name': sanitizeHeaderValue(deviceInfo.browserName),
      'X-OS-Name': sanitizeHeaderValue(deviceInfo.osName),
      ...(deviceInfo.screenResolution && { 'X-Screen-Resolution': sanitizeHeaderValue(deviceInfo.screenResolution) }),
      ...(deviceInfo.connectionType && { 'X-Connection-Type': sanitizeHeaderValue(deviceInfo.connectionType) }),
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object' && !isFormData) {
    config.body = JSON.stringify(config.body);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const fetchConfig = { ...config, signal: controller.signal };
  const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchConfig);
  clearTimeout(timeoutId);

  const contentType = response.headers.get('content-type');
  let data;

  try {
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const textResponse = await response.text();
      data = JSON.parse(textResponse);
    }
  } catch (parseError) {
    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }
    throw new Error('Invalid response format from server');
  }

  if (!response.ok) {
    if (response.status === 401) {
      await triggerAppLogout();
      throw new Error(data?.error || response.statusText || 'Your session has expired. Please log in again.');
    }
    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }
    if (response.status >= 500) {
      throw new Error('Server error occurred. Please try again later.');
    }
    if (response.status >= 400 && response.status < 500) {
      throw new Error(data.error || `Request failed: ${response.statusText}`);
    }
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }

  return data;
};

const makeRequestWithRetry = async (endpoint, options = {}, maxRetries = 2) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await makeRequest(endpoint, options);
    } catch (error) {
      lastError = error;
      if (error.message.includes('401') || error.message.includes('403') ||
          error.message.includes('400') || error.message.includes('422')) {
        throw error;
      }
      const isNetworkError = error.message.includes('NetworkError') ||
                              error.message.includes('Failed to fetch') ||
                              error.message.includes('CORS') ||
                              error.message.includes('Unable to connect to server');
      if (isNetworkError && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

const checkBackendConnectivity = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });

    if (response.ok) {
      const data = await response.json();
      return {
        connected: true,
        status: data.status || 'healthy',
        message: data.message || 'Backend is running'
      };
    } else {
      return {
        connected: false,
        status: 'error',
        message: `Backend responded with status ${response.status}`
      };
    }
  } catch (error) {
    return {
      connected: false,
      status: 'offline',
      message: 'Unable to connect to backend server',
      error: error.message
    };
  }
};

const checkHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

export {
  makeRequest,
  makeRequestWithRetry,
  checkBackendConnectivity,
  checkHealth,
  API_BASE_URL,
  REQUEST_TIMEOUT,
};
