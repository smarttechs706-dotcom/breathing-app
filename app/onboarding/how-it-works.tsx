import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../src/components/GlassCard';
import { GradientText } from '../../src/components/GradientText';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { setOnboardingComplete } from '../../src/utils/onboarding';

// Screen 2/3 — matches assets/design-reference/onboarding-2-how-it-works-code.html
// + onboarding-2-how-it-works-screenshot.png.
//
// PRD.md copy override (explicit, locked): the reference's "Pick a session"
// step description ("Choose from guided breaths, body scans, or nature
// sounds") references features out of this app's scope. Using PRD.md's
// replacement text instead.
const steps = [
  {
    icon: 'format-list-bulleted' as const,
    iconColor: colors.tertiary,
    title: 'Pick a session',
    description: 'Choose a guided breathing session matched to how you’re feeling.',
  },
  {
    icon: 'sync' as const,
    iconColor: colors.primary,
    title: 'Follow the ring',
    description: 'Sync your breath to our visual guide for immediate focus.',
  },
  {
    icon: 'moving' as const,
    iconColor: colors.secondaryFixed,
    title: 'Check in',
    description: 'Log your state before and after to measure the impact.',
  },
];

async function skipToHome() {
  await setOnboardingComplete();
  router.replace('/home');
}

export default function HowItWorksScreen() {
  return (
    <View style={styles.root}>
      <View style={[styles.backgroundGlow, styles.backgroundGlowTop]} />
      <View style={[styles.backgroundGlow, styles.backgroundGlowBottom]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View />
          <Pressable onPress={skipToHome} hitSlop={8} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <GradientText
            colors={[colors.primary, colors.tertiaryContainer]}
            style={styles.headline}
          >
            Two minutes. Real difference.
          </GradientText>
          <Text style={styles.body}>
            Every session opens and closes with a quick check-in, so you can
            actually see your stress ease before you're back in it.
          </Text>

          <View style={styles.stepsColumn}>
            {steps.map((step) => (
              // CORNER-CLIP FIX (2026-09-20, AUDIT-2.md Medium finding):
              // expo-blur's native BlurView on Android doesn't reliably clip
              // to a rounded rect via the parent's own overflow:hidden at
              // radii.xl (48px) — confirmed on-device for Insights' cards at
              // this same radius (see PROGRESS.md's "stat card corners
              // uneven" entry). These step cards use the same radius and
              // never got the matching fix. Wrapping in a second
              // overflow:hidden + matching borderRadius View outside the
              // BlurView, same technique as insights.tsx's cardClip.
              <View key={step.title} style={styles.stepCardClip}>
                <GlassCard radius={radii.xl} style={styles.stepCard}>
                  <View style={styles.stepIconCircle}>
                    <MaterialIcons name={step.icon} size={28} color={step.iconColor} />
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </GlassCard>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => router.push('/onboarding/build-habit')}
            style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
          >
            {/* CONTRAST FIX (2026-09-20, AUDIT-2.md Medium finding): the
                2026-09-19 primaryContainer -> inversePrimary gradient with
                onPrimaryFixed text computed to only ~2.6:1 contrast at the
                gradient's darker end — below the 4.5:1 AA minimum. Swapped
                to inversePrimary -> onPrimaryFixedVariant (both stops dark
                enough that white text stays >=6.47:1 across the whole
                gradient — see AUDIT-2.md for the full before/after math)
                with white text, matching Home/Library/Player's identical
                fix. */}
            <LinearGradient
              colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextButtonGradient}
            >
              <Text style={styles.nextButtonText}>NEXT</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#ffffff" />
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Approximates the mockup's `radial-gradient(circle at 50% -20%, #1f1b3d
  // 0%, #111415 80%)` + its two corner `.glow-effect` divs using the same
  // soft-glow-circle pattern established on Home/Library/Insights, rather
  // than a literal radial-gradient body background (RN's LinearGradient
  // has no radial mode; consistent with the rest of the app's approximation).
  backgroundGlow: {
    pointerEvents: 'none',
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.primaryContainer,
    opacity: 0.1,
  },
  backgroundGlowTop: {
    top: -40,
    left: -60,
  },
  backgroundGlowBottom: {
    bottom: -20,
    right: -60,
    backgroundColor: colors.tertiary,
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
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  skipText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.primary,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base * 3,
    paddingBottom: spacing.base * 4,
    alignItems: 'center',
    gap: spacing.base * 2.5,
  },
  headline: {
    fontFamily: typography.displayLg.fontFamily,
    fontSize: 36,
    fontWeight: typography.displayLg.fontWeight,
    lineHeight: 44,
    letterSpacing: typography.displayLg.letterSpacing,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  stepsColumn: {
    width: '100%',
    gap: spacing.gutter,
  },
  // CORNER-CLIP FIX (2026-09-20, AUDIT-2.md) — see the step-card JSX
  // comment above.
  stepCardClip: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  stepCard: {
    padding: spacing.base * 3,
    alignItems: 'center',
  },
  stepIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base * 1.5,
  },
  stepTitle: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: 22,
    fontWeight: typography.headlineLgMobile.fontWeight,
    color: colors.onSurface,
    marginBottom: spacing.base * 0.5,
    textAlign: 'center',
  },
  stepDescription: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  nextButton: {
    width: '100%',
    borderRadius: radii.full,
    marginTop: spacing.base,
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
    paddingHorizontal: spacing.base * 6,
    borderRadius: radii.full,
  },
  nextButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    // CONTRAST FIX (2026-09-20, AUDIT-2.md) — see the NEXT button's
    // LinearGradient comment above for the full before/after math.
    color: '#ffffff',
  },
});
