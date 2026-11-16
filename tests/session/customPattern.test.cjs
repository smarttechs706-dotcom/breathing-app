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
