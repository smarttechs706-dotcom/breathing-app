import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { text } from '../../src/features/home/styles';
import { BACKDROP_BOTTOM, MIST_BACKGROUND, ScreenBackdrop } from '../../src/features/profile/ScreenBackdrop';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { setOnboardingComplete } from '../../src/utils/onboarding';

// Screen 2/3. Same look as the sign-in screens: the mist backdrop, a white
// headline and the shared primary button style. The three steps are plain
// rows on the mist (an outlined icon circle, title and description), with no
// panels or glow circles.
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

async function skipToSignUp() {
  await setOnboardingComplete();
  router.replace('/signup');
}

export default function HowItWorksScreen() {
  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.wordmark}>Breathease</Text>
          <Pressable onPress={skipToSignUp} hitSlop={8} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.headline} accessibilityRole="header">
              Two minutes. Real difference.
            </Text>
            <Text style={styles.body}>
              Every session opens and closes with a quick check-in, so you can
              actually see your stress ease before you're back in it.
            </Text>
          </View>

          <View style={styles.stepsColumn}>
            {steps.map((step) => (
              <View key={step.title} style={styles.stepRow}>
                <View style={styles.stepIconCircle}>
                  <MaterialIcons name={step.icon} size={22} color={step.iconColor} />
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => router.push('/onboarding/build-habit')}
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
        </ScrollView>
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
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipText: {
    ...text.link,
    color: colors.onSurfaceVariant,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base * 2,
    paddingBottom: spacing.base * 4,
    gap: spacing.base * 5,
  },
  header: {
    alignItems: 'center',
    gap: spacing.base * 1.5,
  },
  headline: {
    ...text.name,
    fontSize: 28,
    lineHeight: 36,
    color: '#ffffff',
    textAlign: 'center',
  },
  body: {
    ...text.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  stepsColumn: {
    width: '100%',
    gap: spacing.base * 3,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 2,
  },
  stepIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    ...typography.headlineLgMobile,
    fontSize: 17,
    lineHeight: 24,
    color: '#ffffff',
  },
  stepDescription: {
    ...text.body,
    color: colors.onSurfaceVariant,
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
