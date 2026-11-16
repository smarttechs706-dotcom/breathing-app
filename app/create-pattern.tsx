import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useIsFocused, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BreathCircle } from '../src/features/session/BreathCircle';
import { breathAt, nextTickMs, patternLabel, patternLine, type BreathPattern } from '../src/features/session/breathPattern';
import {
  customPlayerHref,
  DEFAULT_CUSTOM_PATTERN,
  DEFAULT_LENGTH_SEC,
  parseLengthParam,
  parsePatternParam,
  parseRecipe,
  PHASE_NAMES,
  PHASES,
  patternSpoken,
  SAFETY_NOTE,
  startSpoken,
  startText,
  stepPhase,
  stepperSpoken,
  type LengthSec,
  type PhaseName,
} from '../src/features/session/customPattern';
import { LengthChooser } from '../src/features/session/LengthChooser';
import { accents, text } from '../src/features/home/styles';
import { MIST_BACKGROUND, ScreenBackdrop } from '../src/features/profile/ScreenBackdrop';
import { colors, spacing, typography } from '../src/theme/tokens';

// "Create your own": the full-screen editor opened from Library's card (or
// from Edit on a "Your patterns" card, with ?pattern=4-7-8-0&length=300).
// Four steppers in whole seconds inside the limits in customPattern.ts, a live
// pattern label, a small breathing circle running the pattern, the length
// choice, the safety note under Hold, and one Start button that opens the
// player. Nothing is saved here: the recipe is kept in "Your patterns" when
// its session reaches the end (app/session-player.tsx).
// Built in the existing glass card style (no Stitch reference for this screen).

const CARD_RADIUS = 16;
// The preview circle is the player's BreathCircle (300 dp) drawn at 0.6.
const PREVIEW_SCALE = 0.6;
const PREVIEW_SIZE = 300 * PREVIEW_SCALE;
const PHASE_WORD: Record<PhaseName, string> = {
  inhale: 'BREATHE IN',
  hold: 'HOLD',
  exhale: 'BREATHE OUT',
  rest: 'REST',
};

