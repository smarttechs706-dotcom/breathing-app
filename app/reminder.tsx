import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TimePickerModal } from '../src/components/TimePickerModal';
import { PreviewGlass } from '../src/features/home/PreviewGlass';
import { text } from '../src/features/home/styles';
import { reminderLabel } from '../src/features/profile/profileModel';
import { BACKDROP_BOTTOM, MIST_BACKGROUND, ScreenBackdrop } from '../src/features/profile/ScreenBackdrop';
import {
  applyReminderSchedule,
  REMINDER_TIP,
  getReminderSettings,
  requestNotificationPermission,
  saveReminderSettings,
  type ReminderSettings,
} from '../src/utils/reminders';
import { colors, spacing, typography } from '../src/theme/tokens';

// Daily reminder, opened from Profile's "Daily reminder" row. The card and
// its logic moved here unchanged from app/settings.tsx (toggle, permission
// handling, time picker, calls to src/utils/reminders.ts). The time reads the
// same as on Profile: the time, e.g. "8:00 PM", or "Off".

const CARD_RADIUS = 16;

// A local pill switch (track 48x28, thumb 20x20, 20px travel). Off: a light
// thumb on a faint track. On: a white thumb on a solid blue track.
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
      <View style={[StyleSheet.absoluteFill, value ? styles.toggleTrackOn : styles.toggleTrackOff]} />
      <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
    </Pressable>
  );
}

const LOADING_SETTINGS: ReminderSettings = { enabled: false, hour: null, minute: null };

export default function ReminderScreen() {
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(LOADING_SETTINGS);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    getReminderSettings().then(setReminderSettings);
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
        "Reminders are off because notification permission was denied. You can allow it in your phone's app settings."
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
      <ScreenBackdrop painting={MIST_BACKGROUND} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Daily reminder
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PreviewGlass radius={CARD_RADIUS} style={styles.card}>
            <View style={styles.reminderRow}>
              <View>
                <Pressable
                  onPress={() => reminderSettings.enabled && setPickerVisible(true)}
                  disabled={!reminderSettings.enabled}
                  hitSlop={8}
                >
                  <Text style={styles.reminderTime}>{reminderLabel(reminderSettings)}</Text>
                </Pressable>
              </View>
              <ReminderToggle value={reminderSettings.enabled} onValueChange={handleToggleChange} />
            </View>
            {permissionError && <Text style={styles.permissionErrorText}>{permissionError}</Text>}
            <Text style={styles.reminderTip}>{REMINDER_TIP}</Text>
          </PreviewGlass>
        </ScrollView>
      </SafeAreaView>

      <TimePickerModal
        visible={pickerVisible}
        initialHour={reminderSettings.hour}
        initialMinute={reminderSettings.minute}
        onConfirm={handleConfirmTime}
        onCancel={() => setPickerVisible(false)}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.gutter,
    height: 64,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...text.name,
    color: '#ffffff',
  },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.base * 2,
    paddingBottom: spacing.base * 4,
  },
  card: {
    padding: spacing.base * 2.5,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderTime: {
    ...typography.headlineLgMobile,
    color: '#ffffff',
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
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  toggleTrackOn: {
    borderRadius: 14,
    backgroundColor: colors.inversePrimary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.onSurfaceVariant,
    transform: [{ translateX: 0 }],
  },
  toggleThumbOn: {
    backgroundColor: '#ffffff',
    transform: [{ translateX: 20 }],
  },
  reminderTip: {
    ...text.body,
    color: colors.onSurfaceVariant,
    marginTop: spacing.base * 1.5,
  },
  permissionErrorText: {
    ...text.body,
    color: colors.error,
    marginTop: spacing.base * 1.5,
  },
});
