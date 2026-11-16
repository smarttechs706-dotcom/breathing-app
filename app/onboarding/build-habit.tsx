import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TimePickerModal } from '../../src/components/TimePickerModal';
import { text } from '../../src/features/home/styles';
import { onboardingLayout, SECONDARY_ACTION_HEIGHT } from '../../src/features/onboarding/layout';
import { BACKDROP_BOTTOM, MIST_BACKGROUND, ScreenBackdrop } from '../../src/features/profile/ScreenBackdrop';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { setOnboardingComplete } from '../../src/utils/onboarding';
import {
  applyReminderSchedule,
  REMINDER_TIP,
  requestNotificationPermission,
  saveReminderSettings,
} from '../../src/utils/reminders';

// Screen 3/3. Same look as the sign-in screens: the mist backdrop, a white
// headline, the shared primary button style and "Enable reminders" as a link.
// No panels or glow circles; the floating flame illustration keeps its ring
// and circle as outlines only.
//
// Deviation (flagged, not silent): the reference's illustration is a
// hotlinked <img> of a session-card mockup showing fake vital-sign readouts.
// CLAUDE.md forbids reintroducing biometric data, so this is a streak/flame
// illustration matching the headline's daily-habit theme.
//
// Both "Get started" and "Enable reminders" end at Sign up, since accounts are
// required; "Enable reminders" asks for the permission and a time first.
export default function BuildHabitScreen() {
  const float = useRef(new Animated.Value(0)).current;
  const [pickerVisible, setPickerVisible] = useState(false);

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
    router.replace('/signup');
  }

  async function handleEnableReminders() {
    const result = await requestNotificationPermission();
    if (result === 'unavailable') {
      Alert.alert(
        'Reminders unavailable',
        "Reminders need a development build and aren't available in Expo Go. You can enable them later from Settings once you're on a build that supports them.",
        [{ text: 'OK', onPress: finishOnboarding }]
      );
      return;
    }
    if (result === 'denied') {
      Alert.alert(
        'Reminders are off',
        "You can turn them on later from Settings if you change your mind.",
        [{ text: 'OK', onPress: finishOnboarding }]
      );
      return;
    }
    setPickerVisible(true);
  }

  async function handleConfirmTime(hour: number, minute: number) {
    const settings = { enabled: true, hour, minute };
    const result = await applyReminderSchedule(settings);
    setPickerVisible(false);
    if (!result.ok) {
      // Nothing saved; stay here so the user can retry or skip.
      Alert.alert(
        "Couldn't schedule the reminder",
        'Please try again, or set it up later from Settings.'
      );
      return;
    }
    await saveReminderSettings(settings);
    await finishOnboarding();
  }

  async function handleCancelTime() {
    setPickerVisible(false);
    await finishOnboarding();
  }

  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.wordmark}>Breathease</Text>
          <Pressable onPress={finishOnboarding} hitSlop={8}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={onboardingLayout.body}>
          <Animated.View style={[styles.illustrationWrap, { transform: [{ translateY }] }]}>
            <View style={styles.illustrationRing} />
            <View style={styles.illustrationCircle}>
              <MaterialIcons name="local-fire-department" size={64} color="#fb923c" />
            </View>
          </Animated.View>

          <View style={styles.textArea}>
            <Text style={styles.headline} accessibilityRole="header">
              One reset a day changes the rest of it.
            </Text>
            <Text style={styles.body}>
              We'll remind you at the moments you actually need it.
            </Text>
            <Text style={styles.tip}>{REMINDER_TIP}</Text>
          </View>
        </View>

        <View style={onboardingLayout.footer}>
          <Pressable
            onPress={finishOnboarding}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          >
            <LinearGradient
              colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Get started</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={handleEnableReminders} hitSlop={8} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Enable reminders</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <TimePickerModal
        visible={pickerVisible}
        initialHour={null}
        initialMinute={null}
        onConfirm={handleConfirmTime}
        onCancel={handleCancelTime}
      />
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
  // Outline only: no lighter fill.
  illustrationCircle: {
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    alignItems: 'center',
    gap: spacing.base * 1.5,
  },
  headline: {
    ...text.name,
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
  tip: {
    ...text.meta,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
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
    minHeight: 52,
    paddingVertical: spacing.base * 2,
    borderRadius: radii.full,
  },
  primaryButtonText: {
    ...typography.headlineLgMobile,
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: SECONDARY_ACTION_HEIGHT,
    paddingVertical: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...text.linkBold,
    color: '#ffffff',
  },
});
