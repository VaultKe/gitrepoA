const TOKEN_KEY = 'vaultke_auth_token';
const REFRESH_KEY = 'vaultke_refresh_token';
const USER_KEY = 'vaultke_user_data';

const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

export const getAuthToken = async () => {
  if (!storage) return null;
  return storage.getItem(TOKEN_KEY);
};

export const setAuthToken = async (token) => {
  if (!storage) return;
  storage.setItem(TOKEN_KEY, token);
};

export const removeAuthToken = async () => {
  if (!storage) return;
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(REFRESH_KEY);
  storage.removeItem(USER_KEY);
};

export const getRefreshToken = async () => {
  if (!storage) return null;
  return storage.getItem(REFRESH_KEY);
};

export const setRefreshToken = async (token) => {
  if (!storage) return;
  storage.setItem(REFRESH_KEY, token);
};

export const storeUserData = async (user) => {
  if (!storage) return;
  storage.setItem(USER_KEY, JSON.stringify(user));
};

export const getStoredUserData = async () => {
  if (!storage) return null;
  const data = storage.getItem(USER_KEY);
  if (data) {
    try { return JSON.parse(data); } catch (_) { return null; }
  }
  return null;
};
