import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiBaseUrl } from '../src/api/client';
import { accountFirstName } from '../src/auth/accountName';
import { useAuth } from '../src/auth/AuthProvider';
import { useSingleFlight } from '../src/auth/useSingleFlight';
import { EditNameModal } from '../src/components/EditNameModal';
import { GlassCard } from '../src/components/GlassCard';
import { TimePickerModal } from '../src/components/TimePickerModal';
import {
  confirmDelete,
  DELETE_FAILURE,
  DELETE_REMINDER_NOT_CANCELLED,
  deleteMyData,
  showDeleted,
} from '../src/utils/deleteMyData';
import {
  applyReminderSchedule,
  REMINDER_TIP,
  getReminderSettings,
  requestNotificationPermission,
  saveReminderSettings,
  type ReminderSettings,
} from '../src/utils/reminders';
import { colors, radii, spacing, typography } from '../src/theme/tokens';

const APP_VERSION = Constants.expoConfig?.version ?? '';

// Opened from About; the policy page is served by the same API as the data.
function openPrivacyPolicy() {
  Linking.openURL(new URL('/privacy', getApiBaseUrl()).toString()).catch(() => {});
}

// react-native-web's Alert.alert is a no-op, so web (used for testing) falls
// back to the browser's own dialog, same as confirmDelete.
function confirmSignOut(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm('Sign out?'));
  return new Promise((resolve) => {
    Alert.alert(
      'Sign out?',
      undefined,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign out', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

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

  const { session, signOut } = useAuth();
  const email = session?.user.email ?? null;
  const firstName = accountFirstName(session?.user);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const leaving = useSingleFlight();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The route guards go to Log in once the session is gone, so nothing
  // navigates here.
  const handleSignOut = () =>
    leaving.run(async () => {
      if (await confirmSignOut()) await signOut();
    });

  async function handleDeleteAccount() {
    if (deleting) return;
    if (!(await confirmDelete())) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteMyData();
    if (result === 'failed') {
      setDeleting(false);
      setDeleteError(DELETE_FAILURE);
      return;
    }
    // The account is gone but its token still works for up to an hour, so sign
    // out now. The route guards then drop every signed-in screen, which is why
    // nothing navigates here.
    showDeleted(
      () => void signOut(),
      result === 'reminder-not-cancelled' ? DELETE_REMINDER_NOT_CANCELLED : undefined
    );
  }

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

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
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

          {/* No Account section in settings-code.html: these reuse the card and
              row styles already on this screen. */}
          <GlassCard radius={radii.lg} style={styles.card}>
            <Text style={styles.sectionLabel}>Account</Text>
            <View
              style={[styles.aboutRow, styles.accountRow]}
              accessible
              accessibilityLabel={`Email ${email ?? 'not available'}`}
            >
              <Text style={styles.cardTitle}>Email</Text>
              <Text style={styles.emailValue} numberOfLines={1} ellipsizeMode="middle">
                {email ?? ''}
              </Text>
            </View>
            <Pressable
              onPress={() => setNameModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit your first name"
              style={[styles.aboutRow, styles.accountRow]}
            >
              <Text style={styles.cardTitle}>First name</Text>
              <View style={styles.nameEdit}>
                <Text style={styles.nameValue} numberOfLines={1}>
                  {firstName ?? 'Add your name'}
                </Text>
                <MaterialIcons name="edit" size={24} color={colors.onSurfaceVariant} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => router.push('/change-password')}
              accessibilityRole="button"
              accessibilityLabel="Change password"
              style={[styles.aboutRow, styles.accountRow]}
            >
              <Text style={styles.cardTitle}>Change password</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
            </Pressable>
            <Pressable
              onPress={handleSignOut}
              disabled={leaving.running}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              accessibilityState={{ disabled: leaving.running, busy: leaving.running }}
              style={[styles.aboutRow, styles.accountRow]}
            >
              <Text style={styles.cardTitle}>Sign out</Text>
              {leaving.running ? (
                <ActivityIndicator color={colors.onSurfaceVariant} />
              ) : (
                <MaterialIcons name="logout" size={24} color={colors.onSurfaceVariant} />
              )}
            </Pressable>
          </GlassCard>

          <GlassCard radius={radii.lg} style={styles.card}>
            <Pressable
              onPress={handleDeleteAccount}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              accessibilityState={{ disabled: deleting }}
              style={styles.aboutRow}
            >
              <Text style={styles.cardTitle}>Delete account</Text>
              {deleting ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <MaterialIcons name="delete-outline" size={24} color={colors.error} />
              )}
            </Pressable>
            {deleteError && <Text style={styles.permissionErrorText}>{deleteError}</Text>}
          </GlassCard>

          <GlassCard radius={radii.lg} style={styles.card}>
            <View style={styles.aboutRow}>
              <Text style={styles.cardTitle}>About</Text>
              <Text style={styles.versionText}>Version {APP_VERSION}</Text>
            </View>
            <Pressable
              onPress={openPrivacyPolicy}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
              style={[styles.aboutRow, styles.privacyRow]}
            >
              <Text style={styles.cardTitle}>Privacy Policy</Text>
              <MaterialIcons name="open-in-new" size={24} color={colors.onSurfaceVariant} />
            </Pressable>
          </GlassCard>

          {/* Dev builds only: the one way into the Home redesign preview. */}
          {__DEV__ && (
            <GlassCard radius={radii.lg} style={styles.card}>
              <Pressable
                onPress={() => router.push('/home-redesign-preview')}
                accessibilityRole="button"
                accessibilityLabel="Home redesign preview"
                style={[styles.aboutRow, styles.accountRow]}
              >
                <Text style={styles.cardTitle}>Home redesign preview</Text>
                <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
              </Pressable>
            </GlassCard>
          )}
        </ScrollView>
      </SafeAreaView>

      <TimePickerModal
        visible={pickerVisible}
        initialHour={reminderSettings.hour}
        initialMinute={reminderSettings.minute}
        onConfirm={handleConfirmTime}
        onCancel={() => setPickerVisible(false)}
      />

      <EditNameModal
        visible={nameModalVisible}
        initialName={firstName}
        onClose={() => setNameModalVisible(false)}
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
    paddingBottom: spacing.base * 4,
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
  sectionLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.onSurfaceVariant,
  },
  accountRow: {
    minHeight: 48,
  },
  // Read-only, so it uses the quiet color rather than the editable accent.
  emailValue: {
    flexShrink: 1,
    marginLeft: spacing.base * 2,
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurfaceVariant,
  },
  // Shrinks and truncates so a 30-char name can't push the label off the row.
  nameEdit: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginLeft: spacing.base * 2,
  },
  nameValue: {
    flexShrink: 1,
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    fontWeight: '600',
    color: colors.primary,
  },
  privacyRow: {
    marginTop: spacing.gutter,
    minHeight: 48,
  },
  versionText: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
  },
});
