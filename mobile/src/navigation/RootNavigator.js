import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Navigation Stacks
import AuthStack from './AuthStack';
import UserDashboardStack from './UserDashboardStack';
import AdminDashboardStack from './AdminDashboardStack';
import ChamaDashboardStack from './ChamaDashboardStack';

import { useApp } from '../context/AppContext';

const Stack = createStackNavigator();

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

  // Show auth stack if not authenticated
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
    <NavigationContainer>
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
