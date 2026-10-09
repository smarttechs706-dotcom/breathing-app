import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useIsFocused } from 'expo-router';
// See app/(tabs)/home.tsx for why this is a deep import — CONFIRMED
// correct on-device via instrumented debugging (see PROGRESS.md).
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

import { fetchInsights, fetchSessions } from '../../src/api/client';
import { BreathOrb } from '../../src/components/BreathOrb';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientText } from '../../src/components/GradientText';
import { useActiveSession } from '../../src/state/ActiveSessionContext';
import { getCachedSessions, setCachedSessions } from '../../src/state/sessionsCache';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import type { Session } from '../../src/types/models';
import { getDeviceId } from '../../src/utils/deviceId';

// architecture.md's "Bottom navigation — Player tab behavior": tapping
// Player never silently redirects — it always shows this tab's own
// content. With no session in progress, that's this dedicated empty
// state; with one in progress (tracked via ActiveSessionContext, set by
// app/session-player.tsx while it's mounted), it shows the actual Session
// Player UI by navigating to that real screen.
//
// Note: session-player.tsx is a top-level route (sibling to this (tabs)
// group, matching the Stitch mockup's no-bottom-nav "focused transactional
// view"), so the tab bar isn't visible while it's on screen — the only
// ways back to the tabs are exiting (which explicitly discards progress)
// or completing. In today's navigation flow this means the "active"
// branch below is wired correctly but rarely reachable in practice, not a
// commonly-hit path — flagging this rather than silently building
// something that looks functional but rarely triggers.
//
// Redesigned (2026-09-25) per assets/design-reference/player-empty-code
// .html / player-empty-screenshot.png, the first real Stitch export this
// empty state has had (the previous version predated it and matched the
// app's general visual language only). Same top bar as before; new
// "BREATH PLAYER" status pill, hero card with glow blobs, "Explore
// Library" CTA, Quick Suggestions, and a stats section — this file only,
// per instruction (ActiveSessionContext/Home/Library/Session
// Player/Insights/backend untouched).
//
// Two real-data decisions, flagged rather than silently resolved:
// 1. The mockup's stats row is a 2-up grid: "Daily Goal" (a minutes-
//    progress number) and "Calm Streak". architecture.md's GET
//    /api/insights has no daily-goal concept at all — no real data exists
//    to back it, and PRD.md doesn't define one either. Rather than invent
//    a number, that card is omitted; only the real streak (same
//    `streak.currentStreak` field Home/Insights already use) is shown, as
//    a single card instead of a half-empty 2-up grid.
// 2. Quick Suggestions: the mockup hardcodes "Box Breathing · 4m" and
//    "Deep Exhale · 10m" with one-off icons (spa/nights_stay). Both
//    sessions are real catalog entries, so their titles/durations come
//    from the live GET /api/sessions catalog instead of the mockup's
//    numbers (Box Breathing is actually 12m, not 4m — same "real catalog
//    over mockup numbers" precedent as Library's category counts), and
//    their icons reuse the LOCKED badge→icon mapping (Leaf→eco,
//    Heart→favorite) from app/(tabs)/library.tsx's BADGE_ICON rather than
//    inventing new ones — per CLAUDE.md's "never re-derive the Library
//    session mapping" rule, this reuses those exact locked values, not
//    fresh ones.
//
// FRONTEND-AUDIT-2.md High finding (fixed 2026-09-26): this used to read
// src/data/sessions.ts, a local static catalog never cross-checked against
// the live backend — now fetched via the same GET /api/sessions Library's
// grid already uses, with its own loading/error handling below (not a
// silent omission on failure, unlike the Calm Streak stat's still-open Low
// finding from the same audit — out of scope for this fix).
const BADGE_ICON: Record<Session['badge'], keyof typeof MaterialIcons.glyphMap> = {
  Leaf: 'eco',
  Moon: 'bedtime',
  Zap: 'bolt',
  Heart: 'favorite',
};

// Same two sessions the mockup names, by their real catalog ids.
const QUICK_SUGGESTION_IDS = ['box-breathing', 'deep-exhale'] as const;

function matchSuggestions(sessions: Session[]): Session[] {
  return QUICK_SUGGESTION_IDS.map((id) => sessions.find((s) => s.id === id)).filter(
    (s): s is Session => s !== undefined
  );
}

function formatDuration(durationSec: number) {
  return `${Math.round(durationSec / 60)}m`;
}

