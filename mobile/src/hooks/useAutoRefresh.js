import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import DevHelper from '../utils/DevHelper';

/**
 * Hook for automatic data refresh in development
 * @param {Function} refreshFunction - Function to call for refresh
 * @param {Object} options - Configuration options
 */
export const useAutoRefresh = (refreshFunction, options = {}) => {
  const {
    interval = 30000, // 30 seconds default
    enableInDev = true,
    enableOnFocus = true,
    enableInterval = false,
    dependencies = [],
  } = options;

  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Handle app state changes (foreground/background)
  const handleAppStateChange = useCallback((nextAppState) => {
    if (
      enableOnFocus &&
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      DevHelper.log('🔄 App became active, refreshing data...');
      refreshFunction();
    }
    appStateRef.current = nextAppState;
  }, [refreshFunction, enableOnFocus]);

  // Setup interval refresh
  useEffect(() => {
    if (enableInterval && (__DEV__ ? enableInDev : true)) {
      intervalRef.current = setInterval(() => {
        DevHelper.log(`🔄 Auto-refresh triggered (${interval}ms interval)`);
        refreshFunction();
      }, interval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refreshFunction, interval, enableInterval, enableInDev]);

  // Setup app state listener
  useEffect(() => {
    if (enableOnFocus) {
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      return () => subscription?.remove();
    }
  }, [handleAppStateChange, enableOnFocus]);

  // Refresh when dependencies change
  useEffect(() => {
    if (dependencies.length > 0) {
      DevHelper.log('🔄 Dependencies changed, refreshing data...');
      refreshFunction();
    }
  }, dependencies);

  // Manual refresh function
  const manualRefresh = useCallback(() => {
    DevHelper.log('🔄 Manual refresh triggered');
    refreshFunction();
  }, [refreshFunction]);

  return {
    refresh: manualRefresh,
    isAutoRefreshEnabled: enableInterval && (__DEV__ ? enableInDev : true),
  };
};

/**
 * Hook for development-only hot refresh
 */
export const useDevRefresh = (componentName, refreshFunction) => {
  useEffect(() => {
    if (__DEV__) {
      DevHelper.onHotReload(componentName);
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        refreshFunction();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [componentName, refreshFunction]);
};

export default useAutoRefresh;
