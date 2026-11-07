import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getApiBaseUrl } from '../src/api/client';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { ActiveSessionProvider } from '../src/state/ActiveSessionContext';
import { colors } from '../src/theme/tokens';
import { removeLegacyIdentity } from '../src/utils/legacyCleanup';
import { initNotificationChannel, initNotificationHandler } from '../src/utils/reminders';

// Shows the thrown message (e.g. a missing/placeholder API URL in a release
// build) on screen instead of the app just closing.
export { ErrorBoundary } from 'expo-router';

// A screen outside every guard stays reachable: `index` routes by status, and
// `auth/callback` must open whatever the status is. When a guard turns false,
// Expo Router drops those screens from history and returns to `index`.
function RootStack() {
  const { status } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/callback" />

      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding/welcome" />
        <Stack.Screen name="onboarding/how-it-works" />
        <Stack.Screen name="onboarding/build-habit" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session-player" />
        <Stack.Screen name="settings" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'recovery'}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'linkConfirm'}>
        <Stack.Screen name="auth/signed-in" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'offlineRestore'}>
        <Stack.Screen name="offline-restore" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Fail fast and visibly on a misconfigured release build; a no-op in dev.
  getApiBaseUrl();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    initNotificationHandler();
    initNotificationChannel();
    void removeLegacyIdentity();
  }, []);

  if (!fontsLoaded) {
    // Keep the same dark background so there's no flash of a different
    // color while the DESIGN.md typeface loads.
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ActiveSessionProvider>
          <StatusBar style="light" />
          <RootStack />
        </ActiveSessionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
