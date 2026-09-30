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
import { ActiveSessionProvider } from '../src/state/ActiveSessionContext';
import { colors } from '../src/theme/tokens';
import { initNotificationChannel, initNotificationHandler } from '../src/utils/reminders';

// Shows the thrown message (e.g. a missing/placeholder API URL in a release
// build) on screen instead of the app just closing.
export { ErrorBoundary } from 'expo-router';

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
  }, []);

  if (!fontsLoaded) {
    // Keep the same dark background so there's no flash of a different
    // color while the DESIGN.md typeface loads.
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <ActiveSessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </ActiveSessionProvider>
    </SafeAreaProvider>
  );
}
