// Tests for session lengths, the custom pattern limits and parser, and the
// seconds a check-in reports (src/features/session/customPattern.ts), plus
// source checks for where they are used.
// Run with:
//   node --test tests/session/customPattern.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');
const bp = loadTs('src/features/session/breathPattern.ts');
const cp = loadTs('src/features/session/customPattern.ts', { stubs: { './breathPattern': bp } });

const P = (inhale, hold, exhale, rest) => ({ inhale, hold, exhale, rest });

// --- Lengths ------------------------------------------------------------------

test('lengths: 2, 3, 5 and 10 minutes; a built-in session keeps its own length', () => {
  assert.deepEqual([...cp.LENGTH_OPTIONS], [120, 180, 300, 600]);
  assert.equal(cp.DEFAULT_LENGTH_SEC, 300);
  assert.equal(cp.defaultLengthFor(300), 300);
  assert.equal(cp.defaultLengthFor(180), 180, 'the two 3-minute sessions keep 3');
  assert.equal(cp.defaultLengthFor(240), 300, 'anything else starts at 5');
  assert.equal(cp.lengthLabel(120), '2 min');
  assert.equal(cp.lengthSpoken(600), '10 minutes');
  assert.equal(cp.lengthSpoken(60), '1 minute');
});

test('length parameter: only one of the four choices', () => {
  assert.equal(cp.parseLengthParam('300'), 300);
  assert.equal(cp.parseLengthParam('180'), 180);
  for (const bad of ['240', '60', '6000', '300.0', ' 300', '', undefined, null, 300]) {
    assert.equal(cp.parseLengthParam(bad), null, String(bad));
  }
});

// --- Limits -----------------------------------------------------------------------

test('limits: in 2-10, hold 0-10, out 2-12, rest 0-10, one breath at most 30 s, default 4-0-6-0', () => {
  assert.deepEqual(cp.PHASE_LIMITS, {
    inhale: { min: 2, max: 10 },
    hold: { min: 0, max: 10 },
    exhale: { min: 2, max: 12 },
    rest: { min: 0, max: 10 },
  });
  assert.equal(cp.MAX_BREATH_SEC, 30);
  assert.deepEqual(cp.DEFAULT_CUSTOM_PATTERN, P(4, 0, 6, 0));
  assert.equal(cp.isValidCustomPattern(cp.DEFAULT_CUSTOM_PATTERN), true);
  assert.equal(cp.isValidCustomPattern(P(4, 7, 8, 0)), true);
  assert.equal(cp.isValidCustomPattern(P(10, 8, 12, 0)), true, '30 s exactly');
  for (const [bad, why] of [
    [P(1, 0, 6, 0), 'in below 2'],
    [P(11, 0, 6, 0), 'in above 10'],
    [P(4, 11, 6, 0), 'hold above 10'],
    [P(4, 0, 1, 0), 'out below 2'],
    [P(4, 0, 13, 0), 'out above 12'],
    [P(4, 0, 6, 11), 'rest above 10'],
    [P(10, 9, 12, 0), 'one breath 31 s'],
    [P(4, 0.5, 6, 0), 'not whole seconds'],
    [P(4, -1, 6, 0), 'negative'],
    [{ inhale: 4, exhale: 6 }, 'missing phases'],
    [null, 'nothing'],
  ]) {
    assert.equal(cp.isValidCustomPattern(bad), false, why);
  }
});

test('stepper: a step that leaves the limits or the 30 s breath is refused (button disabled)', () => {
  assert.deepEqual(cp.stepPhase(P(4, 0, 6, 0), 'hold', 1), P(4, 1, 6, 0));
  assert.equal(cp.stepPhase(P(4, 0, 6, 0), 'hold', -1), null, 'hold below 0');
  assert.equal(cp.stepPhase(P(2, 0, 6, 0), 'inhale', -1), null, 'in below 2');
  assert.equal(cp.stepPhase(P(10, 8, 12, 0), 'rest', 1), null, 'breath would be 31 s');
  assert.deepEqual(cp.stepPhase(P(10, 8, 12, 0), 'hold', -1), P(10, 7, 12, 0));
});

