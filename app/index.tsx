import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { colors } from '../src/theme/tokens';
import { getOnboardingComplete } from '../src/utils/onboarding';

// architecture.md's repo structure names the file (tabs)/home.tsx (not
// index.tsx), so the root route redirects into it rather than renaming.
// Also gates first launch into onboarding, per PRD.md's "first launch only".
export default function RootIndex() {
  const [target, setTarget] = useState<'/home' | '/onboarding/welcome' | null>(null);

  useEffect(() => {
    let mounted = true;
    getOnboardingComplete().then((complete) => {
      if (mounted) setTarget(complete ? '/home' : '/onboarding/welcome');
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!target) {
    // Same "keep the dark background, render nothing" pattern app/_layout.tsx
    // uses while fonts load — avoids a flash of a different screen while
    // AsyncStorage resolves.
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return <Redirect href={target} />;
}
