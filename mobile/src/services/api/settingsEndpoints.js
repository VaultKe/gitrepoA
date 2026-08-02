import { makeRequest, makeRequestWithRetry, API_BASE_URL } from './client';
import { getAuthToken } from './auth';

const getNotificationPreferences = async () => {
  return await makeRequest('/notifications/preferences', { method: 'GET' });
};

const updateNotificationPreferences = async (preferences) => {
  return await makeRequest('/notifications/preferences', {
    method: 'PUT',
    body: preferences,
  });
};

const getPrivacySettings = async () => {
  return await makeRequest('/users/privacy-settings');
};

const updatePrivacySettings = async (privacySettings) => {
  return await makeRequest('/users/privacy-settings', {
    method: 'PUT',
    body: privacySettings,
  });
};

const getSecuritySettings = async () => {
  return await makeRequest('/users/security-settings');
};

const updateSecuritySettings = async (securitySettings) => {
  return await makeRequest('/users/security-settings', {
    method: 'PUT',
    body: securitySettings,
  });
};

const getUserPreferences = async () => {
  return await makeRequest('/users/preferences');
};

const updateUserPreferences = async (preferences) => {
  return await makeRequest('/users/preferences', {
    method: 'PUT',
    body: preferences,
  });
};

const updateUserSettings = async (settings) => {
  const results = {};
  if (settings.notifications) {
    results.notifications = await updateNotificationPreferences(settings.notifications);
  }
  if (settings.privacy) {
    results.privacy = await updatePrivacySettings(settings.privacy);
  }
  if (settings.security) {
    results.security = await updateSecuritySettings(settings.security);
  }
  if (settings.preferences) {
    results.preferences = await updateUserPreferences(settings.preferences);
  }
  return {
    success: true,
    message: 'Settings updated successfully',
    data: results
  };
};

const deleteAccount = async () => {
  return await makeRequest('/users/delete-account', { method: 'DELETE' });
};

const exportUserData = async () => {
  return await makeRequest('/users/export-data');
};

const getTransparencyFeed = async () => {
  return await makeRequest('/account/transparency-feed');
};

const getEligibleLoanMembers = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/eligible-loan-members`);
};

const getEligibleWelfareMembers = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/eligible-welfare-members`);
};

const getEligibleDividendMembers = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/eligible-dividend-members`);
};

const getChamaDividendDeclarations = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/dividends/`);
};

const getEligibleSharesMembers = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/eligible-shares-members`);
};

const getEligibleSavingsMembers = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/eligible-savings-members`);
};

const getEligibleOtherMembers = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/eligible-other-members`);
};

const exportSavingsTransactions = async (chamaId) => {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}/chamas/${chamaId}/savings/export`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Export failed: ${response.status} ${errorText}`);
  }

  // Return the blob directly for the export function
  return await response.blob();
};

const getTransparencyFeedChama = async (chamaId, filters = {}) => {
  const queryParams = new URLSearchParams();
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  const url = `/chamas/${chamaId}/transparency-feed${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  return await makeRequest(url);
};

const getAccountNotifications = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/account-notifications`);
};

const sendSystemNotification = async (notificationData) => {
  return await makeRequest('/notifications/system', {
    method: 'POST',
    body: notificationData
  });
};

const getMemberRole = async (chamaId, memberId) => {
  return await makeRequestWithRetry(`/chamas/${chamaId}/members/${memberId}/role`);
};

const createChamaShares = async (chamaId, shareData) => {
  return await makeRequest(`/chamas/${chamaId}/shares/offering/`, {
    method: 'POST',
    body: shareData
  });
};

const getChamaShareOfferings = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/shares/offerings`);
};

const declareChamaDividends = async (chamaId, dividendData) => {
  return await makeRequest(`/chamas/${chamaId}/dividends/`, {
    method: 'POST',
    body: dividendData
  });
};

const validateSystemSecurity = async (chamaId) => {
  return await makeRequest(`/chamas/${chamaId}/validate-security`);
};

const logSecurityEvent = async (eventData) => {
  return await makeRequest('/account/security-events', {
    method: 'POST',
    body: JSON.stringify(eventData)
  });
};

export {
  getNotificationPreferences,
  updateNotificationPreferences,
  getPrivacySettings,
  updatePrivacySettings,
  getSecuritySettings,
  updateSecuritySettings,
  getUserPreferences,
  updateUserPreferences,
  updateUserSettings,
  deleteAccount,
  exportUserData,
  getTransparencyFeed,
  getEligibleLoanMembers,
  getEligibleWelfareMembers,
  getEligibleDividendMembers,
  getChamaDividendDeclarations,
  getEligibleSharesMembers,
  getEligibleSavingsMembers,
  getEligibleOtherMembers,
  exportSavingsTransactions,
  getTransparencyFeedChama,
  getAccountNotifications,
  sendSystemNotification,
  getMemberRole,
  createChamaShares,
  getChamaShareOfferings,
  declareChamaDividends,
  validateSystemSecurity,
  logSecurityEvent,
};