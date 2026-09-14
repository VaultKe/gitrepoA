import { makeRequest } from './client';

const checkVersion = async (currentVersionCode, currentVersionName) => {
  return await makeRequest(
    `/apk/version-check?currentVersionCode=${currentVersionCode}&currentVersionName=${encodeURIComponent(currentVersionName || '')}`
  );
};

const getLatestApk = async () => {
  return await makeRequest('/apk/latest');
};

const getApkHistory = async (limit = 20, offset = 0) => {
  return await makeRequest(`/apk/history?limit=${limit}&offset=${offset}`);
};

const uploadApk = async (formData) => {
  const res = await makeRequest('/apk/upload', {
    method: 'POST',
    body: formData,
  });
  return res;
};

const deleteVersion = async (versionId) => {
  return await makeRequest(`/apk/version/${versionId}`, {
    method: 'DELETE',
  });
};

const getApkDownloadUrl = (versionName) => {
  const ApiService = require('./index').default;
  const baseUrl = ApiService.getUploadBaseUrl();
  return `${baseUrl}/api/v1/apk/download/${encodeURIComponent(versionName || 'latest')}`;
};

export {
  checkVersion,
  getLatestApk,
  getApkHistory,
  uploadApk,
  deleteVersion,
  getApkDownloadUrl,
};
