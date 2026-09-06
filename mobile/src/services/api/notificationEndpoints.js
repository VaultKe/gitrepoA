import { makeRequest, makeRequestWithRetry, invalidateCache } from './client';

// The auto-invalidation in client.js keys off the mutation's own path
// (e.g. /notifications/<id>/read), which never matches the cached list key
// (GET:/notifications/?limit=...). Clear the list + unread-count cache
// explicitly so a read/deleted notification does not reappear from the 30s
// response cache on the next reload.
const invalidateNotificationCaches = () => {
  invalidateCache('/notifications/');
  invalidateCache('/notifications?');
  invalidateCache('/notifications/unread-count');
};

const getNotifications = async (limit = 20, offset = 0) => {
  return await makeRequest(`/notifications/?limit=${limit}&offset=${offset}`);
};

const getUnreadNotificationCount = async () => {
  return await makeRequestWithRetry('/notifications/unread-count');
};

const markNotificationAsRead = async (notificationId) => {
  const res = await makeRequest(`/notifications/${notificationId}/read`, {
    method: 'PUT',
  });
  invalidateNotificationCaches();
  return res;
};

const markAllNotificationsAsRead = async () => {
  const res = await makeRequest('/notifications/read-all', {
    method: 'POST',
  });
  invalidateNotificationCaches();
  return res;
};

const deleteNotification = async (notificationId) => {
  const res = await makeRequest(`/notifications/${notificationId}`, {
    method: 'DELETE',
  });
  invalidateNotificationCaches();
  return res;
};

const registerPushToken = async ({ token, platform, deviceName } = {}) => {
  return await makeRequest('/notifications/push-token', {
    method: 'POST',
    body: { token, platform, deviceName },
  });
};

const unregisterPushToken = async ({ token } = {}) => {
  return await makeRequest('/notifications/push-token/remove', {
    method: 'POST',
    body: { token },
  });
};

const getNotificationPreferences = async () => {
  return await makeRequest('/notifications/preferences', { method: 'GET' });
};

const updateNotificationPreferences = async (preferences) => {
  return await makeRequest('/notifications/preferences', {
    method: 'PUT',
    body: preferences,
  });
};

const getAvailableNotificationSounds = async () => {
  return await makeRequest('/notifications/sounds', { method: 'GET' });
};

const testNotificationSound = async (soundId) => {
  return await makeRequest('/notifications/test-sound', {
    method: 'POST',
    body: { sound_id: soundId },
  });
};

const getNotificationSettings = async () => {
  return await makeRequest('/notifications/settings', { method: 'GET' });
};

const updateNotificationSettings = async (settings) => {
  return await makeRequest('/notifications/settings', {
    method: 'PUT',
    body: settings,
  });
};

export {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  registerPushToken,
  unregisterPushToken,
  getNotificationPreferences,
  updateNotificationPreferences,
  getAvailableNotificationSounds,
  testNotificationSound,
  getNotificationSettings,
  updateNotificationSettings,
};