import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// New Chama Tab Navigator (like user dashboard)
import ChamaTabNavigator from './ChamaTabNavigator';

const Stack = createStackNavigator();

// Main Chama Dashboard Stack
export default function ChamaDashboardStack() {

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Let the tab navigator handle headers
      }}
    >
      <Stack.Screen
        name="ChamaTabs"
        component={ChamaTabNavigator}
        options={{
          title: 'Chama Dashboard',
        }}
      />
    </Stack.Navigator>
  );
}
