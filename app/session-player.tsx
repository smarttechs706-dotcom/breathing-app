import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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

import { BreathingRing } from '../src/components/BreathingRing';
import { GlassCard } from '../src/components/GlassCard';
import { GradientText } from '../src/components/GradientText';
import { MOOD_EMOJIS, MoodSelector } from '../src/components/MoodSelector';
import { featuredSession, getSessionById } from '../src/data/sessions';
import { useActiveSession } from '../src/state/ActiveSessionContext';
import { colors, radii, spacing, typography } from '../src/theme/tokens';

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

export default function SessionPlayerScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  // Graceful fallback if sessionId is missing/invalid — Home/Library always
  // pass a real id today, so this mainly guards a direct/malformed deep link.
  const session = getSessionById(sessionId ?? '') ?? featuredSession;

  const { setActiveSessionId } = useActiveSession();
  // Marks a session "in progress" for the Player tab (app/(tabs)/player.tsx)
  // for as long as this screen is mounted, in any phase — cleared on exit,
  // completion, or unmount. See architecture.md's "Bottom navigation —
  // Player tab behavior".
  useEffect(() => {
    setActiveSessionId(session.id);
    return () => setActiveSessionId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const [phase, setPhase] = useState<Phase>('pre-mood');
  const [preMood, setPreMood] = useState(3);
  const [postMood, setPostMood] = useState(3);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [paused, setPaused] = useState(false);
  const [breathSubPhase, setBreathSubPhase] = useState<BreathSubPhase>('inhale');

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

  // Elapsed-time timer — only ticks during the active phase, and not while
  // paused.
  useEffect(() => {
    if (phase !== 'active' || paused) return;
    const id = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, paused]);

  // Auto-advance to post-mood once the session's full duration has elapsed.
  useEffect(() => {
    if (phase === 'active' && elapsedSec >= session.durationSec) {
      setPhase('post-mood');
    }
  }, [elapsedSec, phase, session.durationSec]);

  // Breathing sub-phase cycle (inhale -> hold -> exhale -> inhale...),
  // timed from the session's own phaseConfig. Self-scheduling chain since
  // each sub-phase has a different duration.
  useEffect(() => {
    if (phase !== 'active' || paused) return;
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
  }, [phase, paused, breathSubPhase, session.phaseConfig]);

  const exitSession = () => {
    setActiveSessionId(null);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  // architecture.md's back-button spec: during `active`, confirm before
  // exiting; during `pre-mood`/`post-mood`, exit directly. Never steps
  // backward between phases (e.g. active -> pre-mood) — only continues
  // forward or exits entirely.
  const handleExitPress = () => {
    if (phase === 'active') {
      Alert.alert('Exit session?', "Your progress won't be saved", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: exitSession },
      ]);
    } else {
      exitSession();
    }
  };

  // Android hardware back button — same rule as the X button. Re-registers
  // per phase change so the handler always sees the current phase (no
  // stale-closure risk from a listener registered once on mount).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExitPress();
      return true; // we always handle it ourselves, never let it fall through
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleBeginJourney = () => {
    setElapsedSec(0);
    setBreathSubPhase('inhale');
    setPhase('active');
  };

  const handlePauseToggle = () => setPaused((p) => !p);

  const handleDone = () => {
    // TODO: POST /api/checkin { userId, sessionId: session.id, preMood,
    // postMood } once breathing-app-api exists (architecture.md's API
    // contract) — backend doesn't exist yet, so this is a stub for now.
    setActiveSessionId(null);
    router.replace('/home');
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
        <View style={styles.topBar}>
          <Pressable
            onPress={handleExitPress}
            hitSlop={12}
            style={styles.topBarButton}
          >
            <MaterialIcons name="close" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
          <GradientText
            colors={[colors.primary, colors.tertiary]}
            style={styles.topBarTitle}
          >
            Breathe
          </GradientText>
          <Pressable
            onPress={() => {
              // Settings screen doesn't exist yet (build order step 7,
              // needs a design pass first per CLAUDE.md) — no-op for now.
            }}
            hitSlop={12}
            style={styles.topBarButton}
          >
            <MaterialIcons name="settings" size={24} color={colors.primary} />
          </Pressable>
        </View>

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

                <Pressable onPress={handleDone} style={styles.doneButton}>
                  <Text style={styles.doneButtonText}>Done</Text>
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
  doneButtonText: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    color: colors.onSurface,
  },
});
