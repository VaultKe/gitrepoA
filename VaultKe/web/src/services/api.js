const API_BASE_URL = typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : (process.env.VITE_API_BASE_URL || 'https://gitrepoa-1.onrender.com/api/v1');

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
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }
  return data;
};

const api = {
  baseURL: API_BASE_URL,

  async get(endpoint) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: { ...defaultHeaders, ...headers },
    });
    return handleResponse(res);
  },

  async post(endpoint, body) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { ...defaultHeaders, ...headers },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async postFormData(endpoint, formData) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { ...headers },
      body: formData,
    });
    return handleResponse(res);
  },

  async put(endpoint, body) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: { ...defaultHeaders, ...headers },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async del(endpoint) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { ...defaultHeaders, ...headers },
    });
    return handleResponse(res);
  },

  getBaseUrl() {
    return API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  },
};

export default api;
