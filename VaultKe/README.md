# VaultKe — APK Distribution Platform

Self-hosted APK distribution and versioning system for the VaultKe mobile app.

## Directory Structure

```
VaultKe/
├── web/                    # React frontend (GitHub Pages static build)
│   ├── src/
│   │   ├── components/     # UI components (Header, Footer, Layout, Toast, LoadingSpinner)
│   │   ├── pages/          # Page views (Login, Console, Download, VersionCheck)
│   │   ├── services/       # API client & version checking
│   │   └── styles/         # CSS (white-mode theme)
│   └── dist/               # Static build output
├── .env.example            # Environment configuration template
└── README.md               # This file
```

## Backend Integration

APK management endpoints are registered in the existing VaultKe Go API backend
(`API/main-server`). The database migration is auto-applied on server startup.

## Configuration

### Web Frontend

| Variable             | Default                                  | Description                          |
| -------------------- | ---------------------------------------- | ------------------------------------ |
| `VITE_API_BASE_URL`  | `https://gitrepoa-1.onrender.com/api/v1` | VaultKe API base URL (with `/api/v1`)|

### Backend (.env)

No additional environment variables are required. APKs are stored in the
`uploads/apk/` subdirectory under the configured `UPLOAD_PATH`.

## API Endpoints

### Public (no auth required)

| Method | Endpoint                     | Description                                              |
| ------ | ---------------------------- | ------------------------------------------------------- |
| GET    | `/api/v1/apk/latest`         | Fetch the latest active APK version info                |
| GET    | `/api/v1/apk/version-check`  | Version check for APK clients (query: `currentVersionCode`, `currentVersionName`) |
| GET    | `/api/v1/apk/history`        | List all APK versions (newest first)                    |
| GET    | `/api/v1/apk/download/:version` | Download a specific APK by version name (streamed as binary, no source code exposed) |

### Protected (admin/publisher only)

| Method   | Endpoint                  | Description                                  |
| -------- | ------------------------- | -------------------------------------------- |
| POST     | `/api/v1/apk/upload`      | Upload a new APK (multipart form: `apk`, `versionCode`, `versionName`, `releaseNotes`, `isMandatory`) |
| DELETE   | `/api/v1/apk/version/:id` | Delete an APK version by ID (removes DB row + file) |

### Version Check Request

```http
GET /api/v1/apk/version-check?currentVersionCode=23&currentVersionName=2.1.0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "latest": {
      "latestVersionCode": 42,
      "latestVersionName": "2.3.1",
      "versionCode": 42,
      "versionName": "2.3.1",
      "releaseNotes": "Bug fixes and performance improvements",
      "releaseDate": "2026-09-14T10:30:00Z",
      "fileSize": 25678901,
      "downloadUrl": "/api/v1/apk/download/2.3.1",
      "isMandatory": false
    },
    "hasUpdate": true,
    "updateType": "minor",
    "currentVersionCode": 23,
    "currentVersionName": "2.1.0"
  }
}
```

## How It Works

1. **Publisher** uploads a new APK via the Play Console (`/console`).
2. The backend stores the APK binary in `uploads/apk/` and metadata in the `apk_versions` table.
3. The `is_latest` flag is set on the new version and cleared on the old.
4. **End users** visit `/download` in their browser or check via the APK's version-check endpoint.
5. **APK clients** (mobile app) periodically call `version-check` and show local notifications when a new version is available.
6. **No code is exposed** — only binary APK downloads are served. Source code, keys, and signing configs are never available via the API.

## Mobile App Integration

The mobile app uses `src/services/apkUpdateService.js` and the `useApkUpdateCheck` hook
to:

- Check for updates on app start and periodically (every 30 minutes in background)
- Schedule a local notification when a new version is available
- Download and install the APK directly from the backend

```javascript
import { useApkUpdateCheck } from '../hooks/useApkUpdateCheck';

const { hasUpdate, latestVersion, downloadUpdate, loading } = useApkUpdateCheck({
  autoCheck: true,
  onUpdateFound: (info) => {
    // Show in-app update prompt
    console.log('New version:', info.latestVersion.versionName);
  },
});
```

## Deployment

### Web Frontend (GitHub Pages)

```bash
cd VaultKe/web
npm install
npm run build
# Or deploy to GitHub Pages:
npm run deploy
```

### Backend

The backend endpoints are part of the existing VaultKe API server. No additional
deployment is needed — just restart the server after updating the code.

### Docker

Add to `docker-compose.yml` if deploying independently:

```yaml
apk-uploads:
  # Ensure the uploads/apk volume persists across restarts
```
