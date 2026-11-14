import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendlyError } from '../../api/apiErrors';
import { fetchInsights, fetchSessions, type InsightsResponse } from '../../api/client';
import { accountFirstName, homeGreeting } from '../../auth/accountName';
import { useAuth } from '../../auth/AuthProvider';
import { useRefreshOnNewCheckin } from '../../state/checkinSignal';
import { getCachedSessions, setCachedSessions } from '../../state/sessionsCache';
import { colors, spacing } from '../../theme/tokens';
import type { Session } from '../../types/models';
import { BACKDROP_BOTTOM, MIST_BACKGROUND, ScreenBackdrop } from '../profile/ScreenBackdrop';
import { FeaturedSessionCard } from './FeaturedSessionCard';
import { FadeIn, STAGGER_MS } from './motion';
import { NowForYou } from './NowForYou';
import { pickFeatured, pickNowForYou } from './picks';
import { HorizonBand } from './HorizonBand';
import { GreetingRow, WeekRow } from './PreviewHeader';
import { text } from './styles';
import { weekActivity } from './weekActivity';

// Used only when no tab-bar height is passed in (the dev preview route, which
// sits outside the tabs): the real tab bar's content height from
// app/(tabs)/_layout.tsx, so the layout sits where it does on Home.
const TAB_BAR_CONTENT_HEIGHT = 84;

// The horizon band between the week row and the Featured card: full width,
// 2.5 : 1 (about 164 dp tall on a 411 dp phone), the same shape as its video.
const BAND_ASPECT = 2.5;

// Re-reads the clock on focus, once a minute, and when the app comes back to
// the foreground, so the greeting changes at the boundary (midnight too).
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

// The Home screen. app/(tabs)/home.tsx renders it with the real tab-bar height.
// Data and navigation are the same as the previous Home: GET /api/sessions
// (cache first) for the Featured card and "Now for you", GET /api/insights for
// the week row and streak, a silent refresh after a saved check-in.
export function HomeScreen({ tabBarHeight }: { tabBarHeight?: number }) {
  const { session: authSession, status } = useAuth();
  const insets = useSafeAreaInsets();
  const hour = useLocalHour();
  const signedIn = status === 'signedIn';
  const { width: windowW } = useWindowDimensions();

  // Session history: real check-ins, the server's streak and 7-day count.
  // null = loading (first fetch, or a retry in flight).
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const loadInsights = useCallback(() => {
    setInsightsError(null);
    setInsights(null);
    fetchInsights()
      .then(setInsights)
      .catch((err) => setInsightsError(friendlyError(err)));
  }, []);

  // Session catalog: starts from the shared cache when it holds a list, then
  // refreshes. A failed refresh with a cached list keeps showing the cache.
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

  // After a saved check-in: refresh quietly; old numbers stay on a failure.
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

  // Home itself sits behind the signed-in guard; only the dev route can be
  // open while signed out.
  if (!signedIn) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.notice}>Sign in to see Home.</Text>
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
    ? ({ kind: 'error', message: insightsError, onRetry: loadInsights } as const)
    : insights && days
      ? ({
          kind: 'ready',
          days,
          streak: insights.streak.currentStreak,
          sessionsLast7Days: insights.sessionsThisWeek,
        } as const)
      : ({ kind: 'loading' } as const);

  const displayName = accountFirstName(authSession?.user) ?? homeGreeting(null);
  const bottomSpace = tabBarHeight ?? TAB_BAR_CONTENT_HEIGHT + insets.bottom;

  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomSpace + spacing.base * 3 }]}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <FadeIn>
              <GreetingRow hour={hour} displayName={displayName} />
            </FadeIn>
            <FadeIn delay={STAGGER_MS}>
              <WeekRow state={weekState} />
            </FadeIn>
          </View>

          <HorizonBand height={Math.round(windowW / BAND_ASPECT)} style={styles.band} />

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
    backgroundColor: BACKDROP_BOTTOM,
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
  // Full width (the scroll content has no side padding).
  band: {
    marginVertical: spacing.base * 2,
  },
  lower: {
    paddingHorizontal: spacing.gutter,
    gap: spacing.base * 2,
  },
});
