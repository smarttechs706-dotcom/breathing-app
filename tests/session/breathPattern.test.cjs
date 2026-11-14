// Tests for the breathing pattern rules (src/features/session/breathPattern.ts).
// Run with:
//   node --test tests/session/breathPattern.test.cjs

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const bp = loadTs('src/features/session/breathPattern.ts');

const p = (inhale, hold, exhale, rest) => ({ inhale, hold, exhale, rest });

// The six target sessions (seconds: inhale, hold, exhale, rest) and length.
const TARGET = {
  'box-breathing': { pattern: p(4, 4, 4, 4), length: 300 },
  'calm-focus': { pattern: p(5, 0, 5, 0), length: 300 },
  'deep-exhale': { pattern: p(4, 0, 8, 0), length: 180 },
  'morning-reset': { pattern: p(4, 2, 4, 0), length: 180 },
  'stress-relief': { pattern: p(4, 4, 6, 0), length: 300 },
  'wind-down': { pattern: p(4, 7, 8, 0), length: 300 },
};

// label, line, cycle seconds, session seconds (whole breaths, ends on an out-breath)
const EXPECTED = {
  'box-breathing': ['4-4-4-4', 'Breathe in 4, hold 4, breathe out 4, hold 4', 16, 284], // 18 breaths, no final rest
  'calm-focus': ['5-5', 'Breathe in 5, breathe out 5', 10, 300], // 30 breaths
  'deep-exhale': ['4-8', 'Breathe in 4, breathe out 8', 12, 180], // 15 breaths
  'morning-reset': ['4-2-4', 'Breathe in 4, hold 2, breathe out 4', 10, 180], // 18 breaths
  'stress-relief': ['4-4-6', 'Breathe in 4, hold 4, breathe out 6', 14, 294], // 21 breaths
  'wind-down': ['4-7-8', 'Breathe in 4, hold 7, breathe out 8', 19, 285], // 15 breaths
};

test('all six sessions: label, line, cycle and session length', () => {
  for (const [id, { pattern, length }] of Object.entries(TARGET)) {
    const [label, line, cycle, session] = EXPECTED[id];
    assert.equal(bp.patternLabel(pattern), label, `${id} label`);
    assert.equal(bp.patternLine(pattern), line, `${id} line`);
    assert.equal(bp.cycleSeconds(pattern), cycle, `${id} cycle`);
    assert.equal(bp.sessionSeconds(pattern, length), session, `${id} session`);
  }
});

test('each session is at most 10 minutes, never longer than its length, and short by less than one breath plus the skipped final rest', () => {
  for (const [id, { pattern, length }] of Object.entries(TARGET)) {
    const s = bp.sessionSeconds(pattern, length);
    assert.ok(length <= 600, `${id} length`);
    assert.ok(s <= length, `${id}: ${s} > ${length}`);
    assert.ok(length - s < bp.cycleSeconds(pattern) + pattern.rest, `${id}: loses too much`);
  }
});

test('the session ends on an out-breath: whole breaths, minus only a final rest', () => {
  for (const [id, { pattern, length }] of Object.entries(TARGET)) {
    const s = bp.sessionSeconds(pattern, length);
    const breaths = (s + pattern.rest) / bp.cycleSeconds(pattern);
    assert.ok(Number.isInteger(breaths) && breaths >= 1, `${id}: ${breaths} breaths`);
  }
});

test('0-second hold: two numbers, and the hold is left out of the line', () => {
  assert.equal(bp.patternLabel(p(5, 0, 5, 0)), '5-5');
  assert.equal(bp.patternLabel(p(4, 0, 8, 0)), '4-8');
  assert.equal(bp.patternLine(p(4, 0, 8, 0)), 'Breathe in 4, breathe out 8');
  assert.equal(bp.cycleSeconds(p(4, 0, 8, 0)), 12);
});

test('rest: used shows four numbers and a final ", hold N"; 0-second rest is left out', () => {
  assert.equal(bp.patternLabel(p(4, 4, 4, 4)), '4-4-4-4');
  assert.equal(bp.patternLine(p(4, 4, 4, 4)), 'Breathe in 4, hold 4, breathe out 4, hold 4');
  // Rest without a hold still shows all four numbers so they stay in order.
  assert.equal(bp.patternLabel(p(4, 0, 8, 2)), '4-0-8-2');
  assert.equal(bp.patternLine(p(4, 0, 8, 2)), 'Breathe in 4, breathe out 8, hold 2');
  assert.equal(bp.patternLabel(p(4, 7, 8, 0)), '4-7-8');
  assert.ok(!bp.patternLine(p(4, 7, 8, 0)).endsWith('hold 0'));
});

