import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
// See app/(tabs)/home.tsx for why this is a deep import — CONFIRMED
// correct on-device via instrumented debugging (see PROGRESS.md).
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchSessions } from '../../src/api/client';
import { getCachedSessions, setCachedSessions } from '../../src/state/sessionsCache';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientText } from '../../src/components/GradientText';
import { SessionThumbnail } from '../../src/components/SessionThumbnail';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import type { Session } from '../../src/types/models';

// FRONTEND-AUDIT-2.md High finding: Quick Start's target used to be a local
// static session id, never cross-checked against the live catalog this
// screen already fetches. architecture.md's locked table designates
// 'deep-exhale' as the Featured/Quick Start session — looked up from the
// already-fetched `sessions` state below instead of a separate local import.
const FEATURED_SESSION_ID = 'deep-exhale';

// PRD.md names the tabs "For You/Calm/Recovery/Sleep" in its Core Screens
// list, but its own category-count example ("Calm 2, Sleep 2, Energy 1,
// Recovery 1") only makes sense with an Energy tab too — Stress Relief's
// real category is Energy. Using the full 4-category enum from
// src/types/models.ts (+ For You) resolves that inconsistency; flagged in
// PROGRESS.md rather than silently picking one.
type CategoryFilter = 'For You' | Session['category'];
const CATEGORIES: CategoryFilter[] = ['For You', 'Calm', 'Sleep', 'Energy', 'Recovery'];

const BADGE_ICON: Record<Session['badge'], keyof typeof MaterialIcons.glyphMap> = {
  Leaf: 'eco',
  Moon: 'bedtime',
  Zap: 'bolt',
  Heart: 'favorite',
};

function formatDuration(durationSec: number) {
  return `${Math.round(durationSec / 60)} min`;
}

