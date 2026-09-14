import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { uploadApk, getVersionHistory, deleteVersion } from '../services/versionCheck';
import { showToast } from '../components/Toast';

const ConsolePage = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    versionName: '',
    versionCode: '',
    releaseNotes: '',
    isMandatory: false,
    file: null,
  });

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const data = await getVersionHistory();
      setVersions(data);
    } catch (err) {
      showToast(`Failed to load versions: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.apk')) {
      showToast('Please select a valid .apk file', 'error');
      return;
    }
    setUploadForm({ ...uploadForm, file, versionName: file.name });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) {
      showToast('Please select an APK file', 'error');
      return;
    }
    if (!uploadForm.versionCode) {
      showToast('Version code is required', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('apk', uploadForm.file);
      formData.append('versionName', uploadForm.versionName);
      formData.append('versionCode', uploadForm.versionCode);
      formData.append('releaseNotes', uploadForm.releaseNotes);
      formData.append('isMandatory', uploadForm.isMandatory);

      const res = await uploadApk(formData);
      showToast(`APK v${uploadForm.versionCode} uploaded successfully`, 'success');
      setUploadForm({ versionName: '', versionCode: '', releaseNotes: '', isMandatory: false, file: null });
      e.target.reset();
      fetchVersions();
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (versionId) => {
    if (!confirm('Are you sure you want to remove this version?')) return;
    try {
      await deleteVersion(versionId);
      showToast('Version removed', 'success');
      fetchVersions();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <h1 className="text-2xl font-bold">Play Console</h1>
        <div className="flex" style={{ gap: '4px' }}>
          <button
            className={`btn btn-sm ${activeTab === 'upload' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('upload')}
          >
            Upload APK
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('history')}
          >
            Version History
          </button>
        </div>
      </div>

      {activeTab === 'upload' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Upload New APK</h2>
          <form onSubmit={handleUpload}>
            <div className="gap-4" style={{ marginBottom: '16px' }}>
              <label className="text-sm font-medium">APK File</label>
              <label
                className="input-file"
                style={{ padding: '24px', textAlign: 'center' }}
              >
                <input
                  type="file"
                  accept=".apk"
                  onChange={handleFileChange}
                  required
                  style={{ display: 'none' }}
                  id="apk-input"
                />
                <label htmlFor="apk-input" style={{ cursor: 'pointer', display: 'block' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {uploadForm.file ? uploadForm.file.name : 'Click to select APK file'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {uploadForm.file ? formatSize(uploadForm.file.size) : 'Max file size: 200MB'}
                  </div>
                </label>
              </label>
            </div>

            <div className="gap-4" style={{ marginBottom: '16px' }}>
              <label className="text-sm font-medium">Version Code</label>
              <input
                type="number"
                className="input"
                placeholder="e.g. 23"
                value={uploadForm.versionCode}
                onChange={(e) => setUploadForm({ ...uploadForm, versionCode: e.target.value })}
                required
              />
            </div>

            <div className="gap-4" style={{ marginBottom: '16px' }}>
              <label className="text-sm font-medium">Version Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 1.2.3"
                value={uploadForm.versionName}
                onChange={(e) => setUploadForm({ ...uploadForm, versionName: e.target.value })}
              />
            </div>

            <div className="gap-4" style={{ marginBottom: '16px' }}>
              <label className="text-sm font-medium">Release Notes</label>
              <textarea
                className="input"
                placeholder="What's new in this version?"
                rows={4}
                value={uploadForm.releaseNotes}
                onChange={(e) => setUploadForm({ ...uploadForm, releaseNotes: e.target.value })}
              />
            </div>

            <div className="flex" style={{ gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
              <label className="flex" style={{ gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={uploadForm.isMandatory}
                  onChange={(e) => setUploadForm({ ...uploadForm, isMandatory: e.target.checked })}
                />
                <span className="text-sm font-medium">Mandatory update</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload APK'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Version History</h2>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto' }}></div>
            </div>
          ) : versions.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: '40px' }}>
              No APK versions uploaded yet.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Version
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Code
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Size
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Release Date
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Status
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <div className="font-medium">{v.version_name || v.versionName}</div>
                      {v.release_notes && <div className="text-sm text-muted mt-1">{v.release_notes}</div>}
                    </td>
                    <td style={{ padding: '12px 8px' }}>{v.version_code || v.versionCode}</td>
                    <td style={{ padding: '12px 8px' }}>{formatSize(v.file_size || v.fileSize)}</td>
                    <td style={{ padding: '12px 8px' }}>{formatDate(v.created_at || v.createdAt)}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className="badge badge-success">Active</span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="btn btn-error btn-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default ConsolePage;