test('length shorter than one breath: exactly one full breath', () => {
  assert.equal(bp.sessionSeconds(p(4, 7, 8, 0), 10), 19);
  assert.equal(bp.sessionSeconds(p(4, 4, 4, 4), 5), 12); // one breath, no final rest
  assert.equal(bp.sessionSeconds(p(4, 4, 6, 0), 0), 14);
  assert.equal(bp.sessionSeconds(p(4, 4, 6, 0), NaN), 14);
  assert.equal(bp.sessionSeconds(p(4, 4, 6, 0), -60), 14);
});

test('bad input: an empty pattern never loops; negative or non-finite phases count as 0', () => {
  assert.equal(bp.cycleSeconds(p(0, 0, 0, 0)), 0);
  assert.equal(bp.sessionSeconds(p(0, 0, 0, 0), 300), 0);
  assert.equal(bp.cycleSeconds(p(4, -2, 8, NaN)), 12);
  assert.equal(bp.patternLabel(p(4, -2, 8, NaN)), '4-8');
  assert.equal(bp.patternLine(p(4, -2, 8, NaN)), 'Breathe in 4, breathe out 8');
});

test('label and line always carry the same numbers as the pattern; hyphens only', () => {
  for (const { pattern } of Object.values(TARGET)) {
    const nonZero = [pattern.inhale, pattern.hold, pattern.exhale, pattern.rest].filter((n) => n > 0);
    const label = bp.patternLabel(pattern);
    const line = bp.patternLine(pattern);
    assert.deepEqual(label.split('-').map(Number).filter((n) => n > 0), nonZero);
    assert.deepEqual((line.match(/\d+(\.\d+)?/g) || []).map(Number), nonZero);
    assert.match(label, /^\d+(-\d+){1,3}$/);
    assert.ok(!/[–—]/.test(label + line), 'no long dashes');
    assert.equal(line[0], 'B');
  }
  // Fractions show one decimal.
  assert.equal(bp.patternLabel(p(4.5, 0, 6.25, 0)), '4.5-6.3');
});

test("today's live pattern for comparison: 4-4-8-4 over 600 s is 30 breaths ending on the out-breath", () => {
  assert.equal(bp.patternLabel(p(4, 4, 8, 4)), '4-4-8-4');
  assert.equal(bp.sessionSeconds(p(4, 4, 8, 4), 600), 596);
});

// --- The one clock: breathAt and nextTickMs ---------------------------------

test('breathAt: 4-7-8 runs in, hold, out and loops; never shows a rest', () => {
  const w = p(4, 7, 8, 0);
  assert.deepEqual(bp.breathAt(w, 0), { phase: 'inhale', step: 0, phaseElapsedMs: 0, phaseDurationMs: 4000 });
  assert.equal(bp.breathAt(w, 3999).phase, 'inhale');
  assert.equal(bp.breathAt(w, 4000).phase, 'hold');
  assert.equal(bp.breathAt(w, 10999).phase, 'hold');
  assert.equal(bp.breathAt(w, 11000).phase, 'exhale');
  assert.equal(bp.breathAt(w, 18999).phase, 'exhale');
  const next = bp.breathAt(w, 19000);
  assert.equal(next.phase, 'inhale');
  assert.equal(next.step, 3);
  for (let ms = 0; ms < 19000 * 3; ms += 250) assert.notEqual(bp.breathAt(w, ms).phase, 'rest');
});

test('breathAt: a 0-second hold is skipped entirely (no HOLD, not even for one frame)', () => {
  const c = p(5, 0, 5, 0);
  for (let ms = 0; ms < 30000; ms += 50) {
    const b = bp.breathAt(c, ms);
    assert.ok(b.phase === 'inhale' || b.phase === 'exhale', `${ms} ms: ${b.phase}`);
  }
  assert.equal(bp.breathAt(c, 5000).phase, 'exhale');
  assert.equal(bp.breathAt(c, 10000).phase, 'inhale');
});

test('breathAt: box breathing uses all four phases, rest included', () => {
  const b = p(4, 4, 4, 4);
  assert.deepEqual([0, 4000, 8000, 12000, 16000].map((ms) => bp.breathAt(b, ms).phase), ['inhale', 'hold', 'exhale', 'rest', 'inhale']);
});

test('breathAt: step changes exactly when the phase changes, and phase time is measured from its start', () => {
  const s = p(4, 4, 6, 0);
  let prev = bp.breathAt(s, 0);
  for (let ms = 50; ms < 14000 * 2; ms += 50) {
    const b = bp.breathAt(s, ms);
    assert.equal(b.step !== prev.step, b.phase !== prev.phase || b.phaseElapsedMs < prev.phaseElapsedMs, `${ms} ms`);
    assert.ok(b.phaseElapsedMs >= 0 && b.phaseElapsedMs < b.phaseDurationMs);
    prev = b;
  }
  assert.equal(bp.breathAt(s, 9500).phaseElapsedMs, 1500);
});