export default function LibraryScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('For You');
  const [query, setQuery] = useState('');
  // null = still loading (first fetch, or a retry in flight).
  // Starts from the shared cache when it holds a non-empty list (P4, same
  // pattern as session-player.tsx) so the grid renders with no spinner; an
  // empty cached list is not treated as a hit.
  const [sessions, setSessions] = useState<Session[] | null>(() => {
    const cached = getCachedSessions();
    return cached && cached.length > 0 ? cached : null;
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setSessions(null);
    fetchSessions()
      .then((fresh) => {
        setCachedSessions(fresh);
        setSessions(fresh);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load sessions.')
      );
  }, []);

  useEffect(() => {
    if (sessions) {
      // Cache hit: already showing data. Refresh in the background and swap
      // in the result; a failed refresh is silent (keeps the cached grid) —
      // only the blocking path below shows the error + Retry state.
      fetchSessions()
        .then((fresh) => {
          setCachedSessions(fresh);
          setSessions(fresh);
        })
        .catch(() => {});
      return;
    }
    load();
    // Mount-only: `sessions` here is the initial (cache-derived) value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Real counts from the live fetched catalog — NOT library-code.html's
  // placeholder mockup numbers ("For You 292", "Calm 45", "Recovery 38",
  // "Sleep 24"), which PRD.md explicitly calls out as illustrative filler
  // only. 0 while loading/errored, same as an empty catalog would show.
  function countFor(category: CategoryFilter): number {
    if (!sessions) return 0;
    if (category === 'For You') return sessions.length;
    return sessions.filter((s) => s.category === category).length;
  }

  const visibleSessions = useMemo(() => {
    if (!sessions) return [];
    const byCategory =
      selectedCategory === 'For You'
        ? sessions
        : sessions.filter((s) => s.category === selectedCategory);
    const q = query.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, selectedCategory, query]);

  const handleQuickStart = () => {
    // PRD.md: Quick Start immediately begins the current "For You"
    // recommended session. Looked up from the live `sessions` state (this
    // screen's own already-fetched catalog) rather than a local import —
    // no-ops safely if the catalog is empty or somehow lacks the featured
    // id and has nothing else to fall back to (guarded, not a crash).
    const target = sessions?.find((s) => s.id === FEATURED_SESSION_ID) ?? sessions?.[0];
    if (!target) return;
    router.push(`/session-player?sessionId=${target.id}`);
  };

  return (
    <View style={styles.root}>
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

        {error ? (
          <View style={styles.centerState}>
            <MaterialIcons name="error-outline" size={32} color={colors.onSurfaceVariant} />
            <Text style={styles.centerStateText}>Couldn&apos;t load sessions.</Text>
            <Text style={styles.centerStateSubtext}>{error}</Text>
            <Pressable onPress={load} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : sessions === null ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarHeight + spacing.base * 2 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search — DESIGN.md's "Inputs" spec calls for a darker glass
              variant (rgba(0,0,0,0.2)); the Stitch screenshot renders this
              search bar solid white, which reads as a Tailwind-forms-plugin
              rendering artifact rather than an intentional style (it
              contradicts both DESIGN.md's written spec and the HTML's own
              .glass-input CSS class) — built to the written spec instead. */}
          <View style={styles.searchWrapper}>
            <MaterialIcons
              name="search"
              size={20}
              color={colors.onSurfaceVariant}
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search sessions..."
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.searchInput}
            />
          </View>

          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {CATEGORIES.map((category) => {
              const active = category === selectedCategory;
              return (
                <Pressable
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[styles.categoryTab, active && styles.categoryTabActive]}
                >
                  <Text
                    style={[
                      styles.categoryLabel,
                      active && styles.categoryLabelActive,
                    ]}
                  >
                    {category}
                  </Text>
                  <View
                    style={[
                      styles.categoryCount,
                      active && styles.categoryCountActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryCountText,
                        active && styles.categoryCountTextActive,
                      ]}
                    >
                      {countFor(category)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Quick Start */}
          {/* CONTRAST FIX (2026-09-20, AUDIT-2.md Medium finding): the
              original primaryContainer -> inversePrimary gradient with
              onPrimaryContainer text computed to only ~2.2:1 contrast at the
              gradient's darker (inversePrimary) end — below the 4.5:1 AA
              minimum. Swapped to inversePrimary -> onPrimaryFixedVariant (a
              narrower, uniformly dark-navy range, both stops <=~0.12
              luminance) with white text/icon, which computes to >=6.47:1
              across the entire gradient — see AUDIT-2.md for the full
              before/after math. Matches Session Player's Begin Journey
              button's own white-text approach. */}
          <Pressable onPress={handleQuickStart}>
            <LinearGradient
              colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickStart}
            >
              <MaterialIcons name="play-arrow" size={20} color="#ffffff" />
              <Text style={styles.quickStartText}>Quick Start</Text>
            </LinearGradient>
          </Pressable>

          {/* Session grid */}
          <View style={styles.grid}>
            {visibleSessions.map((session) => (
              <Pressable
                key={session.id}
                onPress={() =>
                  router.push(`/session-player?sessionId=${session.id}`)
                }
              >
                <GlassCard radius={radii.DEFAULT} style={styles.sessionCard}>
                  <View style={styles.sessionCardRow}>
                    <SessionThumbnail sessionId={session.id} size={80} />
                    <View style={styles.sessionInfo}>
                      {/* numberOfLines pins the row height across all 6 cards
                          regardless of title length — "Calm and Focus" is 4
                          chars longer than "Calm Focus" and would otherwise
                          wrap to 2 lines, disrupting card layout consistency
                          (see PROGRESS.md's 2026-09-19 title-change entry). */}
                      <Text
                        style={styles.sessionTitle}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {session.title}
                      </Text>
                      <View style={styles.sessionMetaRow}>
                        <MaterialIcons
                          name={BADGE_ICON[session.badge]}
                          size={16}
                          color={colors.onSurfaceVariant}
                        />
                        <Text style={styles.sessionMetaText}>
                          {formatDuration(session.durationSec)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
            {visibleSessions.length === 0 && (
              <Text style={styles.emptyText}>No sessions match your search.</Text>
            )}
          </View>
        </ScrollView>
        )}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    height: 64,
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
    paddingTop: spacing.base,
    // paddingBottom is set dynamically at render time from
    // useBottomTabBarHeight() — see the ScrollView usage above.
    gap: spacing.base * 2,
  },
  searchWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: spacing.base * 2,
    zIndex: 1,
  },
  searchInput: {
    height: 56,
    paddingLeft: spacing.base * 6,
    paddingRight: spacing.base * 2,
    borderRadius: radii.DEFAULT,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: colors.onSurface,
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.base * 1.5,
    paddingRight: spacing.base,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.base * 2.5,
    paddingVertical: spacing.base * 1.25,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // CONTRAST FIX (2026-09-20, AUDIT-2.md Medium finding): the 2026-09-19
  // COLOR-AUDIT.md pass switched this active-state indicator to flat
  // colors.inversePrimary (#3c55bf) — computed WCAG contrast against this
  // screen's dark background is only ~2.86-2.9:1 (worse still against the
  // count badge's own translucent fill), below the 4.5:1 AA minimum for
  // this label/count text. Reverted to colors.primary (#b9c3ff), ~10.85:1
  // against the same background — matches the tab bar's own contrast fix.
  categoryTabActive: {
    borderColor: `${colors.primary}80`,
  },
  categoryLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurfaceVariant,
  },
  categoryLabelActive: {
    color: colors.primary,
  },
  categoryCount: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.base * 0.75,
    borderRadius: 6,
  },
  categoryCountActive: {
    backgroundColor: `${colors.primary}33`,
  },
  categoryCountText: {
    fontSize: 11,
    fontFamily: typography.labelSm.fontFamily,
    color: colors.onSurfaceVariant,
  },
  categoryCountTextActive: {
    color: colors.primary,
  },
  quickStart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingVertical: spacing.base * 1.5,
    borderRadius: radii.DEFAULT,
  },
  quickStartText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    // CONTRAST FIX (2026-09-20, AUDIT-2.md) — see the Quick Start
    // LinearGradient comment above for the full before/after math.
    color: '#ffffff',
  },
  grid: {
    gap: spacing.base * 1.5,
  },
  sessionCard: {
    padding: spacing.base * 1.5,
  },
  sessionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 2,
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionTitle: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.75,
  },
  sessionMetaText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.onSurfaceVariant,
  },
  emptyText: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: spacing.base * 4,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.marginMobile,
  },
  centerStateText: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
  },
  centerStateSubtext: {
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
