import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { useAuth } from '../src/auth/AuthProvider';
import { useSingleFlight } from '../src/auth/useSingleFlight';
import { PreviewGlass } from '../src/features/home/PreviewGlass';
import { accents, text } from '../src/features/home/styles';
import { removeProfilePhoto } from '../src/features/profile/profilePhotoStore';
import { BACKDROP_BOTTOM, MIST_BACKGROUND, ScreenBackdrop } from '../src/features/profile/ScreenBackdrop';
import {
  confirmDelete,
  DELETE_FAILURE,
  DELETE_REMINDER_NOT_CANCELLED,
  deleteMyData,
  showDeleted,
} from '../src/utils/deleteMyData';
import { colors, spacing, typography } from '../src/theme/tokens';

// Settings: account actions and About, styled like Profile (navy backdrop,
// glass cards, icon rows). The name is shown on Profile and can no longer be
// edited; the daily reminder lives on its own screen (app/reminder.tsx),
// opened from Profile.

const APP_VERSION = Constants.expoConfig?.version ?? '';
const CARD_RADIUS = 16;

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

export default function SettingsScreen() {
  const { signOut, session } = useAuth();
  // Shown read-only as the "Account" row (it is no longer on Profile).
  const email = session?.user.email ?? null;
  const leaving = useSingleFlight();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The route guards go to Log in once the session is gone, so nothing
  // navigates here.
  const handleSignOut = () =>
    leaving.run(async () => {
      if (await confirmSignOut()) {
        // Only this user-initiated sign out removes the Profile picture; the
        // automatic sign-out after a session expires keeps it.
        removeProfilePhoto(session?.user.id);
        await signOut();
      }
    });

  async function handleDeleteAccount() {
    if (deleting) return;
    if (!(await confirmDelete())) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteMyData(session?.user.id);
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
            Settings
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PreviewGlass radius={CARD_RADIUS}>
            {email && (
              <View style={styles.row} accessible accessibilityLabel={`Account, ${email}`}>
                <Ionicons name="person-circle-outline" size={22} color={colors.onSurfaceVariant} />
                <Text style={styles.rowLabel}>Account</Text>
                <Text style={[styles.rowValue, styles.rowValueShrink]} numberOfLines={1} ellipsizeMode="middle">
                  {email}
                </Text>
              </View>
            )}
            <Pressable
              onPress={() => router.push('/change-password')}
              accessibilityRole="button"
              accessibilityLabel="Change password"
              style={({ pressed }) => [styles.row, email ? styles.rowDivider : null, pressed && styles.rowPressed]}
            >
              <Ionicons name="key-outline" size={22} color={colors.onSurfaceVariant} />
              <Text style={styles.rowLabel}>Change password</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
            </Pressable>
            <Pressable
              onPress={handleSignOut}
              disabled={leaving.running}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              accessibilityState={{ disabled: leaving.running, busy: leaving.running }}
              style={({ pressed }) => [styles.row, styles.rowDivider, pressed && styles.rowPressed]}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.onSurfaceVariant} />
              <Text style={styles.rowLabel}>Sign out</Text>
              {leaving.running && <ActivityIndicator color={colors.onSurfaceVariant} />}
            </Pressable>
          </PreviewGlass>

          <PreviewGlass radius={CARD_RADIUS}>
            <Pressable
              onPress={handleDeleteAccount}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              accessibilityState={{ disabled: deleting }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
              <Text style={[styles.rowLabel, styles.danger]}>Delete account</Text>
              {deleting && <ActivityIndicator color={colors.error} />}
            </Pressable>
            {deleteError && <Text style={styles.deleteError}>{deleteError}</Text>}
          </PreviewGlass>

          <PreviewGlass radius={CARD_RADIUS}>
            <View style={styles.row} accessible accessibilityLabel={`About, version ${APP_VERSION}`}>
              <Ionicons name="information-circle-outline" size={22} color={colors.onSurfaceVariant} />
              <Text style={styles.rowLabel}>About</Text>
              <Text style={styles.rowValue}>Version {APP_VERSION}</Text>
            </View>
            <Pressable
              onPress={openPrivacyPolicy}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
              style={({ pressed }) => [styles.row, styles.rowDivider, pressed && styles.rowPressed]}
            >
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.onSurfaceVariant} />
              <Text style={styles.rowLabel}>Privacy Policy</Text>
              <Ionicons name="open-outline" size={18} color={colors.onSurfaceVariant} />
            </Pressable>
          </PreviewGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Rows match Profile's (src/features/profile/ProfileScreen.tsx).
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
    gap: spacing.base * 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.base * 2,
    gap: spacing.base * 1.5,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: accents.glassBorder,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowLabel: {
    ...typography.bodyMd,
    color: colors.onSurface,
    flex: 1,
  },
  rowValue: {
    ...text.body,
    color: colors.onSurfaceVariant,
  },
  // A long email gives way (shortened in the middle) before the label does.
  rowValueShrink: {
    flexShrink: 1,
    maxWidth: '65%',
  },
  danger: {
    color: colors.error,
  },
  deleteError: {
    ...text.body,
    color: colors.error,
    paddingHorizontal: spacing.base * 2,
    paddingBottom: spacing.base * 2,
  },
});
