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

test('player: the length chooser replaces the badge; the end and the check-in follow the chosen length', () => {
  const src = read('app/session-player.tsx');
  assert.ok(src.includes('const [chosenLength, setChosenLength] = useState<LengthSec | null>(null);'));
  assert.ok(src.includes('const lengthSec: LengthSec = chosenLength ?? defaultLengthFor(session?.durationSec ?? DEFAULT_LENGTH_SEC);'));
  assert.ok(src.includes('<LengthChooser value={lengthSec} onChange={setChosenLength} />'));
  assert.ok(src.includes('const durationSec = checkinDurationSec(session.phaseConfig, lengthSec);'));
  assert.ok(src.includes('await postCheckin({ sessionId, preMood, postMood, durationSec });'));
  assert.ok(!/MIN SESSION|formatDurationBadge|durationBadge/.test(src), 'old badge gone');
  // The chooser is only on the before-session panel.
  const pre = src.slice(src.indexOf("{phase === 'pre-mood' && ("), src.indexOf("{phase === 'active' && ("));
  assert.ok(pre.includes('<LengthChooser'));
  assert.equal((src.match(/<LengthChooser/g) || []).length, 1);
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
  assert.equal(cp.editorHref(), '/create-pattern');
  assert.equal(cp.editorHref(P(4, 4, 4, 4), 120), '/create-pattern?pattern=4-4-4-4&length=120');
  // What the editor links to, the player reads back.
  const href = cp.customPlayerHref(P(5, 2, 7, 1), 180);
  const q = new URLSearchParams(href.split('?')[1]);
  assert.deepEqual(cp.customSession(q.get('pattern'), q.get('length')).phaseConfig, P(5, 2, 7, 1));
});

test('screen reader wording: steppers, label, Start, cards, safety note', () => {
  assert.equal(cp.stepperSpoken('inhale', 4), 'Breathe in, 4 seconds');
  assert.equal(cp.stepperSpoken('hold', 0), 'Hold, 0 seconds');
  assert.equal(cp.stepperSpoken('hold', 1), 'Hold, 1 second');
  assert.equal(cp.stepperSpoken('exhale', 8), 'Breathe out, 8 seconds');
  assert.equal(cp.stepperSpoken('rest', 2), 'Rest, 2 seconds');
  assert.equal(cp.patternSpoken(P(4, 7, 8, 0)), 'Pattern 4-7-8: breathe in 4, hold 7, breathe out 8');
  assert.equal(cp.patternSpoken(P(4, 0, 6, 0)), 'Pattern 4-6: breathe in 4, breathe out 6');
  assert.equal(cp.startText(300), 'Start · 5 min');
  assert.equal(cp.startSpoken(P(4, 7, 8, 0), 300), 'Start, 5 minute session, pattern 4-7-8');
  assert.equal(cp.savedCardSpoken(P(4, 7, 8, 0), 300), 'Your pattern 4-7-8, 5 minutes. Start');
  assert.equal(cp.SAVED_CARD_HINT, 'Hold for edit or remove');
  assert.equal(
    cp.SAFETY_NOTE,
    "Long holds aren't for everyone. If you feel dizzy or short of breath, stop and breathe normally."
  );
});

// --- Part 2: wiring ---------------------------------------------------------------

test('player: plays a custom session from the link without the catalogue', () => {
  const src = read('app/session-player.tsx');
  assert.ok(src.includes('const isCustom = sessionId === CUSTOM_SESSION_ID;'));
  assert.ok(src.includes('(isCustom ? customSession(pattern, length) : null)'));
  assert.ok(src.includes('const session = isCustom ? custom : (sessions?.find((s) => s.id === sessionId) ?? null);'));
  assert.ok(src.includes('if (isCustom) return; // played from the link, not the catalogue'));
  assert.ok(src.includes('if (!isCustom && fetchError) {'));
  assert.ok(src.includes('if (!isCustom && sessions === null) {'));
  // Its check-in goes out like any other: id "custom", the seconds played.
  assert.ok(src.includes('await postCheckin({ sessionId, preMood, postMood, durationSec });'));
  // The Player tab can come back to it with its pattern.
  assert.ok(src.includes('isCustom ? customPlayerHref(session.phaseConfig, defaultLengthFor(session.durationSec), replaces) : undefined'));
});

