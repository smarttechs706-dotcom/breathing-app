import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../src/components/GlassCard';
import { TimePickerModal } from '../src/components/TimePickerModal';
import { UserNameModal } from '../src/components/UserNameModal';
import { getUserName } from '../src/utils/userName';
import {
  applyReminderSchedule,
  REMINDER_TIP,
  getReminderSettings,
  requestNotificationPermission,
  saveReminderSettings,
  type ReminderSettings,
} from '../src/utils/reminders';
import { colors, radii, spacing, typography } from '../src/theme/tokens';

const APP_VERSION = '1.0.0';

// architecture.md's Notifications section: daily reminder time is always
// user-chosen, never a fixed default — see src/utils/reminders.ts.
function formatReminderTime(settings: ReminderSettings): string {
  if (settings.hour === null || settings.minute === null) return 'Not set';
  const period = settings.hour >= 12 ? 'PM' : 'AM';
  const hour12 = settings.hour % 12 === 0 ? 12 : settings.hour % 12;
  return `${hour12}:${settings.minute.toString().padStart(2, '0')} ${period}`;
}

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

const LOADING_SETTINGS: ReminderSettings = { enabled: false, hour: null, minute: null };

export default function SettingsScreen() {
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(LOADING_SETTINGS);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    getReminderSettings().then(setReminderSettings);
  }, []);

  // TEMPORARY local display name (src/utils/userName.ts), edited here via the
  // same modal Home uses for its first-time prompt. Home re-reads it on focus.
  const [userName, setUserNameState] = useState<string | null>(null);
  const [nameModalVisible, setNameModalVisible] = useState(false);

  useEffect(() => {
    getUserName().then(setUserNameState);
  }, []);

  const REMINDER_SCHEDULE_ERROR = "Couldn't schedule the reminder. Please try again.";

  async function handleToggleChange(nextEnabled: boolean) {
    if (!nextEnabled) {
      const next = { ...reminderSettings, enabled: false };
      const result = await applyReminderSchedule(next);
      if (!result.ok) {
        setPermissionError(REMINDER_SCHEDULE_ERROR);
        return;
      }
      await saveReminderSettings(next);
      setReminderSettings(next);
      setPermissionError(null);
      return;
    }

    const result = await requestNotificationPermission();
    if (result === 'unavailable') {
      setPermissionError("Reminders need a development build and aren't available in Expo Go.");
      return;
    }
    if (result === 'denied') {
      setPermissionError(
        "Reminders are off — notification permission was denied. You can allow it from your device's app settings."
      );
      return;
    }
    setPermissionError(null);
    // Don't flip `enabled` until a time is actually chosen — this is the
    // "never default to a fixed time" requirement in practice.
    setPickerVisible(true);
  }

  async function handleConfirmTime(hour: number, minute: number) {
    const next: ReminderSettings = { enabled: true, hour, minute };
    const result = await applyReminderSchedule(next);
    setPickerVisible(false);
    if (!result.ok) {
      // Nothing was saved, so the card keeps showing what is really scheduled.
      setPermissionError(REMINDER_SCHEDULE_ERROR);
      return;
    }
    setPermissionError(null);
    await saveReminderSettings(next);
    setReminderSettings(next);
  }

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
                <Pressable
                  onPress={() => reminderSettings.enabled && setPickerVisible(true)}
                  disabled={!reminderSettings.enabled}
                  hitSlop={8}
                >
                  <Text style={styles.reminderTime}>{formatReminderTime(reminderSettings)}</Text>
                </Pressable>
              </View>
              <ReminderToggle value={reminderSettings.enabled} onValueChange={handleToggleChange} />
            </View>
            {permissionError && <Text style={styles.permissionErrorText}>{permissionError}</Text>}
            <Text style={styles.reminderTip}>{REMINDER_TIP}</Text>
          </GlassCard>

          <GlassCard radius={radii.lg} style={styles.card}>
            <Pressable
              onPress={() => setNameModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit your name"
              style={styles.aboutRow}
            >
              <Text style={styles.cardTitle}>Name</Text>
              <Text style={styles.nameValue} numberOfLines={1}>
                {userName ?? 'Not set'}
              </Text>
            </Pressable>
          </GlassCard>

          <GlassCard radius={radii.lg} style={styles.card}>
            <View style={styles.aboutRow}>
              <Text style={styles.cardTitle}>About</Text>
              <Text style={styles.versionText}>Version {APP_VERSION}</Text>
            </View>
          </GlassCard>
        </View>
      </SafeAreaView>

      <TimePickerModal
        visible={pickerVisible}
        initialHour={reminderSettings.hour}
        initialMinute={reminderSettings.minute}
        onConfirm={handleConfirmTime}
        onCancel={() => setPickerVisible(false)}
      />

      <UserNameModal
        visible={nameModalVisible}
        initialName={userName}
        onSaved={(name) => {
          setUserNameState(name);
          setNameModalVisible(false);
        }}
        onCancel={() => setNameModalVisible(false)}
      />
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
  reminderTip: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: spacing.base * 1.5,
  },
  permissionErrorText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.error,
    marginTop: spacing.base * 1.5,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Name card's value — shrinks and truncates so a 30-char name can't push
  // the "Name" label off the row.
  nameValue: {
    flexShrink: 1,
    marginLeft: spacing.base * 2,
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    fontWeight: '600',
    color: colors.primary,
  },
  versionText: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
  },
});
