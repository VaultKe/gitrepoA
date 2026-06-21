import * as authEndpoints from './authEndpoints';
import * as userEndpoints from './userEndpoints';
import * as walletEndpoints from './walletEndpoints';
import * as chamaEndpoints from './chamaEndpoints';
import * as loanEndpoints from './loanEndpoints';
import * as chatEndpoints from './chatEndpoints';
import * as notificationEndpoints from './notificationEndpoints';
import * as learningEndpoints from './learningEndpoints';
import * as settingsEndpoints from './settingsEndpoints';
import * as invitationEndpoints from './invitationEndpoints';
import * as contributionEndpoints from './contributionEndpoints';
import * as welfareEndpoints from './welfareEndpoints';
import * as meetingEndpoints from './meetingEndpoints';
import { makeRequest, makeRequestWithRetry, checkBackendConnectivity, checkHealth, API_BASE_URL, REQUEST_TIMEOUT } from './client';
import { getAuthToken, setAuthToken, removeAuthToken, storeUserData, getDeviceInfo } from './auth';

const ApiService = {
  ...authEndpoints,
  ...userEndpoints,
  ...walletEndpoints,
  ...chamaEndpoints,
  ...loanEndpoints,
  ...chatEndpoints,
  ...notificationEndpoints,
  ...learningEndpoints,
  ...settingsEndpoints,
  ...invitationEndpoints,
  ...contributionEndpoints,
  ...welfareEndpoints,
  ...meetingEndpoints,
  makeRequest,
  makeRequestWithRetry,
  checkBackendConnectivity,
  checkHealth,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  storeUserData,
  getDeviceInfo,
  getApiBaseUrl: () => API_BASE_URL,
};

export default ApiService;