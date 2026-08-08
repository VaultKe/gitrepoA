import { API_BASE_URL, REQUEST_TIMEOUT, getAuthToken, getRefreshToken, setAuthToken, setRefreshToken, getDeviceInfo, sanitizeHeaderValue } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerAppLogout, getLoggingOut } from '../../utils/authLogout';
import { maskSensitiveData } from '../../utils/formatters';

let isRefreshing = false;
let refreshPromise = null;

/**
 * Endpoints that never return PII and should bypass the expensive
 * maskSensitiveData deep-clone in makeRequest.  Matching is done with
 * String.prototype.includes so a single prefix like "/chamas" covers
 * /chamas/my, /chamas/:id, /chamas/:id/members, etc.
 */
const UNMASKED_ENDPOINTS = [
  '/chamas/',          // chama listings, details, members, transactions
  '/transactions',
  '/meetings',
  '/contributions',
  '/wallets/',
  '/merry-go-rounds',
  '/notifications',
  '/groups',
  '/activity',
  '/dashboard',
];

const isUnmaskedEndpoint = (endpoint) =>
  UNMASKED_ENDPOINTS.some((pattern) => endpoint.includes(pattern));

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
      if (!getLoggingOut()) {
        await triggerAppLogout();
      }
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
      const startChar = trimmed.charAt(0);
      if (startChar === '{' || startChar === '[') {
        const endChar = startChar === '{' ? '}' : ']';
        const startIdx = trimmed.indexOf(startChar);
        if (startIdx !== -1) {
          // Find the matching end character by counting depth so we
          // only parse the first complete JSON value even if the
          // response body contains duplicate JSON objects.
          let depth = 0;
          let endIdx = -1;
          for (let i = startIdx; i < trimmed.length; i++) {
            if (trimmed[i] === startChar) depth++;
            else if (trimmed[i] === endChar) depth--;
            if (depth === 0) {
              endIdx = i;
              break;
            }
          }
          if (endIdx !== -1) {
            try {
              return JSON.parse(trimmed.substring(startIdx, endIdx + 1));
            } catch (_) {
              // fall through to throw below
            }
          }
        }
      }
      throw new Error(`Invalid JSON response from server`);
    }
  };

  const makeRequest = async (endpoint, options = {}) => {
    // Bail out early if a logout is already in progress — prevents a cascade
    // of failed requests that would each independently call triggerAppLogout
    if (getLoggingOut()) {
      throw new Error('Request cancelled — user is logging out');
    }

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
        if (!getLoggingOut()) {
          await triggerAppLogout();
        }
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
        if (!getLoggingOut()) {
          await triggerAppLogout();
        }
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

  // maskSensitiveData deep-clones and recursively processes every field in the
  // response — extremely expensive for large payloads (e.g. chama listings with
  // 50+ items).  Only apply it to endpoints that may return PII.  Everything
  // else returns the original parsed object, avoiding the memory/CPU overhead
  // of a full deep clone.
  if (isAuthEndpoint) {
    return result;
  }

  const shouldMask = !isUnmaskedEndpoint(endpoint);
  return shouldMask ? maskSensitiveData(result) : result;
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
