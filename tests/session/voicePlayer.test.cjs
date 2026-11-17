// Tests for step 5, the voice in the session player (foreground only): the
// dev-only placeholder clips and their guard, the one clip source, the rules
// for whether a session gets a track and how the audio follows the clock, the
// player and Home wiring, and a timing of the 10-minute write.
// Run with:
//   node --test tests/session/voicePlayer.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');
const bp = loadTs('src/features/session/breathPattern.ts');
const vs = loadTs('src/features/session/audio/voiceScript.ts');
const fit = loadTs('src/features/session/audio/fitRule.ts');
const sch = loadTs('src/features/session/audio/schedule.ts', {
  stubs: { '../breathPattern': bp, './fitRule': fit, './voiceScript': vs },
});
const wav = loadTs('src/features/session/audio/wav.ts');
const mix = loadTs('src/features/session/audio/mixer.ts', { stubs: { './wav': wav } });
const dev = loadTs('src/features/session/audio/devPlaceholderClips.ts', { stubs: { './voiceScript': vs, './wav': wav } });
const sync = loadTs('src/features/session/audio/voiceSync.ts', { stubs: { './schedule': sch } });

const P = (inhale, hold, exhale, rest) => ({ inhale, hold, exhale, rest });
const peak = (a, from = 0, to = a.length) => {
  let m = 0;
  for (let i = from; i < to; i++) m = Math.max(m, Math.abs(a[i]));
  return m;
};

// --- Placeholder clips -----------------------------------------------------------

test('placeholder: all 44 clips in memory, a soft pip then silence, about 70 ms per character', () => {
  const v = dev.placeholderVoiceClips();
  assert.equal(v.placeholder, true);
  assert.equal(dev.PLACEHOLDER_MARKER, 'breathease-dev-placeholder-voice');
  const ids = vs.allClips().map((c) => c.id);
  assert.deepEqual(Object.keys(v.clips).sort(), [...ids].sort());
  for (const c of vs.allClips()) {
    const clip = v.clips[c.id];
    assert.equal(clip.rate, 22050);
    assert.equal(clip.samples.length, wav.msToSamples(c.text.length * 70), c.id);
    assert.ok(Math.abs(v.durations[c.id] - c.text.length * 70) < 0.05, c.id);
    const pipEnd = wav.msToSamples(150);
    assert.ok(peak(clip.samples, 0, pipEnd) > 0, 'audible pip at the start');
    assert.ok(peak(clip.samples) <= Math.round(32767 * 0.2), 'quiet');
    assert.equal(clip.samples[0], 0, 'starts at silence');
    assert.equal(peak(clip.samples, pipEnd), 0, 'then silence');
  }
});

// --- Guard -----------------------------------------------------------------------

function clipSource(devFlag, env) {
  globalThis.__DEV__ = devFlag;
  const mod = loadTs('src/features/session/audio/voiceClips.ts', {
    stubs: { './devPlaceholderClips': { placeholderVoiceClips: () => ({ placeholder: true }) } },
    env,
  });
  try {
    return mod.getVoiceClips();
  } finally {
    delete globalThis.__DEV__;
  }
}

test('guard: the placeholder only with __DEV__ AND the env switch; never in a release build', () => {
  assert.deepEqual(clipSource(true, { EXPO_PUBLIC_VOICE_PLACEHOLDER: '1' }), { placeholder: true });
  assert.equal(clipSource(false, { EXPO_PUBLIC_VOICE_PLACEHOLDER: '1' }), null, 'release build, switch set: nothing');
  assert.equal(clipSource(true, {}), null, 'dev build without the switch: nothing');
  assert.equal(clipSource(true, { EXPO_PUBLIC_VOICE_PLACEHOLDER: 'true' }), null, 'only exactly "1"');
  assert.equal(clipSource(false, {}), null);
});