// --- Link parameters ------------------------------------------------------------

test('pattern parameter: "4-7-8-0" round-trips; anything else is refused', () => {
  assert.equal(cp.formatPatternParam(P(4, 7, 8, 0)), '4-7-8-0');
  assert.deepEqual(cp.parsePatternParam('4-7-8-0'), P(4, 7, 8, 0));
  assert.deepEqual(cp.parsePatternParam(cp.formatPatternParam(P(10, 8, 12, 0))), P(10, 8, 12, 0));
  for (const bad of ['4-7-8', '4-7-8-0-0', '4-7-8-x', '4-7-8--1', '4.5-0-6-0', '99-0-6-0', '10-9-12-0', '', undefined, null, ['4-7-8-0']]) {
    assert.equal(cp.parsePatternParam(bad), null, String(bad));
  }
});

// --- Check-in seconds -----------------------------------------------------------

test('check-in seconds: the time actually played (whole breaths), 60 to 600', () => {
  // 4-7-8 at 5 min: 15 breaths of 19 s = 285 s.
  assert.equal(cp.checkinDurationSec(P(4, 7, 8, 0), 300), 285);
  // Box 4-4-4-4 at 5 min: 18 breaths, ending after the out-breath = 18*16 - 4.
  assert.equal(cp.checkinDurationSec(P(4, 4, 4, 4), 300), 284);
  // 5-5 at 10 min: exactly 600.
  assert.equal(cp.checkinDurationSec(P(5, 0, 5, 0), 600), 600);
  // Every length choice with every built-in pattern stays inside 60-600.
  const builtIns = [P(4, 4, 4, 4), P(5, 0, 5, 0), P(4, 0, 8, 0), P(4, 2, 4, 0), P(4, 4, 6, 0), P(4, 7, 8, 0)];
  for (const p of builtIns) {
    for (const len of cp.LENGTH_OPTIONS) {
      const s = cp.checkinDurationSec(p, len);
      assert.ok(Number.isInteger(s) && s >= 60 && s <= len, `${JSON.stringify(p)} @ ${len}: ${s}`);
    }
  }
  // The longest allowed breath still gives at least 60 s at 2 min.
  assert.ok(cp.checkinDurationSec(P(10, 8, 12, 0), 120) >= 60);
  // Out of range is left out (the check-in still saves without it).
  assert.equal(cp.checkinDurationSec(P(4, 0, 6, 0), 30), undefined);
});

test('custom check-ins use the hidden catalogue id "custom"', () => {
  assert.equal(cp.CUSTOM_SESSION_ID, 'custom');
});

// --- Wiring -----------------------------------------------------------------------

test('player: the chooser (built-in) or the label (custom) replaces the badge; the end and the check-in follow the length', () => {
  const src = read('app/session-player.tsx');
  assert.ok(src.includes('const [chosenLength, setChosenLength] = useState<LengthSec | null>(null);'));
  assert.ok(src.includes('const lengthSec: LengthSec = chosenLength ?? defaultLengthFor(session?.durationSec ?? DEFAULT_LENGTH_SEC);'));
  assert.ok(src.includes('<LengthChooser value={lengthSec} onChange={setChosenLength} />'));
  assert.ok(src.includes('const durationSec = checkinDurationSec(session.phaseConfig, lengthSec);'));
  assert.ok(src.includes('await postCheckin({ sessionId, preMood, postMood, durationSec });'));
  assert.ok(!/MIN SESSION|formatDurationBadge|durationBadge/.test(src), 'old badge gone');
  // The chooser and the label are only on the before-session panel.
  const pre = src.slice(src.indexOf("{phase === 'pre-mood' && ("), src.indexOf("{phase === 'active' && ("));
  assert.ok(pre.includes('<LengthChooser'));
  assert.ok(pre.includes('<LengthLabel'));
  assert.equal((src.match(/<LengthChooser/g) || []).length, 1);
  assert.equal((src.match(/<LengthLabel/g) || []).length, 1);
});

