import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { securityCheck } from './rootDetection';

const VERSION_CHECK_KEY = 'vaultke_last_version_check';
const VERSION_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const getAppVersionCode = () => {
  try {
    const code = Application.nativeBuildVersion;
    return code ? String(code) : '1';
  } catch (e) {
    return '1';
  }
};

const getAppVersionName = () => {
  try {
    return Application.nativeApplicationVersion || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
};

const getHeaders = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  } catch (e) {
    return { 'Content-Type': 'application/json' };
  }
};

export const checkForApkUpdate = async (force = false) => {
  const isSecure = await securityCheck();
  if (!isSecure) {
    console.warn('[APK_UPDATE] Device security check failed - update check blocked on rooted/emulator device');
    return {
      hasUpdate: false,
      currentVersionCode: getAppVersionCode(),
      currentVersionName: getAppVersionName(),
      latestVersion: null,
      blocked: true,
      error: 'Security check failed: device is rooted or running on an emulator',
    };
  }

  const now = Date.now();

  if (!force) {
    try {
      const cached = await AsyncStorage.getItem(VERSION_CHECK_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (now - parsed.timestamp < VERSION_CACHE_TTL_MS && parsed.data?.hasUpdate === false) {
          return parsed.data;
        }
      }
    } catch (_) {}
  }

  const versionCode = getAppVersionCode();
  const versionName = getAppVersionName();
  const currentCode = parseInt(versionCode, 10) || 0;

  try {
    const ApiService = (await import('./api')).default;
    const apiUrl = ApiService.getApiBaseUrl();
    const response = await fetch(
      `${apiUrl}/apk/version-check?currentVersionCode=${currentCode}&currentVersionName=${encodeURIComponent(versionName)}`,
      {
        method: 'GET',
        headers: await getHeaders(),
      }
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Version check failed');
    }

    const latest = data.data?.latest || null;
    const result = {
      hasUpdate: data.data?.hasUpdate || false,
      currentVersionCode: currentCode,
      currentVersionName: versionName,
      latestVersion: latest,
      updateType: data.data?.updateType || 'none',
      checkedAt: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(VERSION_CHECK_KEY, JSON.stringify({
        timestamp: now,
        data: result,
      }));
    } catch (_) {}

    if (result.hasUpdate && latest) {
      await scheduleUpdateNotification(latest);
    }

    return result;
  } catch (error) {
    console.warn('[APK_UPDATE] Version check failed:', error?.message || error);
    return {
      hasUpdate: false,
      currentVersionCode: currentCode,
      currentVersionName: versionName,
      latestVersion: null,
      error: error.message,
    };
  }
};

const scheduleUpdateNotification = async (latestVersion) => {
  const isMandatory = latestVersion.isMandatory;
  const title = isMandatory ? 'Update Required' : 'New Version Available';
  const versionName = latestVersion.versionName || latestVersion.latestVersionName;
  const versionCode = latestVersion.versionCode || latestVersion.latestVersionCode;

  const body = isMandatory
    ? `A new version (${versionName}) is required. Please update VaultKe.`
    : `New version ${versionName} is available. Tap to update.`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'apk_update',
          versionCode: versionCode,
          versionName: versionName,
          isMandatory: isMandatory,
        },
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('[APK_UPDATE] Failed to schedule update notification:', error?.message || error);
  }
};

export const downloadApk = async (versionName, onProgress) => {
  const ApiService = (await import('./api')).default;
  const baseUrl = ApiService.getUploadBaseUrl();
  const downloadUrl = `${baseUrl}/api/v1/apk/download/${encodeURIComponent(versionName)}`;
  const localPath = `${FileSystem.documentDirectory}vaultke-${versionName}.apk`;

  try {
    const downloadRes = await FileSystem.createDownloadResumable(
      downloadUrl,
      localPath,
      {},
      (progress) => {
        if (onProgress && progress.totalBytesExpectedToWrite > 0) {
          onProgress({
            progress: progress.totalBytesWritten / progress.totalBytesExpectedToWrite,
          });
        }
      }
    );

    const { uri } = await downloadRes.downloadAsync();

    if (!uri) {
      throw new Error('Download failed — no file URI returned');
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);

    return {
      uri: uri,
      path: fileInfo.uri,
      size: fileInfo.size,
    };
  } catch (error) {
    console.error('[APK_UPDATE] Download failed:', error);
    throw error;
  }
};

export const installApk = async (fileUri) => {
  if (!fileUri) {
    return false;
  }

  try {
    if (Platform.OS === 'android') {
      await FileSystem.openUriAsync(fileUri);
      return true;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.android.package-archive',
        dialogTitle: 'Install VaultKe Update',
        UIMessage: 'Install VaultKe',
      });
      return true;
    }

    await FileSystem.openUriAsync(fileUri);
    return true;
  } catch (error) {
    console.error('[APK_UPDATE] Install failed:', error);
    return false;
  }
};

export const downloadAndInstallApk = async (versionName, onProgress) => {
  try {
    const downloadResult = await downloadApk(versionName, onProgress);

    if (__DEV__) {
      console.log('[APK_UPDATE] Downloaded APK to:', downloadResult.uri);
    }

    const installed = await installApk(downloadResult.uri);
    return installed;
  } catch (error) {
    console.error('[APK_UPDATE] Download and install failed:', error);
    throw error;
  }
};

export const getStoredVersionCheckResult = async () => {
  try {
    const cached = await AsyncStorage.getItem(VERSION_CHECK_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed.data;
    }
  } catch (_) {}
  return null;
};

export const clearVersionCheckCache = async () => {
  try {
    await AsyncStorage.removeItem(VERSION_CHECK_KEY);
  } catch (_) {}
};

export const startBackgroundUpdateCheck = (intervalMs = 30 * 60 * 1000) => {
  const intervalId = setInterval(() => {
    checkForApkUpdate(true).catch((err) => {
      console.warn('[APK_UPDATE] Background check failed:', err?.message || err);
    });
  }, intervalMs);

  return intervalId;
};

export const checkForUpdateIfNeeded = async () => {
  const cached = await getStoredVersionCheckResult();

  if (cached && cached.hasUpdate) {
    return cached;
  }

  return await checkForApkUpdate(false);
};

export default {
  checkForApkUpdate,
  checkForUpdateIfNeeded,
  downloadApk,
  downloadAndInstallApk,
  installApk,
  getStoredVersionCheckResult,
  clearVersionCheckCache,
  startBackgroundUpdateCheck,
};
