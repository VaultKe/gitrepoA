import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import Toast from 'react-native-toast-message';

// Development helpers
import DevHelper from './src/utils/DevHelper';

// Context Provider
import { AppProvider } from './src/context/AppContext';

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
      <StatusBar style="auto" />
      <RootNavigator />
      <Toast />
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