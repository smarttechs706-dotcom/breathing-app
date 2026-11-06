import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '../src/auth/AuthProvider';
import type { AuthStatus } from '../src/auth/authStatus';
import { colors } from '../src/theme/tokens';
import { getOnboardingComplete } from '../src/utils/onboarding';

const DESTINATIONS = {
  signedIn: '/home',
  recovery: '/reset-password',
  linkConfirm: '/auth/signed-in',
  offlineRestore: '/offline-restore',
} as const satisfies Partial<Record<AuthStatus, string>>;

// The one place that routes by auth status. The route guards send everything
// here when they change, so screens never navigate after a login or sign-out.
// First launch shows onboarding; a returning signed-out user goes to Log in.
export default function RootIndex() {
  const { status } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    getOnboardingComplete().then((complete) => {
      if (mounted) setOnboarded(complete);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (status === 'loading' || onboarded === null) {
    // Same "keep the dark background, render nothing" pattern app/_layout.tsx
    // uses while fonts load.
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (status === 'signedOut') {
    return <Redirect href={onboarded ? '/login' : '/onboarding/welcome'} />;
  }

  return <Redirect href={DESTINATIONS[status]} />;
}
