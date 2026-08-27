import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform, View } from 'react-native';
import { triggerAppLogout } from '../utils/authLogout';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

const useInactivityTracker = () => {
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const logout = useCallback(async () => {
    try {
      await triggerAppLogout();
    } catch (error) {
      // ignore logout errors
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);
  }, [logout]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const events = [
        'touchstart',
        'mousedown',
        'keydown',
        'scroll',
        'gesturestart',
        'gesturechange',
        'gestureend',
      ];

      const onActivity = () => {
        resetTimer();
      };

      events.forEach((eventName) => {
        window.addEventListener(eventName, onActivity, { passive: true });
      });

      const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
          onActivity();
        }
        appStateRef.current = nextState;
      });

      resetTimer();

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        events.forEach((eventName) => {
          window.removeEventListener(eventName, onActivity);
        });
        subscription.remove();
      };
    } else {
      const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
          resetTimer();
        }
        appStateRef.current = nextState;
      });

      resetTimer();

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        subscription.remove();
      };
    }
  }, [resetTimer]);

  // ActivityResponder: wraps the app to detect user touches on native.
  const ActivityResponder = useCallback(({ children }) => {
    return (
      <View
        style={{ flex: 1 }}
        onTouchStart={() => {
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
    ActivityResponder,
  };
};

export default useInactivityTracker;