test('player: a custom session shows its length as a label, not the chooser; the length is what the link carries', () => {
  const src = read('app/session-player.tsx');
  const pre = src.slice(src.indexOf("{phase === 'pre-mood' && ("), src.indexOf("{phase === 'active' && ("));
  assert.ok(
    pre.includes(
      [
        '{isCustom ? (',
        '                    <LengthLabel value={lengthSec} />',
        '                  ) : (',
        '                    <LengthChooser value={lengthSec} onChange={setChosenLength} />',
        '                  )}',
      ].join('\n')
    ),
    'label for custom, chooser for built-in'
  );
  // setChosenLength is only reachable through the chooser, so for a custom
  // session the length stays the link's (chosenLength stays null).
  assert.equal((src.match(/setChosenLength/g) || []).length, 2, 'declared once, used once (the chooser)');
  for (const len of cp.LENGTH_OPTIONS) {
    const s = cp.customSession('4-7-8-0', String(len));
    assert.equal(s.durationSec, len);
    assert.equal(cp.defaultLengthFor(s.durationSec), len, `${len}: the link's length is used as is`);
  }
});

test('length label (custom): not interactive, read as "Session length, 5 minutes"', () => {
  assert.equal(cp.lengthLabelSpoken(300), 'Session length, 5 minutes');
  assert.equal(cp.lengthLabelSpoken(120), 'Session length, 2 minutes');
  const src = read('src/features/session/LengthChooser.tsx');
  const label = src.slice(src.indexOf('export function LengthLabel'));
  assert.ok(label.includes('accessibilityRole="text"'));
  assert.ok(label.includes('accessibilityLabel={lengthLabelSpoken(value)}'));
  assert.ok(label.includes('{lengthLabel(value)}'));
  assert.ok(!/Pressable|onPress|accessibilityRole="(button|radio)"/.test(label.slice(0, label.indexOf('const styles'))), 'not interactive');
});

test('length chooser (built-in): four pills of equal width in one row, never a second row', () => {
  const src = read('src/features/session/LengthChooser.tsx');
  const style = (name) => {
    const m = src.match(new RegExp('\\n  ' + name + ': \\{([^}]*)\\}'));
    assert.ok(m, name);
    return m[1];
  };
  assert.ok(!src.includes('flexWrap'), 'no wrapping onto a second row');
  assert.ok(style('row').includes("flexDirection: 'row'"));
  assert.ok(style('row').includes('gap: spacing.base,'));
  assert.ok(style('choice').includes('flex: 1,'), 'equal width: a quarter each');
  assert.ok(style('choice').includes('paddingHorizontal: spacing.base * 0.5,'));
  assert.ok(src.includes('style={[styles.pill, styles.choice, selected && styles.pillSelected]}'));
  // Large system font: the label may break between words inside its pill; it is
  // never shrunk, capped or cut.
  assert.ok(style('label').includes("textAlign: 'center'"));
  assert.ok(!/numberOfLines|adjustsFontSizeToFit|maxFontSizeMultiplier|allowFontScaling/.test(src));
  // Same text role and colours as before.
  assert.ok(style('label').includes('...typography.labelSm,'));
  assert.ok(style('label').includes('color: colors.onSurfaceVariant,'));
  assert.ok(style('pillSelected').includes('backgroundColor: colors.inversePrimary,'));
  assert.ok(style('labelSelected').includes("color: '#ffffff',"));
  // Spacing from the 8-pt tokens only.
  for (const m of src.matchAll(/(?:gap|padding\w*|minHeight): ([^,]+),/g)) {
    assert.ok(m[1].startsWith('spacing.base'), m[0]);
  }
});

test('check-in payload: optional durationSec, sent only when present', () => {
  assert.ok(read('src/state/pendingCheckin.ts').includes('durationSec?: number;'));
  const client = read('src/api/client.ts');
  assert.ok(client.includes('const { sessionId, preMood, postMood, durationSec } = checkin;'));
  assert.ok(client.includes('body: JSON.stringify({ sessionId, preMood, postMood, durationSec }),'));
  // JSON.stringify leaves an undefined field out, so older payloads look as before.
  assert.equal(JSON.stringify({ sessionId: 'x', preMood: 2, postMood: 4, durationSec: undefined }), '{"sessionId":"x","preMood":2,"postMood":4}');
});

