import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform, View } from 'react-native';
import { triggerAppLogout } from '../utils/authLogout';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const INACTIVITY_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

const useInactivityTracker = (enabled = true) => {
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastActivityRef = useRef(Date.now());
  const isEnabledRef = useRef(enabled);
  const checkIntervalRef = useRef(null);

  isEnabledRef.current = enabled;

  const logout = useCallback(async () => {
    try {
      await triggerAppLogout();
    } catch (error) {
      // ignore logout errors
    }
  }, []);

  const updateLastActivity = useCallback(() => {
    if (!isEnabledRef.current) return;
    lastActivityRef.current = Date.now();
  }, []);

  const checkInactivity = useCallback(() => {
    if (!isEnabledRef.current) return;
    if (appStateRef.current !== 'active') return;

    const now = Date.now();
    const elapsed = now - lastActivityRef.current;

    if (elapsed >= INACTIVITY_TIMEOUT) {
      // Clear timers before logout to prevent double-logout
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
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
      // Clean up all timers if tracker is disabled
      if (timerRef.current) clearTimeout(timerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      return;
    }

    // Initialize last activity to now
    lastActivityRef.current = Date.now();

    // Web: listen to user interaction events
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

      // Periodic check for inactivity
      checkIntervalRef.current = setInterval(() => {
        checkInactivity();
      }, INACTIVITY_CHECK_INTERVAL);

      const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
          // App came to foreground - check if we exceeded inactivity timeout
          checkInactivity();
        }
        appStateRef.current = nextState;
      });

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        events.forEach((eventName) => {
          window.removeEventListener(eventName, onActivity);
        });
        subscription.remove();
      };
    } else {
      // Native: listen to AppState changes AND touch events
      const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
          // App came to foreground - check if we exceeded inactivity timeout
          checkInactivity();
        } else if (nextState.match(/inactive|background/)) {
          // App going to background - update last activity so we don't
          // immediately logout when returning if within timeout
          updateLastActivity();
        }
        appStateRef.current = nextState;
      });

      // Periodic check for inactivity
      checkIntervalRef.current = setInterval(() => {
        checkInactivity();
      }, INACTIVITY_CHECK_INTERVAL);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        subscription.remove();
      };
    }
  }, [enabled, checkInactivity, updateLastActivity]);

  // ActivityResponder: wraps the app to detect user touches on native.
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

export default useInactivityTracker;
