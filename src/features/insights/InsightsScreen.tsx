import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { InsightsResponse } from '../../api/client';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { FadeIn, STAGGER_MS } from '../home/motion';
import { PreviewAvatar } from '../home/PreviewAvatar';
import { PreviewGlass } from '../home/PreviewGlass';
import { text } from '../home/styles';
import { BACKDROP_BOTTOM, MIST_BACKGROUND, ScreenBackdrop } from '../profile/ScreenBackdrop';
import { CalmShiftRing } from './CalmShiftRing';
import { INSIGHT_COLORS } from './insightColors';
import {
  calmShift,
  dayCount,
  minutesValue,
  moodJourney,
  sessionCount,
  weekDots,
} from './insightsModel';
import { MoodJourneyChart } from './MoodJourneyChart';

// Insights tab: Calm shift ring, Mood journey (before and after, this week),
// Consistency dots with the streak, and three stat tiles. Everything is
// computed from GET /api/insights as it is (see insightsModel.ts); the data
// loading, error and retry live in app/(tabs)/insights.tsx, unchanged.

const CARD_RADIUS = 16;

export function InsightsScreen({
  insights,
  error,
  onRetry,
  tabBarHeight,
}: {
  insights: InsightsResponse | null;
  error: string | null;
  onRetry: () => void;
  tabBarHeight: number;
}) {
  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <PreviewAvatar size={40} />
          <Text style={styles.title} accessibilityRole="header">
            Insights
          </Text>
        </View>

        {error ? (
          <View style={styles.centerState}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.onSurfaceVariant} />
            <Text style={styles.centerStateText}>Couldn&apos;t load insights.</Text>
            <Text style={styles.centerStateSubtext}>{error}</Text>
            <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retryButton}>
              <LinearGradient
                colors={[INSIGHT_COLORS.indigoStart, INSIGHT_COLORS.indigoEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.retryGradient}
              >
                <Text style={styles.retryText}>Retry</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : insights === null ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={INSIGHT_COLORS.emphasis} />
          </View>
        ) : (
          <Loaded insights={insights} tabBarHeight={tabBarHeight} />
        )}
      </SafeAreaView>
    </View>
  );
}