export default function CreatePatternScreen() {
  const params = useLocalSearchParams<{ pattern?: string; length?: string }>();
  const [pattern, setPattern] = useState<BreathPattern>(
    () => parsePatternParam(params.pattern) ?? DEFAULT_CUSTOM_PATTERN
  );
  const [lengthSec, setLengthSec] = useState<LengthSec>(() => parseLengthParam(params.length) ?? DEFAULT_LENGTH_SEC);
  // Opened through Edit: the card being edited, replaced when the edited
  // session's breathing ends (savedPatterns.replaceSaved).
  const [editing] = useState(() => parseRecipe(params.pattern, params.length));

  const close = () => (router.canGoBack() ? router.back() : router.replace('/library'));
  const start = () => router.push(customPlayerHref(pattern, lengthSec, editing) as Href);

  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={close}
            hitSlop={12}
            style={styles.topBarButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Create your own
          </Text>
          <View style={styles.topBarButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Live label: the same patternLabel the cards and the player show. */}
          <View style={styles.labelBlock} accessible accessibilityLabel={patternSpoken(pattern)}>
            <Text style={styles.patternLabel}>{patternLabel(pattern)}</Text>
            <Text style={styles.patternLine}>{patternLine(pattern)}</Text>
          </View>

          <PatternPreview pattern={pattern} />

          <View style={styles.card}>
            {PHASES.map((phase, i) => (
              <View key={phase}>
                {i > 0 && <View style={styles.divider} />}
                <Stepper phase={phase} pattern={pattern} onChange={setPattern} />
                {phase === 'hold' && (
                  // Read with the Hold stepper (its hint), so not twice.
                  <Text style={styles.safetyNote} importantForAccessibility="no" accessibilityElementsHidden>
                    {SAFETY_NOTE}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.lengthBlock}>
            <Text style={styles.sectionLabel}>Length</Text>
            <LengthChooser value={lengthSec} onChange={setLengthSec} />
          </View>

          {/* Library's Quick Start gradient: white text stays >= 6.47:1 (AUDIT-2.md). */}
          <Pressable onPress={start} accessibilityRole="button" accessibilityLabel={startSpoken(pattern, lengthSec)}>
            <LinearGradient
              colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.startButton}
            >
              <Text style={styles.startButtonText}>{startText(lengthSec)}</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// One phase: name, "4 s" and - / + buttons. A button is disabled when the
// step would leave the limits or make one breath longer than 30 s
// (stepPhase returns null). Screen readers hear one adjustable control,
// "Breathe in, 4 seconds", with Increase / Decrease actions.
function Stepper({
  phase,
  pattern,
  onChange,
}: {
  phase: PhaseName;
  pattern: BreathPattern;
  onChange: (p: BreathPattern) => void;
}) {
  const down = stepPhase(pattern, phase, -1);
  const up = stepPhase(pattern, phase, 1);
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={stepperSpoken(phase, pattern[phase])}
      accessibilityHint={phase === 'hold' ? SAFETY_NOTE : undefined}
      accessibilityActions={[
        { name: 'increment', label: 'Increase' },
        { name: 'decrement', label: 'Decrease' },
      ]}
      onAccessibilityAction={(e) => {
        const next = e.nativeEvent.actionName === 'increment' ? up : down;
        if (next) onChange(next);
      }}
    >
      <Text style={styles.stepperName}>{PHASE_NAMES[phase]}</Text>
      <View style={styles.stepperControls}>
        <StepButton icon="remove" disabled={!down} onPress={() => down && onChange(down)} />
        <Text style={styles.stepperValue}>{`${pattern[phase]} s`}</Text>
        <StepButton icon="add" disabled={!up} onPress={() => up && onChange(up)} />
      </View>
    </View>
  );
}

function StepButton({ icon, disabled, onPress }: { icon: 'add' | 'remove'; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[styles.stepButton, disabled && styles.stepButtonDisabled]}
    >
      <Ionicons name={icon} size={20} color="#ffffff" />
    </Pressable>
  );
}

// The player's breathing circle running the pattern on its own preview clock,
// restarting whenever the pattern changes. Stops while this screen is covered
// (the player on top). Still with reduced motion (BreathCircle). Decorative:
// the label above already says the pattern.
function PatternPreview({ pattern }: { pattern: BreathPattern }) {
  const focused = useIsFocused();
  const [elapsedMs, setElapsedMs] = useState(0);
  const key = `${pattern.inhale}-${pattern.hold}-${pattern.exhale}-${pattern.rest}`;

  useEffect(() => {
    setElapsedMs(0);
    if (!focused) return;
    const startedAt = Date.now();
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const ms = Date.now() - startedAt;
      setElapsedMs(ms);
      id = setTimeout(tick, Math.max(16, nextTickMs(pattern, ms, Number.POSITIVE_INFINITY) - ms));
    };
    tick();
    return () => clearTimeout(id);
    // The pattern is read through `key`, so a new object with the same numbers doesn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, focused]);

  const breath = breathAt(pattern, elapsedMs);
  return (
    <View style={styles.preview} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.previewScale}>
        <BreathCircle
          label={PHASE_WORD[breath.phase]}
          phase={breath.phase}
          step={breath.step}
          phaseElapsedMs={breath.phaseElapsedMs}
          phaseDurationMs={breath.phaseDurationMs}
          paused={!focused}
        />
      </View>
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
    paddingHorizontal: spacing.gutter,
    height: 64,
  },
  topBarButton: {
    width: 40,
    padding: spacing.base,
  },
  title: {
    ...text.sectionTitle,
    color: '#ffffff',
  },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.base * 4,
    gap: spacing.base * 3,
  },
  labelBlock: {
    alignItems: 'center',
    gap: spacing.base * 0.5,
  },
  patternLabel: {
    ...typography.displayTitle,
    color: '#ffffff',
  },
  patternLine: {
    ...text.body,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  preview: {
    alignSelf: 'center',
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewScale: {
    transform: [{ scale: PREVIEW_SCALE }],
  },
  // Library's light glass (search field, chips).
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: accents.glassBorder,
    backgroundColor: accents.glassFill,
    paddingHorizontal: spacing.base * 2,
  },
  divider: {
    height: 1,
    backgroundColor: accents.glassBorder,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  stepperName: {
    ...text.link,
    color: '#ffffff',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 1.5,
  },
  stepperValue: {
    ...text.link,
    color: '#ffffff',
    minWidth: 40,
    textAlign: 'center',
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: accents.glassBorder,
    backgroundColor: 'rgba(10,16,40,0.6)',
  },
  stepButtonDisabled: {
    opacity: 0.35,
  },
  safetyNote: {
    ...text.cardMeta,
    color: colors.onSurfaceVariant,
    paddingBottom: spacing.base * 2,
  },
  lengthBlock: {
    gap: spacing.base * 1.5,
  },
  sectionLabel: {
    ...text.link,
    color: '#ffffff',
  },
  startButton: {
    height: 56,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    ...text.link,
    color: '#ffffff',
  },
});
