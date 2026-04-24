import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// New Admin Tab Navigator (like user and chama dashboards)
import AdminTabNavigator from './AdminTabNavigator';

const Stack = createStackNavigator();

export default function AdminDashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Temporarily disable for production deployment
      }}
    >
      <Stack.Screen
        name="AdminTabs"
        component={AdminTabNavigator}
        options={{
          title: 'Admin Dashboard',
        }}
      />
    </Stack.Navigator>
  );
}
