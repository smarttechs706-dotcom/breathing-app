import { MaterialIcons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { friendlyError } from '../src/api/apiErrors';
import { fetchSessions, postCheckin } from '../src/api/client';
import { useAuth } from '../src/auth/AuthProvider';
import { useSingleFlight } from '../src/auth/useSingleFlight';
import { markCheckinSaved } from '../src/state/checkinSignal';
import { getCachedSessions, setCachedSessions } from '../src/state/sessionsCache';
import { BreathCircle } from '../src/features/session/BreathCircle';
import {
  breathAt,
  nextTickMs,
  patternLabel,
  patternLine,
  sessionSeconds,
  type BreathPhase,
} from '../src/features/session/breathPattern';
import {
  checkinDurationSec,
  CUSTOM_SESSION_ID,
  customPlayerHref,
  customSession,
  defaultLengthFor,
  DEFAULT_LENGTH_SEC,
  type LengthSec,
} from '../src/features/session/customPattern';
import { rememberLastPattern } from '../src/features/session/lastPatternStore';
import { LengthChooser, LengthLabel } from '../src/features/session/LengthChooser';
import { MoodGlyph, MoodScale } from '../src/features/session/MoodScale';
import { BackdropSpacer, PhaseTransition, SessionBackdrop } from '../src/features/session/SessionBackdrop';
import { useActiveSession } from '../src/state/ActiveSessionContext';
import { colors, radii, spacing, typography } from '../src/theme/tokens';
import type { Session } from '../src/types/models';
import {
  INITIAL_CLOCK,
  beat as clockBeat,
  elapsedMs as clockElapsedMs,
  setRunning as setClockRunning,
  type ClockState,
} from '../src/utils/sessionClock';

const KEEP_AWAKE_TAG = 'breathe-session';
// Disabled Begin Journey / Done: translucent navy glass with a hairline border.
const GLASS_BUTTON_FILL = 'rgba(10,16,40,0.55)';

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

function formatTime(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
      <Pressable
        onPress={onExitPress}
        hitSlop={12}
        style={styles.topBarButton}
        accessibilityRole="button"
        accessibilityLabel="Close session"
      >
        <MaterialIcons name="close" size={24} color="#ffffff" />
      </Pressable>
      <Text style={styles.topBarTitle}>Breathease</Text>
      <Pressable
        onPress={onSettingsPress}
        hitSlop={12}
        style={styles.topBarButton}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <MaterialIcons name="settings" size={24} color="#ffffff" />
      </Pressable>
    </View>
  );
}

