import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BreathOrb } from '../../src/components/BreathOrb';
import { text } from '../../src/features/home/styles';
import { BACKDROP_BOTTOM, MIST_BACKGROUND, ScreenBackdrop } from '../../src/features/profile/ScreenBackdrop';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { setOnboardingComplete } from '../../src/utils/onboarding';

// Screen 1/3. Same look as the sign-in screens: the mist backdrop, a white
// headline, the "Breathease" wordmark in the top bar and the shared primary
// button style (inversePrimary to onPrimaryFixedVariant, white sentence-case
// label, >=6.47:1 per AUDIT-2.md). No panels or glow circles. The central
// visual is the app's own `BreathOrb` (the reference's hotlinked image is not
// an asset this project owns).
async function skipToSignUp() {
  await setOnboardingComplete();
  router.replace('/signup');
}

export default function WelcomeScreen() {
  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.wordmark}>Breathease</Text>
          <Pressable onPress={skipToSignUp} hitSlop={8}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.orbArea}>
            <BreathOrb size={220} />
          </View>

          <View style={styles.textArea}>
            <Text style={styles.headline} accessibilityRole="header">
              A reset between meetings, not another hour-long ritual.
            </Text>
            <Text style={styles.body}>
              Built for busy workdays, with short guided breathing sessions you
              can fit in before your next call.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/onboarding/how-it-works')}
            style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
          >
            <LinearGradient
              colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextButtonGradient}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKDROP_BOTTOM,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    height: 56,
  },
  wordmark: {
    ...typography.headlineLgMobile,
    fontSize: 18,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.8)',
  },
  skipText: {
    ...text.link,
    color: colors.onSurfaceVariant,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
    gap: spacing.base * 5,
  },
  orbArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    alignItems: 'center',
    gap: spacing.base * 1.5,
  },
  headline: {
    ...text.name,
    fontSize: 28,
    lineHeight: 40,
    color: '#ffffff',
    textAlign: 'center',
  },
  body: {
    ...text.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
  },
  nextButton: {
    width: '100%',
    borderRadius: radii.full,
  },
  nextButtonPressed: {
    opacity: 0.85,
  },
  nextButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: spacing.base * 2,
    borderRadius: radii.full,
  },
  nextButtonText: {
    ...typography.headlineLgMobile,
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
  },
});
