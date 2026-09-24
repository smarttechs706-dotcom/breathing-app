import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { setOnboardingComplete } from '../../src/utils/onboarding';

// Screen 3/3 — matches assets/design-reference/onboarding-3-build-habit-code.html
// + onboarding-3-build-habit-screenshot.png.
//
// Deviation (flagged, not silent): the reference's illustration is a
// hotlinked <img> of a mini "Deep Exhale" session-card mockup showing fake
// vital-sign readouts ("64 bpm", "98%", "Low" stress). CLAUDE.md's house
// rules explicitly forbid reintroducing real/simulated biometric data
// (heart rate, blood oxygen, stress %) — this app uses manual mood
// check-ins only. Built a streak/flame illustration instead (matching the
// headline's daily-habit theme and Home's existing streak-card flame icon)
// inside the same circular glass panel + pulsing float treatment the
// reference specifies, rather than reproducing that biometric mockup.
//
// Button copy: the actual reference/screenshot only has "Get Started"
// (primary) + "Enable reminders" (secondary text link) — there's no
// separate "Skip for now" button on this screen (only the shared "Skip"
// header present on screens 1-2, absent here per the reference). Per the
// instruction that both of this screen's actions must end in Home, both
// "Get Started" and "Enable reminders" navigate to Home; "Enable reminders"
// additionally shows a dummy permission prompt first (real push
// notifications are build order step 10, not wired up here).
export default function BuildHabitScreen() {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  async function finishOnboarding() {
    await setOnboardingComplete();
    router.replace('/home');
  }

  function handleEnableReminders() {
    // Dummy placeholder — no expo-notifications wiring yet (build order
    // step 10). Simulates the OS permission prompt's shape so the flow
    // feels complete without touching real push notifications.
    Alert.alert(
      'Enable Reminders',
      'Breathe would like to send you daily reset reminders.',
      [
        { text: "Don't Allow", style: 'cancel', onPress: finishOnboarding },
        { text: 'Allow', onPress: finishOnboarding },
      ]
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.backgroundGlow} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <MaterialIcons name="local-florist" size={22} color={colors.primary} />
          <Pressable onPress={finishOnboarding} hitSlop={8}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <Animated.View style={[styles.illustrationWrap, { transform: [{ translateY }] }]}>
            <View style={styles.illustrationRing} />
            <View style={styles.illustrationCircle}>
              <MaterialIcons name="local-fire-department" size={64} color="#fb923c" />
            </View>
          </Animated.View>

          <View style={styles.textArea}>
            <Text style={styles.headline}>One reset a day changes the rest of it.</Text>
            <Text style={styles.body}>
              We'll remind you at the moments you actually need it — not a
              bedtime ritual you'll forget.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={finishOnboarding}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
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
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={handleEnableReminders} hitSlop={8} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Enable Reminders</Text>
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
  // Approximates the mockup's `radial-gradient(circle at top right, #1a1a3a,
  // #111415 70%)` with the same soft-glow-circle pattern used elsewhere.
  backgroundGlow: {
    pointerEvents: 'none',
    position: 'absolute',
    top: '20%',
    left: '50%',
    marginLeft: -180,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: colors.primaryContainer,
    opacity: 0.08,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
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
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationRing: {
    position: 'absolute',
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 1,
    borderColor: `${colors.primary}33`,
  },
  illustrationCircle: {
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    color: colors.onSurface,
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
  actions: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.gutter,
    paddingBottom: spacing.sectionGap,
    gap: spacing.gutter,
  },
  primaryButton: {
    width: '100%',
    borderRadius: radii.full,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.base * 2,
    borderRadius: radii.full,
  },
  primaryButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    textTransform: 'uppercase',
    // CONTRAST FIX (2026-09-20, AUDIT-2.md) — see the Get Started button's
    // LinearGradient comment above for the full before/after math.
    color: '#ffffff',
  },
  secondaryButton: {
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    textTransform: 'uppercase',
    color: colors.primary,
  },
});