test('length chooser: a radio group named "Session length", each choice spoken in minutes', () => {
  const src = read('src/features/session/LengthChooser.tsx');
  assert.ok(src.includes('accessibilityRole="radiogroup" accessibilityLabel="Session length"'));
  assert.ok(src.includes('accessibilityRole="radio"'));
  assert.ok(src.includes('accessibilityLabel={lengthSpoken(sec)}'));
  assert.ok(src.includes('accessibilityState={{ selected, checked: selected }}'));
  assert.ok(src.includes('{lengthLabel(sec)}'));
  assert.ok(!/fontFamily:|fontWeight:|fontSize:/.test(src), 'text roles only');
});

test('no long dashes or emoji in the new files', () => {
  for (const f of ['src/features/session/customPattern.ts', 'src/features/session/LengthChooser.tsx']) {
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(read(f)), f);
  }
});

// --- Part 2: playing a custom session -------------------------------------------

test('custom session: built from the link, hidden id "custom", null for a broken link', () => {
  const s = cp.customSession('4-7-8-0', '600');
  assert.deepEqual(s, {
    id: 'custom',
    title: 'Your pattern',
    category: 'Calm',
    durationSec: 600,
    phaseConfig: P(4, 7, 8, 0),
    badge: 'Leaf',
    pattern: 'rings',
    description: 'A pattern you set yourself.',
  });
  assert.equal(cp.customSession('4-7-8-0', '240'), null, 'not a length choice');
  assert.equal(cp.customSession('10-9-12-0', '300'), null, 'one breath 31 s');
  assert.equal(cp.customSession(undefined, '300'), null);
  assert.equal(cp.customSession('4-7-8-0', undefined), null);
});

test('links: the player and the editor', () => {
  assert.equal(cp.customPlayerHref(P(4, 7, 8, 0), 300), '/session-player?sessionId=custom&pattern=4-7-8-0&length=300');
  assert.equal(cp.EDITOR_HREF, '/create-pattern');
  // What the editor links to, the player reads back.
  const href = cp.customPlayerHref(P(5, 2, 7, 1), 180);
  const q = new URLSearchParams(href.split('?')[1]);
  assert.deepEqual(cp.customSession(q.get('pattern'), q.get('length')).phaseConfig, P(5, 2, 7, 1));
  // No Edit link parameters any more.
  assert.ok(!href.includes('from'));
});

test('screen reader wording: steppers, label, Start, safety note', () => {
  assert.equal(cp.stepperSpoken('inhale', 4), 'Breathe in, 4 seconds');
  assert.equal(cp.stepperSpoken('hold', 0), 'Hold, 0 seconds');
  assert.equal(cp.stepperSpoken('hold', 1), 'Hold, 1 second');
  assert.equal(cp.stepperSpoken('exhale', 8), 'Breathe out, 8 seconds');
  assert.equal(cp.stepperSpoken('rest', 2), 'Rest, 2 seconds');
  assert.equal(cp.patternSpoken(P(4, 7, 8, 0)), 'Pattern 4-7-8: breathe in 4, hold 7, breathe out 8');
  assert.equal(cp.patternSpoken(P(4, 0, 6, 0)), 'Pattern 4-6: breathe in 4, breathe out 6');
  assert.equal(cp.startText(300), 'Start · 5 min');
  assert.equal(cp.startSpoken(P(4, 7, 8, 0), 300), 'Start, 5 minute session, pattern 4-7-8');
  assert.equal(
    cp.SAFETY_NOTE,
    "Long holds aren't for everyone. If you feel dizzy or short of breath, stop and breathe normally."
  );
});

// --- Wiring -----------------------------------------------------------------------

