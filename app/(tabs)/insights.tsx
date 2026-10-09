import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

import { fetchInsights, type InsightsResponse } from '../../src/api/client';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientText } from '../../src/components/GradientText';
import { MoodTrendChart } from '../../src/components/MoodTrendChart';
import { useRefreshOnNewCheckin } from '../../src/state/checkinSignal';
import type { MoodPoint } from '../../src/data/insights';
import type { Checkin } from '../../src/types/models';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { getDeviceId } from '../../src/utils/deviceId';

const CONSISTENCY_DAYS = 28;

// Each real checkin's postMood becomes one real point, chronological
// (oldest first — checkins arrives newest-first from the API). No
// averaging/bucketing per day: multiple same-day checkins just become
// multiple real points, exactly as they happened.
function buildMoodTrend(checkins: Checkin[]): MoodPoint[] {
  return [...checkins]
    .reverse()
    .map((c) => ({ date: c.createdAt.slice(0, 10), mood: c.postMood }));
}

// One boolean per day for the last CONSISTENCY_DAYS days (oldest first,
// today last) — true iff at least one real checkin exists that calendar
// date. Grouped from the same real checkins array, no invented days.
function buildConsistencyCalendar(checkins: Checkin[]): boolean[] {
  const checkinDates = new Set(checkins.map((c) => c.createdAt.slice(0, 10)));
  const days: boolean[] = [];
  const today = new Date();
  for (let i = CONSISTENCY_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push(checkinDates.has(iso));
  }
  return days;
}

// architecture.md's /api/insights: mindfulMinutes is a raw minute count —
// the hour/minute formatting happens here at render time rather than
// being baked into the dummy data.
function formatMindfulMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

interface StatCardConfig {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
}

const CALENDAR_COLUMNS = 7;
const STAT_COLUMNS = 2;

// `flexWrap: 'wrap'` + percentage/aspectRatio-sized children has been an
// unreliable combination on Android throughout this screen (the
// consistency grid's cells collapsed to 0 height; the stat grid's wrapped
// second row rendered its icon/value/label overlapping instead of
// stacked — both confirmed on-device, both fine on web). Chunking into
// plain (non-wrapping) rows of `flex: 1` cells sidesteps `flexWrap`
// entirely rather than patching each symptom individually.
function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

// Shared across the loading/error/success render branches below.
function TopBar() {
  return (
    <View style={styles.topBar}>
      <View style={styles.avatar}>
        <MaterialIcons name="person" size={18} color={colors.onSurfaceVariant} />
      </View>
      <GradientText colors={[colors.primary, colors.tertiary]} style={styles.headline}>
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
  );
}

