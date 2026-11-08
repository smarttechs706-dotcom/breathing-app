import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendlyError } from '../../api/apiErrors';
import { fetchInsights, fetchSessions, type InsightsResponse } from '../../api/client';
import { accountFirstName, homeGreeting } from '../../auth/accountName';
import { useAuth } from '../../auth/AuthProvider';
import { useRefreshOnNewCheckin } from '../../state/checkinSignal';
import { getCachedSessions, setCachedSessions } from '../../state/sessionsCache';
import { colors, spacing } from '../../theme/tokens';
import type { Session } from '../../types/models';
import { FeaturedSessionCard } from './FeaturedSessionCard';
import { FadeIn, STAGGER_MS } from './motion';
import { NowForYou } from './NowForYou';
import { pickFeatured, pickNowForYou } from './picks';
import { GreetingRow, WeekRow } from './PreviewHeader';
import { PreviewOrb } from './PreviewOrb';
import { text } from './styles';
import { horizonOnScreen, SCENES } from './backgrounds';
import { TimeOfDayBackground } from './TimeOfDayBackground';
import { backgroundPhaseForHour, type DayPhase } from './timeOfDay';
import { weekActivity } from './weekActivity';

// Matches the real tab bar's content height in app/(tabs)/_layout.tsx. This
// route sits outside the tabs, so no tab bar shows; the space is kept so the
// layout sits where it will once it replaces Home.
const TAB_BAR_CONTENT_HEIGHT = 84;

// The Featured card's top edge stays at least this far below the horizon.
const CARD_BELOW_HORIZON = 40;
// The orb's own box (PreviewOrb BOX).
const ORB_AREA_MIN = 200;

// Dev-only: each long-press on the greeting moves to the next scene, and after
// night back to following the clock (null).
const SCENE_CYCLE: (DayPhase | null)[] = ['morning', 'afternoon', 'evening', 'night', null];

// Re-reads the clock on focus, once a minute, and when the app comes back to
// the foreground, so greeting and scene change at the boundary (midnight too).
function useLocalHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useFocusEffect(
    useCallback(() => {
      const read = () => setHour(new Date().getHours());
      read();
      const id = setInterval(read, 60_000);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') read();
      });
      return () => {
        clearInterval(id);
        sub.remove();
      };
    }, [])
  );
  return hour;
}

export function HomeRedesignPreview() {
  const { session: authSession, status } = useAuth();
  const insets = useSafeAreaInsets();
  const hour = useLocalHour();
  const signedIn = status === 'signedIn';
  const { width: windowW, height: windowH } = useWindowDimensions();
  // Dev-only scene override from the hidden long-press; null follows the clock.
  const [phaseOverride, setPhaseOverride] = useState<DayPhase | null>(null);
  const cycleScene = useCallback(
    () => setPhaseOverride((p) => SCENE_CYCLE[(SCENE_CYCLE.indexOf(p) + 1) % SCENE_CYCLE.length]),
    []
  );
  // Bottom of the greeting + week block inside the scroll content.
  const [headerBottom, setHeaderBottom] = useState(0);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setHeaderBottom(y + height);
  }, []);

  // Session history: real check-ins and the server's streak.
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [insightsError, setInsightsError] = useState(false);

  const loadInsights = useCallback(() => {
    setInsightsError(false);
    setInsights(null);
    fetchInsights()
      .then(setInsights)
      .catch(() => setInsightsError(true));
  }, []);

  // Session catalog: starts from the shared cache like the real Home.
  const [sessions, setSessions] = useState<Session[] | null>(() => {
    const cached = getCachedSessions();
    return cached && cached.length > 0 ? cached : null;
  });
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    setSessionsError(null);
    fetchSessions()
      .then((fresh) => {
        setCachedSessions(fresh);
        setSessions(fresh);
      })
      .catch((err) => setSessionsError(friendlyError(err)));
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    loadInsights();
    loadSessions();
  }, [signedIn, loadInsights, loadSessions]);

  const refreshAfterCheckin = useCallback(() => {
    fetchInsights()
      .then(setInsights)
      .catch(() => {});
  }, []);
  useRefreshOnNewCheckin(refreshAfterCheckin);

  const days = useMemo(
    () => (insights ? weekActivity(insights.checkins.map((c) => c.createdAt), new Date()) : null),
    // `hour` re-runs this when the day changes while the screen stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insights, hour]
  );

  if (!signedIn) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.notice}>Sign in to see the Home redesign preview.</Text>
      </View>
    );
  }

  const featured = sessions ? pickFeatured(sessions) : null;
  const featuredState = sessions
    ? featured
      ? ({ kind: 'ready', session: featured } as const)
      : ({ kind: 'error', message: 'No sessions are available right now.', onRetry: loadSessions } as const)
    : sessionsError
      ? ({ kind: 'error', message: sessionsError, onRetry: loadSessions } as const)
      : ({ kind: 'loading' } as const);

  const nowState = sessions
    ? ({ kind: 'ready', sessions: pickNowForYou(sessions) } as const)
    : sessionsError
      ? ({ kind: 'error' } as const)
      : ({ kind: 'loading' } as const);

  const weekState = insightsError
    ? ({ kind: 'error', onRetry: loadInsights } as const)
    : insights && days
      ? ({ kind: 'ready', days, streak: insights.streak.currentStreak } as const)
      : ({ kind: 'loading' } as const);

  const displayName = accountFirstName(authSession?.user) ?? homeGreeting(null);
  const phase = phaseOverride ?? backgroundPhaseForHour(hour);

  // The orb area grows at least enough to put the Featured card's top edge
  // CARD_BELOW_HORIZON under the horizon (window coordinates: the scroll
  // content starts below the top inset). On a short phone the page scrolls.
  const horizonY = horizonOnScreen(phase, windowW, windowH);
  const orbAreaMin =
    headerBottom > 0
      ? Math.max(ORB_AREA_MIN, horizonY + CARD_BELOW_HORIZON - insets.top - headerBottom)
      : ORB_AREA_MIN;

  return (
    <View style={styles.root}>
      <TimeOfDayBackground phase={phase} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + spacing.base * 3 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View onLayout={onHeaderLayout}>
            <FadeIn>
              <GreetingRow
                hour={hour}
                displayName={displayName}
                onLongPressGreeting={__DEV__ ? cycleScene : undefined}
              />
            </FadeIn>
            <FadeIn delay={STAGGER_MS}>
              <WeekRow state={weekState} emptyFill={SCENES[phase].emptyDays} />
            </FadeIn>
          </View>

          <View style={[styles.orbArea, { minHeight: orbAreaMin }]}>
            <PreviewOrb backing={SCENES[phase].orbBacking === true} />
          </View>

          <View style={styles.lower}>
            <FadeIn delay={STAGGER_MS * 2}>
              <FeaturedSessionCard state={featuredState} />
            </FadeIn>
            <NowForYou state={nowState} enterDelay={STAGGER_MS * 3} />
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.marginMobile,
  },
  notice: {
    ...text.body,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  // Takes the space between the week row and the cards, like the reference.
  orbArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lower: {
    paddingHorizontal: spacing.gutter,
    gap: spacing.base * 2,
  },
});