test('guard: loaded from one place only, behind both checks; the switch is set in no build config', () => {
  const { execFileSync } = require('node:child_process');
  const grep = (pattern) => {
    try {
      return execFileSync('git', ['grep', '-l', '--untracked', '-F', pattern, '--', 'src', 'app'], { cwd: repo })
        .toString().trim().split(/\r?\n/).filter(Boolean);
    } catch {
      return [];
    }
  };
  assert.deepEqual(grep('devPlaceholderClips'), ['src/features/session/audio/voiceClips.ts']);
  assert.deepEqual(grep('breathease-dev-placeholder-voice'), ['src/features/session/audio/devPlaceholderClips.ts']);
  const src = read('src/features/session/audio/voiceClips.ts');
  assert.ok(
    /if \(__DEV__ && process\.env\.EXPO_PUBLIC_VOICE_PLACEHOLDER === '1'\) \{\s*return require\('\.\/devPlaceholderClips'\)\.placeholderVoiceClips\(\);\s*\}/.test(src)
  );
  assert.equal((src.match(/devPlaceholderClips/g) || []).length, 2, 'the comment and the one require');
  // Never set for EAS: not in eas.json, not in the app config.
  for (const f of ['eas.json', 'app.json', 'app.config.ts']) assert.ok(!read(f).includes('EXPO_PUBLIC_VOICE_PLACEHOLDER'), f);
  // .env.local (where a developer sets it) stays out of EAS uploads.
  assert.ok(/^\.env\*\.local$/m.test(read('.easignore')));
});

test('removal: the placeholder file and its branch go together (never half removed)', () => {
  const file = fs.existsSync(path.join(repo, 'src/features/session/audio/devPlaceholderClips.ts'));
  const branch = read('src/features/session/audio/voiceClips.ts').includes("require('./devPlaceholderClips')");
  assert.equal(file, branch, 'both present (now) or both gone (when the real clips land)');
});

// --- Rules ------------------------------------------------------------------------

test('plan: Voice guidance off, or no clips, means no track (silent breathing, same timing)', () => {
  const clips = dev.placeholderVoiceClips();
  assert.deepEqual(sync.planVoice({ voice: false }, clips, P(4, 7, 8, 0), 300), { kind: 'silent', reason: 'off' });
  assert.deepEqual(sync.planVoice({ voice: true }, null, P(4, 7, 8, 0), 300), { kind: 'silent', reason: 'no-clips' });
  assert.deepEqual(sync.planVoice({ voice: true }, clips, P(0, 0, 0, 0), 300), { kind: 'silent', reason: 'empty' });
  const on = sync.planVoice({ voice: true }, clips, P(4, 7, 8, 0), 300);
  assert.equal(on.kind, 'voice');
  assert.equal(on.schedule.totalMs, 285000, 'the same length the circle plays');
  assert.equal(on.clips, clips.clips);
});

test('sync: start and resume line the audio up with the clock; a drift over 250 ms is corrected; stop pauses', () => {
  assert.equal(sync.DRIFT_MS, 250);
  const s = (want, playing, audioMs, clockMs) => sync.syncStep({ want, playing, audioMs, clockMs });
  assert.deepEqual(s(true, false, 0, 0), { seekMs: 0, play: true }, 'Begin');
  assert.deepEqual(s(true, false, 12000, 30500), { seekMs: 30500, play: true }, 'resume after pause: from the clock');
  assert.deepEqual(s(true, true, 30600, 30500), {}, 'within 250 ms: leave it');
  assert.deepEqual(s(true, true, 30751, 30500), { seekMs: 30500 }, 'drifted ahead');
  assert.deepEqual(s(true, true, 30000, 30500), { seekMs: 30500 }, 'drifted behind');
  assert.deepEqual(s(false, true, 30500, 30500), { pause: true }, 'pause, Settings, background, end');
  assert.deepEqual(s(false, false, 30500, 30500), {});
  assert.deepEqual(s(true, false, 0, -5), { seekMs: 0, play: true });
});

// --- Wiring --------------------------------------------------------------------------

test('player: bakes while the mood is picked, follows the running clock, stops at Session Complete', () => {
  const player = read('app/session-player.tsx');
  const call = player.slice(player.indexOf('useSessionVoice({'), player.indexOf('});', player.indexOf('useSessionVoice({')));
  for (const line of [
    'pattern: session?.phaseConfig ?? null,',
    'lengthSec,',
    'ready: session !== null,',
    'breathing: running && elapsedMs < endMs,',
    "finished: phase === 'post-mood',",
    'clockMs: elapsedMs,',
    'trackNameRef,',
  ]) assert.ok(call.includes(line), line);
  // The clock and its screen-off rule are unchanged (the app in the foreground).
  assert.ok(player.includes("const running = phase === 'active' && !paused && isFocused && appActive;"));
  assert.ok(player.indexOf('useSessionVoice({') < player.indexOf('if (!isCustom && fetchError) {'), 'before any early return');
  assert.ok(!/from 'expo-audio'/.test(player), 'audio stays in the hook');
});

