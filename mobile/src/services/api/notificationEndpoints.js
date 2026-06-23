import { makeRequest, makeRequestWithRetry } from './client';

const getNotifications = async (limit = 20, offset = 0) => {
  return await makeRequest(`/notifications/?limit=${limit}&offset=${offset}`);
};

const getUnreadNotificationCount = async () => {
  return await makeRequest('/notifications/unread-count');
};

const markNotificationAsRead = async (notificationId) => {
  return await makeRequest(`/notifications/${notificationId}/read`, {
    method: 'PUT',
  });
};

const markAllNotificationsAsRead = async () => {
  return await makeRequest('/notifications/read-all', {
    method: 'POST',
  });
};

const deleteNotification = async (notificationId) => {
  return await makeRequest(`/notifications/${notificationId}`, {
    method: 'DELETE',
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
  getNotificationPreferences,
  updateNotificationPreferences,
  getAvailableNotificationSounds,
  testNotificationSound,
  getNotificationSettings,
  updateNotificationSettings,
};