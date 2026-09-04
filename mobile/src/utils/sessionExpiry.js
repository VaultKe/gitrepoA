import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Default session inactivity timeout.
 *
 * A session must expire within 30 minutes of inactivity by default. This
 * constant is the single source of truth used by:
 *   - the in-app inactivity tracker (`useInactivityTracker`)
 *   - the startup session validation (`AppContext.initializeApp`)
 *
 * Both enforce the same 30-minute window so the rule holds whether the app is
 * running (timer fires) or has been killed/restarted (last-activity persisted to
 * AsyncStorage is validated on launch).
 */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * AsyncStorage key for the persisted last-interaction timestamp.
 *
 * Stored as an epoch-millisecond string. Read on app start to detect sessions
 * that have been inactive for longer than SESSION_TIMEOUT_MS even when no JS was
 * running (e.g. the app was force-quit or the device rebooted).
 */
export const SESSION_LAST_ACTIVITY_KEY = 'sessionLastActivityAt';

/**
 * Throttle for persisting last-activity writes. The 30-minute expiry threshold
 * is coarse, so a few seconds of staleness is irrelevant — throttling avoids
 * hammering AsyncStorage on every touch event.
 */
export const SESSION_PERSIST_THROTTLE_MS = 30 * 1000; // 30 seconds

/**
 * Decode (without cryptographically verifying) the payload of a JWT so the client
 * can inspect the `exp` claim. The signature is never trusted here — the server
 * is the source of truth; this only lets us short-circuit obviously-expired local
 * tokens so the user isn't shown protected pages for an expired session.
 *
 * Returns the parsed payload object, or null if the token is malformed.
 */
export const decodeJwtPayload = (token) => {
  if (typeof token !== 'string' || token.length === 0) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    // JWT payloads are base64url encoded.
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = typeof atob === 'function'
      ? atob(base64)
      : (typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64').toString('binary') : '');
    return JSON.parse(binary);
  } catch (e) {
    return null;
  }
};

/**
 * True when the JWT access token has expired (or cannot be decoded).
 *
 * The backend mints tokens with a standard `exp` claim, so a missing/expired
 * claim means the token is no longer valid and must not grant access to pages.
 */
export const isTokenExpired = (token) => {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSec;
};

/**
 * Read the age (ms) of the persisted last-activity timestamp.
 *
 * Returns a number (milliseconds since last known activity) when the timestamp
 * exists, or null when it is unknown/missing (e.g. first run, or a legacy token
 * from before this tracking existed). A null result must be treated as
 * "activity unknown" — callers should seed it to now rather than logging the
 * user out, to avoid forcing a re-login on every legacy session.
 */
export const getLastActivityAgeMs = async () => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
    if (!raw) return null;
    const last = Number(raw);
    if (!Number.isFinite(last)) return null;
    return Date.now() - last;
  } catch (e) {
    // If storage can't be read, do not lock users out — fail open.
    return null;
  }
};

/**
 * Persist the last-activity timestamp so inactivity can be detected across app
 * restarts. Callers throttle writes themselves using SESSION_PERSIST_THROTTLE_MS;
 * this function never throws.
 */
export const persistLastActivity = async (timestamp = Date.now()) => {
  try {
    await AsyncStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(timestamp));
  } catch (e) {
    // Best-effort. Storage pressure must never block expiry enforcement.
  }
};

/**
 * Remove every session/auth related entry from AsyncStorage.
 *
 * Used both by the logout path and the startup "session is stale" path so the
 * user is never silently authenticated again with an expired/inactive session.
 */
export const clearSessionStorage = async () => {
  try {
    await AsyncStorage.multiRemove([
      'authToken',
      'token',
      'user',
      'userRole',
      'userData',
      'refreshToken',
      'currentDeviceInfo',
      SESSION_LAST_ACTIVITY_KEY,
    ]);
  } catch (e) {
    // ignore — logout must still proceed
  }
};