export default function InsightsScreen() {
  const tabBarHeight = useBottomTabBarHeight();
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
        setError(err instanceof Error ? err.message : 'Failed to load insights.')
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // D-02: this tab now survives a completed session (see checkinSignal.ts);
  // refresh silently so the numbers/chart include it.
  const refreshAfterCheckin = useCallback(() => {
    getDeviceId()
      .then(fetchInsights)
      .then(setInsights)
      .catch(() => {});
  }, []);
  useRefreshOnNewCheckin(refreshAfterCheckin);

  if (error) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <TopBar />
          <View style={styles.centerState}>
            <MaterialIcons name="error-outline" size={32} color={colors.onSurfaceVariant} />
            <Text style={styles.centerStateText}>Couldn&apos;t load insights.</Text>
            <Text style={styles.centerStateSubtext}>{error}</Text>
            <Pressable onPress={load} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (insights === null) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <TopBar />
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const moodTrend = buildMoodTrend(insights.checkins);
  const consistencyCalendar = buildConsistencyCalendar(insights.checkins);
  const deltaSign = insights.monthOverMonthDelta >= 0 ? '+' : '';

  const statCards: StatCardConfig[] = [
    {
      // 'local-fire-department' is a newer Material Symbols addition —
      // same family as grid_view/air/insights, which rendered as the
      // wrong glyph on Android's Expo Go bundled font (see PROGRESS.md).
      // 'whatshot' is the classic fire icon, confirmed present in that
      // font's original glyph set.
      key: 'streak',
      icon: 'whatshot',
      // Matches Home's streak card treatment exactly (app/(tabs)/home.tsx)
      // rather than the generic colors.primary every other stat card uses —
      // same distinct orange for the fire/streak indicator on both screens.
      iconColor: '#fb923c',
      value: `${insights.streak.currentStreak}`,
      label: 'Current Streak',
    },
    {
      key: 'sessions',
      icon: 'check-circle',
      iconColor: colors.secondary,
      value: `${insights.totalSessions}`,
      label: 'Total Sessions',
    },
    {
      // 'schedule' confirmed WRONG glyph on-device (see PROGRESS.md) —
      // codepoint proximity to other working icons (e.g. 'home'/'settings')
      // turned out not to predict this reliably. 'access-time' sits in the
      // 0xe1xx-0xe6xx band that has a clean track record all session
      // ('apps', 'waves', 'show-chart', 'check' all live there and work).
      key: 'minutes',
      icon: 'access-time',
      iconColor: colors.tertiary,
      value: formatMindfulMinutes(insights.mindfulMinutes),
      label: 'Mindful Minutes',
    },
    {
      // 'trending-up' confirmed WRONG glyph on-device — 'arrow-upward'
      // fixed the font-mismatch but is a plain arrow, not the zigzag
      // trend-line look the design calls for. Rendered every candidate
      // from the exact bundled MaterialIcons.ttf as an image (via a local
      // @font-face test page) to compare shapes directly rather than
      // guess by name: 'moving' (0xe501) is a pixel-for-pixel match for
      // trending-up's zigzag-line-with-arrowhead shape, and its codepoint
      // sits in the proven-safe 0xe1xx-0xe6xx band.
      key: 'trend',
      icon: 'moving',
      iconColor: colors.primary,
      // Real monthOverMonthDelta can be negative (sessions declined) —
      // the old dummy-data version hardcoded a leading "+", which would
      // misrender a real negative value as e.g. "+-12%".
      value: `${deltaSign}${insights.monthOverMonthDelta}%`,
      label: 'Vs Last Month',
    },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TopBar />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarHeight + spacing.base * 2 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Your Breathing Health</Text>
            <Text style={styles.subtitle}>Tracking your journey to digital zen.</Text>
          </View>

          {/* Mood Trend */}
          <View style={styles.cardClip}>
            <GlassCard radius={radii.xl} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Mood Trend</Text>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Last 30 Days</Text>
                </View>
              </View>
              <View style={styles.chartWrapper}>
                <MoodTrendChart data={moodTrend} height={120} />
              </View>
            </GlassCard>
          </View>

          {/* Consistency */}
          <View style={styles.cardClip}>
            <GlassCard radius={radii.xl} style={styles.card}>
              <Text style={styles.cardTitle}>Consistency</Text>
              <View style={styles.calendarGrid}>
                {chunk(consistencyCalendar, CALENDAR_COLUMNS).map((week, rowIndex) => (
                  <View key={rowIndex} style={styles.calendarRow}>
                    {week.map((filled, cellIndex) => (
                      <View
                        key={cellIndex}
                        style={[styles.calendarCell, filled && styles.calendarCellFilled]}
                      />
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.calendarFooter}>
                <Text style={styles.calendarFooterStrong}>
                  {insights.streak.currentStreak}{' '}
                  {insights.streak.currentStreak === 1 ? 'Day' : 'Days'} Streak
                </Text>
                <Text style={styles.calendarFooterMuted}>Keep going</Text>
              </View>
            </GlassCard>
          </View>

          {/* Stat cards */}
          <View style={styles.statGrid}>
            {chunk(statCards, STAT_COLUMNS).map((row, rowIndex) => (
              <View key={rowIndex} style={styles.statRow}>
                {row.map((stat) => (
                  <View key={stat.key} style={[styles.cardClip, styles.statCardClip]}>
                    <GlassCard
                      radius={radii.xl}
                      style={[
                        styles.statCard,
                        stat.key === 'streak' && styles.streakStatCard,
                      ]}
                    >
                      <MaterialIcons name={stat.icon} size={22} color={stat.iconColor} />
                      <Text style={styles.statValue}>{stat.value}</Text>
                      <Text
                        style={[
                          styles.statLabel,
                          stat.key === 'streak' && styles.streakStatLabel,
                        ]}
                      >
                        {stat.label}
                      </Text>
                    </GlassCard>
                  </View>
                ))}
              </View>
            ))}
          </View>
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
    gap: spacing.base * 1.5,
  },
  header: {
    gap: 4,
  },
  title: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
    color: colors.onSurface,
  },
  subtitle: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
  },
  // expo-blur's native BlurView on Android doesn't reliably clip to a
  // rounded rect via the parent's own overflow:hidden — confirmed
  // on-device as 2-of-4 corners staying sharp, only surfacing once the
  // radius grew from 16px to 48px. Wrapping each GlassCard in its own
  // overflow:hidden + matching borderRadius View forces a second clip
  // boundary outside the BlurView, which works around it.
  cardClip: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  statCardClip: {
    flex: 1,
  },
  card: {
    padding: spacing.base * 2,
    gap: spacing.base * 1.5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
  },
  pill: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.full,
    paddingHorizontal: spacing.base * 1.5,
    paddingVertical: spacing.base * 0.5,
  },
  pillText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurfaceVariant,
  },
  chartWrapper: {
    width: '100%',
  },
  calendarGrid: {
    gap: spacing.base * 0.75,
  },
  calendarRow: {
    flexDirection: 'row',
    gap: spacing.base * 0.75,
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: `${colors.primaryContainer}33`,
  },
  calendarCellFilled: {
    backgroundColor: colors.primaryContainer,
  },
  calendarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarFooterStrong: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
  },
  calendarFooterMuted: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.primary,
  },
  statGrid: {
    gap: spacing.base,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.base * 1.5,
  },
  statCard: {
    padding: spacing.base * 1.75,
    gap: spacing.base * 0.75,
  },
  // Matches Home's streakCard/streakLabel treatment exactly (app/(tabs)/
  // home.tsx) — same #fb923c-derived tints, scoped to just this one stat
  // card. Total Sessions/Mindful Minutes/Vs Last Month are untouched.
  streakStatCard: {
    borderColor: 'rgba(251,146,60,0.2)',
  },
  streakStatLabel: {
    color: 'rgba(254,215,170,0.7)',
  },
  statValue: {
    fontFamily: typography.displayLg.fontFamily,
    fontSize: 32,
    fontWeight: '700',
    color: colors.onSurface,
  },
  statLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurfaceVariant,
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
