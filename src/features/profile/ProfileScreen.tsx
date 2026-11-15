import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { friendlyError } from '../../api/apiErrors';
import { fetchInsights, type InsightsResponse } from '../../api/client';
import { accountFirstName, accountInitial, homeGreeting } from '../../auth/accountName';
import { useAuth } from '../../auth/AuthProvider';
import { useRefreshOnNewCheckin } from '../../state/checkinSignal';
import { colors, spacing, typography } from '../../theme/tokens';
import { getReminderSettings } from '../../utils/reminders';
import { FadeIn, STAGGER_MS } from '../home/motion';
import { PreviewGlass } from '../home/PreviewGlass';
import { accents, text } from '../home/styles';
import {
  dayCount,
  minutesLabel,
  PROFILE_ROWS,
  reminderLabel,
  sessionCount,
  type ProfileRow,
  type ReminderState,
} from './profileModel';
import { PhotoSheet } from './PhotoSheet';
import {
  chooseProfilePhoto,
  getProfilePhotoUri,
  removeProfilePhotoEverywhere,
  syncProfilePhoto,
} from './profilePhotoStore';
import { BACKDROP_BOTTOM, BACKDROP_TOP, MIST_BACKGROUND, ScreenBackdrop } from './ScreenBackdrop';

// Profile tab: who you are, your real stats, and two rows: Settings (account
// actions, About) and Daily reminder (its own screen). Change password,
// Privacy Policy and Sign out live only in Settings. Same tokens and light
// glass cards as Home; background from ScreenBackdrop.

const AVATAR = 72;
// The edit badge on the circle and its pencil.
const EDIT_BADGE = 22;
const EDIT_ICON = 12;
const CARD_RADIUS = 16;

export function ProfileScreen({ tabBarHeight }: { tabBarHeight: number }) {
  const { session } = useAuth();
  const firstName = accountFirstName(session?.user);
  const initial = accountInitial(firstName);
  const userId = session?.user.id ?? null;

  // The Profile picture: the phone copy, kept in step with the account's copy
  // (profilePhotoStore.ts, photoSync.ts). null = no photo: the circle shows
  // the initial (or a person icon) as before.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  useEffect(() => {
    setPhotoUri(getProfilePhotoUri(userId));
  }, [userId]);

  // On every focus: upload a waiting picture, or fetch the account's copy
  // (after sign-in, or once a day). Quiet: a failure leaves what is shown.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      let active = true;
      void syncProfilePhoto(userId).then((result) => {
        if (active && (result === 'downloaded' || result === 'removed-locally')) {
          setPhotoUri(getProfilePhotoUri(userId));
        }
      });
      return () => {
        active = false;
      };
    }, [userId])
  );

  const choosePhoto = useCallback(async () => {
    if (!userId) return;
    const result = await chooseProfilePhoto(userId);
    if (result.kind === 'saved') setPhotoUri(result.uri);
    else if (result.kind === 'failed') {
      Alert.alert("Couldn't use that photo", 'Please try a different one.');
    }
  }, [userId]);

  // The "Profile picture" sheet (PhotoSheet.tsx). Its actions run after it
  // has closed, so the system photo picker never opens on top of it.
  const [sheetOpen, setSheetOpen] = useState(false);
  const openPhotoChoices = useCallback(() => setSheetOpen(true), []);
  // Remove photo needs the server: nothing is removed unless the account's
  // copy is gone, so a removed picture never comes back.
  const removePhoto = useCallback(async () => {
    if (!userId) return;
    const result = await removeProfilePhotoEverywhere(userId);
    if (result === 'removed') setPhotoUri(null);
    else Alert.alert("Couldn't remove your photo", 'Check your connection and try again.');
  }, [userId]);

  const onPhotoAction = useCallback(
    (action: 'choose' | 'remove') => {
      if (action === 'choose') void choosePhoto();
      else void removePhoto();
    },
    [choosePhoto, removePhoto]
  );

  // Stats from the existing GET /api/insights. null = loading.
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const loadInsights = useCallback(() => {
    setInsightsError(null);
    setInsights(null);
    fetchInsights()
      .then(setInsights)
      .catch((err) => setInsightsError(friendlyError(err)));
  }, []);
  useEffect(() => {
    loadInsights();
  }, [loadInsights]);
  // After a saved check-in: refresh quietly; old numbers stay on a failure.
  const refreshAfterCheckin = useCallback(() => {
    fetchInsights()
      .then(setInsights)
      .catch(() => {});
  }, []);
  useRefreshOnNewCheckin(refreshAfterCheckin);

  // Reminder status, read on every focus so it is current after the Reminder screen.
  const [reminder, setReminder] = useState<ReminderState | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getReminderSettings()
        .then((s) => {
          if (active) setReminder(s);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [])
  );

  const openRow = (row: ProfileRow) => router.push(row.target.href);

  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.base * 3 }]}
          showsVerticalScrollIndicator={false}
        >
          <FadeIn style={styles.header}>
            <Pressable
              onPress={openPhotoChoices}
              style={styles.avatarButton}
              accessibilityRole="button"
              accessibilityLabel={`Profile picture, ${firstName ?? 'Your profile'}`}
              accessibilityHint="Choose or remove a photo"
            >
              <View style={styles.avatar}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photo}
                    resizeMode="cover"
                    accessible={false}
                    accessibilityIgnoresInvertColors
                    onError={() => setPhotoUri(null)}
                  />
                ) : initial ? (
                  <Text style={styles.initial}>{initial}</Text>
                ) : (
                  <Ionicons name="person" size={36} color="#ffffff" />
                )}
              </View>
              {/* Decorative edit badge: part of the one button above, never a
                  tap target or a screen reader stop of its own. */}
              <View
                style={styles.editBadge}
                pointerEvents="none"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                <Ionicons name="pencil" size={EDIT_ICON} color="#ffffff" />
              </View>
            </Pressable>
            <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
              {firstName ?? homeGreeting(null)}
            </Text>
          </FadeIn>

          <FadeIn delay={STAGGER_MS}>
            {insightsError ? (
              <PreviewGlass radius={CARD_RADIUS} style={styles.errorCard}>
                <View style={styles.errorText}>
                  <Text style={styles.errorTitle}>Couldn&apos;t load your stats.</Text>
                  <Text style={styles.errorDetail} numberOfLines={2}>
                    {insightsError}
                  </Text>
                </View>
                <Pressable onPress={loadInsights} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.retry}>Retry</Text>
                </Pressable>
              </PreviewGlass>
            ) : (
              <View
                style={[styles.stats, !insights && styles.loading]}
                accessible={!insights}
                accessibilityLabel={insights ? undefined : 'Loading your stats'}
              >
                <Stat
                  icon="flame"
                  iconColor={accents.flame}
                  value={insights ? dayCount(insights.streak.currentStreak) : ''}
                  label="Streak"
                />
                <Stat
                  icon="calendar-outline"
                  iconColor={colors.secondary}
                  value={insights ? sessionCount(insights.sessionsThisWeek) : ''}
                  label="Last 7 days"
                />
                <Stat
                  icon="time-outline"
                  iconColor={colors.secondary}
                  value={insights ? minutesLabel(insights.mindfulMinutes) : ''}
                  label="Mindful minutes"
                />
              </View>
            )}
          </FadeIn>

          <FadeIn delay={STAGGER_MS * 2}>
            <PreviewGlass radius={CARD_RADIUS}>
              {PROFILE_ROWS.map((row, i) => {
                const value = row.key === 'reminder' ? reminderLabel(reminder) : null;
                return (
                  <Pressable
                    key={row.key}
                    onPress={() => openRow(row)}
                    accessibilityRole="button"
                    accessibilityLabel={value ? `${row.label}, ${value}` : row.label}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && styles.rowDivider,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <Ionicons
                      name={row.icon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color={colors.onSurfaceVariant}
                    />
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {row.label}
                    </Text>
                    {value && <Text style={styles.rowValue}>{value}</Text>}
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.onSurfaceVariant}
                    />
                  </Pressable>
                );
              })}
            </PreviewGlass>
          </FadeIn>

        </ScrollView>
      </SafeAreaView>
      <PhotoSheet
        visible={sheetOpen}
        hasPhoto={photoUri !== null}
        onAction={onPhotoAction}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

