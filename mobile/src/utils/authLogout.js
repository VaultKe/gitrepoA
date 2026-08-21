let appLogout = null;
let isLoggingOut = false;
let lastLogoutTime = 0;
const LOGOUT_COOLDOWN_MS = 30000; // 30 seconds between logout attempts

export const setAppLogout = (fn) => {
  appLogout = typeof fn === 'function' ? fn : null;
};

export const triggerAppLogout = async () => {
  // Prevent re-entrancy: if a logout is already in progress, return immediately.
  if (isLoggingOut) {
    return new Promise(() => {});
  }

  // Debounce: prevent logout loops by throttling to once per LOGOUT_COOLDOWN_MS
  const now = Date.now();
  if (now - lastLogoutTime < LOGOUT_COOLDOWN_MS) {
    return;
  }
  lastLogoutTime = now;

  // Mark as logging out. This flag stays true for the rest of the app session
  // — it is never reset, preventing any subsequent code path from re-triggering
  // the logout cascade.
  isLoggingOut = true;

  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const authKeys = ['authToken', 'token', 'user', 'userRole', 'userData', 'refreshToken'];
    await AsyncStorage.multiRemove(authKeys);

    if (appLogout) {
      try {
        await appLogout();
      } catch {
        // no-op — appLogout (AppContext.logout) also has its own error handling
      }
    }
  } catch (error) {
    console.warn('triggerAppLogout error:', error?.message || error);
  }
};

export const getLoggingOut = () => isLoggingOut;

/**
 * Clears the "logging out" guard so a user can authenticate again after a
 * logout (or after a logout was triggered for any reason).
 *
 * The `isLoggingOut` flag is intentionally sticky to prevent a logout cascade
 * from re-entrant requests. However, leaving it set permanently also blocks a
 * fresh login/register within the same app session — once you log out you can
 * never log back in. Authentication entry points (login/register) must clear
 * this flag so a new session can be established. This is safe: a completed
 * logout should not prevent the user from re-authenticating, and an in-flight
 * logout that races with a login is benign (the login simply establishes a new
 * session).
 */
export const resetLoggingOut = () => {
  isLoggingOut = false;
  lastLogoutTime = 0;
};
