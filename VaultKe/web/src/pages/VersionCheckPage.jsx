import React, { useState, useEffect } from 'react';

const VersionCheckPage = () => {
  const [checkResult, setCheckResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [versionCode, setVersionCode] = useState('');
  const [versionName, setVersionName] = useState('');

  const urlParams = new URLSearchParams(window.location.search);

  useEffect(() => {
    const vc = urlParams.get('currentVersionCode') || '';
    const vn = urlParams.get('currentVersionName') || '';
    if (vc) setVersionCode(vc);
    if (vn) setVersionName(vn);
  }, []);

  const checkVersion = async () => {
    if (!versionCode) return;
    setLoading(true);
    try {
      const baseUrl = process.env.VITE_API_BASE_URL || 'https://gitrepoa-1.onrender.com/api/v1';
      const res = await fetch(
        `${baseUrl}/apk/version-check?currentVersionCode=${versionCode}&currentVersionName=${encodeURIComponent(versionName || '')}`
      );
      const data = await res.json();
      setCheckResult(data);
    } catch (err) {
      setCheckResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (versionCode && versionName) {
      checkVersion();
    }
  }, [versionCode, versionName]);

  return (
    <div className="app-container">
      <div className="page-wrapper">
        <div className="flex-center" style={{ minHeight: '80vh' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="flex-center" style={{ gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '40px', height: '40px',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '18px', color: 'var(--bg-primary)',
              }}>KV</div>
              <h1 className="text-xl font-bold">VaultKe Version Check</h1>
            </div>

            <p className="text-sm text-muted mb-4">
              This endpoint is used by the VaultKe APK to check for updates.
              When a new version is detected, users are notified and can
              download it safely.
            </p>

            <div className="gap-3" style={{ marginBottom: '16px' }}>
              <label className="text-sm font-medium">Version Code</label>
              <input
                type="number" className="input"
                value={versionCode}
                onChange={(e) => setVersionCode(e.target.value)}
                placeholder="e.g. 42"
              />
            </div>

            <div className="gap-3" style={{ marginBottom: '16px' }}>
              <label className="text-sm font-medium">Version Name</label>
              <input
                type="text" className="input"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="e.g. 2.1.0"
              />
            </div>

            <button
              onClick={checkVersion}
              className="btn btn-primary btn-full"
              disabled={loading || !versionCode}
            >
              {loading ? 'Checking...' : 'Check for Update'}
            </button>

            {checkResult && (
              <div className="mt-4" style={{
                padding: '16px',
                background: checkResult.hasUpdate
                  ? 'rgba(0, 209, 255, 0.08)'
                  : 'rgba(0, 255, 136, 0.08)',
                border: `1px solid ${checkResult.hasUpdate ? 'var(--accent-primary)' : 'var(--success)'}`,
                borderRadius: '8px',
              }}>
                <h3 className="font-semibold mb-2">
                  {checkResult.hasUpdate ? 'Update Available!' : 'Up to Date'}
                </h3>
                {checkResult.latestVersion && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <p><strong>Latest:</strong> v{checkResult.latestVersion.version_name || checkResult.latestVersion.versionName} (code: {checkResult.latestVersion.version_code || checkResult.latestVersion.versionCode})</p>
                    <p><strong>Mandatory:</strong> {checkResult.latestVersion.is_mandatory ? 'Yes' : 'No'}</p>
                    {checkResult.latestVersion.release_notes && (
                      <p className="mt-2"><strong>Release notes:</strong> {checkResult.latestVersion.release_notes}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionCheckPage;
