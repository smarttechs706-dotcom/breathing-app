// Tests for the voice guidance core (step 1): the script of 44 clips, the fit
// rule and the session audio schedule (src/features/session/audio/). Clip
// lengths here are synthetic (about 70 ms per character); no real audio.
// Run with:
//   node --test tests/session/voiceSchedule.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const repo = path.join(__dirname, '..', '..');
const bp = loadTs('src/features/session/breathPattern.ts');
const cp = loadTs('src/features/session/customPattern.ts', { stubs: { './breathPattern': bp } });
const vs = loadTs('src/features/session/audio/voiceScript.ts');
const fit = loadTs('src/features/session/audio/fitRule.ts');
const sch = loadTs('src/features/session/audio/schedule.ts', {
  stubs: { '../breathPattern': bp, './fitRule': fit, './voiceScript': vs },
});

const P = (inhale, hold, exhale, rest) => ({ inhale, hold, exhale, rest });
const MS_PER_CHAR = 70;
const SYNTHETIC = Object.fromEntries(vs.allClips().map((c) => [c.id, c.text.length * MS_PER_CHAR]));
const ON = { voice: true };

// Every pattern the editor allows (customPattern limits, one breath <= 30 s).
function editorPatterns() {
  const L = cp.PHASE_LIMITS;
  const out = [];
  for (let i = L.inhale.min; i <= L.inhale.max; i++)
    for (let h = L.hold.min; h <= L.hold.max; h++)
      for (let e = L.exhale.min; e <= L.exhale.max; e++)
        for (let r = L.rest.min; r <= L.rest.max; r++) {
          const p = P(i, h, e, r);
          if (cp.isValidCustomPattern(p)) out.push(p);
        }
  return out;
}

// --- Script --------------------------------------------------------------------

test('script: 44 clips, 40 sentences (in 2-10, hold 1-10, out 2-12, rest 1-10) and 4 cues, unique ids', () => {
  const clips = vs.allClips();
  assert.equal(clips.length, 44);
  assert.equal(clips.filter((c) => c.kind === 'sentence').length, 40);
  assert.deepEqual(clips.filter((c) => c.kind === 'cue').map((c) => c.text), ['Breathe in', 'Hold', 'Breathe out', 'Rest']);
  assert.equal(new Set(clips.map((c) => c.id)).size, 44);
  assert.deepEqual(vs.SENTENCE_RANGES, {
    inhale: { min: 2, max: 10 },
    hold: { min: 1, max: 10 },
    exhale: { min: 2, max: 12 },
    rest: { min: 1, max: 10 },
  });
  for (const c of clips) assert.match(c.id, /^(in|hold|out|rest)-\d\d$|^cue-(in|hold|out|rest)$/, c.id);
});

test('script: exact sentences, number words, "one second" singular', () => {
  assert.equal(vs.sentence('inhale', 4), 'Breathe in slowly for four seconds');
  assert.equal(vs.sentence('hold', 7), 'Hold for seven seconds');
  assert.equal(vs.sentence('exhale', 8), 'Breathe out slowly for eight seconds');
  assert.equal(vs.sentence('rest', 2), 'Rest for two seconds');
  assert.equal(vs.sentence('hold', 1), 'Hold for one second');
  assert.equal(vs.sentence('rest', 1), 'Rest for one second');
  assert.equal(vs.sentence('exhale', 12), 'Breathe out slowly for twelve seconds');
  assert.equal(vs.sentence('inhale', 10), 'Breathe in slowly for ten seconds');
  // Outside the ranges, or not whole seconds: no sentence (the cue is used).
  for (const [phase, s] of [['inhale', 1], ['inhale', 11], ['hold', 0], ['exhale', 13], ['rest', 0], ['hold', 2.5]]) {
    assert.equal(vs.sentence(phase, s), null, `${phase} ${s}`);
    assert.equal(vs.sentenceClipId(phase, s), null);
  }
  assert.equal(vs.sentenceClipId('inhale', 4), 'in-04');
  assert.equal(vs.sentenceClipId('exhale', 12), 'out-12');
  assert.equal(vs.cueClipId('hold'), 'cue-hold');
  // Plain wording: no long dashes or emoji in the script.
  for (const c of vs.allClips()) assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(c.text), c.text);
});