test('player: plays a custom session from the link without the catalogue', () => {
  const src = read('app/session-player.tsx');
  assert.ok(src.includes('const isCustom = sessionId === CUSTOM_SESSION_ID;'));
  assert.ok(src.includes('(isCustom ? customSession(pattern, length) : null)'));
  assert.ok(src.includes('const session = isCustom ? custom : (sessions?.find((s) => s.id === sessionId) ?? null);'));
  assert.ok(src.includes('if (isCustom) return; // played from the link, not the catalogue'));
  assert.ok(src.includes('if (!isCustom && fetchError) {'));
  assert.ok(src.includes('if (!isCustom && sessions === null) {'));
  // The check-in is unchanged: id "custom", the seconds played.
  assert.ok(src.includes('await postCheckin({ sessionId, preMood, postMood, durationSec });'));
  // The Player tab can come back to it with its pattern.
  assert.ok(src.includes('isCustom ? customPlayerHref(session.phaseConfig, defaultLengthFor(session.durationSec)) : undefined'));
});

test('player: the last pattern is stored once when the breathing ends, not inside the check-in code', () => {
  const src = read('app/session-player.tsx');
  const end = src.slice(src.indexOf('const recipeSavedRef = useRef(false);'), src.indexOf('const exitSession = () => {'));
  assert.ok(end.includes("if (phase === 'active' && elapsedMs >= endMs) {"));
  assert.ok(end.includes('if (isCustom && !recipeSavedRef.current) {'));
  assert.ok(end.includes('recipeSavedRef.current = true;'));
  assert.ok(end.includes('void rememberLastPattern(userId, { pattern: session.phaseConfig, lengthSec });'));
  assert.equal((src.match(/rememberLastPattern\(/g) || []).length, 1, 'stored in one place only');
  const save = src.slice(src.indexOf('const saveCheckin = async'), src.indexOf('const handleExitPress'));
  assert.ok(save.includes('await postCheckin('), 'slice is the check-in code');
  assert.ok(!save.includes('rememberLastPattern'), 'not tied to the check-in');
});

test('editor: opens with the last pattern; steppers, live label, preview circle, length, safety note, Start', () => {
  const src = read('app/create-pattern.tsx');
  assert.ok(read('app/_layout.tsx').includes('<Stack.Screen name="create-pattern" />'));
  // Prefilled from the one remembered recipe (the default when none or broken),
  // shown only once it has been read, so the numbers never jump.
  assert.ok(src.includes('loadLastPattern(userId).then((recipe) => {'));
  assert.ok(src.includes('{initial && <PatternEditor initial={initial} />}'));
  assert.ok(src.includes('const [pattern, setPattern] = useState<BreathPattern>(initial.pattern);'));
  assert.ok(src.includes('const [lengthSec, setLengthSec] = useState<LengthSec>(initial.lengthSec);'));
  assert.ok(!src.includes('useLocalSearchParams'), 'no link parameters (no Edit)');
  assert.ok(src.includes('accessibilityLabel={patternSpoken(pattern)}'));
  assert.ok(src.includes('{patternLabel(pattern)}'));
  assert.ok(src.includes('<PatternPreview pattern={pattern} />'));
  assert.ok(src.includes('<BreathCircle'));
  assert.ok(src.includes('<LengthChooser value={lengthSec} onChange={setLengthSec} />'));
  // Steppers: one adjustable control each, buttons disabled outside the limits.
  assert.ok(src.includes('accessibilityRole="adjustable"'));
  assert.ok(src.includes('accessibilityLabel={stepperSpoken(phase, pattern[phase])}'));
  assert.ok(src.includes("{ name: 'increment', label: 'Increase' }"));
  assert.ok(src.includes("{ name: 'decrement', label: 'Decrease' }"));
  assert.ok(src.includes('const down = stepPhase(pattern, phase, -1);'));
  assert.ok(src.includes('const up = stepPhase(pattern, phase, 1);'));
  assert.ok(src.includes('disabled={!down}') && src.includes('disabled={!up}'));
  // Safety note: shown under Hold, read with the Hold stepper.
  assert.ok(src.includes("{phase === 'hold' && ("));
  assert.ok(src.includes("accessibilityHint={phase === 'hold' ? SAFETY_NOTE : undefined}"));
  // Start opens the player with the recipe; nothing is stored here.
  assert.ok(src.includes('router.push(customPlayerHref(pattern, lengthSec) as Href)'));
  assert.ok(src.includes('accessibilityLabel={startSpoken(pattern, lengthSec)}'));
  assert.ok(src.includes('{startText(lengthSec)}'));
  assert.ok(!src.includes('rememberLastPattern'));
  // The preview circle is decorative.
  assert.ok(src.includes('importantForAccessibility="no-hide-descendants"'));
});

test('library: the slim "Create your own" row under the chips; nothing about the last pattern', () => {
  const src = read('src/features/library/LibraryScreen.tsx');
  assert.ok(src.includes('accessibilityLabel="Create your own pattern"'));
  assert.ok(src.includes('router.push(EDITOR_HREF as Href)'));
  // Order: search, chips, "Create your own", then the session list (Quick
  // Start was removed). Every marker must exist (indexOf -1 would pass).
  const order = [
    'placeholder="Search sessions..."',
    '{CATEGORIES.map((category) => {',
    'accessibilityLabel="Create your own pattern"',
    '<View style={styles.cards}>',
  ].map((marker) => {
    const at = src.indexOf(marker);
    assert.ok(at >= 0, marker);
    return at;
  });
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  // A slim row: title and the one-line description, neither wraps.
  assert.ok(src.includes('<Text style={styles.createTitle} numberOfLines={1}>\n                  Create your own'));
  assert.ok(src.includes('<Text style={styles.createSubtitle} numberOfLines={1}>\n                  Set your own pattern and length'));
  // The "Your patterns" row, its hold actions and the list store are gone.
  for (const gone of ['Your patterns', 'savedPatterns', 'onLongPress', 'Alert', 'useFocusEffect', 'lastPattern', 'customPlayerHref']) {
    assert.ok(!src.includes(gone), gone);
  }
});

test('the saved list, Edit flow and limit of 8 are gone from the app', () => {
  for (const f of ['src/features/session/savedPatterns.ts', 'src/features/session/savedPatternsStore.ts']) {
    assert.ok(!fs.existsSync(path.join(repo, f)), `${f} removed`);
  }
  const files = ['app/session-player.tsx', 'app/create-pattern.tsx', 'src/features/library/LibraryScreen.tsx', 'src/features/session/customPattern.ts', 'src/utils/deleteMyData.ts'];
  for (const f of files) {
    const src = read(f);
    for (const gone of ['savedPatterns', 'fromLength', 'parseRecipe', 'editorHref', 'SAVED_CARD_HINT', 'savedCardSpoken', 'MAX_SAVED']) {
      assert.ok(!src.includes(gone), `${f}: ${gone}`);
    }
  }
  for (const gone of ['savedCardSpoken', 'SAVED_CARD_HINT', 'parseRecipe', 'editorHref']) {
    assert.equal(cp[gone], undefined, gone);
  }
});

test('Player tab returns to the player by its own link; Delete account clears the last pattern', () => {
  assert.ok(read('src/state/ActiveSessionContext.tsx').includes('href: href ?? `/session-player?sessionId=${id}`'));
  assert.ok(read('app/(tabs)/player.tsx').includes('router.replace(activeSessionHref as Href);'));
  assert.ok(read('src/utils/deleteMyData.ts').includes('() => clearLastPattern(userId),'));
  // Sign-out keeps it: only Delete account clears.
  for (const f of ['app/settings.tsx', 'src/auth/AuthProvider.tsx', 'src/features/profile/ProfileScreen.tsx']) {
    assert.ok(!read(f).includes('clearLastPattern'), f);
  }
});

test('custom pattern files: text roles only, no long dashes or emoji', () => {
  for (const f of ['app/create-pattern.tsx', 'src/features/session/lastPattern.ts', 'src/features/session/lastPatternStore.ts']) {
    const src = read(f);
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(src), f);
    assert.ok(!/fontFamily:|fontWeight:|fontSize:/.test(src), `${f}: text roles only`);
  }
});
