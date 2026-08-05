import { API_BASE_URL, REQUEST_TIMEOUT, getAuthToken, getRefreshToken, setAuthToken, setRefreshToken, getDeviceInfo, sanitizeHeaderValue } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerAppLogout, getLoggingOut } from '../../utils/authLogout';
import { maskSensitiveData } from '../../utils/formatters';

let isRefreshing = false;
let refreshPromise = null;

const refreshAccessToken = async () => {
  if (isRefreshing) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const plainRefreshToken = await getRefreshToken();
      if (!plainRefreshToken) {
        throw new Error('No refresh token');
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: plainRefreshToken }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error || 'Refresh failed');
      }

      const newAccessToken = data.data?.token;
      const newRefreshToken = data.data?.refreshToken;

      if (newAccessToken) {
        await setAuthToken(newAccessToken);
      }
      if (newRefreshToken) {
        await setRefreshToken(newRefreshToken);
      }

      return newAccessToken;
    } catch (error) {
      await triggerAppLogout();
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

   return refreshPromise;
 };

  const safeJSONParse = (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Empty response from server');
    }
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // Try to extract valid JSON from the response by finding
      // the first { or [ and the matching closing } or ].
      const startChar = trimmed.charAt(0);
      if (startChar === '{' || startChar === '[') {
        const endChar = startChar === '{' ? '}' : ']';
        const startIdx = trimmed.indexOf(startChar);
        const endIdx = trimmed.lastIndexOf(endChar);
        if (startIdx !== -1 && endIdx > startIdx) {
          try {
            return JSON.parse(trimmed.substring(startIdx, endIdx + 1));
          } catch (_) {
            // Fall through to throw below
          }
        }
      }
      throw new Error(`Invalid JSON response from server`);
    }
  };

 const makeRequest = async (endpoint, options = {}) => {
  if (endpoint === '/auth/refresh') {
    throw new Error('Use refreshAccessToken instead');
  }

  const token = await getAuthToken();
  const isFormData = !!(options.body &&
    typeof options.body === 'object' &&
    !Array.isArray(options.body) &&
    ((typeof FormData !== 'undefined' && options.body instanceof FormData) ||
      typeof options.body.append === 'function' ||
      typeof options.body.getParts === 'function' ||
      (Array.isArray(options.body._parts)) ||
      (options.body.constructor && options.body.constructor.name === 'FormData')));
  const deviceInfo = await getDeviceInfo();

  const isAuthEndpoint = endpoint.startsWith('/auth/') || endpoint.startsWith('/auth/refresh');

  const config = {
    method: 'GET',
    headers: {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      'X-Timezone': sanitizeHeaderValue(deviceInfo.timezone),
      'X-Language': sanitizeHeaderValue(deviceInfo.language),
      'X-Locale': sanitizeHeaderValue(deviceInfo.locale),
      'X-Device-Id': sanitizeHeaderValue(deviceInfo.deviceId),
      'X-Device-Type': sanitizeHeaderValue(deviceInfo.deviceType),
      'X-Device-Name': sanitizeHeaderValue(deviceInfo.deviceName),
      'X-Browser-Name': sanitizeHeaderValue(deviceInfo.browserName),
      'X-OS-Name': sanitizeHeaderValue(deviceInfo.osName),
      'X-OS-Version': sanitizeHeaderValue(deviceInfo.osVersion),
      'X-App-Version': sanitizeHeaderValue(deviceInfo.appVersion),
      'X-Manufacturer': sanitizeHeaderValue(deviceInfo.manufacturer),
      'X-Model': sanitizeHeaderValue(deviceInfo.model),
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
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
  }
  const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchConfig);
  clearTimeout(timeoutId);

  const contentType = response.headers.get('content-type');
  let data;

  try {
    const textResponse = await response.text();
    if (textResponse.trim().startsWith('<!DOCTYPE') || textResponse.trim().startsWith('<html')) {
      throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`);
    }
    if (contentType && contentType.includes('application/json')) {
      data = safeJSONParse(textResponse);
    } else {
      try {
        data = JSON.parse(textResponse);
      } catch (jsonError) {
        throw new Error(`Invalid JSON response from server. Status: ${response.status}`);
      }
    }
  } catch (parseError) {
      if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }
    throw parseError;
  }

  if (!response.ok) {
    if (response.status === 401) {
      const isAuthEndpoint = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');
      if (isAuthEndpoint) {
        await triggerAppLogout();
        throw new Error(data?.error || response.statusText || 'Your session has expired. Please log in again.');
      }

      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          const retryHeaders = {
            ...config.headers,
            Authorization: `Bearer ${newToken}`,
          };
          const retryConfig = { ...config, headers: retryHeaders };
          if (retryConfig.body && typeof retryConfig.body === 'object' && !isFormData) {
            retryConfig.body = JSON.stringify(retryConfig.body);
          }

          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT);

          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...retryConfig,
            signal: retryController.signal,
          });

          clearTimeout(retryTimeoutId);
          const retryContentType = retryResponse.headers.get('content-type');
          let retryData;
          if (retryContentType && retryContentType.includes('application/json')) {
            retryData = await retryResponse.json();
          } else {
            retryData = await retryResponse.text();
          }

          if (!retryResponse.ok) {
            throw new Error(retryData?.error || retryResponse.statusText || 'Request failed after token refresh');
          }

          return maskSensitiveData(retryData?.success !== undefined ? retryData : { success: true, data: retryData });
        }
      } catch (refreshError) {
        await triggerAppLogout();
        throw new Error(data?.error || response.statusText || 'Your session has expired. Please log in again.');
      }
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

  const result = data?.success !== undefined ? data : { success: true, data };
  return isAuthEndpoint ? result : maskSensitiveData(result);
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
      // On 429, back off exponentially before retrying so we don't hammer
      // an already-rate-limited endpoint and turn a single failure into a
      // logout/429 storm.
      if (error.message.includes('429') && attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 16000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      // Retry transient JSON parse / empty-response errors. These can occur
      // when a backend panic is recovered as a non-JSON body or when a
      // gateway returns a transient HTML error page for a 200-status cache
      // hit. A short backoff avoids hammering a struggling backend.
      const isTransientParseError = error.message.includes('Invalid JSON response from server') ||
                                    error.message.includes('Empty response from server');
      if (isTransientParseError && attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      // Treat any TypeError from fetch as a transient network error.
      // fetch only throws TypeError for network-level failures (CORS, connection
      // drops, empty responses, DNS failures, aborted requests, etc.).
      const isNetworkError = error instanceof TypeError ||
                              error.message.includes('NetworkError') ||
                              error.message.includes('Failed to fetch') ||
                              error.message.includes('Network request failed') ||
                              error.message.includes('ERR_EMPTY_RESPONSE') ||
                              error.message.includes('ERR_INCOMPLETE_CHUNKED_ENCODING') ||
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
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
     const response = await fetch(`${API_BASE_URL}/health`, {
       method: 'GET',
       headers: { 'Content-Type': 'application/json' },
       signal: controller.signal,
     });

     clearTimeout(timeoutId);
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
     const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
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
