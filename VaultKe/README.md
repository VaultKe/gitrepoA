# VaultKe — APK Distribution Platform

Self-hosted APK distribution and versioning system for the VaultKe mobile app.

## Directory Structure

```
VaultKe/
├── src/
│   ├── components/     # UI components (Header, Footer, Layout, Toast, LoadingSpinner)
│   ├── pages/          # Page views (Login, Console, Download, VersionCheck)
│   ├── services/       # API client, runtime config, version checking
│   ├── hooks/          # React hooks
│   └── styles/         # CSS (white-mode theme matching mobile app)
├── public/             # Public assets (config.json runtime config)
│   └── config.json     # Runtime API URL config (NOT committed with real URL)
├── dist/               # Static build output (deploy to GitHub Pages)
├── package.json        # npm package manifest
├── vite.config.js      # Vite build configuration
└── index.html          # HTML entry point
```

## How It Works

1. **Publisher** uploads a new APK via the Play Console (`/console`).
2. The backend (existing VaultKe Go API) stores the APK binary in `uploads/apk/`
   and metadata in the `apk_versions` table.
3. The `is_latest` flag is set on the new version and cleared on the old.
4. **End users** visit `/download` to see the latest APK and get the download link.
5. **APK clients** (mobile app) periodically call `/apk/version-check` and show
   local notifications when a new version is available — even if they already
   have the latest version, the check still runs and notifies.
6. **No code is exposed** — only the binary APK file is served. Source code,
   signing keys, and build configs are never available via the API.

## Configuration

### Runtime Config (Backend URL)

The backend URL is **not hardcoded** in the source code. It's loaded at runtime
from `/config.json`:

1. On app startup, the frontend fetches `config.json` from the same origin.
2. If `config.json` has `API_BASE_URL` set, it uses that.
3. If empty, it falls back to `/api/v1` (same-origin relative path).
4. The `VITE_API_BASE_URL` env var can be used for local development only.

**Production deployment:** Edit `dist/config.json` on the server to set the real
API URL. This file is never in source control with the real URL.

### Backend (.env on the Go API server)

No additional environment variables are required. APKs are stored in the
`uploads/apk/` subdirectory under the configured `UPLOAD_PATH`.

## API Endpoints

### Public (no auth required)

| Method | Endpoint                          | Description                                             |
| ------ | --------------------------------- | ------------------------------------------------------ |
| GET    | `/api/v1/apk/latest`              | Fetch the latest active APK version info               |
| GET    | `/api/v1/apk/version-check`       | Version check for APK clients                          |
| GET    | `/api/v1/apk/history`             | List all APK versions (newest first)                   |
| GET    | `/api/v1/apk/download/:version`   | Download APK (streamed as binary, no source code)      |

### Protected (admin/publisher only)

| Method   | Endpoint                     | Description                                                |
| -------- | ---------------------------- | --------------------------------------------------------- |
| POST     | `/api/v1/apk/upload`         | Upload new APK (multipart: apk, versionCode, versionName) |
| DELETE   | `/api/v1/apk/version/:id`    | Delete an APK version (removes DB row + file)             |

### Version Check

```
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
      "fileSize": 25678901,
      "downloadUrl": "/api/v1/apk/download/2.3.1",
      "isMandatory": false
    },
    "hasUpdate": true,
    "updateType": "minor"
  }
}
```

## GitHub Pages Deployment

```bash
npm install
npm run build
# Deploy dist/ to GitHub Pages (push to gh-pages branch)
```

The runtime `config.json` in `public/` is copied to `dist/` on build.
After deployment, update `config.json` on the live site to point to your
backend (the URL stays hidden from source code).

## Mobile App Integration

The mobile app uses `src/services/apkUpdateService.js` and the
`useApkUpdateCheck` hook to check for updates on app start and periodically.
