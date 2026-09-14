import { getApiBaseUrl } from './runtimeConfig';

const defaultHeaders = {
  'Content-Type': 'application/json',
};

const getAuthTokenFromStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('vaultke_auth_token') || null;
  }
  return null;
};

const getAuthHeaders = async () => {
  const token = getAuthTokenFromStorage();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleResponse = async (response) => {
  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { success: response.ok, data: await response.text() };
  }
  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }
  return data;
};

let cachedBaseUrl = null;

const api = {
  baseURL: '/api/v1',

  async get(endpoint) {
    const baseUrl = cachedBaseUrl || await getApiBaseUrl();
    cachedBaseUrl = baseUrl;
    const headers = await getAuthHeaders();
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: { ...defaultHeaders, ...headers },
    });
    return handleResponse(res);
  },

  async post(endpoint, body) {
    const baseUrl = cachedBaseUrl || await getApiBaseUrl();
    cachedBaseUrl = baseUrl;
    const headers = await getAuthHeaders();
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { ...defaultHeaders, ...headers },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async postFormData(endpoint, formData) {
    const baseUrl = cachedBaseUrl || await getApiBaseUrl();
    cachedBaseUrl = baseUrl;
    const headers = await getAuthHeaders();
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { ...headers },
      body: formData,
    });
    return handleResponse(res);
  },

  async put(endpoint, body) {
    const baseUrl = cachedBaseUrl || await getApiBaseUrl();
    cachedBaseUrl = baseUrl;
    const headers = await getAuthHeaders();
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: { ...defaultHeaders, ...headers },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async del(endpoint) {
    const baseUrl = cachedBaseUrl || await getApiBaseUrl();
    cachedBaseUrl = baseUrl;
    const headers = await getAuthHeaders();
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: { ...defaultHeaders, ...headers },
    });
    return handleResponse(res);
  },

  async getBaseUrl() {
    if (cachedBaseUrl) return cachedBaseUrl;
    return getApiBaseUrl().then((url) => {
      cachedBaseUrl = url;
      return url;
    });
  },
};

export default api;
