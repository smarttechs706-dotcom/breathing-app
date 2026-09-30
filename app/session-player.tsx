import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchSessions, postCheckin } from '../src/api/client';
import { getCachedSessions, setCachedSessions } from '../src/state/sessionsCache';
import { BreathingRing } from '../src/components/BreathingRing';
import { GlassCard } from '../src/components/GlassCard';
import { GradientText } from '../src/components/GradientText';
import { MOOD_EMOJIS, MoodSelector } from '../src/components/MoodSelector';
import { useActiveSession } from '../src/state/ActiveSessionContext';
import { colors, radii, spacing, typography } from '../src/theme/tokens';
import type { Session } from '../src/types/models';
import { getDeviceId } from '../src/utils/deviceId';

// ============================================================================
// FLAGGED CONFLICT (per instruction: flag rather than silently pick one)
// ----------------------------------------------------------------------------
// architecture.md's "Session Player implementation" section is headed
// "(explicit — do not deviate)" and says this is ONE screen with internal
// state, one phase visible at a time, transitioning via fade/scale — not
// 3 separate screens or routes.
//
// But assets/design-reference/session-player-code.html (and its matching
// screenshot) renders all 3 phases stacked vertically on ONE long
// scrollable page, with "expand_more" chevron dividers between them — i.e.
// all 3 states visible simultaneously, one after another by scrolling.
//
// Resolution taken: treated the stacked layout as a Stitch design-review
// presentation convention (showing all 3 states together on one canvas for
// a human reviewer to see at a glance), not the intended runtime behavior —
// architecture.md's own heading calls its one-screen/one-phase-at-a-time
// model explicit and non-negotiable, so that wins. Built genuinely ONE
// phase visible at a time with a fade/scale transition between them; the
// "expand_more" dividers have no equivalent here and were omitted. Each
// phase's internal layout/colors/spacing/copy structure was still copied
// exactly from that phase's section of the HTML.
// ============================================================================

// RESOLVED (was FLAGGED CONFLICT #2): session-player-code.html and
// home-code.html originally gave "Deep Exhale" different description text
// (and PRD.md's table said 18 min vs. session-player-code.html's "10 MIN
// SESSION"). User explicitly decided (2026-09-12) to make
// session-player-code.html's version canonical everywhere: 10 min +
// "Designed to activate your parasympathetic nervous system...". Updated
// in sessions.ts (single source of truth, so Home/Library/Session Player
// all reflect it) and in PRD.md's table to match — see PROGRESS.md.

type Phase = 'pre-mood' | 'active' | 'post-mood';
// 4-phase pattern (2026-09-17): BREATHE IN / HOLD / BREATHE OUT / REST,
// replacing the prior 3-phase inhale/hold/exhale cycle — see sessions.ts.
type BreathSubPhase = 'inhale' | 'hold' | 'exhale' | 'rest';

function formatDurationBadge(durationSec: number) {
  return `${Math.round(durationSec / 60)} MIN SESSION`;
}

