# VaultKe APK Security Hardening Guide

## 1. Preventing Source Code Exposure & Reverse Engineering

### ProGuard / R8 (Android)

Enable code shrinking and obfuscation in **all release builds**:

#### `android/app/build.gradle`
```gradle
buildTypes {
    release {
        minifyEnabled true           // Obfuscate Java/Kotlin bytecode
        shrinkResources true         // Remove unused resources
        shrinkResources true
        proguardFiles getDefaultProguardFile(
            'proguard-android-optimize.txt'
        ), 'proguard-rules.pro'
    }
}
```

Set in `gradle.properties`:
```properties
android.enableProguardInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
```

#### ProGuard Rules (`proguard-rules.pro`)
```
# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enum fields
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueof(java.lang.String);
}

# Keep React Native / Expo entry points
-keep class com.somulos.vaultke.** { *; }
-keep class com.facebook.react.** { *; }
-keep classexpo.** { *; }

# Keep the API endpoint interface (used via reflection)
-keep class com.somulos.vaultke.api.** { *; }
```

### EAS Build (Recommended for Production)

Use **Expo Application Services (EAS)** for release builds — EAS automatically
applies ProGuard/R8 and obfuscates the bundle:

```json
// eas.json
{
  "build": {
    "release": {
      "android": {
        "gradleCommand": ":app:assembleRelease",
        "buildType": "app-bundle"
      }
    }
  }
}
```

Build with:
```bash
eas build --platform android --profile release
```

### Certificate Pinning (Prevents MITM)

Add `expo-pinch` or manual TLS pinning to prevent network interception:

```js
// In your API requests, validate the SSL certificate
const response = await fetch(apiUrl, {
  signal: AbortSignal.timeout(30000),
  // Certificate pinning is handled at the native level
});
```

At the native level (`android/network_security_config.xml`):
```xml
<network-security-config>
    <domain-config>
        <domain includeSubdomains="true">gitrepoa-1.onrender.com</domain>
        <pin-set expiration="2027-01-01">
            <pin digest="SHA-256">RENDER_COM_CERT_PIN</pin>
        </pin-set>
    </domain-config>
</network-security-config>
```

### Root Detection

Detect rooted devices and refuse to run:

```js
import * as Device from 'expo-device';

const isDeviceRooted = async () => {
  // Check for common root indicators
  const checks = [
    '/system/app/su',
    '/system/bin/su',
    '/sbin/su',
    '/vendor/bin/su',
  ];
  // On Android, check if 'su' binary exists
  // (use a native module for actual file system checks)
  return false; // placeholder — see RootDetection.js
};
```

### Secure Signing

- **Never** use `signingConfigs.debug` in production
- Generate a secure keystore:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore vaultke-keystore.keystore \
  -alias vaultke-key \
  -keyalg RSA -keysize 2048 -validity 10000
```

- Store the keystore outside version control (in CI/CD secrets only)
- Reference it in `gradle.properties` via environment variables

## 2. Hiding the Backend Endpoint

### Web Frontend (Already Implemented)
The backend URL is loaded at **runtime** from `public/config.json`, never hardcoded:
- Source code has zero backend URLs
- `config.json` is edited on the server after deployment
- Default fallback is `/api/v1` (same-origin via reverse proxy)

### Mobile App
Move the API URL **out of JavaScript** into native config:

#### Option A: Native String Resources
```xml
<!-- android/app/src/main/res/values/strings.xml -->
<string name="api_base_url">https://gitrepoa-1.onrender.com/api/v1</string>
```

```java
// MainApplication.java
String apiUrl = getString(R.string.api_base_url);
```

#### Option B: gradle.properties
```gradle
# gradle.properties
VAULTKE_API_BASE_URL=https://gitrepoa-1.onrender.com/api/v1
```

Then read from native code, not from JS.

### Reverse Proxy (Recommended)

Use **Cloudflare** or **nginx** as a reverse proxy so the origin server is
never directly exposed:

```
Client → Cloudflare CDN (e.g. vaultke.app) → Backend (gitrepoa-1.onrender.com)
                          ↑
              Origin IP is hidden from all clients
```

The frontend and mobile app connect to `https://vaultke.app/api/v1/` which
Cloudflare proxies to the actual backend. The origin domain is never visible
to end users or attackers.

### Additional Recommendations

1. **API Gateway**: Use an API gateway (e.g., AWS API Gateway, Kong) to sit
   in front of the backend and obscure the real server.
2. **Rate Limiting**: Add rate limiting on `/apk/version-check` and `/apk/download`
   to prevent automated scraping of APK files.
3. **IP Allowlisting**: For the `/apk/upload` endpoint, add IP allowlisting
   in addition to JWT auth.
4. **DNS Obfuscation**: Use a CNAME to a CDN domain, never point directly to
   the Render service URL.
5. **Request Signing**: Sign API requests with HMAC to prevent replay attacks.
