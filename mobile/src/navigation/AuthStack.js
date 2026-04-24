import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AuthTabNavigator from './AuthTabNavigator';

const Stack = createStackNavigator();

export default function AuthStack() {

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="AuthTabs"
    >
      <Stack.Screen
        name="AuthTabs"
        component={AuthTabNavigator}
        options={{
          title: 'Authentication',
        }}
      />
    </Stack.Navigator>
  );
}
