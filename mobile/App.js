/**
 * AgriAI Mobile App
 * React Native client for the AgriAI yield-prediction service.
 *
 * Author: Juliet Chinenye Duru
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import PredictionScreen from './src/screens/PredictionScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createNativeStackNavigator();

const theme = {
  primary: '#2E7D32',
  onPrimary: '#FFFFFF',
};

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: theme.primary },
          headerTintColor: theme.onPrimary,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'AgriAI — Nigerian Farmers' }}
        />
        <Stack.Screen
          name="Prediction"
          component={PredictionScreen}
          options={{ title: 'New Prediction' }}
        />
        <Stack.Screen
          name="Results"
          component={ResultsScreen}
          options={{ title: 'AI Yield Results' }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: 'Saved Predictions' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