export default function PlayerScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { activeSessionId } = useActiveSession();
  // Guards the redirect below against firing while this tab is mounted but
  // not the one on screen (e.g. session-player.tsx, pushed on top, sets
  // activeSessionId once its own fetch resolves) — without this, that
  // context update reaches this backgrounded effect too, which calls
  // router.replace on the very session-player screen currently displayed,
  // remounting it, whose cleanup clears activeSessionId back to null,
  // which this effect also reacts to — an infinite replace/remount loop.
  // Confirmed via reproduction: dozens of duplicate /api/sessions and
  // /api/insights requests firing in a loop, screen stuck on its loading
  // spinner indefinitely.
  const isFocused = useIsFocused();

  // null = loading, undefined = failed (shown as a quiet omission, not a
  // blocking error — this is a supplementary stat, not the screen's
  // primary content, matching Home's per-section-not-whole-screen gating
  // philosophy for secondary widgets).
  const [currentStreak, setCurrentStreak] = useState<number | null | undefined>(null);

  useEffect(() => {
    if (isFocused && activeSessionId) {
      router.replace(`/session-player?sessionId=${activeSessionId}`);
    }
  }, [activeSessionId, isFocused]);

  // P5 (2026-09-30): split out of the redirect effect above so it no longer
  // depends on `isFocused` — previously every focus/blur of this tab (e.g.
  // tapping Player, then tapping away) refetched /api/insights. Now runs on
  // mount and again only when `activeSessionId` changes (e.g. a session
  // ends and it returns to null), not on plain tab switches.
  useEffect(() => {
    if (activeSessionId) return;
    let cancelled = false;
    getDeviceId()
      .then(fetchInsights)
      .then((insights) => {
        if (!cancelled) setCurrentStreak(insights.streak.currentStreak);
      })
      .catch(() => {
        if (!cancelled) setCurrentStreak(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  // null = loading, undefined = fetch failed (shows an explicit error +
  // Retry below, unlike the streak stat above — this is one of the 4
  // screens FRONTEND-AUDIT-2.md's High finding named explicitly, so it
  // gets the same real error/retry pattern Library/Home use, not the
  // silent-omission pattern that finding also flagged separately).
  //
  // P4: starts from the shared sessions cache when it yields at least one
  // suggestion (same pattern as session-player.tsx / library.tsx / home.tsx),
  // so the pills render with no spinner; every successful fetch also writes
  // the cache. Once loaded, later runs (e.g. a session ends and
  // activeSessionId returns to null) refresh in the background instead of
  // resetting to the spinner.
  const [quickSuggestions, setQuickSuggestions] = useState<Session[] | null | undefined>(
    () => {
      const cached = getCachedSessions();
      const matched = cached ? matchSuggestions(cached) : [];
      return matched.length > 0 ? matched : null;
    }
  );

  const loadQuickSuggestions = useCallback(() => {
    if (activeSessionId) return;
    setQuickSuggestions(null);
    fetchSessions()
      .then((sessions) => {
        setCachedSessions(sessions);
        setQuickSuggestions(matchSuggestions(sessions));
      })
      .catch(() => setQuickSuggestions(undefined));
  }, [activeSessionId]);

  useEffect(() => {
    if (activeSessionId) return;
    if (Array.isArray(quickSuggestions)) {
      // Already showing suggestions: refresh in the background; a failed
      // refresh is silent — only the blocking path (loadQuickSuggestions,
      // also used by Retry) shows the error state.
      fetchSessions()
        .then((fresh) => {
          setCachedSessions(fresh);
          setQuickSuggestions(matchSuggestions(fresh));
        })
        .catch(() => {});
      return;
    }
    loadQuickSuggestions();
    // Deliberately not depending on `quickSuggestions`: this must re-run on
    // activeSessionId changes only, not on its own state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadQuickSuggestions]);

  return (
    <View style={styles.root}>
      <View style={styles.backgroundGlow} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={18} color={colors.onSurfaceVariant} />
          </View>
          <GradientText
            colors={[colors.primary, colors.tertiary]}
            style={styles.headline}
          >
            Breathe
          </GradientText>
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
          {activeSessionId ? (
            // Brief placeholder while the redirect above takes effect.
            <View style={styles.redirectPlaceholder} />
          ) : (
            <>
              <View style={styles.statusPill}>
                <View style={styles.statusPillDot} />
                <Text style={styles.statusPillText}>Breath Player</Text>
              </View>

              <GlassCard radius={radii.lg} style={styles.heroCard}>
                <View style={[styles.glowBlob, styles.glowBlobPrimary]} />
                <View style={[styles.glowBlob, styles.glowBlobSecondary]} />

                <View style={styles.orbWrapper}>
                  <BreathOrb size={140} />
                </View>

                <Text style={styles.title}>No Session in Progress</Text>
                <Text style={styles.subtitle}>
                  Select a guided breathing practice from your Library to
                  begin your mindful pause.
                </Text>

                <Pressable onPress={() => router.push('/library')}>
                  {/* Same contrast-fixed gradient as Home/Library/Session
                      Player's primary CTAs (AUDIT-2.md) — white text stays
                      >=6.47:1 across the whole gradient. */}
                  <LinearGradient
                    colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.exploreButton}
                  >
                    <Text style={styles.exploreButtonText}>Explore Library</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
                  </LinearGradient>
                </Pressable>

                <View style={styles.suggestionsSection}>
                  <Text style={styles.suggestionsLabel}>Quick Suggestions</Text>
                  {quickSuggestions === undefined ? (
                    <View style={styles.suggestionsErrorRow}>
                      <Text style={styles.suggestionsErrorText}>
                        Couldn&apos;t load suggestions.
                      </Text>
                      <Pressable onPress={loadQuickSuggestions}>
                        <Text style={styles.suggestionsRetryText}>Retry</Text>
                      </Pressable>
                    </View>
                  ) : quickSuggestions === null ? (
                    <ActivityIndicator size="small" color={colors.onSurfaceVariant} />
                  ) : (
                    <View style={styles.suggestionsRow}>
                      {quickSuggestions.map((session) => (
                        <Pressable
                          key={session.id}
                          onPress={() =>
                            router.push(`/session-player?sessionId=${session.id}`)
                          }
                          style={styles.suggestionPill}
                        >
                          <MaterialIcons
                            name={BADGE_ICON[session.badge]}
                            size={15}
                            color={colors.primary}
                          />
                          <Text style={styles.suggestionText}>{session.title}</Text>
                          <Text style={styles.suggestionMeta}>
                            · {formatDuration(session.durationSec)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </GlassCard>

              {currentStreak !== undefined && (
                <GlassCard radius={radii.md} style={styles.statCard}>
                  <View style={styles.statIconBadge}>
                    <MaterialIcons name="whatshot" size={20} color="#fb923c" />
                  </View>
                  <View style={styles.statTextGroup}>
                    <Text style={styles.statLabel}>Calm Streak</Text>
                    {currentStreak === null ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.onSurfaceVariant}
                        style={styles.statLoading}
                      />
                    ) : (
                      <Text style={styles.statValue}>
                        {currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}
                      </Text>
                    )}
                  </View>
                </GlassCard>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Matches Home's background glow treatment exactly (same values) — the
  // app's background is never flat black per DESIGN.md.
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
    height: 56,
  },
  // Same padding-only Pressable-wrapper pattern already used by
  // session-player.tsx's settings icon.
  settingsButton: {
    padding: spacing.base,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  headline: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
  },
  scrollContent: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base * 0.5,
    gap: spacing.base * 2,
  },
  redirectPlaceholder: {
    height: 1,
  },
  statusPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.75,
    backgroundColor: `${colors.surfaceContainerHigh}99`,
    paddingHorizontal: spacing.base * 1.75,
    paddingVertical: spacing.base * 0.75,
    borderRadius: radii.full,
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.tertiary,
  },
  statusPillText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.tertiary,
    textTransform: 'uppercase',
  },
  heroCard: {
    marginTop: spacing.base * 1.5,
    padding: spacing.base * 3.5,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glowBlob: {
    pointerEvents: 'none',
    position: 'absolute',
    borderRadius: 999,
  },
  glowBlobPrimary: {
    top: -80,
    right: -80,
    width: 180,
    height: 180,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  glowBlobSecondary: {
    bottom: -70,
    left: -70,
    width: 160,
    height: 160,
    backgroundColor: colors.secondary,
    opacity: 0.08,
  },
  orbWrapper: {
    marginBottom: spacing.base * 2,
  },
  title: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  subtitle: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.base * 3,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.base * 4,
    paddingVertical: spacing.base * 1.75,
    borderRadius: radii.full,
  },
  exploreButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    // Same contrast fix as the gradient above — see comment there.
    color: '#ffffff',
  },
  suggestionsSection: {
    width: '100%',
    marginTop: spacing.base * 3,
    paddingTop: spacing.base * 3,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    alignItems: 'center',
    gap: spacing.base * 1.25,
  },
  suggestionsLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.outline,
    textTransform: 'uppercase',
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.base,
  },
  suggestionsErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  suggestionsErrorText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.onSurfaceVariant,
  },
  suggestionsRetryText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.primary,
  },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.5,
    backgroundColor: `${colors.surfaceContainerHigh}B3`,
    paddingHorizontal: spacing.base * 1.5,
    paddingVertical: spacing.base * 0.75,
    borderRadius: radii.full,
  },
  suggestionText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurface,
  },
  suggestionMeta: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurfaceVariant,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 1.5,
    padding: spacing.base * 2,
  },
  statIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251,146,60,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTextGroup: {
    gap: 2,
  },
  statLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurfaceVariant,
  },
  statValue: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
  },
  statLoading: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
});