// --- Fit rule --------------------------------------------------------------------

test('fit rule: sentence if it fits with 300 ms to spare, else the cue, else nothing', () => {
  assert.equal(fit.FIT_MARGIN_MS, 300);
  assert.equal(fit.chooseVoice(4000, 2380, 700), 'sentence');
  assert.equal(fit.chooseVoice(2680, 2380, 700), 'sentence', 'exactly the margin left');
  assert.equal(fit.chooseVoice(2679, 2380, 700), 'cue', '1 ms short');
  assert.equal(fit.chooseVoice(2000, 2310, 700), 'cue', 'a 2 s in-breath gets "Breathe in"');
  assert.equal(fit.chooseVoice(1000, 1330, 280), 'cue', 'a 1 s hold gets "Hold"');
  assert.equal(fit.chooseVoice(500, 1330, 280), 'none', 'not even the cue fits');
  assert.equal(fit.chooseVoice(4000, null, 700), 'cue', 'no sentence for this length');
  assert.equal(fit.chooseVoice(4000, null, null), 'none', 'clip missing from the manifest');
  assert.equal(fit.chooseVoice(4000, 0, 700), 'cue', 'a zero-length clip counts as missing');
});

// --- Schedule ----------------------------------------------------------------------

test('schedule: 4-7-8 at 5 min, phase by phase', () => {
  const s = sch.buildSchedule(P(4, 7, 8, 0), 300, ON, SYNTHETIC);
  assert.equal(s.totalMs, 285000, '15 breaths of 19 s');
  assert.equal(s.phases.length, 45);
  assert.deepEqual(
    s.phases.slice(0, 3).map((p) => [p.breath, p.phase, p.startMs, p.durationMs, p.voice && p.voice.clipId]),
    [
      [0, 'inhale', 0, 4000, 'in-04'],
      [0, 'hold', 4000, 7000, 'hold-07'],
      [0, 'exhale', 11000, 8000, 'out-08'],
    ]
  );
  const last = s.phases[s.phases.length - 1];
  assert.equal(last.phase, 'exhale');
  assert.equal(last.startMs + last.durationMs, s.totalMs, 'ends on the last out-breath');
});

test('schedule: a 0-second hold or rest is skipped; rest is spoken; no rest after the last out-breath', () => {
  const s = sch.buildSchedule(P(4, 4, 4, 4), 120, ON, SYNTHETIC);
  assert.equal(s.totalMs, 108000, '7 breaths of 16 s, minus the final rest');
  const rest = s.phases.find((p) => p.phase === 'rest');
  assert.equal(rest.voice.clipId, 'rest-04');
  assert.equal(s.phases[s.phases.length - 1].phase, 'exhale');
  const noHold = sch.buildSchedule(P(5, 0, 5, 0), 120, ON, SYNTHETIC);
  assert.ok(noHold.phases.every((p) => p.phase === 'inhale' || p.phase === 'exhale'));
});

