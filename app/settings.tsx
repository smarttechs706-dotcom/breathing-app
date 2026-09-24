import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../src/components/GlassCard';
import { colors, radii, spacing, typography } from '../src/theme/tokens';

// Dummy/placeholder per CLAUDE.md's build order — real expo-notifications
// scheduling is build order step 10. Matches settings-code.html's static
// "8:00 PM" + toggle-on default exactly; no persistence yet.
const REMINDER_TIME_LABEL = '8:00 PM';
const APP_VERSION = '1.0.0';

// settings-code.html's toggle is a custom-styled switch (gradient track
// when on, not a flat color), which RN's built-in Switch can't reproduce —
// it only supports flat trackColor per state. Built as a local Pressable +
// LinearGradient to match the reference exactly, matching the pill-toggle
// dimensions from the HTML precisely: track 48x28 (w-12 h-7), thumb 20x20
// (w-5 h-5), 4px inset (p-1), 20px thumb travel (translate-x-5) — kept
// local to this file since no other screen uses this component today.
function ReminderToggle({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Daily reminder"
      hitSlop={8}
      style={styles.toggleTrack}
    >
      {value ? (
        <LinearGradient
          colors={[colors.primaryContainer, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.toggleTrackOff]} />
      )}
      <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [reminderEnabled, setReminderEnabled] = useState(true);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <View style={styles.content}>
          {/* settings-code.html: absolute -top-12 -left-12 w-64 h-64
              rounded-full bg-primary-container/10 blur-3xl — same flat-
              circle approximation for backdrop-blur glow already used for
              Home/Player's background glow, since RN has no CSS blur. */}
          <View style={styles.backgroundGlow} />

          <GlassCard radius={radii.lg} style={styles.card}>
            <View style={styles.reminderRow}>
              <View>
                <Text style={styles.cardTitle}>Daily Reminder</Text>
                <Text style={styles.reminderTime}>{REMINDER_TIME_LABEL}</Text>
              </View>
              <ReminderToggle value={reminderEnabled} onValueChange={setReminderEnabled} />
            </View>
          </GlassCard>

          <GlassCard radius={radii.lg} style={styles.card}>
            <View style={styles.aboutRow}>
              <Text style={styles.cardTitle}>About</Text>
              <Text style={styles.versionText}>Version {APP_VERSION}</Text>
            </View>
          </GlassCard>
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
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.marginMobile,
    height: 64,
  },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -spacing.base,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
    color: colors.onSurface,
  },
  content: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base * 2,
    gap: spacing.base * 3,
  },
  backgroundGlow: {
    pointerEvents: 'none',
    position: 'absolute',
    top: -48,
    left: -48,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: colors.primaryContainer,
    opacity: 0.1,
  },
  card: {
    padding: spacing.base * 2.5,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    fontWeight: '600',
    color: colors.onSurface,
  },
  reminderTime: {
    fontFamily: typography.headlineLg.fontFamily,
    fontSize: typography.headlineLg.fontSize,
    lineHeight: typography.headlineLg.lineHeight,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toggleTrackOff: {
    borderRadius: 14,
    backgroundColor: colors.surfaceVariant,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.onPrimary,
    transform: [{ translateX: 0 }],
  },
  toggleThumbOn: {
    transform: [{ translateX: 20 }],
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versionText: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
  },
});