function Loaded({ insights, tabBarHeight }: { insights: InsightsResponse; tabBarHeight: number }) {
  const now = new Date();
  const shift = calmShift(insights.checkins);
  const journey = moodJourney(insights.checkins, now);
  const dots = weekDots(insights.checkins, now);
  const streak = insights.streak.currentStreak;

  const shiftCaption =
    shift.count === 0 ? 'Complete a session to see how breathing shifts your mood.' : 'Average mood change';
  const shiftNote =
    shift.count === 0 ? null : `Based on ${sessionCount(shift.count)} in the last 30 days.`;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.base * 3 }]}
      showsVerticalScrollIndicator={false}
    >
      <FadeIn>
        <PreviewGlass radius={CARD_RADIUS} style={styles.card}>
          <Text style={styles.cardTitle}>Calm shift</Text>
          <View
            style={styles.ringRow}
            accessible
            accessibilityLabel={
              shift.count === 0 ? 'Calm shift: no sessions yet' : `Calm shift: ${shift.label}, average mood change`
            }
          >
            <CalmShiftRing fill={shift.fill} label={shift.label} caption={shiftCaption} />
          </View>
          {shiftNote && <Text style={styles.note}>{shiftNote}</Text>}
        </PreviewGlass>
      </FadeIn>

      <FadeIn delay={STAGGER_MS}>
        <PreviewGlass radius={CARD_RADIUS} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Mood journey</Text>
            <View style={styles.legend}>
              <View style={[styles.legendDot, { backgroundColor: INSIGHT_COLORS.before }]} />
              <Text style={styles.legendText}>Before</Text>
              <View style={[styles.legendDot, { backgroundColor: INSIGHT_COLORS.emphasis }]} />
              <Text style={styles.legendText}>After</Text>
            </View>
          </View>
          <MoodJourneyChart days={journey} />
        </PreviewGlass>
      </FadeIn>

      <FadeIn delay={STAGGER_MS * 2}>
        <PreviewGlass radius={CARD_RADIUS} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Consistency</Text>
            <View style={styles.badge} accessible accessibilityLabel={`Streak, ${dayCount(streak)}`}>
              <Text style={styles.badgeText}>Streak: {dayCount(streak)}</Text>
            </View>
          </View>
          <View style={styles.dotsRow}>
            {dots.map((d) => (
              <View
                key={d.key}
                style={styles.dotCol}
                accessible
                accessibilityLabel={`${d.label}, ${d.done ? 'session done' : 'no session'}`}
              >
                <View style={[styles.dot, d.done && styles.dotDone, d.isToday && !d.done && styles.dotToday]}>
                  {d.done && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                </View>
                <Text style={[styles.dotLabel, d.isToday && styles.today]}>{d.label}</Text>
              </View>
            ))}
          </View>
        </PreviewGlass>
      </FadeIn>

      <FadeIn delay={STAGGER_MS * 3}>
        <View style={styles.tiles}>
          <PreviewGlass radius={CARD_RADIUS} style={styles.tile}>
            <Text style={styles.tileLabel}>Streak</Text>
            <Text style={styles.tileSub}>Best: {dayCount(insights.streak.longestStreak)}</Text>
            <Text style={styles.tileValue}>{dayCount(streak)}</Text>
          </PreviewGlass>
          <PreviewGlass radius={CARD_RADIUS} style={styles.tile}>
            <Text style={styles.tileLabel}>Sessions</Text>
            <Text style={styles.tileSub}>last 7 days</Text>
            <Text style={styles.tileValue}>{Math.max(0, Math.floor(insights.sessionsThisWeek))}</Text>
          </PreviewGlass>
          <PreviewGlass radius={CARD_RADIUS} style={styles.tile}>
            <Text style={styles.tileLabel} numberOfLines={1} adjustsFontSizeToFit>
              Mindful minutes
            </Text>
            <Text style={styles.tileSub}>all time</Text>
            <Text style={styles.tileValue}>{minutesValue(insights.mindfulMinutes)}</Text>
          </PreviewGlass>
        </View>
      </FadeIn>
    </ScrollView>
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
    gap: spacing.base * 1.5,
    paddingHorizontal: spacing.gutter,
    height: 64,
  },
  title: {
    ...text.pageTitle,
    color: '#ffffff',
  },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.base,
    gap: spacing.base * 2,
  },
  card: {
    padding: spacing.base * 2.5,
    gap: spacing.base * 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    ...text.sectionTitle,
    color: '#ffffff',
  },
  ringRow: {
    alignItems: 'center',
  },
  note: {
    ...text.meta,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.75,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...text.meta,
    color: colors.onSurfaceVariant,
    marginRight: spacing.base,
  },
  badge: {
    paddingHorizontal: spacing.base * 1.5,
    paddingVertical: spacing.base * 0.5,
    borderRadius: radii.full,
    backgroundColor: INSIGHT_COLORS.indigoStart,
  },
  badgeText: {
    ...text.link,
    color: '#ffffff',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotCol: {
    alignItems: 'center',
    gap: spacing.base,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: INSIGHT_COLORS.indigoStart,
    borderColor: INSIGHT_COLORS.indigoStart,
  },
  dotToday: {
    borderColor: '#ffffff',
  },
  dotLabel: {
    ...text.meta,
    color: colors.onSurfaceVariant,
  },
  today: {
    color: '#ffffff',
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.base * 1.5,
  },
  tile: {
    flex: 1,
    padding: spacing.base * 1.5,
    gap: 2,
  },
  tileLabel: {
    ...text.cardTitle,
    color: '#ffffff',
  },
  tileSub: {
    ...text.cardMeta,
    color: colors.onSurfaceVariant,
  },
  tileValue: {
    ...typography.headlineLgMobile,
    fontSize: 22,
    lineHeight: 28,
    color: '#ffffff',
    marginTop: spacing.base,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.marginMobile,
  },
  centerStateText: {
    ...typography.bodyLg,
    color: colors.onSurface,
  },
  centerStateSubtext: {
    ...text.body,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.base,
    borderRadius: radii.full,
  },
  retryGradient: {
    paddingHorizontal: spacing.base * 3,
    paddingVertical: spacing.base * 1.25,
    borderRadius: radii.full,
  },
  retryText: {
    ...text.link,
    color: '#ffffff',
  },
});
