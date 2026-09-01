import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WorkoutAppProvider } from '@/context/workout-app-context';
import { initializeRestAlerts } from '@/services/rest-alert';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  useEffect(() => {
    void initializeRestAlerts();
  }, []);

  return (
    <SafeAreaProvider>
      <WorkoutAppProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
        </Stack>
      </WorkoutAppProvider>
    </SafeAreaProvider>
  );
}
