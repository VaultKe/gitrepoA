import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Chama Tab Navigator (Home tab = ChamaHomeStack, Chat tab)
import ChamaTabNavigator from './ChamaTabNavigator';

const Stack = createStackNavigator();

/**
 * Chama Dashboard Stack
 *
 * Wraps ChamaTabNavigator in a Stack.
 * The Tab navigator's Home tab uses ChamaHomeStack internally, so
 * detail screens participate in Stack back history.
 */
export default function ChamaDashboardStack({ route }) {
  const params = route?.params;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="ChamaTabs"
        component={ChamaTabNavigator}
        options={{ title: 'Chama Dashboard' }}
        initialParams={params}
      />
    </Stack.Navigator>
  );
}
