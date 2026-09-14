import * as authEndpoints from './authEndpoints';
import * as userEndpoints from './userEndpoints';
import * as walletEndpoints from './walletEndpoints';
import * as chamaEndpoints from './chamaEndpoints';
import * as loanEndpoints from './loanEndpoints';
import * as chatEndpoints from './chatEndpoints';
import * as notificationEndpoints from './notificationEndpoints';
import * as settingsEndpoints from './settingsEndpoints';
import * as invitationEndpoints from './invitationEndpoints';
import * as contributionEndpoints from './contributionEndpoints';
import * as welfareEndpoints from './welfareEndpoints';
import * as meetingEndpoints from './meetingEndpoints';
import * as apkEndpoints from './apkEndpoints';
import { makeRequest, makeRequestWithRetry, checkBackendConnectivity, checkHealth, invalidateCache, clearApiCache, API_BASE_URL, REQUEST_TIMEOUT } from './client';
import { getAuthToken, setAuthToken, removeAuthToken, storeUserData, getDeviceInfo } from './auth';

// Static/uploaded assets (avatars, rules PDFs, etc.) are served by the backend
// from the root path "/uploads/...", NOT under "/api/v1". Strip the "/api/v1"
// suffix so asset URLs resolve correctly (otherwise they 404 under /api/v1/uploads).
const uploadBaseUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const ApiService = {
  ...authEndpoints,
  ...userEndpoints,
  ...walletEndpoints,
  ...chamaEndpoints,
  ...loanEndpoints,
  ...chatEndpoints,
	...notificationEndpoints,
	...settingsEndpoints,
  ...invitationEndpoints,
  ...contributionEndpoints,
  ...welfareEndpoints,
  ...meetingEndpoints,
	...apkEndpoints,
  makeRequest,
  makeRequestWithRetry,
  checkBackendConnectivity,
  checkHealth,
  invalidateCache,
  clearApiCache,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  storeUserData,
  getDeviceInfo,
  getApiBaseUrl: () => API_BASE_URL,
  getUploadBaseUrl: () => uploadBaseUrl,
  uploadBaseUrl,
  baseURL: API_BASE_URL,
};

export default ApiService;