import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
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


// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'AsyncStorage has been extracted from react-native',
]);


// Main App Component
function AppContent() {
  const { theme } = useApp();
  const colors = getThemeColors(theme);


  // Initialize notification service
  useEffect(() => {
    // Initialize the enhanced notification service
    notificationService.initialize().then(async (success) => {
      if (success) {
        // Verify the notification system is working properly
        const verification = await notificationService.verifyNotificationSystem();
        if (verification.overall) {
        } else {
        }
      } else {
      }
    }).catch((error) => {
    });

    // Cleanup on unmount
    return () => {
      notificationService.cleanup();
    };
  }, []);

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.background} />
      <RootNavigator />
      <Toast config={customToastConfig} />
    </>
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