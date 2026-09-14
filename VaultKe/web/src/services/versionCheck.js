import api from './api';

const DEFAULT_OPTIONS = {
  currentVersionCode: 1,
  currentVersionName: '1.0.0',
  skipCache: false,
};

const determineUpdateType = (currentCode, latestCode) => {
  if (!latestCode || latestCode <= currentCode) return 'none';
  if (latestCode - currentCode >= 1000) return 'major';
  if (latestCode - currentCode >= 10) return 'minor';
  return 'patch';
};

export const checkForUpdate = async (options = {}) => {
  const { currentVersionCode, currentVersionName, skipCache } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const cacheKey = 'vaultke_version_check';
  const now = Date.now();

  if (!skipCache) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (now - parsed.timestamp < 60000) {
          const cachedLatest = parsed.data.latestVersion;
          if (cachedLatest && cachedLatest.latestVersionCode > currentVersionCode) {
            return parsed.data;
          }
        }
      }
    } catch (_) {}
  }

  try {
    const response = await api.get(
      `/apk/version-check?currentVersionCode=${currentVersionCode}&currentVersionName=${encodeURIComponent(currentVersionName || '')}`
    );

    const latestVersion = response.data?.latest || response.data;
    const hasUpdate = latestVersion && latestVersion.latestVersionCode > currentVersionCode;

    const result = {
      hasUpdate: !!hasUpdate,
      currentVersionCode,
      latestVersion: latestVersion || null,
      updateType: determineUpdateType(currentVersionCode, latestVersion?.latest_version_code || latestVersion?.latestVersionCode),
      checkedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: result }));
    } catch (_) {}

    return result;
  } catch (error) {
    throw new Error(`Version check failed: ${error.message}`);
  }
};

export const downloadApk = async (versionName, onProgress) => {
  try {
    const baseUrl = api.getBaseUrl();
    const url = `${baseUrl}/api/v1/apk/download/${encodeURIComponent(versionName || '')}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const contentDisposition = response.headers.get('content-disposition');
    let filename = `vaultke-${versionName || 'latest'}.apk`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

    return { filename, size: blob.size };
  } catch (error) {
    throw new Error(`APK download failed: ${error.message}`);
  }
};

export const getVersionHistory = async () => {
  const response = await api.get('/apk/history');
  return response.data || response || [];
};

export const uploadApk = async (formData) => {
  const response = await api.postFormData('/apk/upload', formData);
  return response.data || response;
};

export const deleteVersion = async (versionId) => {
  const response = await api.del(`/apk/version/${versionId}`);
  return response.data || response;
};