test('the session ends at the end of an out-breath for all six sessions', () => {
  for (const [id, { pattern, length }] of Object.entries(TARGET)) {
    const endMs = bp.sessionSeconds(pattern, length) * 1000;
    assert.equal(bp.breathAt(pattern, endMs - 1).phase, 'exhale', `${id}: last moment is an out-breath`);
    const last = bp.breathAt(pattern, endMs - 1);
    assert.ok(last.phaseDurationMs - last.phaseElapsedMs <= 1, `${id}: that out-breath is complete`);
  }
});

test('pause and resume: the breath depends only on breathed time, so it picks up where it stopped', () => {
  // 7.2 s breathed, a pause of any length, then on: same phase and progress.
  const w = p(4, 7, 8, 0);
  const before = bp.breathAt(w, 7200);
  assert.equal(before.phase, 'hold');
  assert.equal(before.phaseElapsedMs, 3200);
  assert.deepEqual(bp.breathAt(w, 7200), before);
  assert.equal(bp.breathAt(w, 7200 + 3800).phase, 'exhale');
});

test('nextTickMs: next phase change, next whole second, or the end, whichever is first', () => {
  const w = p(4, 7, 8, 0);
  assert.equal(bp.nextTickMs(w, 0, 285000), 1000);
  assert.equal(bp.nextTickMs(w, 3500, 285000), 4000); // second and phase change coincide
  assert.equal(bp.nextTickMs(w, 3999, 285000), 4000);
  assert.equal(bp.nextTickMs(p(4.5, 0, 6, 0), 4200, 300000), 4500); // phase change before the second
  assert.equal(bp.nextTickMs(w, 284600, 285000), 285000);
  // Always moves forward.
  for (let ms = 0; ms < 40000; ms += 333) assert.ok(bp.nextTickMs(w, ms, 285000) > ms);
});

test('breathAt: an empty pattern does not loop or throw', () => {
  assert.deepEqual(bp.breathAt(p(0, 0, 0, 0), 5000), { phase: 'inhale', step: 0, phaseElapsedMs: 0, phaseDurationMs: 0 });
  assert.equal(bp.nextTickMs(p(0, 0, 0, 0), 5000, 0), 6000);
});

// --- Where the pattern label is shown ---------------------------------------

const fs = require('node:fs');
const path = require('node:path');
const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');

test('labels: Library cards, the Featured card and the pre-session screen, all from phaseConfig', () => {
  const library = read('src/features/library/LibraryScreen.tsx');
  assert.ok(library.includes('const pattern = patternLabel(session.phaseConfig);'));
  assert.ok(/<View style=\{styles\.cardMetaDivider\} \/>\s*<Text style=\{styles\.cardMetaText\}>\{pattern\}<\/Text>/.test(library));
  const featured = read('src/features/home/FeaturedSessionCard.tsx');
  assert.ok(featured.includes('`${formatMinutes(session.durationSec)} · ${session.category} · ${patternLabel(session.phaseConfig)}`'));
  const player = read('app/session-player.tsx');
  assert.ok(player.includes('{`${patternLabel(session.phaseConfig)} · ${patternLine(session.phaseConfig)}`}'));
  // Existing text roles only: the meta role on cards, the description (body) role on pre-session.
  assert.ok(/<Text\s+style=\{styles\.sessionDescription\}\s+accessibilityLabel=\{patternLine\(session\.phaseConfig\)\}/.test(player));
  // Screen readers hear the plain line, never "4-7-8".
  assert.ok(library.includes('${patternLine(session.phaseConfig)}. Start'));
  assert.ok(featured.includes('accessibilityLabel={`Featured session, ${session.title}, ${spokenMeta}. Start`}'));
});

test('no label on the breathing screen, Session Complete or the Now-for-you tiles', () => {
  const player = read('app/session-player.tsx');
  const active = player.slice(player.indexOf("{phase === 'active' && ("), player.indexOf("{phase === 'post-mood' && ("));
  const post = player.slice(player.indexOf("{phase === 'post-mood' && ("));
  assert.ok(!/patternLabel|patternLine/.test(active), 'breathing screen');
  assert.ok(!/patternLabel|patternLine/.test(post), 'Session Complete');
  assert.ok(!/patternLabel|patternLine|breathPattern/.test(read('src/features/home/NowForYou.tsx')), 'Now for you');
});

test('label copy rules: hyphens and the existing middle dot only, no emoji, no long dashes', () => {
  for (const f of ['src/features/library/LibraryScreen.tsx', 'src/features/home/FeaturedSessionCard.tsx', 'app/session-player.tsx']) {
    const lines = read(f).split(/\r?\n/).filter((l) => /patternLabel|patternLine/.test(l));
    for (const l of lines) {
      assert.ok(!/[–—]/.test(l), `${f}: long dash`);
      assert.ok(!/\p{Extended_Pictographic}/u.test(l), `${f}: emoji`);
    }
  }
});