test('schedule: Voice guidance on speaks at every breath; off means no audio at all', () => {
  const pattern = P(4, 7, 8, 0);
  const on = sch.buildSchedule(pattern, 300, ON, SYNTHETIC);
  assert.ok(on.phases.every((p) => p.voice !== null), 'every phase of every breath (the clips all fit 4-7-8)');
  assert.equal(on.phases[on.phases.length - 1].breath, 14, 'up to the last breath');
  const off = sch.buildSchedule(pattern, 300, { voice: false }, SYNTHETIC);
  assert.ok(off.phases.every((p) => p.voice === null));
  assert.equal(off.totalMs, on.totalMs, 'the setting never changes the timing');
  assert.equal(sch.usesAudio({ voice: true }), true);
  assert.equal(sch.usesAudio({ voice: false }), false, 'off: no track, the existing clock');
  assert.deepEqual(sch.DEFAULT_AUDIO_SETTINGS, { voice: true });
  // Voice only for now: no tone or frequency fields (decided 2026-11-17).
  for (const ph of on.phases) assert.deepEqual(Object.keys(ph).sort(), ['breath', 'durationMs', 'phase', 'startMs', 'voice']);
  assert.equal(sch.VOICE_FIRST_BREATHS, undefined);
});

test('every editor pattern: phases match the breathing circle, the voice never runs into the next phase', () => {
  const patterns = editorPatterns();
  assert.ok(patterns.length > 5000, `${patterns.length} patterns`);
  let phases = 0;
  for (const p of patterns) {
    const s = sch.buildSchedule(p, 120, ON, SYNTHETIC);
    assert.equal(s.totalMs, Math.round(bp.sessionSeconds(p, 120) * 1000));
    let at = 0;
    for (const ph of s.phases) {
      // Contiguous, and each starts exactly where breathAt changes phase.
      assert.equal(ph.startMs, at);
      const b = bp.breathAt(p, ph.startMs);
      assert.equal(b.phase, ph.phase);
      assert.equal(b.phaseElapsedMs, 0);
      assert.equal(ph.durationMs, b.phaseDurationMs);
      at += ph.durationMs;
      if (ph.voice) {
        assert.equal(ph.voice.startMs, ph.startMs, 'spoken at the start of the phase');
        assert.ok(ph.voice.startMs + ph.voice.durationMs + fit.FIT_MARGIN_MS <= ph.startMs + ph.durationMs);
        assert.equal(ph.voice.durationMs, SYNTHETIC[ph.voice.clipId]);
      } else {
        // Silent only when not even the cue fits.
        assert.ok(SYNTHETIC[vs.cueClipId(ph.phase)] + fit.FIT_MARGIN_MS > ph.durationMs, JSON.stringify(ph));
      }
      phases++;
    }
    assert.equal(at, s.totalMs);
  }
  assert.ok(phases > 100000, `${phases} phases checked`);
});

test('every length for the built-in patterns: same rules, voice for the exact seconds', () => {
  const builtIns = [P(4, 4, 4, 4), P(5, 0, 5, 0), P(4, 0, 8, 0), P(4, 2, 4, 0), P(4, 4, 6, 0), P(4, 7, 8, 0)];
  for (const p of builtIns) {
    for (const len of [120, 180, 300, 600]) {
      const s = sch.buildSchedule(p, len, ON, SYNTHETIC);
      for (const ph of s.phases) {
        if (ph.voice && ph.voice.kind === 'sentence') {
          assert.equal(ph.voice.clipId, vs.sentenceClipId(ph.phase, p[ph.phase]));
        }
      }
      assert.equal(s.phases.reduce((t, ph) => t + ph.durationMs, 0), s.totalMs);
    }
  }
});

test('empty or broken patterns give an empty schedule, never a throw', () => {
  assert.deepEqual(sch.buildSchedule(P(0, 0, 0, 0), 300, ON, SYNTHETIC), { totalMs: 0, phases: [] });
  assert.deepEqual(sch.buildSchedule(P(4, 0, 6, 0), 300, ON, {}).phases.every((p) => p.voice === null), true, 'no clips: silent');
});

test('pure modules: no React Native or Expo imports, no long dashes or emoji', () => {
  for (const f of ['voiceScript.ts', 'fitRule.ts', 'schedule.ts']) {
    const src = fs.readFileSync(path.join(repo, 'src/features/session/audio', f), 'utf8');
    assert.ok(!/from 'react|from 'expo/.test(src), f);
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(src), f);
  }
});