function formatTime(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function emojiForMood(mood: number) {
  return MOOD_EMOJIS[Math.min(Math.max(mood, 1), MOOD_EMOJIS.length) - 1];
}

// Shared across the loading/error/not-found/ready render branches below —
// same reasoning as insights.tsx's own module-level TopBar component.
// Takes its press handlers as props (rather than reading them from module
// scope) since they close over this screen's own `phase`/`session` state.
function TopBar({
  onExitPress,
  onSettingsPress,
}: {
  onExitPress: () => void;
  onSettingsPress: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onExitPress} hitSlop={12} style={styles.topBarButton}>
        <MaterialIcons name="close" size={24} color={colors.onSurfaceVariant} />
      </Pressable>
      <GradientText colors={[colors.primary, colors.tertiary]} style={styles.topBarTitle}>
        Breathe
      </GradientText>
      <Pressable onPress={onSettingsPress} hitSlop={12} style={styles.topBarButton}>
        <MaterialIcons name="settings" size={24} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export default function SessionPlayerScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  // FRONTEND-AUDIT-2.md High finding (fixed 2026-09-26): this used to be
  // `getSessionById(sessionId ?? '') ?? featuredSession` — a synchronous
  // lookup into the local static catalog that silently substituted Deep
  // Exhale for ANY unrecognized id, with no error, no warning, and (via
  // handleDone below) the checkin would then be silently mis-attributed to
  // the wrong session. Now fetches the live catalog via the same
  // GET /api/sessions Library's grid already uses, and distinguishes three
  // real states: still loading, the fetch itself failed (network/backend
  // error — offers Retry), and the fetch succeeded but no session in the
  // live list matches `sessionId` (a genuine "not found," not silently
  // substituted — see the dedicated not-found branch further down).
  //
  // P4 (2026-09-30): if Library/Player tab already fetched the list and it
  // contains this id, start from that (no spinner, no blocking request) and
  // only refresh the shared cache in the background — deliberately NOT
  // setting state from that refresh, so `session` keeps a stable reference
  // and the timer/phase effects below never restart mid-session. A cache
  // miss (cold start, deep link, unknown id) falls through to the original
  // blocking fetch, so loading/error/not-found behave exactly as before.
  const [sessions, setSessions] = useState<Session[] | null>(() => {
    const cachedSessions = getCachedSessions();
    return cachedSessions?.some((s) => s.id === sessionId) ? cachedSessions : null;
  });
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    setFetchError(null);
    setSessions(null);
    fetchSessions()
      .then((fresh) => {
        setCachedSessions(fresh);
        setSessions(fresh);
      })
      .catch((err) =>
        setFetchError(err instanceof Error ? err.message : 'Failed to load session.')
      );
  }, []);

  useEffect(() => {
    if (sessions) {
      fetchSessions().then(setCachedSessions).catch(() => {});
      return;
    }
    loadSessions();
    // Mount-only: `sessions` here is the initial (cache-derived) value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSessions]);

  // Referentially stable across re-renders as long as `sessions` itself
  // hasn't changed (Array.prototype.find on the same array reference
  // returns the same element reference), so this is safe to use directly
  // in effect dependency arrays below without causing extra re-runs.
  // Once `sessions` has loaded and `fetchError` is clear, `session` being
  // null unambiguously means "not found" (see the guard sequence before
  // the main return below) — not a loading state.
  const session = sessions?.find((s) => s.id === sessionId) ?? null;

  // AUDIT.md High finding (2026-09-19): router.push('/settings') from this
  // screen doesn't unmount it — it just loses focus while Settings sits on
  // top. Without this, the timers below and the BackHandler further down
  // keep acting as if this screen were still the one on screen. Gates both
  // on actual navigation focus, not just component lifetime.
  const isFocused = useIsFocused();

  const { setActiveSessionId } = useActiveSession();
  // Marks a session "in progress" for the Player tab (app/(tabs)/player.tsx)
  // for as long as this screen is mounted, in any phase — cleared on exit,
  // completion, or unmount. See architecture.md's "Bottom navigation —
  // Player tab behavior". Only marks once a session has genuinely resolved
  // from the live catalog — not during loading, and not for an id that
  // turns out not to exist (previously this fired immediately for
  // whatever the local-fallback session was, even for a malformed link —
  // see the FRONTEND-AUDIT-2.md comment above).
  useEffect(() => {
    if (!session) return;
    setActiveSessionId(session.id);
    return () => setActiveSessionId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const [phase, setPhase] = useState<Phase>('pre-mood');
  const [preMood, setPreMood] = useState(3);
  const [postMood, setPostMood] = useState(3);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [paused, setPaused] = useState(false);
  const [breathSubPhase, setBreathSubPhase] = useState<BreathSubPhase>('inhale');
  // Save state for the real POST /api/checkin call Done triggers. On
  // failure, we stay on this screen with saveError set (preMood/postMood
  // stay in state, untouched) instead of silently discarding the
  // completed session — see PROGRESS.md for the full reasoning.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const transitionAnim = useRef(new Animated.Value(0)).current;

  // architecture.md: "Transitions between phases should be animated
  // smoothly (fade/scale)."
  useEffect(() => {
    transitionAnim.setValue(0);
    Animated.timing(transitionAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [phase, transitionAnim]);

  // Elapsed-time timer — only ticks during the active phase, not while
  // paused, and not while this screen has lost focus (e.g. Settings was
  // pushed on top) — otherwise a long-enough visit to Settings mid-session
  // could silently auto-complete it in the background.
  useEffect(() => {
    if (phase !== 'active' || paused || !isFocused) return;
    const id = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, paused, isFocused]);

  // Auto-advance to post-mood once the session's full duration has elapsed.
  useEffect(() => {
    if (!session) return;
    if (phase === 'active' && elapsedSec >= session.durationSec) {
      setPhase('post-mood');
    }
  }, [elapsedSec, phase, session]);

  // Breathing sub-phase cycle (inhale -> hold -> exhale -> inhale...),
  // timed from the session's own phaseConfig. Self-scheduling chain since
  // each sub-phase has a different duration. Also paused while unfocused —
  // same reasoning as the elapsed-time timer above.
  useEffect(() => {
    if (phase !== 'active' || paused || !isFocused || !session) return;
    const durations: Record<BreathSubPhase, number> = {
      inhale: session.phaseConfig.inhale,
      hold: session.phaseConfig.hold,
      exhale: session.phaseConfig.exhale,
      rest: session.phaseConfig.rest,
    };
    const nextSubPhase: Record<BreathSubPhase, BreathSubPhase> = {
      inhale: 'hold',
      hold: 'exhale',
      exhale: 'rest',
      rest: 'inhale',
    };
    const id = setTimeout(() => {
      setBreathSubPhase((cur) => nextSubPhase[cur]);
    }, durations[breathSubPhase] * 1000);
    return () => clearTimeout(id);
  }, [phase, paused, isFocused, breathSubPhase, session]);

  const exitSession = () => {
    setActiveSessionId(null);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  // Used only by the "not found" state below — Library, not Home, is the
  // more useful destination when the session the user tried to open
  // doesn't exist (they were trying to view a specific session, so
  // somewhere to pick a real one is more helpful than the dashboard).
  const handleBackToLibrary = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/library');
    }
  };

  // architecture.md's back-button spec: during `active`, confirm before
  // leaving; during `pre-mood`/`post-mood`, act directly. Shared by every
  // way of leaving the active phase (X button, hardware back, and the
  // settings gear — AUDIT.md High finding, 2026-09-19) so none of them can
  // silently skip the confirmation the others already show.
  const confirmIfActive = (action: () => void) => {
    if (phase === 'active') {
      Alert.alert('Exit session?', "Your progress won't be saved", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: action },
      ]);
    } else {
      action();
    }
  };

  const handleExitPress = () => confirmIfActive(exitSession);
  const handleSettingsPress = () => confirmIfActive(() => router.push('/settings'));

  // Android hardware back button — same rule as the X button, but only
  // while this screen is actually the focused one. Without the isFocused
  // guard, this global listener kept firing even while Settings was
  // pushed on top (this screen doesn't unmount, just loses focus) and
  // showed "Exit session?" over the Settings UI (AUDIT.md High finding,
  // 2026-09-19). When unfocused, returning false lets Android's default
  // back behavior run instead — correctly popping back to this screen.
  // Re-registers on every phase/focus change so the handler never reads a
  // stale value (no stale-closure risk from a listener registered once).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isFocused) return false;
      handleExitPress();
      return true; // we always handle it ourselves, never let it fall through
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isFocused]);

  const handleBeginJourney = () => {
    setElapsedSec(0);
    setBreathSubPhase('inhale');
    setPhase('active');
  };

  const handlePauseToggle = () => setPaused((p) => !p);

  // FRONTEND-AUDIT-2.md High finding: 3 real states, checked in order, all
  // hooks above already unconditionally declared so this is safe. Beyond
  // this point TypeScript narrows `session` to a real Session (not
  // Session | null) for the rest of the render — the existing phase JSX
  // below needed no changes to account for that, it's the same shape
  // GET /api/sessions already returns as the local catalog used to.
  if (fetchError) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <TopBar onExitPress={handleExitPress} onSettingsPress={handleSettingsPress} />
          <View style={styles.centerState}>
            <MaterialIcons name="error-outline" size={32} color={colors.onSurfaceVariant} />
            <Text style={styles.centerStateText}>Couldn&apos;t load this session.</Text>
            <Text style={styles.centerStateSubtext}>{fetchError}</Text>
            <Pressable onPress={loadSessions} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (sessions === null) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <TopBar onExitPress={handleExitPress} onSettingsPress={handleSettingsPress} />
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!session) {
    // sessions is loaded and fetchError is clear (both prior guards
    // already returned otherwise) — a null session here unambiguously
    // means the requested id genuinely doesn't exist in the live catalog.
    // This is the exact case FRONTEND-AUDIT-2.md flagged: previously this
    // silently substituted Deep Exhale with no indication anything was
    // wrong; now it's a clear, dedicated state with no session
    // substitution and nothing for handleDone to misattribute a checkin
    // to.
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <TopBar onExitPress={handleExitPress} onSettingsPress={handleSettingsPress} />
          <View style={styles.centerState}>
            <MaterialIcons name="search-off" size={32} color={colors.onSurfaceVariant} />
            <Text style={styles.centerStateText}>Session not found.</Text>
            <Text style={styles.centerStateSubtext}>
              This session may have been removed, or the link you followed is
              invalid.
            </Text>
            <Pressable onPress={handleBackToLibrary} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Back to Library</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const handleDone = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const userId = await getDeviceId();
      await postCheckin({ userId, sessionId: session.id, preMood, postMood });
      setActiveSessionId(null);
      router.replace('/home');
    } catch (err) {
      // Stay on this screen — preMood/postMood are still in state, so
      // Retry (below) can resend the exact same completed session data
      // rather than losing it.
      setSaveError(err instanceof Error ? err.message : 'Failed to save your session.');
    } finally {
      setSaving(false);
    }
  };

  const progressPercent = Math.min(
    (elapsedSec / session.durationSec) * 100,
    100
  );

  // 4-phase pattern (2026-09-17 product decision): exact labels/instruction
  // copy per session — see PROGRESS.md. Deviates from architecture.md:163-168's
  // documented "Inhale.../Hold for 4 seconds" convention; flagged, not silent.
  const PHASE_LABEL: Record<BreathSubPhase, string> = {
    inhale: 'BREATHE IN',
    hold: 'HOLD',
    exhale: 'BREATHE OUT',
    rest: 'REST',
  };
  const phaseLabel = PHASE_LABEL[breathSubPhase];
  const phaseSubLabel =
    breathSubPhase === 'inhale'
      ? `Breathe in slowly for ${session.phaseConfig.inhale} seconds`
      : breathSubPhase === 'hold'
        ? `Hold gently for ${session.phaseConfig.hold} seconds`
        : breathSubPhase === 'exhale'
          ? `Breathe out slowly for ${session.phaseConfig.exhale} seconds`
          : `Stay relaxed for ${session.phaseConfig.rest} seconds`;

  return (
    <View style={styles.root}>
      {/* Disables the swipe-back gesture (iOS edge swipe / Android
          predictive back) specifically during the active phase, so it
          can't bypass the confirmation dialog the hardware/X back button
          enforces. Native-gesture behavior — cannot be verified from the
          web preview; flagging for on-device testing. */}
      <Stack.Screen options={{ gestureEnabled: phase !== 'active' }} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TopBar onExitPress={handleExitPress} onSettingsPress={handleSettingsPress} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.phaseContainer,
              {
                opacity: transitionAnim,
                transform: [
                  {
                    scale: transitionAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {phase === 'pre-mood' && (
              <GlassCard radius={radii.lg} style={styles.card}>
                <View style={styles.preMoodTop}>
                  <View style={styles.durationBadge}>
                    <MaterialIcons name="waves" size={16} color={colors.tertiary} />
                    <Text style={styles.durationBadgeText}>
                      {formatDurationBadge(session.durationSec)}
                    </Text>
                  </View>
                  <Text style={styles.sessionTitle}>{session.title}</Text>
                  <Text style={styles.sessionDescription}>
                    {session.description}
                  </Text>
                </View>

                <View style={styles.preMoodBottom}>
                  <Text style={styles.moodQuestion}>How are you feeling?</Text>
                  <MoodSelector
                    value={preMood}
                    onChange={setPreMood}
                    style={styles.moodSelector}
                  />
                  <Pressable onPress={handleBeginJourney}>
                    <LinearGradient
                      colors={[colors.inversePrimary, colors.primaryContainer]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.beginButton}
                    >
                      <Text style={styles.beginButtonText}>Begin Journey</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </GlassCard>
            )}

            {phase === 'active' && (
              // CORNER-CLIP FIX (2026-09-20, AUDIT-2.md Medium finding):
              // expo-blur's native BlurView on Android doesn't reliably clip
              // to a rounded rect via the parent's own overflow:hidden at
              // radii.xl (48px) — confirmed on-device as 2-of-4 corners
              // staying sharp (see PROGRESS.md's Insights "stat card corners
              // uneven" entry, and src/components/GlassCard.tsx). This card
              // is the only other radii.xl GlassCard in the app besides
              // Insights', which already has this same wrapper — Insights
              // never got a matching fix here because the two pieces of work
              // happened in separate sessions. Wrapping in a second
              // overflow:hidden + matching borderRadius View outside the
              // BlurView, same technique as insights.tsx's cardClip.
              <View style={styles.activeCardClip}>
                <GlassCard radius={radii.xl} style={[styles.card, styles.activeCard]}>
                  <View style={styles.activeCenter}>
                    <Text style={styles.phaseLabel}>{phaseLabel}</Text>
                    <BreathingRing
                      inhaleSec={session.phaseConfig.inhale}
                      holdSec={session.phaseConfig.hold}
                      exhaleSec={session.phaseConfig.exhale}
                      restSec={session.phaseConfig.rest}
                      paused={paused}
                    />
                    <Text style={styles.phaseSubLabel}>{phaseSubLabel}</Text>
                  </View>

                  <View style={styles.activeFooter}>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeText}>{formatTime(elapsedSec)}</Text>
                      <Text style={styles.timeText}>
                        {formatTime(session.durationSec)}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <LinearGradient
                        colors={[colors.primary, colors.tertiary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressFill, { width: `${progressPercent}%` }]}
                      />
                    </View>
                    <Pressable onPress={handlePauseToggle} style={styles.pauseButton}>
                      <MaterialIcons
                        name={paused ? 'play-arrow' : 'pause'}
                        size={24}
                        color={colors.onSurface}
                      />
                    </Pressable>
                  </View>
                </GlassCard>
              </View>
            )}

            {phase === 'post-mood' && (
              <GlassCard radius={radii.lg} style={styles.card}>
                <View style={styles.postMoodTop}>
                  <View style={styles.checkBadge}>
                    <MaterialIcons
                      name="check-circle"
                      size={32}
                      color={colors.tertiary}
                    />
                  </View>
                  <Text style={styles.completeHeadline}>Session Complete</Text>
                  <Text style={styles.mindfulMinutes}>
                    {Math.round(session.durationSec / 60)} Mindful Minutes
                  </Text>
                </View>

                <View style={styles.postMoodCardInner}>
                  <Text style={styles.moodQuestion}>How do you feel now?</Text>

                  <View style={styles.beforeAfterRow}>
                    <View style={styles.beforeAfterItem}>
                      <Text style={styles.beforeAfterEmoji}>
                        {emojiForMood(preMood)}
                      </Text>
                      <Text style={styles.beforeAfterLabel}>Before</Text>
                    </View>
                    <MaterialIcons
                      name="arrow-forward"
                      size={20}
                      color={colors.onSurfaceVariant}
                    />
                    <View style={styles.beforeAfterItem}>
                      <Text style={[styles.beforeAfterEmoji, styles.afterEmoji]}>
                        {emojiForMood(postMood)}
                      </Text>
                      <Text style={[styles.beforeAfterLabel, styles.afterLabel]}>
                        After
                      </Text>
                    </View>
                  </View>

                  <MoodSelector value={postMood} onChange={setPostMood} />
                </View>

                {saveError && (
                  <View style={styles.saveErrorBox}>
                    <MaterialIcons name="error-outline" size={20} color={colors.error} />
                    <View style={styles.saveErrorTextGroup}>
                      <Text style={styles.saveErrorTitle}>
                        Couldn&apos;t save your session.
                      </Text>
                      <Text style={styles.saveErrorSubtext}>{saveError}</Text>
                    </View>
                  </View>
                )}

                <Pressable
                  onPress={handleDone}
                  disabled={saving}
                  style={[styles.doneButton, saving && styles.doneButtonDisabled]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.onSurface} />
                  ) : (
                    <Text style={styles.doneButtonText}>
                      {saveError ? 'Try Again' : 'Done'}
                    </Text>
                  )}
                </Pressable>
              </GlassCard>
            )}
          </Animated.View>
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
    height: 64,
  },
  topBarButton: {
    padding: spacing.base,
  },
  topBarTitle: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.sectionGap,
  },
  // Loading/error/not-found states (FRONTEND-AUDIT-2.md fix) — same values
  // as Library/Insights' equivalent centered states for visual consistency.
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
  phaseContainer: {
    flex: 1,
  },
  card: {
    flex: 1,
    padding: spacing.base * 3,
    justifyContent: 'space-between',
    minHeight: 480,
  },
  // ---- pre-mood ----
  preMoodTop: {
    gap: spacing.base * 2,
  },
  durationBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: spacing.base,
    backgroundColor: `${colors.surfaceVariant}80`,
    paddingHorizontal: spacing.base * 1.5,
    paddingVertical: spacing.base * 0.75,
    borderRadius: radii.full,
  },
  durationBadgeText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurfaceVariant,
  },
  sessionTitle: {
    fontFamily: typography.displayLg.fontFamily,
    fontSize: 40,
    fontWeight: '700',
    color: colors.onSurface,
  },
  sessionDescription: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    color: colors.onSurfaceVariant,
  },
  preMoodBottom: {
    gap: spacing.base * 2,
    marginTop: spacing.sectionGap,
  },
  moodQuestion: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurface,
    textAlign: 'center',
  },
  moodSelector: {
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  beginButton: {
    paddingVertical: spacing.base * 2,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginButtonText: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
    color: '#ffffff',
  },
  // ---- active ----
  // CORNER-CLIP FIX (2026-09-20, AUDIT-2.md) — see the active-phase
  // GlassCard's JSX comment above. flex:1 so the wrapper still fills
  // phaseContainer the same way the GlassCard's own flex:1 (styles.card)
  // did before this wrapper existed.
  activeCardClip: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  activeCard: {
    alignItems: 'center',
  },
  activeCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sectionGap,
  },
  phaseLabel: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    color: colors.onSurface,
    opacity: 0.8,
  },
  phaseSubLabel: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
  },
  activeFooter: {
    width: '100%',
    gap: spacing.base * 1.5,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.onSurfaceVariant,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceVariant,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  pauseButton: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.surfaceVariant}80`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  // ---- post-mood ----
  postMoodTop: {
    alignItems: 'center',
    gap: spacing.base,
  },
  checkBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.tertiaryContainer}4D`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeHeadline: {
    fontFamily: typography.displayLg.fontFamily,
    fontSize: 32,
    fontWeight: '700',
    color: colors.onSurface,
  },
  mindfulMinutes: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    color: colors.tertiary,
  },
  postMoodCardInner: {
    backgroundColor: `${colors.surfaceContainer}66`,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: spacing.base * 3,
    gap: spacing.base * 2,
    marginTop: spacing.sectionGap,
  },
  beforeAfterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base * 2,
  },
  beforeAfterItem: {
    alignItems: 'center',
    gap: 4,
  },
  beforeAfterEmoji: {
    fontSize: 24,
    opacity: 0.5,
  },
  afterEmoji: {
    fontSize: 30,
    opacity: 1,
  },
  beforeAfterLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.onSurfaceVariant,
  },
  afterLabel: {
    color: colors.tertiary,
  },
  doneButton: {
    marginTop: spacing.sectionGap,
    paddingVertical: spacing.base * 2,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.surfaceVariant}80`,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  doneButtonDisabled: {
    opacity: 0.7,
  },
  doneButtonText: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    color: colors.onSurface,
  },
  saveErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
    marginTop: spacing.sectionGap,
    padding: spacing.base * 1.5,
    borderRadius: radii.md,
    backgroundColor: `${colors.onErrorContainer}1A`,
    borderWidth: 1,
    borderColor: `${colors.error}4D`,
  },
  saveErrorTextGroup: {
    flex: 1,
    gap: 2,
  },
  saveErrorTitle: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
  },
  saveErrorSubtext: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.onSurfaceVariant,
  },
});