export default function SessionPlayerScreen() {
  const { sessionId, pattern, length } = useLocalSearchParams<{
    sessionId?: string;
    pattern?: string;
    length?: string;
  }>();
  // "Create your own": the pattern and length come in the link
  // (customPattern.customPlayerHref), so no catalogue fetch is needed. A
  // broken link gives null, which shows "Session not found" below.
  const isCustom = sessionId === CUSTOM_SESSION_ID;
  const custom = useMemo(
    () => (isCustom ? customSession(pattern, length) : null),
    [isCustom, pattern, length]
  );

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
      .catch((err) => setFetchError(friendlyError(err)));
  }, []);

  useEffect(() => {
    if (isCustom) return; // played from the link, not the catalogue
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
  const session = isCustom ? custom : (sessions?.find((s) => s.id === sessionId) ?? null);
  const { session: auth } = useAuth();
  const userId = auth?.user.id ?? null;

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
    setActiveSessionId(
      session.id,
      isCustom ? customPlayerHref(session.phaseConfig, defaultLengthFor(session.durationSec)) : undefined
    );
    return () => setActiveSessionId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const [phase, setPhase] = useState<Phase>('pre-mood');
  // D-10: no default — null until the user actually picks a mood, so an
  // untouched selector can never submit a fabricated value.
  const [preMood, setPreMood] = useState<number | null>(null);
  const [postMood, setPostMood] = useState<number | null>(null);
  // The length chosen before the session (2, 3, 5 or 10 min). null = the
  // session's own length (customPattern.ts defaultLengthFor). Only changeable
  // before the session starts.
  const [chosenLength, setChosenLength] = useState<LengthSec | null>(null);
  const lengthSec: LengthSec = chosenLength ?? defaultLengthFor(session?.durationSec ?? DEFAULT_LENGTH_SEC);
  // Breathed time in ms: the one clock everything on the breathing screen
  // reads (see the clock effect below).
  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  // Save state for the real POST /api/checkin call Done triggers. On
  // failure, we stay on this screen with saveError set (preMood/postMood
  // stay in state, untouched) instead of silently discarding the
  // completed session — see PROGRESS.md for the full reasoning. Done and the
  // exit prompt's Save share this lock, so two taps can't send two check-ins.
  const { running: saving, run: runSave } = useSingleFlight();
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
  //
  // F-02 (DEEP-AUDIT-3): elapsed time now comes from a timestamp-based clock
  // (src/utils/sessionClock.ts), not from counting interval ticks, so a
  // throttled timer can only make the display late, never stretch the
  // session. The clock only runs while the session is `running`: active
  // phase, not paused, this screen focused (Settings pauses it) and the app
  // in the foreground (backgrounding pauses it; it resumes on return).
  const clockRef = useRef<ClockState>(INITIAL_CLOCK);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      // Stop the clock at the moment the app leaves the foreground (lock,
      // app switch), not when the re-render gets round to it: on Android that
      // can be only after unlock, which used to count the locked time.
      if (s !== 'active') clockRef.current = setClockRunning(clockRef.current, false, Date.now());
      setAppActive(s === 'active');
    });
    return () => sub.remove();
  }, []);

  const running = phase === 'active' && !paused && isFocused && appActive;

  // ONE clock drives the breathing screen: the phase word, the line under it,
  // the circle and the end are all derived from this breathed time
  // (breathPattern.breathAt), so they can never drift apart, also across
  // pause, Settings and backgrounding (the clock only runs while `running`).
  // The session ends at the last whole out-breath that fits its length
  // (sessionSeconds). Instead of a fixed interval, the next update is
  // scheduled for the next phase change, the next whole second or the end.
  const endMs = session ? sessionSeconds(session.phaseConfig, lengthSec) * 1000 : 0;

  useEffect(() => {
    clockRef.current = setClockRunning(clockRef.current, running, Date.now());
    const read = () => {
      const ms = clockElapsedMs(clockRef.current, Date.now());
      return endMs > 0 ? Math.min(ms, endMs) : ms;
    };
    if (!running || !session) {
      // Show the exact value the clock stopped at.
      setElapsedMs(read());
      return;
    }
    let id: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      // Heartbeat: time is only counted up to the last beat after a gap
      // (sessionClock.beat), so unobserved time never counts. Starting is
      // idempotent and covers a stop by the AppState listener above that
      // React merged with the return to the foreground.
      const now = Date.now();
      clockRef.current = clockBeat(setClockRunning(clockRef.current, true, now), now);
      const ms = read();
      setElapsedMs(ms);
      if (ms >= endMs) return;
      const wait = nextTickMs(session.phaseConfig, ms, endMs) - ms;
      id = setTimeout(tick, Math.max(16, wait));
    };
    tick();
    return () => {
      if (id !== undefined) clearTimeout(id);
    };
  }, [running, session, endMs]);

  // Keep the display awake only while the session is actually running (and
  // release on pause / exit / finish / unmount), so a screen timeout can't
  // interrupt a session the user is breathing through with eyes closed.
  useEffect(() => {
    if (!running) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [running]);

  // Session Complete as soon as the last whole out-breath has finished.
  // A custom recipe is remembered as the last pattern right here, once per
  // finished session and before the check-in, because it is stored only on
  // this phone and a weak connection must not lose it (the check-in has its
  // own Retry). The editor opens with it next time.
  const recipeSavedRef = useRef(false);
  useEffect(() => {
    if (!session || endMs <= 0) return;
    if (phase === 'active' && elapsedMs >= endMs) {
      setPhase('post-mood');
      if (isCustom && !recipeSavedRef.current) {
        recipeSavedRef.current = true;
        void rememberLastPattern(userId, { pattern: session.phaseConfig, lengthSec });
      }
    }
  }, [elapsedMs, phase, session, endMs, isCustom, userId, lengthSec]);

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
      // F-04 (DEEP-AUDIT-3): says exactly what is lost — leaving mid-session
      // posts nothing, so the whole session is discarded, not "progress".
      Alert.alert(
        'End this session?',
        "You're partway through. If you leave now, this session won't be counted and no check-in will be saved.",
        [
          { text: 'Keep going', style: 'cancel' },
          { text: 'End session', style: 'destructive', onPress: action },
        ]
      );
    } else {
      action();
    }
  };

  // F-04: the settings gear does not end the session — the player stays
  // mounted, pauses while unfocused, and resumes on Back — so it must not
  // reuse the destructive "End this session?" dialog above.
  const openSettings = () => {
    if (phase === 'active') {
      Alert.alert(
        'Open Settings?',
        'Your session will pause and you can pick up where you left off.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Open Settings', onPress: () => router.push('/settings') },
        ]
      );
    } else {
      router.push('/settings');
    }
  };

  // Posts the check-in. Shared by Done and by "Save" in the exit prompt
  // below. Resolves true only on success; on failure it leaves saveError set
  // (moods stay in state) so the user can retry instead of losing the session.
  const saveCheckin = async (): Promise<boolean> => {
    if (!session) return false;
    // D-10: never send a null mood to the API.
    if (preMood === null || postMood === null) return false;
    const sessionId = session.id;
    // The seconds actually played (whole breaths), so Insights counts them.
    const durationSec = checkinDurationSec(session.phaseConfig, lengthSec);
    const saved = await runSave(async () => {
      setSaveError(null);
      try {
        await postCheckin({ sessionId, preMood, postMood, durationSec });
        markCheckinSaved();
        return true;
      } catch (err) {
        setSaveError(friendlyError(err));
        return false;
      }
    });
    return saved === true;
  };

  // D-03: at post-mood the session is complete but the check-in is only
  // saved by Done, so X / hardware Back used to discard it silently. Now they
  // ask first. Cancel keeps the user here (an accidental exit costs nothing).
  const handleExitPress = () => {
    if (saving) return; // a save is already in flight
    if (phase === 'post-mood' && (preMood === null || postMood === null)) {
      // D-10: nothing valid to save yet, so don't offer Save.
      Alert.alert('Exit without saving?', "You haven't chosen how you feel yet, so this session won't be saved.", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: exitSession },
      ]);
      return;
    }
    if (phase === 'post-mood') {
      Alert.alert('Save your session?', "Your check-in hasn't been saved yet.", [
        { text: 'Cancel', style: 'cancel' },
        { text: "Don't save", style: 'destructive', onPress: exitSession },
        {
          text: 'Save',
          onPress: async () => {
            if (await saveCheckin()) exitSession();
          },
        },
      ]);
      return;
    }
    confirmIfActive(exitSession);
  };
  const handleSettingsPress = openSettings;

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
  }, [phase, isFocused, saving, preMood, postMood, session]);

  const handleBeginJourney = () => {
    clockRef.current = INITIAL_CLOCK;
    setElapsedMs(0);
    setPhase('active');
  };

  const handlePauseToggle = () => setPaused((p) => !p);

  // FRONTEND-AUDIT-2.md High finding: 3 real states, checked in order, all
  // hooks above already unconditionally declared so this is safe. Beyond
  // this point TypeScript narrows `session` to a real Session (not
  // Session | null) for the rest of the render — the existing phase JSX
  // below needed no changes to account for that, it's the same shape
  // GET /api/sessions already returns as the local catalog used to.
  if (!isCustom && fetchError) {
    return (
      <View style={styles.root}>
        <SessionBackdrop sessionId={null} phase="pre-mood" />
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

  if (!isCustom && sessions === null) {
    return (
      <View style={styles.root}>
        <SessionBackdrop sessionId={null} phase="pre-mood" />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <TopBar onExitPress={handleExitPress} onSettingsPress={handleSettingsPress} />
          <View style={styles.centerState}>
            <ActivityIndicator color="#ffffff" />
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
        <SessionBackdrop sessionId={null} phase="pre-mood" />
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
    // On failure saveCheckin leaves saveError set and we stay on this screen —
    // preMood/postMood are still in state, so Try Again resends the exact same
    // completed session data rather than losing it.
    if (!(await saveCheckin())) return;
    setActiveSessionId(null);
    // D-02: pop back to the (tabs) already underneath instead of
    // replace()-ing onto a second copy of it (one extra tab tree per
    // completed session). dismissTo falls back to replace when '/home'
    // isn't in history (deep link), where there's nothing to duplicate.
    router.dismissTo('/home');
  };

  const elapsedSec = Math.floor(elapsedMs / 1000);
  // The session's real length: whole breaths, ending on an out-breath.
  const totalSec = endMs / 1000;
  const progressPercent = Math.min((elapsedMs / endMs) * 100, 100);
  // Mindful minutes from the seconds actually breathed (at least 1).
  const breathedMinutes = Math.max(1, Math.round(Math.min(elapsedMs, endMs) / 60000));
  const breath = breathAt(session.phaseConfig, elapsedMs);

  // 4-phase pattern (2026-09-17 product decision): exact labels/instruction
  // copy per session — see PROGRESS.md. Deviates from architecture.md:163-168's
  // documented "Inhale.../Hold for 4 seconds" convention; flagged, not silent.
  const PHASE_LABEL: Record<BreathPhase, string> = {
    inhale: 'BREATHE IN',
    hold: 'HOLD',
    exhale: 'BREATHE OUT',
    rest: 'REST',
  };
  const phaseLabel = PHASE_LABEL[breath.phase];
  const phaseSubLabel =
    breath.phase === 'inhale'
      ? `Breathe in slowly for ${session.phaseConfig.inhale} seconds`
      : breath.phase === 'hold'
        ? `Hold gently for ${session.phaseConfig.hold} seconds`
        : breath.phase === 'exhale'
          ? `Breathe out slowly for ${session.phaseConfig.exhale} seconds`
          : `Stay relaxed for ${session.phaseConfig.rest} seconds`;

  return (
    <View style={styles.root}>
      <SessionBackdrop sessionId={session.id} phase={phase} />
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
          <BackdropSpacer />
          <PhaseTransition progress={transitionAnim} style={styles.phaseContainer}>
            {phase === 'pre-mood' && (
              <View style={styles.panel}>
                <View style={styles.preMoodTop}>
                  {/* A custom session's length was chosen in the editor and
                      stays what the link carries: shown, not changeable. */}
                  {isCustom ? (
                    <LengthLabel value={lengthSec} />
                  ) : (
                    <LengthChooser value={lengthSec} onChange={setChosenLength} />
                  )}
                  <Text style={styles.sessionTitle}>{session.title}</Text>
                  <Text style={styles.sessionDescription}>
                    {session.description}
                  </Text>
                  {/* The session's pattern, from the same phaseConfig the
                      breathing timer uses, so it always matches. */}
                  <Text
                    style={styles.sessionDescription}
                    accessibilityLabel={patternLine(session.phaseConfig)}
                  >
                    {`${patternLabel(session.phaseConfig)} · ${patternLine(session.phaseConfig)}`}
                  </Text>
                </View>

                <View style={styles.preMoodBottom}>
                  <Text style={styles.moodQuestion}>How are you feeling?</Text>
                  <MoodScale
                    value={preMood}
                    onChange={setPreMood}
                    style={styles.moodSelector}
                  />
                  {preMood === null && (
                    <Text style={styles.moodHint}>Pick how you&apos;re feeling to begin</Text>
                  )}
                  <Pressable
                    onPress={handleBeginJourney}
                    disabled={preMood === null}
                    accessibilityState={{ disabled: preMood === null }}
                    style={preMood === null && styles.disabledPress}
                  >
                    <LinearGradient
                      colors={
                        preMood === null
                          ? [GLASS_BUTTON_FILL, GLASS_BUTTON_FILL]
                          : [colors.inversePrimary, colors.primaryContainer]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.beginButton, preMood === null && styles.glassButton]}
                    >
                      <Text style={[styles.beginButtonText, preMood === null && styles.glassButtonText]}>
                        Begin Journey
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            )}

            {phase === 'active' && (
              <View style={styles.activeLayout}>
                <BreathCircle
                  label={phaseLabel}
                  phase={breath.phase}
                  step={breath.step}
                  phaseElapsedMs={breath.phaseElapsedMs}
                  phaseDurationMs={breath.phaseDurationMs}
                  paused={!running}
                />
                <Text style={styles.phaseSubLabel}>{phaseSubLabel}</Text>

                <View style={styles.activeFooter}>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeText}>{formatTime(elapsedSec)}</Text>
                    <Text style={styles.timeText}>
                      {formatTime(totalSec)}
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
                  <Pressable
                    onPress={handlePauseToggle}
                    style={styles.pauseButton}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={paused ? 'Resume session' : 'Pause session'}
                  >
                    <MaterialIcons
                      name={paused ? 'play-arrow' : 'pause'}
                      size={24}
                      color="#ffffff"
                    />
                  </Pressable>
                </View>
              </View>
            )}

            {phase === 'post-mood' && (
              <View style={styles.panel}>
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
                    {breathedMinutes} Mindful Minutes
                  </Text>
                </View>

                <View style={styles.postMoodCardInner}>
                  <Text style={styles.moodQuestion}>How do you feel now?</Text>

                  <View style={styles.beforeAfterRow}>
                    <View style={styles.beforeAfterItem}>
                      <View style={styles.beforeAfterEmoji}>
                        <MoodGlyph mood={preMood} size={24} color={colors.onSurfaceVariant} />
                      </View>
                      <Text style={styles.beforeAfterLabel}>Before</Text>
                    </View>
                    <MaterialIcons
                      name="arrow-forward"
                      size={20}
                      color={colors.onSurfaceVariant}
                    />
                    <View style={styles.beforeAfterItem}>
                      <View style={[styles.beforeAfterEmoji, styles.afterEmoji]}>
                        <MoodGlyph mood={postMood} size={30} color={colors.tertiary} />
                      </View>
                      <Text style={[styles.beforeAfterLabel, styles.afterLabel]}>
                        After
                      </Text>
                    </View>
                  </View>

                  <MoodScale value={postMood} onChange={setPostMood} />
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

                {postMood === null && (
                  <Text style={[styles.moodHint, styles.moodHintPost]}>
                    Pick how you feel now to finish
                  </Text>
                )}
                <Pressable
                  onPress={handleDone}
                  disabled={saving || postMood === null}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: saving || postMood === null }}
                  accessibilityHint={postMood === null ? 'Pick how you feel now to finish' : undefined}
                  style={[
                    styles.doneButton,
                    saving && styles.doneButtonDisabled,
                    postMood === null && styles.glassButton,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.onSurface} />
                  ) : (
                    <Text style={[styles.doneButtonText, postMood === null && styles.glassButtonText]}>
                      {saveError ? 'Try Again' : 'Done'}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </PhaseTransition>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#00051a',
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
  // Plain white over the paintings (the scrim in SessionBackdrop sits behind it).
  topBarTitle: {
    ...typography.headlineLgMobile,
    fontSize: 20,
    lineHeight: 28,
    color: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.sectionGap,
  },
  // Loading/error/not-found states (FRONTEND-AUDIT-2.md fix).
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.marginMobile,
  },
  centerStateText: {
    ...typography.headlineLgMobile,
    fontSize: 18,
    lineHeight: 24,
    color: colors.onSurface,
  },
  centerStateSubtext: {
    ...typography.bodyMd,
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
    ...typography.labelSm,
    color: colors.onPrimary,
  },
  // Each phase is centred in the space below the top bar; the cards fit their
  // content instead of stretching to fill the screen.
  phaseContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.base * 2,
  },
  // Before and after: translucent navy glass so the painting shows through.
  panel: {
    padding: spacing.base * 3,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(10,16,40,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  // ---- pre-mood ----
  preMoodTop: {
    gap: spacing.base * 1.5,
  },
  sessionTitle: {
    ...typography.displayTitle,
    color: colors.onSurface,
  },
  sessionDescription: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  preMoodBottom: {
    gap: spacing.base * 2,
    marginTop: spacing.base * 4,
  },
  moodQuestion: {
    ...typography.bodyLg,
    color: colors.onSurface,
    textAlign: 'center',
  },
  moodHint: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  moodHintPost: {
    marginTop: spacing.base * 3,
  },
  // Disabled buttons: glass fill and hairline border instead of a faded colour.
  disabledPress: {
    opacity: 1,
  },
  glassButton: {
    backgroundColor: GLASS_BUTTON_FILL,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  glassButtonText: {
    color: 'rgba(255,255,255,0.6)',
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
    ...typography.headlineLgMobile,
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
  },
  // ---- active ----
  // No card: the circle, instruction and controls sit on the painting. A soft
  // navy text shadow keeps the small text readable over brighter patches.
  activeLayout: {
    alignItems: 'center',
    gap: spacing.base * 3,
  },
  phaseSubLabel: {
    ...typography.bodyMd,
    color: colors.onSurface,
    textAlign: 'center',
    textShadowColor: 'rgba(0,5,26,0.85)',
    textShadowRadius: 8,
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
    ...typography.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
    textShadowColor: 'rgba(0,5,26,0.85)',
    textShadowRadius: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
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
    backgroundColor: 'rgba(10,16,40,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  // ---- post-mood ----
  postMoodTop: {
    alignItems: 'center',
    gap: spacing.base,
  },
  checkBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.tertiaryContainer}4D`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeHeadline: {
    ...typography.displayTitle,
    color: colors.onSurface,
  },
  mindfulMinutes: {
    ...typography.bodyMd,
    color: colors.tertiary,
  },
  postMoodCardInner: {
    backgroundColor: 'rgba(10,16,40,0.35)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.base * 2.5,
    gap: spacing.base * 2,
    marginTop: spacing.base * 3,
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
    height: 32,
    justifyContent: 'center',
    opacity: 0.6,
  },
  afterEmoji: {
    opacity: 1,
  },
  beforeAfterLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  afterLabel: {
    color: colors.tertiary,
  },
  doneButton: {
    marginTop: spacing.base * 3,
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
    ...typography.headlineLgMobile,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurface,
  },
  saveErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
    marginTop: spacing.base * 3,
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
    ...typography.headlineLgMobile,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurface,
  },
  saveErrorSubtext: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
});
