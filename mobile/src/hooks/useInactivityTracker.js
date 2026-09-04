import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform, View } from 'react-native';
import { triggerAppLogout } from '../utils/authLogout';
import {
  SESSION_TIMEOUT_MS,
  SESSION_LAST_ACTIVITY_KEY,
  SESSION_PERSIST_THROTTLE_MS,
  persistLastActivity,
} from '../utils/sessionExpiry';

// How often to poll for inactivity while the app is in the foreground.
const INACTIVITY_CHECK_INTERVAL = 30 * 1000; // 30 seconds

/**
 * Inactivity-based session expiry.
 *
 * A session expires after SESSION_TIMEOUT_MS (30 minutes, by default) of
 * inactivity. "Activity" = a user touch OR the app being in the foreground —
 * time spent away from the app (backgrounded, screen off, force-quit) counts
 * toward the inactivity window, so a session cannot be kept alive forever by
 * simply switching apps and coming back.
 *
 * The tracker enforces this in two complementary ways:
 *   1. While the app is running: a foreground interval + an AppState
 *      foreground-resume check terminate a stale session immediately when the
 *      user returns.
 *   2. Across restarts: the last-activity timestamp is persisted to
 *      AsyncStorage and validated on launch by `AppContext.initializeApp`.
 */
const useInactivityTracker = (enabled = true) => {
  const appStateRef = useRef(AppState.currentState);
  const lastActivityRef = useRef(Date.now());
  const lastPersistRef = useRef(0);
  const isEnabledRef = useRef(enabled);
  const checkIntervalRef = useRef(null);

  isEnabledRef.current = enabled;

  // Persist the last-activity timestamp so it survives process death / app
  // restarts. Writes are throttled to once per SESSION_PERSIST_THROTTLE_MS to
  // avoid hammering AsyncStorage on every touch.
  const persistIfThrottled = useCallback((timestamp) => {
    const now = Date.now();
    if (now - lastPersistRef.current < SESSION_PERSIST_THROTTLE_MS) return;
    lastPersistRef.current = now;
    persistLastActivity(timestamp);
  }, []);

  const updateLastActivity = useCallback(() => {
    if (!isEnabledRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    persistIfThrottled(now);
  }, [persistIfThrottled]);

  const logout = useCallback(async () => {
    try {
      await triggerAppLogout();
    } catch (error) {
      // ignore — triggerAppLogout has its own re-entrancy guard
    }
  }, []);

  const checkInactivity = useCallback(() => {
    if (!isEnabledRef.current) return;
    // Only enforce expiry while the app is in the foreground (visible to the
    // user). This avoids logging out while backgrounded, which can race with
    // navigation / state updates. Returning here also means a backgrounded
    // session is terminated on the next foreground resume instead.
    if (appStateRef.current !== 'active') return;

    const elapsed = Date.now() - lastActivityRef.current;

    if (elapsed >= SESSION_TIMEOUT_MS) {
      // Clear timers before logout to prevent any double-triggered cascade.
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      logout();
    }
  }, [logout]);

  const resetTimer = useCallback(() => {
    updateLastActivity();
  }, [updateLastActivity]);

  useEffect(() => {
    if (!enabled) {
      // Clean up all timers if the tracker is disabled.
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Seed the activity clock and persisted timestamp on mount.
    lastActivityRef.current = Date.now();
    persistLastActivity(lastActivityRef.current);
    lastPersistRef.current = lastActivityRef.current;

    // Web: listen to global user interaction events. On native these are
    // handled by the ActivityResponder below.
    if (Platform.OS === 'web') {
      const events = [
        'touchstart',
        'mousedown',
        'mousemove',
        'keydown',
        'scroll',
        'gesturestart',
        'gesturechange',
        'gestureend',
        'click',
      ];

      const onActivity = () => {
        updateLastActivity();
      };

      events.forEach((eventName) => {
        window.addEventListener(eventName, onActivity, { passive: true });
      });

      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
        events.forEach((eventName) => {
          window.removeEventListener(eventName, onActivity);
        });
      };
    }

    // Native: periodic check for inactivity while the app is foregrounded.
    checkIntervalRef.current = setInterval(() => {
      checkInactivity();
    }, INACTIVITY_CHECK_INTERVAL);

    const handleAppStateChange = (nextState) => {
      const safeNext = typeof nextState === 'string' && nextState.length > 0 ? nextState : '';
      const safePrev = typeof appStateRef.current === 'string' && appStateRef.current.length > 0
        ? appStateRef.current
        : '';

      // IMPORTANT: update the ref BEFORE evaluating transitions. Previously the
      // ref was updated *after* checkInactivity(), which meant the
      // foreground-resume check ran while appStateRef was still 'background'
      // and bailed out via the `!== 'active'` guard — so a 30-minute+
      // backgrounded session was never terminated (the exact bug being fixed).
      appStateRef.current = safeNext;

      if (safePrev.match(/inactive|background/) && safeNext === 'active') {
        // App returned to the foreground. If the user was inactive long enough
        // while away, terminate the session NOW; otherwise treat returning as
        // fresh activity and reset the inactivity clock.
        checkInactivity();
        updateLastActivity();
      }
      // NOTE: intentionally no branch for backgrounding. Time spent away from
      // the app counts as inactivity, so we do NOT reset lastActivity when the
      // app goes to the background — that previously let users extend their
      // session indefinitely by briefly switching apps every ~30 minutes.
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      subscription.remove();
    };
  }, [enabled, checkInactivity, updateLastActivity]);

  // ActivityResponder: wraps the app to detect user touches and reset the
  // inactivity clock. This is best-effort for foreground touch interactions;
  // the authoritative signal is the foreground-resume + interval check above.
  const ActivityResponder = useCallback(({ children }) => {
    return (
      <View
        style={{ flex: 1 }}
        onTouchStart={() => {
          resetTimer();
        }}
        onTouchMove={() => {
          resetTimer();
        }}
        onTouchEnd={() => {
          resetTimer();
        }}
      >
        {children}
      </View>
    );
  }, [resetTimer]);

  return {
    resetTimer,
    updateLastActivity,
    ActivityResponder,
  };
};

export { SESSION_TIMEOUT_MS, SESSION_LAST_ACTIVITY_KEY, INACTIVITY_CHECK_INTERVAL };

export default useInactivityTracker;
