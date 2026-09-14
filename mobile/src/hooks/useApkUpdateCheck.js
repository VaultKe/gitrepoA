import { useState, useEffect, useCallback } from 'react';
import apkUpdateService, { checkForApkUpdate, downloadAndInstallApk } from '../services/apkUpdateService';

const useApkUpdateCheck = (options = {}) => {
  const {
    autoCheck = true,
    checkIntervalMs = 30 * 60 * 1000,
    onUpdateFound = null,
  } = options;

  const [updateInfo, setUpdateInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const checkUpdate = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await checkForApkUpdate(force);
      setUpdateInfo(result);

      if (result.hasUpdate && typeof onUpdateFound === 'function') {
        onUpdateFound(result);
      }

      return result;
    } catch (err) {
      setError(err?.message || 'Failed to check for updates');
      return { hasUpdate: false, error: err?.message || 'Check failed' };
    } finally {
      setLoading(false);
    }
  }, [onUpdateFound]);

  const downloadUpdate = useCallback(async () => {
    if (!updateInfo?.latestVersion) {
      return { error: 'No update info available' };
    }

    const versionName = updateInfo.latestVersion.versionName ||
      updateInfo.latestVersion.latestVersionName;

    setDownloading(true);
    setError(null);

    try {
      const result = await downloadAndInstallApk(versionName, (progress) => {
        setDownloadProgress(progress.progress);
      });

      return { success: result };
    } catch (err) {
      setError(err?.message || 'Download failed');
      return { error: err?.message || 'Download failed' };
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  }, [updateInfo]);

  const clearCache = useCallback(async () => {
    await apkUpdateService.clearVersionCheckCache();
    setUpdateInfo(null);
  }, []);

  useEffect(() => {
    if (autoCheck) {
      checkUpdate(true);
      const intervalId = apkUpdateService.startBackgroundUpdateCheck(checkIntervalMs);
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [autoCheck, checkIntervalMs, checkUpdate]);

  const refetch = useCallback(() => checkUpdate(true), [checkUpdate]);

  return {
    updateInfo,
    loading,
    downloading,
    downloadProgress,
    error,
    checkUpdate: refetch,
    downloadUpdate,
    clearCache,
    hasUpdate: !!(updateInfo?.hasUpdate && updateInfo?.latestVersion),
    latestVersion: updateInfo?.latestVersion || null,
    isMandatory: updateInfo?.latestVersion?.isMandatory || false,
  };
};

export { useApkUpdateCheck, apkUpdateService };
export default useApkUpdateCheck;