test('hook: doNotMix (foreground only) before the first sound; released at the end and on close; failures stay silent', () => {
  const src = read('src/features/session/audio/useSessionVoice.ts');
  assert.ok(src.includes("setAudioModeAsync({ interruptionMode: 'doNotMix', shouldPlayInBackground: false, playsInSilentMode: true })"));
  // No sound before the mode is set: `want` needs it.
  assert.ok(src.includes('want: latest.current.breathing && modeSet.current && p.isLoaded,'));
  assert.ok(src.includes('const plan = planVoice(settings, getVoiceClips(), pattern, lengthSec);'));
  assert.ok(src.includes("if (plan.kind !== 'voice') return;"), 'off or no clips: nothing');
  assert.ok(src.includes('if (!track.ok) return;'), 'a failed write: nothing');
  assert.ok(src.includes('trackNameRef.current = track.name;'), 'the screen deletes the file on close');
  assert.ok(src.includes('if (finished) release(playerRef);'));
  assert.ok(/useEffect\(\s*\(\) => \(\) => \{\s*release\(playerRef\);\s*\},\s*\[\]\s*\);/.test(src));
  assert.ok(!/shouldPlayInBackground: true|setActiveForLockScreen/.test(src), 'background playback is step 6');
  assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(src));
});

test('Home: the ambient loop never plays while a session is open, and never sets the audio mode then', () => {
  const src = read('src/features/home/useHomeAmbientSound.ts');
  assert.ok(src.includes('const { activeSessionId } = useActiveSession();'));
  assert.ok(src.includes('const active = useFocusedAndForeground() && activeSessionId === null;'));
  // The mode is only set inside the active branch.
  const effect = src.slice(src.indexOf('useEffect(() => {\n    if (!active) return;'));
  assert.ok(effect.indexOf('if (!active) return;') < effect.indexOf('setAudioModeAsync('));
  // The session player marks the session open for its whole life.
  assert.ok(read('app/session-player.tsx').includes('return () => setActiveSessionId(null);'));
});

// --- Timing --------------------------------------------------------------------------

test('timing: a 10-minute track (about 26 MB) renders and writes in pieces; the phone needs its own measurement', () => {
  const os = require('node:os');
  const clips = dev.placeholderVoiceClips();
  const plan = sync.planVoice({ voice: true }, clips, P(4, 7, 8, 0), 600);
  // Render only (repeated phases reused, so this is mostly passing pieces on).
  let bytes = 0;
  let t0 = process.hrtime.bigint();
  const r = mix.renderTrack(plan.schedule, plan.clips, (b) => (bytes += b.length));
  const renderMs = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(bytes, r.bytes);
  assert.equal(r.bytes, mix.trackBytes(plan.schedule.totalMs));
  // Render and write piece by piece to a real file (this computer's temp
  // folder, deleted at once), as the phone does through its file handle.
  const file = path.join(os.tmpdir(), `voice-timing-${process.pid}.wav`);
  const fd = fs.openSync(file, 'wx');
  try {
    t0 = process.hrtime.bigint();
    mix.renderTrack(plan.schedule, plan.clips, (b) => fs.writeSync(fd, b));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  const writeMs = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(fs.statSync(file).size, r.bytes);
  fs.unlinkSync(file);
  assert.equal(fs.existsSync(file), false);
  console.log(
    `  10-minute 4-7-8 track (${plan.schedule.totalMs / 1000} s): ${r.bytes} bytes in ${1 + plan.schedule.phases.length} pieces, ` +
      `${r.rendered} phases computed; render ${renderMs.toFixed(1)} ms, render + write ${writeMs.toFixed(0)} ms on this computer. ` +
      'Phone time still to be measured.'
  );
  assert.ok(writeMs < 10000, `${writeMs} ms`);
});
