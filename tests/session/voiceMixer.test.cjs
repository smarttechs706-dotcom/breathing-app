// Tests for the voice guidance audio: WAV writer and reader, and the mixer that
// renders a session's voice schedule into one track (silence plus the voice
// clips; no tones, decided 2026-11-17). Clips are synthetic beeps built here;
// no real audio file is used or added.
// Run with:
//   node --test tests/session/voiceMixer.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const repo = path.join(__dirname, '..', '..');
const bp = loadTs('src/features/session/breathPattern.ts');
const vs = loadTs('src/features/session/audio/voiceScript.ts');
const fit = loadTs('src/features/session/audio/fitRule.ts');
const sch = loadTs('src/features/session/audio/schedule.ts', {
  stubs: { '../breathPattern': bp, './fitRule': fit, './voiceScript': vs },
});
const wav = loadTs('src/features/session/audio/wav.ts');
const mix = loadTs('src/features/session/audio/mixer.ts', { stubs: { './wav': wav } });

const RATE = wav.SAMPLE_RATE;
const P = (inhale, hold, exhale, rest) => ({ inhale, hold, exhale, rest });
const ON = { voice: true };
const MS_PER_CHAR = 70;
const DURATIONS = Object.fromEntries(vs.allClips().map((c) => [c.id, c.text.length * MS_PER_CHAR]));

// A synthetic clip: a 1 kHz beep at half scale, as a real WAV file's bytes.
function beepWav(ms, rate = RATE, hz = 1000) {
  const n = wav.msToSamples(ms, rate);
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.round(16384 * Math.sin((2 * Math.PI * hz * i) / rate));
  const data = wav.samplesToBytes(s);
  const out = new Uint8Array(wav.HEADER_BYTES + data.length);
  out.set(wav.wavHeader(data.length, rate), 0);
  out.set(data, wav.HEADER_BYTES);
  return out;
}
const CLIPS = Object.fromEntries(Object.entries(DURATIONS).map(([id, ms]) => [id, wav.parseWav(beepWav(ms))]));

function collect(schedule, clips = CLIPS) {
  const parts = [];
  const result = mix.renderTrack(schedule, clips, (b) => parts.push(b));
  const all = new Uint8Array(parts.reduce((t, b) => t + b.length, 0));
  let at = 0;
  for (const b of parts) {
    all.set(b, at);
    at += b.length;
  }
  return { result, bytes: all, parts };
}

const peak = (a, from = 0, to = a.length) => {
  let m = 0;
  for (let i = from; i < to; i++) m = Math.max(m, Math.abs(a[i]));
  return m;
};

// --- WAV -----------------------------------------------------------------------

test('wav: 16-bit mono 22.05 kHz header, little-endian, exact sizes', () => {
  assert.equal(RATE, 22050);
  const h = wav.wavHeader(1000);
  assert.equal(h.length, 44);
  const v = new DataView(h.buffer);
  assert.equal(String.fromCharCode(...h.slice(0, 4)), 'RIFF');
  assert.equal(v.getUint32(4, true), 1036);
  assert.equal(String.fromCharCode(...h.slice(8, 16)), 'WAVEfmt ');
  assert.equal(v.getUint16(20, true), 1, 'PCM');
  assert.equal(v.getUint16(22, true), 1, 'mono');
  assert.equal(v.getUint32(24, true), 22050);
  assert.equal(v.getUint32(28, true), 44100, 'byte rate');
  assert.equal(v.getUint16(32, true), 2, 'block align');
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(String.fromCharCode(...h.slice(36, 40)), 'data');
  assert.equal(v.getUint32(40, true), 1000);
  assert.deepEqual([...wav.samplesToBytes(Int16Array.from([1, -2, 32767]))], [1, 0, 254, 255, 255, 127]);
  assert.equal(wav.msToSamples(1000), 22050);
  assert.equal(wav.msToSamples(19000), 418950);
});

test('wav: a clip reads back exactly; other chunks are skipped; wrong formats are refused', () => {
  const bytes = beepWav(500);
  const clip = wav.parseWav(bytes);
  assert.equal(clip.rate, RATE);
  assert.equal(clip.samples.length, 11025);
  assert.deepEqual([...wav.samplesToBytes(clip.samples)], [...bytes.slice(44)]);
  // A LIST chunk (as editors add) before the data is skipped.
  const list = new Uint8Array([...'LIST'].map((c) => c.charCodeAt(0)).concat([4, 0, 0, 0, 1, 2, 3, 4]));
  const withList = new Uint8Array(bytes.length + list.length);
  withList.set(bytes.slice(0, 36), 0);
  withList.set(list, 36);
  withList.set(bytes.slice(36), 36 + list.length);
  assert.equal(wav.parseWav(withList).samples.length, 11025);
  // Refused: not RIFF, stereo, 8-bit, not PCM, cut short.
  const edit = (at, value) => {
    const b = bytes.slice();
    new DataView(b.buffer).setUint16(at, value, true);
    return b;
  };
  assert.equal(wav.parseWav(new Uint8Array([1, 2, 3])), null);
  assert.equal(wav.parseWav(edit(22, 2)), null, 'stereo');
  assert.equal(wav.parseWav(edit(34, 8)), null, '8-bit');
  assert.equal(wav.parseWav(edit(20, 3)), null, 'float, not PCM');
  assert.equal(wav.parseWav(bytes.slice(0, 1000)), null, 'cut short');
  const notRiff = bytes.slice();
  notRiff[0] = 88;
  assert.equal(wav.parseWav(notRiff), null);
});