function Stat({
  icon,
  iconColor,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
}) {
  return (
    <PreviewGlass radius={CARD_RADIUS} style={styles.stat}>
      <View
        style={styles.statBody}
        accessible={value !== ''}
        accessibilityLabel={value !== '' ? `${label}: ${value}` : undefined}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PreviewGlass>
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
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.base * 3,
    gap: spacing.base * 3,
  },
  header: {
    alignItems: 'center',
    gap: spacing.base,
  },
  // The button: same 72 dp box and bottom margin as the circle had, so the
  // name and everything below stay where they were.
  avatarButton: {
    width: AVATAR,
    height: AVATAR,
    marginBottom: spacing.base,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1,
    borderColor: accents.avatarBorder,
    backgroundColor: accents.avatarFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Small indigo badge with a white pencil, on the bottom-right edge of the
  // circle; a thin ring in the backdrop colour separates it. No shadow.
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: EDIT_BADGE,
    height: EDIT_BADGE,
    borderRadius: EDIT_BADGE / 2,
    borderWidth: 2,
    borderColor: BACKDROP_TOP,
    backgroundColor: colors.inversePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: AVATAR,
    height: AVATAR,
  },
  initial: {
    ...typography.headlineLg,
    color: '#ffffff',
  },
  name: {
    ...text.name,
    color: '#ffffff',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.base * 1.5,
  },
  loading: {
    opacity: 0.4,
  },
  stat: {
    flex: 1,
  },
  statBody: {
    paddingVertical: spacing.base * 2,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    gap: spacing.base * 0.5,
  },
  statValue: {
    ...text.featuredTitle,
    fontSize: 18,
    lineHeight: 24,
    minHeight: 24,
    color: '#ffffff',
  },
  statLabel: {
    ...text.cardMeta,
    color: colors.onSurfaceVariant,
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
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 2,
    padding: spacing.base * 2,
  },
  errorText: {
    flex: 1,
  },
  errorTitle: {
    ...text.body,
    color: colors.onSurface,
  },
  errorDetail: {
    ...text.body,
    color: colors.onSurfaceVariant,
  },
  retry: {
    ...text.linkBold,
    color: '#ffffff',
  },
});