test('player: the recipe is saved once when the breathing ends, before and apart from the check-in', () => {
  const src = read('app/session-player.tsx');
  const end = src.slice(src.indexOf('const recipeSavedRef = useRef(false);'), src.indexOf('const exitSession = () => {'));
  assert.ok(end.includes("if (phase === 'active' && elapsedMs >= endMs) {"));
  assert.ok(end.includes('if (isCustom && !recipeSavedRef.current) {'));
  assert.ok(end.includes('recipeSavedRef.current = true;'));
  assert.ok(end.includes('void rememberPattern(userId, { pattern: session.phaseConfig, lengthSec }, replaces);'));
  assert.equal((src.match(/rememberPattern\(/g) || []).length, 1, 'saved in one place only');
  const save = src.slice(src.indexOf('const saveCheckin = async'), src.indexOf('const handleExitPress'));
  assert.ok(!save.includes('rememberPattern'), 'not tied to the check-in');
});

test('editor: steppers, live label, preview circle, length, safety note under Hold, Start', () => {
  const src = read('app/create-pattern.tsx');
  assert.ok(read('app/_layout.tsx').includes('<Stack.Screen name="create-pattern" />'));
  assert.ok(src.includes('parsePatternParam(params.pattern) ?? DEFAULT_CUSTOM_PATTERN'));
  assert.ok(src.includes('parseLengthParam(params.length) ?? DEFAULT_LENGTH_SEC'));
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
  // Start opens the player with the recipe; nothing is saved here.
  assert.ok(src.includes('router.push(customPlayerHref(pattern, lengthSec, editing) as Href)'));
  assert.ok(src.includes('accessibilityLabel={startSpoken(pattern, lengthSec)}'));
  assert.ok(src.includes('{startText(lengthSec)}'));
  assert.ok(!src.includes('rememberPattern'));
  // The preview circle is decorative.
  assert.ok(src.includes('importantForAccessibility="no-hide-descendants"'));
});

test('library: "Create your own" card and the "Your patterns" row', () => {
  const src = read('src/features/library/LibraryScreen.tsx');
  assert.ok(src.includes('accessibilityLabel="Create your own pattern"'));
  assert.ok(src.includes('router.push(editorHref() as Href)'));
  // Above search, chips and Quick Start.
  assert.ok(src.indexOf('Create your own</Text>') < src.indexOf('placeholder="Search sessions..."'));
  assert.ok(src.indexOf('Your patterns') < src.indexOf('placeholder="Search sessions..."'));
  assert.ok(src.includes('{saved.length > 0 && ('), 'no empty row');
  assert.ok(src.includes('loadSavedPatterns(userId)'));
  assert.ok(src.includes('useFocusEffect('), 're-read when Library comes into view');
  assert.ok(src.includes('accessibilityLabel={savedCardSpoken(item.pattern, item.lengthSec)}'));
  assert.ok(src.includes('accessibilityHint={SAVED_CARD_HINT}'));
  assert.ok(src.includes('onLongPress={() => savedOptions(item)}'));
  assert.ok(src.includes("{ name: 'edit', label: 'Edit' }"));
  assert.ok(src.includes("{ name: 'remove', label: 'Remove' }"));
  assert.ok(src.includes('router.push(customPlayerHref(item.pattern, item.lengthSec) as Href)'));
  assert.ok(src.includes('router.push(editorHref(item.pattern, item.lengthSec) as Href)'));
});

test('Player tab returns to the player by its own link; Delete account clears "Your patterns"', () => {
  assert.ok(read('src/state/ActiveSessionContext.tsx').includes('href: href ?? `/session-player?sessionId=${id}`'));
  assert.ok(read('app/(tabs)/player.tsx').includes('router.replace(activeSessionHref as Href);'));
  assert.ok(read('src/utils/deleteMyData.ts').includes('() => clearSavedPatterns(userId),'));
  // Sign-out keeps them: only Delete account clears.
  for (const f of ['app/settings.tsx', 'src/auth/AuthProvider.tsx', 'src/features/profile/ProfileScreen.tsx']) {
    assert.ok(!read(f).includes('clearSavedPatterns'), f);
  }
});

test('Part 2 files: text roles only, no long dashes or emoji', () => {
  for (const f of ['app/create-pattern.tsx', 'src/features/session/savedPatterns.ts', 'src/features/session/savedPatternsStore.ts']) {
    const src = read(f);
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(src), f);
    assert.ok(!/fontFamily:|fontWeight:|fontSize:/.test(src), `${f}: text roles only`);
  }
});

test('Edit: the editor passes the card it was opened from to the player, which replaces it', () => {
  // Link: the card rides along as from / fromLength, and reads back.
  const href = cp.customPlayerHref(P(4, 6, 8, 0), 600, { pattern: P(4, 7, 8, 0), lengthSec: 300 });
  assert.equal(href, '/session-player?sessionId=custom&pattern=4-6-8-0&length=600&from=4-7-8-0&fromLength=300');
  const q = new URLSearchParams(href.split('?')[1]);
  assert.deepEqual(cp.parseRecipe(q.get('from'), q.get('fromLength')), { pattern: P(4, 7, 8, 0), lengthSec: 300 });
  assert.equal(cp.customPlayerHref(P(4, 6, 8, 0), 600, null), '/session-player?sessionId=custom&pattern=4-6-8-0&length=600');
  assert.equal(cp.parseRecipe('4-7-8-0', undefined), null);
  assert.equal(cp.parseRecipe(undefined, '300'), null);

  // Editor: only a filled-in editor (Edit) has a card to replace.
  const editor = read('app/create-pattern.tsx');
  assert.ok(editor.includes('const [editing] = useState(() => parseRecipe(params.pattern, params.length));'));
  assert.ok(editor.includes('router.push(customPlayerHref(pattern, lengthSec, editing) as Href)'));
  // Player: reads it from the link and hands it to the save at the end.
  const player = read('app/session-player.tsx');
  assert.ok(player.includes('(isCustom ? parseRecipe(from, fromLength) : null)'));
  assert.ok(player.includes('void rememberPattern(userId, { pattern: session.phaseConfig, lengthSec }, replaces);'));
  // Library: "Create your own" opens an empty editor, Edit a filled-in one.
  const library = read('src/features/library/LibraryScreen.tsx');
  assert.ok(library.includes('router.push(editorHref() as Href)'));
  assert.ok(library.includes('router.push(editorHref(item.pattern, item.lengthSec) as Href)'));
});