// --- Mixer ------------------------------------------------------------------------

test('mixer: a 5-minute 4-7-8 track has exactly the session length, header first', () => {
  const s = sch.buildSchedule(P(4, 7, 8, 0), 300, ON, DURATIONS);
  const { result, bytes, parts } = collect(s);
  assert.equal(result.samples, wav.msToSamples(285000));
  assert.equal(result.bytes, bytes.length);
  assert.equal(bytes.length, 44 + 2 * 285 * 22050);
  assert.equal(mix.trackBytes(285000), bytes.length);
  assert.equal(parts[0].length, 44, 'header written first');
  assert.equal(parts.length, 1 + s.phases.length, 'then one piece per phase');
  const back = wav.parseWav(bytes);
  assert.equal(back.samples.length, result.samples, 'the file reads back as a valid WAV');
  // 45 phases, but only 3 different ones are computed (one breath, repeated).
  assert.equal(result.rendered, 3);
});

test('mixer: each clip starts at its phase start, sample-exact and unchanged; silence everywhere else', () => {
  const s = sch.buildSchedule(P(4, 7, 8, 2), 120, ON, DURATIONS);
  const out = wav.parseWav(collect(s).bytes).samples;
  let voiced = 0;
  for (const ph of s.phases) {
    const at = wav.msToSamples(ph.startMs);
    const end = wav.msToSamples(ph.startMs + ph.durationMs);
    if (!ph.voice) {
      assert.equal(peak(out, at, end), 0, 'a phase with no clip is silent');
      continue;
    }
    const clip = CLIPS[ph.voice.clipId].samples;
    assert.deepEqual([...out.slice(at, at + clip.length)], [...clip], ph.voice.clipId);
    assert.equal(peak(out, at + clip.length, end), 0, 'silent after the clip');
    voiced++;
  }
  assert.ok(voiced > 10);
});

test('mixer: voice off or no voice in any phase gives a silent track of the full length', () => {
  const off = sch.buildSchedule(P(4, 4, 4, 4), 120, { voice: false }, DURATIONS);
  const { result, bytes } = collect(off);
  assert.equal(result.samples, wav.msToSamples(off.totalMs));
  assert.equal(peak(wav.parseWav(bytes).samples), 0);
  assert.equal(result.rendered, 1, 'one silent block of 4 s, reused');
  const noClips = sch.buildSchedule(P(4, 7, 8, 0), 120, ON, {});
  assert.equal(peak(wav.parseWav(collect(noClips, {}).bytes).samples), 0);
});

test('mixer: a missing clip or a clip at another rate is refused before anything is written', () => {
  const s = sch.buildSchedule(P(4, 7, 8, 0), 120, ON, DURATIONS);
  const missing = { ...CLIPS };
  delete missing['hold-07'];
  let wrote = 0;
  assert.throws(() => mix.renderTrack(s, missing, () => wrote++), mix.ClipFormatError);
  const wrongRate = { ...CLIPS, 'in-04': wav.parseWav(beepWav(2380, 44100)) };
  assert.throws(() => mix.renderTrack(s, wrongRate, () => wrote++), /44100 Hz/);
  assert.equal(wrote, 0);
});

test('mixer: every length and built-in pattern adds up exactly; sizes 2, 5 and 10 minutes', () => {
  const builtIns = [P(4, 4, 4, 4), P(5, 0, 5, 0), P(4, 0, 8, 0), P(4, 2, 4, 0), P(4, 4, 6, 0), P(4, 7, 8, 0)];
  for (const p of builtIns) {
    for (const len of [120, 180, 300, 600]) {
      const s = sch.buildSchedule(p, len, ON, DURATIONS);
      let bytes = 0;
      const r = mix.renderTrack(s, CLIPS, (b) => (bytes += b.length));
      assert.equal(r.samples, wav.msToSamples(s.totalMs));
      assert.equal(bytes, mix.trackBytes(s.totalMs));
      assert.ok(r.rendered <= 8, `${JSON.stringify(p)}@${len}: ${r.rendered} phases computed`);
    }
  }
  assert.equal(mix.trackBytes(120000), 5292044);
  assert.equal(mix.trackBytes(300000), 13230044);
  assert.equal(mix.trackBytes(600000), 26460044);
});

test('voice only: no tone code left, no React Native or Expo imports, no audio files added', () => {
  assert.ok(!fs.existsSync(path.join(repo, 'src/features/session/audio/tones.ts')), 'tones.ts removed');
  for (const f of ['wav.ts', 'mixer.ts', 'schedule.ts']) {
    const src = fs.readFileSync(path.join(repo, 'src/features/session/audio', f), 'utf8');
    assert.ok(!/from 'react|from 'expo/.test(src), f);
    assert.ok(!/renderTone|ToneKind|DUCK_|from '\.\/tones'/.test(src), `${f}: no tone code`);
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(src), f);
  }
  // No audio added: no voice clips yet, and assets/audio holds only Home's
  // existing ambient loop (committed in f50b0bf, not part of this work).
  assert.ok(!fs.existsSync(path.join(repo, 'assets/audio/voice')), 'no voice clips in the repo');
  assert.deepEqual(fs.readdirSync(path.join(repo, 'assets/audio')), ['home-ambient-loop.m4a']);
});
