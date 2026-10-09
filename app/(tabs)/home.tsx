import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
// Deep import, not a documented public path: expo-router vendors its own
// react-navigation/bottom-tabs copy (there's no separate
// @react-navigation/bottom-tabs dependency), and this hook isn't
// re-exported from the top-level 'expo-router' package. It's still the
// library's own recommended fix for this problem (its own type comments
// say so), and is now CONFIRMED correct on-device via instrumented
// debugging (reported tabBarHeight=84.0, matching reality exactly) — the
// overlap some users see at scrollY=0 is inherent to a floating tab bar
// over content taller than one screen (nothing to scroll yet), not a
// calculation bug. Flagging the fragility: could break on an expo-router
// upgrade that reorganizes this internal path.
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchInsights, fetchSessions, type InsightsResponse } from '../../src/api/client';
import { useRefreshOnNewCheckin } from '../../src/state/checkinSignal';
import { getCachedSessions, setCachedSessions } from '../../src/state/sessionsCache';
import { BreathOrb } from '../../src/components/BreathOrb';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientText } from '../../src/components/GradientText';
import { MOOD_EMOJIS, MOOD_LABELS } from '../../src/components/MoodSelector';
import { UserNameModal } from '../../src/components/UserNameModal';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import type { Session } from '../../src/types/models';
import { getDeviceId } from '../../src/utils/deviceId';
import { getUserName } from '../../src/utils/userName';

function formatDuration(durationSec: number) {
  return `${Math.round(durationSec / 60)} min`;
}

// FRONTEND-AUDIT-2.md High finding: this card used to read a local static
// session unconditionally, never the live backend. Now fetched via the same
// GET /api/sessions Library's grid already uses — architecture.md's locked
// table designates 'deep-exhale' as the Featured Session (matches
// home-code.html's mockup), so that's the id looked up in the live list,
// not just "whichever session the query happens to return first" (Supabase
// query here has no ORDER BY, so response order isn't guaranteed). Falls
// back to the first live session only if 'deep-exhale' itself is somehow
// absent from the backend, rather than showing nothing.
const FEATURED_SESSION_ID = 'deep-exhale';

function pickFeatured(sessions: Session[]): Session | null {
  return sessions.find((s) => s.id === FEATURED_SESSION_ID) ?? sessions[0] ?? null;
}

