// Tests for the voice guidance audio (step 2): WAV writer and reader, the
// generated tones, and the mixer that renders a session's schedule into one
// track (src/features/session/audio/). Clips are synthetic beeps built here;
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
const tones = loadTs('src/features/session/audio/tones.ts');
const mix = loadTs('src/features/session/audio/mixer.ts', { stubs: { './tones': tones, './wav': wav } });

const RATE = wav.SAMPLE_RATE;
const P = (inhale, hold, exhale, rest) => ({ inhale, hold, exhale, rest });
const ON = { voice: true, tones: true, voiceFrequency: 'every' };
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
  const edit = (at, value, size = 2) => {
    const b = bytes.slice();
    const v = new DataView(b.buffer);
    size === 2 ? v.setUint16(at, value, true) : v.setUint32(at, value, true);
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

// --- Tones -----------------------------------------------------------------------

function zeroCrossings(a, from, to) {
  let n = 0;
  for (let i = from + 1; i < to; i++) if ((a[i - 1] < 0) !== (a[i] < 0)) n++;
  return n;
}

test('tones: exact length, start and end at silence, quiet, never NaN', () => {
  for (const kind of ['rise', 'fall', 'chime']) {
    for (const ms of [1000, 4000, 12000]) {
      const n = wav.msToSamples(ms);
      const t = tones.renderTone(kind, n, RATE);
      assert.equal(t.length, n);
      assert.equal(t[0], 0, `${kind} starts at 0`);
      assert.ok(Math.abs(t[n - 1]) < 1e-9, `${kind} ends at 0`);
      assert.ok(peak(t) <= Math.max(tones.TONE_LEVEL, tones.CHIME_LEVEL) + 1e-9, `${kind} quiet`);
      assert.ok(t.every(Number.isFinite));
    }
  }
  assert.ok(tones.renderTone(null, 22050, RATE).every((x) => x === 0), 'rest is silence');
  assert.equal(tones.renderTone('rise', 0, RATE).length, 0);
});

test('tones: the in-tone rises, the out-tone falls, the chime fades', () => {
  const n = wav.msToSamples(4000);
  const q = Math.floor(n / 4);
  const rise = tones.renderTone('rise', n, RATE);
  const fall = tones.renderTone('fall', n, RATE);
  assert.ok(zeroCrossings(rise, 3 * q, n) > zeroCrossings(rise, 0, q) * 1.3, 'higher at the end');
  assert.ok(zeroCrossings(fall, 0, q) > zeroCrossings(fall, 3 * q, n) * 1.3, 'lower at the end');
  const chime = tones.renderTone('chime', n, RATE);
  assert.ok(peak(chime, 3 * q, n) < peak(chime, 0, q) / 4, 'decays');
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

test('mixer: the voice starts at the phase start, sample-exact; the tone is lowered under it', () => {
  const s = sch.buildSchedule(P(4, 7, 8, 0), 120, { voice: true, tones: false, voiceFrequency: 'every' }, DURATIONS);
  const out = wav.parseWav(collect(s).bytes).samples;
  for (const ph of s.phases.slice(0, 3)) {
    const at = wav.msToSamples(ph.startMs);
    const clip = CLIPS[ph.voice.clipId].samples;
    // Tones off: the track is the clip itself at that offset, then silence.
    assert.deepEqual([...out.slice(at, at + clip.length)], [...clip], ph.voice.clipId);
    const end = wav.msToSamples(ph.startMs + ph.durationMs);
    assert.equal(peak(out, at + clip.length, end), 0, 'silent after the clip');
  }
  // Ducking: with tones on and a silent (all-zero) clip, the tone is about a
  // quarter as loud under the clip as after it.
  const silentClips = Object.fromEntries(Object.entries(CLIPS).map(([id, c]) => [id, { rate: c.rate, samples: new Int16Array(c.samples.length) }]));
  const s2 = sch.buildSchedule(P(8, 0, 8, 0), 120, ON, DURATIONS);
  const out2 = wav.parseWav(collect(s2, silentClips).bytes).samples;
  const clipLen = CLIPS[s2.phases[0].voice.clipId].samples.length;
  const ramp = Math.round((mix.DUCK_RAMP_MS * RATE) / 1000);
  const under = peak(out2, Math.floor(clipLen / 2), clipLen - ramp);
  const after = peak(out2, clipLen + ramp, clipLen + ramp + 4000);
  assert.equal(mix.DUCK_GAIN, 0.25);
  assert.ok(under < after * 0.35 && under > after * 0.15, `${under} vs ${after}`);
});

test('mixer: rest is silent, all off is silence, nothing clips', () => {
  const quiet = sch.buildSchedule(P(4, 4, 4, 4), 120, { voice: false, tones: false, voiceFrequency: 'every' }, DURATIONS);
  assert.equal(peak(wav.parseWav(collect(quiet).bytes).samples), 0);
  const s = sch.buildSchedule(P(4, 4, 4, 4), 120, { voice: false, tones: true, voiceFrequency: 'every' }, DURATIONS);
  const out = wav.parseWav(collect(s).bytes).samples;
  const rest = s.phases.find((p) => p.phase === 'rest');
  assert.equal(peak(out, wav.msToSamples(rest.startMs), wav.msToSamples(rest.startMs + rest.durationMs)), 0);
  // A full-scale clip plus a tone stays inside 16 bits.
  const loud = Object.fromEntries(Object.entries(CLIPS).map(([id, c]) => [id, { rate: c.rate, samples: c.samples.map((x) => (x >= 0 ? 32767 : -32768)) }]));
  const out2 = wav.parseWav(collect(sch.buildSchedule(P(8, 0, 8, 0), 120, ON, DURATIONS), loud).bytes).samples;
  assert.ok(peak(out2) <= 32768);
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

test('pure modules: no React Native or Expo imports, no audio files added', () => {
  for (const f of ['wav.ts', 'tones.ts', 'mixer.ts']) {
    const src = fs.readFileSync(path.join(repo, 'src/features/session/audio', f), 'utf8');
    assert.ok(!/from 'react|from 'expo/.test(src), f);
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(src), f);
  }
  assert.ok(!fs.existsSync(path.join(repo, 'assets/audio/voice')), 'no voice clips in the repo yet');
});
