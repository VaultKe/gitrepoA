import React, { useState, useEffect } from 'react';
import { downloadApk, checkForUpdate } from '../services/versionCheck';
import api from '../services/api';
import { showToast } from '../components/Toast';

const DownloadPage = () => {
  const [latestVersion, setLatestVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [checking, setChecking] = useState(false);

  const fetchLatestVersion = async () => {
    setLoading(true);
    try {
      const res = await api.get('/apk/latest');
      const data = res.data || res;
      setLatestVersion(data);
    } catch (err) {
      showToast(`Failed to fetch version: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestVersion();
  }, []);

  const handleDownload = async () => {
    if (!latestVersion) return;
    setDownloading(true);
    try {
      await downloadApk(latestVersion.version_name || latestVersion.versionName);
      showToast('APK download started', 'success');
    } catch (err) {
      showToast(`Download failed: ${err.message}`, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleVersionCheck = async () => {
    setChecking(true);
    try {
      const result = await checkForUpdate({
        currentVersionCode: parseInt(latestVersion?.version_code || '1', 10) - 1,
        currentVersionName: appVersion,
        skipCache: true,
      });

      if (result.hasUpdate) {
        showToast(
          `New version available! Current: ${appVersion}, Latest: ${result.latestVersion?.version_name || result.latestVersion?.versionName}`,
          'info'
        );
        setLatestVersion(result.latestVersion);
      } else {
        showToast('You are on the latest version', 'info');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setChecking(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">VaultKe — APK Download</h1>

      <div className="card">
        {loading ? (
          <div className="flex-center" style={{ padding: '40px' }}>
            <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
          </div>
        ) : latestVersion ? (
          <div>
            <div className="flex-between mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  Version {latestVersion.version_name || latestVersion.versionName}
                  {latestVersion.is_mandatory && (
                    <span className="badge badge-warning ml-2">Mandatory</span>
                  )}
                </h2>
                <p className="text-sm text-muted mt-1">
                  Release code: {latestVersion.version_code || latestVersion.versionCode} · Released: {formatDate(latestVersion.created_at || latestVersion.createdAt)}
                </p>
                {latestVersion.release_notes && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-1">Release Notes:</p>
                    <p className="text-sm text-secondary">{latestVersion.release_notes}</p>
                  </div>
                )}
                <p className="text-sm text-muted mt-2">
                  File size: {formatSize(latestVersion.file_size || latestVersion.fileSize)}
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="btn btn-primary"
                style={{ padding: '12px 24px', fontSize: '15px' }}
                disabled={downloading}
              >
                {downloading ? 'Downloading...' : 'Download APK'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-muted">No APK versions available for download.</p>
        )}
      </div>

      <div className="card mt-4">
        <h2 className="text-lg font-semibold mb-3">Check for Updates</h2>
        <p className="text-sm text-muted mb-4">
          Your app can check this endpoint for new versions and notify users automatically.
        </p>
        <div className="flex" style={{ gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="text-sm font-medium mb-1">Your current version</label>
            <input
              type="text"
              className="input"
              value={appVersion}
              onChange={(e) => setAppVersion(e.target.value)}
              placeholder="e.g. 1.0.0"
            />
          </div>
          <button
            onClick={handleVersionCheck}
            className="btn btn-outline"
            disabled={checking || !latestVersion}
          >
            {checking ? 'Checking...' : 'Check for Update'}
          </button>
        </div>

        <div className="mt-4" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          <p>Version Check API Endpoint:</p>
          <code style={{
            background: 'rgba(0,0,0,0.3)',
            padding: '6px 10px',
            borderRadius: '4px',
            display: 'block',
            marginTop: '6px',
            wordBreak: 'break-all',
          }}>
            GET /api/v1/apk/version-check?currentVersionCode=1&currentVersionName=1.0.0
          </code>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