// Greeting label from the phone's local hour: morning 05:00-11:59,
// afternoon 12:00-16:59, evening 17:00-04:59 (late night reads as "evening"
// rather than a "Good morning" at 2 a.m.).
function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  // TEMPORARY local display name (src/utils/userName.ts) — undefined = still
  // reading storage (shows nothing, so a saved name never flashes the
  // "Tap to add your name" prompt), null = none saved.
  const [userName, setUserNameState] = useState<string | null | undefined>(undefined);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [hour, setHour] = useState(() => new Date().getHours());

  // Home stays mounted underneath Settings, so a mount-only read would go
  // stale after editing the name there. Reads local storage only — no network
  // call, so this doesn't touch the insights/sessions fetches below.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setHour(new Date().getHours());
      getUserName().then((name) => {
        if (active) setUserNameState(name);
      });
      return () => {
        active = false;
      };
    }, [])
  );
  // null = still loading (first fetch, or a retry in flight).
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setInsights(null);
    getDeviceId()
      .then(fetchInsights)
      .then(setInsights)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load your snapshot.')
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // D-02: Home now survives a completed session (see checkinSignal.ts), so
  // refresh the snapshot silently — old numbers stay on screen, and a failed
  // refresh leaves them as they were.
  const refreshAfterCheckin = useCallback(() => {
    getDeviceId()
      .then(fetchInsights)
      .then(setInsights)
      .catch(() => {});
  }, []);
  useRefreshOnNewCheckin(refreshAfterCheckin);

  // Independent of the insights fetch above — the Featured Session card and
  // the Snapshot section are two unrelated pieces of data (matches this
  // screen's existing per-section-gating pattern, now applied consistently
  // to both sections instead of just one).
  //
  // P4: starts from the shared sessions cache when it holds a non-empty list
  // (same pattern as session-player.tsx / library.tsx) so the card renders
  // with no spinner; every successful fetch also writes the cache, which is
  // what lets Library and Session Player hit it after a cold launch.
  const [featuredSession, setFeaturedSession] = useState<Session | null>(() => {
    const cached = getCachedSessions();
    return cached && cached.length > 0 ? pickFeatured(cached) : null;
  });
  const [featuredError, setFeaturedError] = useState<string | null>(null);

  const loadFeatured = useCallback(() => {
    setFeaturedError(null);
    setFeaturedSession(null);
    fetchSessions()
      .then((sessions) => {
        setCachedSessions(sessions);
        const match = pickFeatured(sessions);
        // A genuinely empty catalog isn't a thrown error, but there's
        // nothing to feature either — treat it as the error branch (below)
        // rather than leaving featuredSession permanently null, which would
        // otherwise render as a stuck loading spinner forever.
        if (!match) {
          setFeaturedError('No sessions are available right now.');
          return;
        }
        setFeaturedSession(match);
      })
      .catch((err) =>
        setFeaturedError(
          err instanceof Error ? err.message : 'Failed to load featured session.'
        )
      );
  }, []);

  useEffect(() => {
    if (featuredSession) {
      // Cache hit: already showing the card. Refresh in the background; a
      // failed refresh is silent (keeps what's shown) — only the blocking
      // path in loadFeatured shows the error + Retry state.
      fetchSessions()
        .then((fresh) => {
          setCachedSessions(fresh);
          const match = pickFeatured(fresh);
          if (match) setFeaturedSession(match);
        })
        .catch(() => {});
      return;
    }
    loadFeatured();
    // Mount-only: `featuredSession` here is the initial (cache-derived) value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFeatured]);

  // "Current mood" isn't a field GET /api/insights returns — derived from
  // the most recent real checkin's postMood (checkins is newest-first).
  // No checkins yet -> no mood to show, not a fake default.
  const latestMood = insights?.checkins[0]?.postMood ?? null;

  return (
    <View style={styles.root}>
      {/* DESIGN.md: background is never flat black — a soft radial glow
          approximates the mockup's radial-gradient + blurred glow circle. */}
      <View style={styles.backgroundGlow} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={20} color={colors.onSurfaceVariant} />
            </View>
            <View style={styles.greetingColumn}>
              <Text style={styles.greetingLabel}>{greetingForHour(hour)}</Text>
              {/* Fixed-height slot so the bar doesn't shift between the
                  loading, "Tap to add your name" and name states. */}
              <View style={styles.greetingNameSlot}>
                {userName === undefined ? null : userName === null ? (
                  <Pressable
                    onPress={() => setNameModalVisible(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Add your name"
                  >
                    <Text style={styles.addNamePrompt}>Tap to add your name</Text>
                  </Pressable>
                ) : (
                  <GradientText
                    colors={[colors.primary, colors.tertiary]}
                    style={styles.greetingName}
                    numberOfLines={1}
                  >
                    {userName}
                  </GradientText>
                )}
              </View>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            style={styles.settingsButton}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <MaterialIcons name="settings" size={24} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarHeight + spacing.base * 2 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Featured Session */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Featured Session</Text>
              <View style={styles.newPill}>
                <Text style={styles.newPillText}>NEW</Text>
              </View>
            </View>

            {featuredError ? (
              <View style={styles.snapshotCenterState}>
                <MaterialIcons name="error-outline" size={28} color={colors.onSurfaceVariant} />
                <Text style={styles.snapshotCenterStateText}>
                  Couldn&apos;t load your featured session.
                </Text>
                <Text style={styles.snapshotCenterStateSubtext}>{featuredError}</Text>
                <Pressable onPress={loadFeatured} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : featuredSession === null ? (
              <View style={styles.snapshotCenterState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <GlassCard radius={radii.lg} style={styles.heroCard}>
                <View style={styles.heroContent}>
                  <BreathOrb size={160} />
                  <Text style={styles.heroTitle}>{featuredSession.title}</Text>
                  <Text style={styles.heroDescription} numberOfLines={3}>
                    {featuredSession.description}
                  </Text>
                  <View style={styles.heroFooter}>
                    <View style={styles.durationPill}>
                      <MaterialIcons name="schedule" size={16} color={colors.onSurface} />
                      <Text style={styles.durationPillText}>
                        {formatDuration(featuredSession.durationSec)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        // architecture.md: tapping Begin opens Session Player
                        // directly at the pre-mood phase for this session.
                        router.push(`/session-player?sessionId=${featuredSession.id}`);
                      }}
                    >
                      {/* CONTRAST FIX (2026-09-20, AUDIT-2.md Medium finding):
                          the 2026-09-19 primaryContainer -> inversePrimary
                          gradient with onPrimaryContainer text computed to only
                          ~2.2:1 contrast at the gradient's darker end — below
                          the 4.5:1 AA minimum. Swapped to inversePrimary ->
                          onPrimaryFixedVariant (both stops dark enough that
                          white text stays >=6.47:1 across the whole gradient —
                          see AUDIT-2.md for the full before/after math) with
                          white text, matching Library/Player's identical fix
                          and Session Player's own Begin Journey button. */}
                      <LinearGradient
                        colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.beginButton}
                      >
                        <Text style={styles.beginButtonText}>Begin</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
              </GlassCard>
            )}
          </View>

          {/* Your Snapshot */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Your Snapshot</Text>
            </View>

            {error ? (
              <View style={styles.snapshotCenterState}>
                <MaterialIcons name="error-outline" size={28} color={colors.onSurfaceVariant} />
                <Text style={styles.snapshotCenterStateText}>
                  Couldn&apos;t load your snapshot.
                </Text>
                <Text style={styles.snapshotCenterStateSubtext}>{error}</Text>
                <Pressable onPress={load} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : insights === null ? (
              <View style={styles.snapshotCenterState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.snapshotStack}>
                <GlassCard radius={radii.md} style={styles.snapshotCard}>
                  <View style={styles.snapshotCardRow}>
                    <MaterialIcons name="mood" size={22} color={colors.secondary} />
                    {latestMood !== null && (
                      <Text style={styles.snapshotEmoji}>
                        {MOOD_EMOJIS[latestMood - 1]}
                      </Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.snapshotValue}>
                      {latestMood !== null ? MOOD_LABELS[latestMood - 1] : '—'}
                    </Text>
                    <Text style={styles.snapshotLabel}>CURRENT MOOD</Text>
                  </View>
                </GlassCard>

                <GlassCard radius={radii.md} style={styles.snapshotCard}>
                  <View style={styles.snapshotCardRow}>
                    <MaterialIcons name="calendar-month" size={22} color={colors.tertiary} />
                  </View>
                  <View>
                    <Text style={styles.snapshotValue}>
                      {insights.sessionsThisWeek}{' '}
                      <Text style={styles.snapshotValueUnit}>sessions</Text>
                    </Text>
                    <Text style={styles.snapshotLabel}>THIS WEEK</Text>
                  </View>
                </GlassCard>

                <GlassCard
                  radius={radii.md}
                  style={[styles.snapshotCard, styles.streakCard]}
                >
                  <View style={styles.snapshotCardRow}>
                    <MaterialIcons name="local-fire-department" size={22} color="#fb923c" />
                  </View>
                  <View>
                    <Text style={styles.snapshotValue}>
                      {insights.streak.currentStreak}{' '}
                      <Text style={styles.snapshotValueUnit}>days</Text>
                    </Text>
                    <Text style={[styles.snapshotLabel, styles.streakLabel]}>
                      CURRENT STREAK
                    </Text>
                  </View>
                </GlassCard>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <UserNameModal
        visible={nameModalVisible}
        initialName={userName ?? null}
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
  backgroundGlow: {
    pointerEvents: 'none',
    position: 'absolute',
    top: -200,
    left: '50%',
    marginLeft: -300,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: colors.primary,
    opacity: 0.06,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    // Trimmed slightly (was 64) so first-load content (before any
    // scrolling) clears the floating tab bar better — see PROGRESS.md's
    // "first impression" spacing pass.
    height: 56,
  },
  // Same padding-only Pressable-wrapper pattern already used by
  // session-player.tsx's settings icon — increases the tap target
  // without shifting the icon's centered position in the top bar.
  settingsButton: {
    padding: spacing.base,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    // Lets a long name shrink (and truncate) instead of pushing the settings
    // icon off-screen. No effect on short names — it only shrinks, never grows.
    flexShrink: 1,
  },
  greetingColumn: {
    flexShrink: 1,
  },
  greetingNameSlot: {
    minHeight: typography.headlineLgMobile.lineHeight,
    justifyContent: 'center',
  },
  // TEMPORARY prompt shown until a name is saved — a quieter line than the
  // gradient name, in the accent color so it reads as tappable.
  addNamePrompt: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  greetingLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  greetingName: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
  },
  scrollContent: {
    paddingHorizontal: spacing.marginMobile,
    // paddingTop/gap trimmed from spacing.sectionGap (40) — see
    // PROGRESS.md's "first impression" spacing pass.
    paddingTop: spacing.base * 2.5,
    // paddingBottom is set dynamically at render time from
    // useBottomTabBarHeight() — see the ScrollView usage above.
    gap: spacing.base * 2.5,
  },
  section: {
    gap: spacing.base * 1.25,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
    color: colors.onSurface,
  },
  newPill: {
    backgroundColor: `${colors.primary}1A`,
    paddingHorizontal: spacing.base * 1.5,
    paddingVertical: spacing.base * 0.5,
    borderRadius: radii.full,
  },
  newPillText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  heroCard: {
    padding: spacing.base * 2,
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.base * 1.25,
  },
  heroTitle: {
    fontFamily: typography.displayLg.fontFamily,
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  heroDescription: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 1.5,
    marginTop: spacing.base * 0.5,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.75,
    backgroundColor: `${colors.surfaceVariant}80`,
    paddingHorizontal: spacing.base * 2,
    paddingVertical: spacing.base,
    borderRadius: radii.full,
  },
  durationPillText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurface,
  },
  beginButton: {
    paddingHorizontal: spacing.base * 3,
    paddingVertical: spacing.base,
    borderRadius: radii.full,
  },
  beginButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    // CONTRAST FIX (2026-09-20, AUDIT-2.md) — see the Begin button's
    // LinearGradient comment above for the full before/after math.
    color: '#ffffff',
  },
  snapshotStack: {
    gap: spacing.base * 1.5,
  },
  snapshotCard: {
    padding: spacing.base * 2.5,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  snapshotCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  snapshotEmoji: {
    fontSize: 22,
  },
  snapshotValue: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    color: '#ffffff',
  },
  snapshotValueUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
  },
  snapshotLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  streakCard: {
    borderColor: 'rgba(251,146,60,0.2)',
  },
  streakLabel: {
    color: 'rgba(254,215,170,0.7)',
  },
  snapshotCenterState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingVertical: spacing.sectionGap,
  },
  snapshotCenterStateText: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
  },
  snapshotCenterStateSubtext: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.base,
    paddingHorizontal: spacing.base * 3,
    paddingVertical: spacing.base * 1.25,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onPrimary,
  },
});
