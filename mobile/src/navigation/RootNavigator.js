import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, Text, StyleSheet, Image, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Navigation Stacks
import AuthStack from './AuthStack';
import UserDashboardStack from './UserDashboardStack';
import AdminDashboardStack from './AdminDashboardStack';
import ChamaDashboardStack from './ChamaDashboardStack';

import { useApp } from '../context/AppContext';
import { getThemeColors } from '../utils/theme';

const Stack = createStackNavigator();

const DEFAULT_THEME = 'light';

function getSystemTheme() {
  try {
    const scheme = Appearance.getColorScheme();
    return scheme === 'light' ? 'light' : 'dark';
  } catch {
    return DEFAULT_THEME;
  }
}

function getInitialTheme() {
  try {
    if (typeof window !== 'undefined' && window.__THEME__) {
      return window.__THEME__;
    }
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

// Loading Screen Component
function LoadingScreen() {
  const [theme, setTheme] = useState(getInitialTheme);
  const colors = getThemeColors(theme);

  useEffect(() => {
    let mounted = true;

    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (mounted && savedTheme) {
          setTheme(savedTheme);
        }
      } catch {
        // keep current theme
      }
    };

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <Image
        source={require('../../assets/chama_logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
      <Text style={[styles.loadingText, { color: colors.text }]}>
        Loading VaultKe...
      </Text>
    </View>
  );
}

export default function RootNavigator() {
  const { 
    isLoading, 
    isAuthenticated, 
    currentDashboard, 
    user,
    switchToUserDashboard 
  } = useApp();

  // Debug logging
  useEffect(() => {
  }, [isLoading, isAuthenticated, currentDashboard, user]);

  // Auto-switch to user dashboard if no specific dashboard is set
  useEffect(() => {
    if (isAuthenticated && !isLoading && !currentDashboard) {
      switchToUserDashboard();
    }
  }, [isAuthenticated, isLoading, currentDashboard, switchToUserDashboard]);

  // Show loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }

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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});
