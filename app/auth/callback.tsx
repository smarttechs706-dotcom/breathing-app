import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAuth } from '../../src/auth/supabase';
import { colors, spacing, typography } from '../../src/theme/tokens';

// Deep-link target for email links. Link handling proved on the device in the
// auth spike; Phase 4 replaces this plain screen with the real states.

type Status = 'verifying' | 'verified' | 'failed' | 'ignored';

const MESSAGES: Record<Status, string> = {
  verifying: 'Checking your link...',
  verified: 'Your link worked.',
  failed: "This link didn't work.",
  ignored: "This link can't be used.",
};

let lastHandledHash: string | null = null;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function verify(tokenHash: string, type: 'email' | 'recovery'): Promise<boolean> {
  try {
    const { data, error } = await getAuth().verifyOtp({ token_hash: tokenHash, type });
    return !error && Boolean(data.session);
  } catch {
    return false;
  }
}

export default function AuthCallback() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const tokenHash = first(params.token_hash);
  const type = first(params.type);
  const [status, setStatus] = useState<Status>('verifying');

  useEffect(() => {
    if (!tokenHash || (type !== 'email' && type !== 'recovery')) {
      setStatus('ignored');
      return;
    }
    // Links are single use, and Android can deliver the same one twice.
    if (lastHandledHash === tokenHash) {
      setStatus('ignored');
      return;
    }
    lastHandledHash = tokenHash;
    verify(tokenHash, type).then((ok) => setStatus(ok ? 'verified' : 'failed'));
  }, [tokenHash, type]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>{MESSAGES[status]}</Text>
        {status !== 'verifying' && (
          <Pressable
            onPress={() => router.replace('/')}
            style={styles.button}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1, padding: spacing.marginMobile, gap: spacing.base },
  title: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    color: colors.onSurface,
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
  },
  buttonText: { color: colors.primary, fontWeight: '600' },
});
