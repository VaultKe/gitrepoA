import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Navigation Stacks
import AuthStack from './AuthStack';
import UserDashboardStack from './UserDashboardStack';
import AdminDashboardStack from './AdminDashboardStack';
import ChamaDashboardStack from './ChamaDashboardStack';

import { useApp } from '../context/AppContext';
import notificationService from '../services/notificationService';

const Stack = createStackNavigator();

export const navigationRef = createNavigationContainerRef();

// Let a tapped OS notification deep-link into the app.
notificationService.setNavigator((routeName, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(routeName, params);
  }
});

export default function RootNavigator() {
  const { 
    isAuthenticated, 
    currentDashboard, 
    user,
    switchToUserDashboard 
  } = useApp();

  // Auto-switch to user dashboard if no specific dashboard is set
  useEffect(() => {
    if (isAuthenticated && !currentDashboard) {
      switchToUserDashboard();
    }
  }, [isAuthenticated, currentDashboard, switchToUserDashboard]);

  // Show auth stack if not authenticated. No ref here — deep-link targets
  // (LoanDetails, Notifications) only exist in the authenticated tree, and
  // sharing one ref across two conditionally-mounted containers is fragile.
  if (!isAuthenticated) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthStack} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Show appropriate dashboard based on currentDashboard state
  
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {currentDashboard === 'user' && (
          <Stack.Screen 
            name="UserDashboard" 
            component={UserDashboardStack}
            options={{ title: 'User Dashboard' }}
          />
        )}
        {currentDashboard === 'admin' && (
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardStack}
            options={{ title: 'Admin Dashboard' }}
          />
        )}
        {currentDashboard === 'chama' && (
          <Stack.Screen 
            name="ChamaDashboard" 
            component={ChamaDashboardStack}
            options={{ title: 'Chama Dashboard' }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
