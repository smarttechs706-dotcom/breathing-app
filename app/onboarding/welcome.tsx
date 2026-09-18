import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BreathOrb } from '../../src/components/BreathOrb';
import { GradientText } from '../../src/components/GradientText';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { setOnboardingComplete } from '../../src/utils/onboarding';

// Screen 1/3 — matches assets/design-reference/onboarding-1-welcome-code.html
// + onboarding-1-welcome-screenshot.png.
//
// Deviation (flagged, not silent): the reference's central visual is an
// <img> hotlinked from lh3.googleusercontent.com (a Google AI Studio/
// "Stitch" design-tool preview URL, not an asset this project owns) inside
// a pulsing radial "orb-glow" div. Same situation already resolved for
// Home's hero image — reusing the established `BreathOrb` component (a
// local SVG built off DESIGN.md's own "large, central sphere that pulses
// with a soft glow" spec) instead of bundling an unowned hotlinked image.
async function skipToHome() {
  await setOnboardingComplete();
  router.replace('/home');
}

export default function WelcomeScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.backgroundGlow} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <MaterialIcons name="local-florist" size={22} color={colors.primary} />
          <Pressable onPress={skipToHome} hitSlop={8}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.orbArea}>
            <BreathOrb size={220} />
          </View>

          <View style={styles.textArea}>
            <GradientText
              colors={[colors.primary, colors.primaryContainer]}
              style={styles.headline}
            >
              A reset between meetings, not another hour-long ritual.
            </GradientText>
            <Text style={styles.body}>
              Built for busy workdays — short guided breathing sessions you
              can actually fit before your next call.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/onboarding/how-it-works')}
            style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextButtonGradient}
            >
              <Text style={styles.nextButtonText}>Next</Text>
              <MaterialIcons name="arrow-forward" size={18} color={colors.onPrimaryFixed} />
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
    backgroundColor: colors.background,
  },
  // DESIGN.md: background is never flat black — approximates the mockup's
  // `linear-gradient(180deg, #0a0b10 0%, #111415 100%)` + orb-glow the same
  // way Home/Library/Insights already do (a single soft glow circle), for
  // consistency with the app's established background treatment.
  backgroundGlow: {
    pointerEvents: 'none',
    position: 'absolute',
    top: '18%',
    left: '50%',
    marginLeft: -220,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: colors.primaryContainer,
    opacity: 0.07,
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
  skipText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.onSurfaceVariant,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
    gap: spacing.sectionGap,
  },
  orbArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    alignItems: 'center',
    gap: spacing.gutter,
  },
  headline: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingVertical: spacing.base * 2,
    borderRadius: radii.full,
  },
  nextButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onPrimaryFixed,
  },
});
