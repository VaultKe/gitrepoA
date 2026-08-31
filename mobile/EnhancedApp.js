import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox, ErrorUtils } from 'react-native';
import Toast from 'react-native-toast-message';
import customToastConfig from './src/components/common/CustomToast';

// Development helpers
import DevHelper from './src/utils/DevHelper';

// Context Provider
import { AppProvider, useApp } from './src/context/AppContext';
import { getThemeColors } from './src/utils/theme';

// New Independent Navigation
import RootNavigator from './src/navigation/RootNavigator';

// Notification Service
import notificationService from './src/services/notificationService';
import useInactivityTracker from './src/hooks/useInactivityTracker';


// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'AsyncStorage has been extracted from react-native',
]);

// Global JS error handler to prevent hard crashes and log errors instead
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('[GlobalErrorHandler]', isFatal ? 'FATAL' : 'Non-fatal', error);
  if (isFatal) {
    // For fatal errors, show a toast if possible and reload
    try {
      Toast.show({
        type: 'error',
        text1: 'App Error',
        text2: 'Something went wrong. Please restart the app.',
        visibilityTime: 5000,
      });
    } catch (e) {
      // Ignore toast errors during fatal crash
    }
  }
});


// Main App Component
function AppContent() {
  const { theme, isAuthenticated } = useApp();
  const colors = getThemeColors(theme);

  const { ActivityResponder } = useInactivityTracker(isAuthenticated);

  // Initialize notification service
  useEffect(() => {
    notificationService.initialize()
      .then(async (success) => {
        if (success) {
          const verification = await notificationService.verifyNotificationSystem();
          if (verification.overall) {
            console.log('Notification system verified and ready');
          } else {
            console.warn('Notification system issues detected:', verification);
          }
        } else {
          console.warn('Notification service initialization failed');
        }
      })
      .catch((error) => {
        console.error('Notification service error:', error);
      });

    return () => {
      notificationService.cleanup();
    };
  }, []);

  return (
    <ActivityResponder>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.background} />
      <RootNavigator />
      <Toast config={customToastConfig} />
    </ActivityResponder>
  );
}

// Export main app
export default function App() {
  // Initialize DevHelper in development
  if (__DEV__) {
    DevHelper.enableFastRefresh();
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}