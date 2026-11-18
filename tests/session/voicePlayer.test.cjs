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

// --- Clip source: real clips, fallback, placeholder guard --------------------

const VOICE_DIR = path.join(repo, 'assets/audio/voice');
const realBytes = (id) => new Uint8Array(fs.readFileSync(path.join(VOICE_DIR, `${id}.wav`)));
const ALL_IDS = vs.allClips().map((c) => c.id);
const REAL_MAP = Object.fromEntries(ALL_IDS.map((id) => [id, id])); // module stand-ins: the id itself

// voiceClips.ts with its native imports stubbed; `assets` is the bundled map.
function clipModule({ dev, env = {}, assets }) {
  globalThis.__DEV__ = dev;
  return loadTs('src/features/session/audio/voiceClips.ts', {
    stubs: {
      'expo-asset': { Asset: {} },
      'expo-file-system': { File: class {} },
      './voiceAssets': { VOICE_ASSETS: assets },
      './voiceScript': vs,
      './wav': wav,
      './devPlaceholderClips': { placeholderVoiceClips: () => ({ placeholder: true }) },
    },
    env,
  });
}
async function load(opts, read) {
  const mod = clipModule(opts);
  try {
    return await mod.loadVoiceClips(read);
  } finally {
    delete globalThis.__DEV__;
  }
}
const SWITCH = { EXPO_PUBLIC_VOICE_PLACEHOLDER: '1' };

test('real clips: voiceAssets lists the 44 bundled files in script order', () => {
  const src = read('src/features/session/audio/voiceAssets.ts');
  const entries = [...src.matchAll(/^  '([a-z]+-[a-z0-9]+)': require\('\.\.\/\.\.\/\.\.\/\.\.\/assets\/audio\/voice\/([a-z]+-[a-z0-9]+)\.wav'\),$/gm)];
  assert.deepEqual(entries.map((m) => m[1]), ALL_IDS);
  for (const m of entries) {
    assert.equal(m[1], m[2], 'id and file agree');
    assert.ok(fs.existsSync(path.join(VOICE_DIR, `${m[2]}.wav`)), `${m[2]}.wav exists`);
  }
});

test('real clips: all 44 load into samples with their lengths; the placeholder is never used then', async () => {
  for (const dev of [true, false]) {
    const v = await load({ dev, env: SWITCH, assets: REAL_MAP }, async (id) => realBytes(id));
    assert.equal(v.placeholder, false, `dev ${dev}, switch on: still the real clips`);
    assert.deepEqual(Object.keys(v.clips), ALL_IDS);
    for (const id of ALL_IDS) {
      assert.equal(v.clips[id].rate, 22050);
      assert.ok(Math.abs(v.durations[id] - (v.clips[id].samples.length * 1000) / 22050) < 1e-9);
    }
    // The imported (trimmed) lengths, e.g. cue-rest 579 ms and cue-hold 529 ms.
    assert.ok(Math.abs(v.durations['cue-rest'] - 579) <= 1, String(v.durations['cue-rest']));
    assert.ok(Math.abs(v.durations['cue-hold'] - 529) <= 1, String(v.durations['cue-hold']));
  }
});

test('real clips: any clip failing to load means no clips (silent breathing), retried next time', async () => {
  const cases = {
    'one read fails': async (id) => (id === 'hold-07' ? null : realBytes(id)),
    'one read throws': async (id) => {
      if (id === 'out-12') throw new Error('asset missing');
      return realBytes(id);
    },
    'one clip is not a WAV': async (id) => (id === 'cue-in' ? new Uint8Array([1, 2, 3]) : realBytes(id)),
  };
  for (const [label, read] of Object.entries(cases)) {
    assert.equal(await load({ dev: false, assets: REAL_MAP }, read), null, label);
  }
  // A failure is not remembered: the next call loads again and succeeds.
  const mod = clipModule({ dev: false, assets: REAL_MAP });
  try {
    let reads = 0;
    assert.equal(await mod.loadVoiceClips(async (id) => (reads++, id === 'rest-03' ? null : realBytes(id))), null);
    const ok = await mod.loadVoiceClips(async (id) => (reads++, realBytes(id)));
    assert.equal(ok.placeholder, false);
    const before = reads;
    assert.equal(await mod.loadVoiceClips(async () => { throw new Error('not called'); }), ok, 'then kept for the app run');
    assert.equal(reads, before);
  } finally {
    delete globalThis.__DEV__;
  }
});

test('placeholder: only with __DEV__ AND the switch AND no real clips; never in a release build', async () => {
  const read = async () => { throw new Error('no reads without real clips'); };
  assert.deepEqual(await load({ dev: true, env: SWITCH, assets: {} }, read), { placeholder: true });
  assert.equal(await load({ dev: false, env: SWITCH, assets: {} }, read), null, 'release build, switch on: nothing');
  assert.equal(await load({ dev: true, env: {}, assets: {} }, read), null, 'dev without the switch: nothing');
  assert.equal(await load({ dev: true, env: { EXPO_PUBLIC_VOICE_PLACEHOLDER: 'true' }, assets: {} }, read), null, 'only exactly "1"');
  assert.equal(await load({ dev: false, env: {}, assets: {} }, read), null);
});

test('guard: loaded from one place only, __DEV__ first, behind all three checks; the switch is set in no build config', () => {
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
  // __DEV__ first, so a release build's bundler can drop the branch and its require.
  assert.ok(
    /if \(__DEV__ && process\.env\.EXPO_PUBLIC_VOICE_PLACEHOLDER === '1' && !HAS_REAL_CLIPS\) \{\s*return require\('\.\/devPlaceholderClips'\)\.placeholderVoiceClips\(\);\s*\}/.test(src)
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

test('player: the voice drives the clock when it plays; otherwise the session clock exactly as before', () => {
  const src = read('app/session-player.tsx');
  const call = src.slice(src.indexOf('const voice = useSessionVoice({'), src.indexOf('});', src.indexOf('const voice = useSessionVoice({')));
  for (const line of [
    'pattern: session?.phaseConfig ?? null,',
    'lengthSec,',
    'sessionTitle: session?.title ?? null,',
    'ready: session !== null,',
    "started: phase === 'active',",
    "want: phase === 'active' && !paused && isFocused,",
    "finished: phase === 'post-mood',",
    'clockMs: elapsedMs,',
    'endMs,',
    'trackNameRef,',
    'onExternalPause: () => setPaused(true),',
    'onExternalResume: () => setPaused(false),',
  ]) assert.ok(call.includes(line), line);
  // The voice failing mid-session: the session clock carries on from there.
  assert.ok(src.includes('clockRef.current = { ...INITIAL_CLOCK, accumulatedMs: ms };'));
  // Screen-off time counts only while the voice drives.
  assert.ok(src.includes("const running = phase === 'active' && !paused && isFocused && (voice.driving || appActive);"));
  // One clock: the voice's position while driving, else the session clock
  // (which only runs, and only beats, when the voice is not driving).
  const effect = src.slice(src.indexOf('const fromVoice = voice.driving;'), src.indexOf('}, [running, session, endMs, voice.driving, voice.readElapsedMs, appActive]);'));
  assert.ok(effect.includes('if (!fromVoice) clockRef.current = setClockRunning(clockRef.current, running, Date.now());'));
  assert.ok(effect.includes('? (voice.readElapsedMs() ?? clockElapsedMs(clockRef.current, Date.now()))'));
  assert.ok(effect.includes(': clockElapsedMs(clockRef.current, Date.now());'));
  assert.ok(effect.includes('if (!fromVoice) clockRef.current = clockBeat(setClockRunning(clockRef.current, true, now), now);'));
  assert.ok(src.includes('}, [running, session, endMs, voice.driving, voice.readElapsedMs, appActive]);'), 're-read on returning to the app');
  // The AppState listener still stops the session clock in the background (F-02).
  assert.ok(src.includes("if (s !== 'active') clockRef.current = setClockRunning(clockRef.current, false, Date.now());"));
  // The end (also after a track that ended while away) is the same check as before.
  assert.ok(src.includes("if (phase === 'active' && elapsedMs >= endMs) {"));
  // The hook comes before `running` and before any early return; no audio code here.
  assert.ok(src.indexOf('const voice = useSessionVoice({') < src.indexOf('const running = '));
  assert.ok(src.indexOf('const voice = useSessionVoice({') < src.indexOf('if (!isCustom && fetchError) {'));
  assert.ok(!/from 'expo-audio'/.test(src), 'audio stays in the hook');
  // Keep-awake while breathing, as today.
  assert.ok(src.includes('activateKeepAwakeAsync(KEEP_AWAKE_TAG)'));
});

test('hook: hand-over at Begin with doNotMix, background and silent-mode audio, and the lock screen controls', () => {
  const src = read('src/features/session/audio/useSessionVoice.ts');
  const begin = src.slice(src.indexOf("if (!started || handover.current !== 'idle') return;"), src.indexOf('// While driving: play or pause'));
  // Not ready at Begin: silent on the existing clock for the whole session.
  assert.ok(begin.includes("if (!p || !p.isLoaded) {\n      handover.current = 'skipped';"));
  // In this order: audio mode, controls, the track at the clock's position, then driving.
  const order = [
    'await setAudioModeAsync(VOICE_AUDIO_MODE);',
    'p.setActiveForLockScreen(true, lockScreenMetadata(sessionTitle), LOCK_SCREEN_OPTIONS);',
    'await p.seekTo(Math.max(0, latest.current.clockMs) / 1000);',
    'setDriving(true);',
  ].map((l) => {
    const at = begin.indexOf(l);
    assert.ok(at >= 0, l);
    return at;
  });
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  // Setup failing: no voice, controls removed (release), the clock carries on.
  assert.ok(begin.includes("} catch {\n        // Setup failed: no voice this session, the existing clock keeps going.\n        handover.current = 'skipped';\n        release(playerRef);"));
  // Removed at Session Complete and when the screen closes (Done, X, Back).
  assert.ok(src.includes('if (!finished) return;\n    finishedFlag.current = true;\n    setDriving(false);\n    release(playerRef);'));
  assert.ok(/useEffect\(\s*\(\) => \(\) => \{\s*finishedFlag\.current = true;\s*release\(playerRef\);\s*\},\s*\[\]\s*\);/.test(src));
  const rel = src.slice(src.indexOf('function release('));
  assert.ok(rel.includes('p.setActiveForLockScreen(false);'));
  assert.ok(rel.indexOf('p.pause();') < rel.indexOf('p.setActiveForLockScreen(false);'));
  assert.ok(rel.indexOf('p.setActiveForLockScreen(false);') < rel.indexOf('p.remove();'));
  // Off, or no clips: nothing is even loaded or baked.
  assert.ok(src.includes('const clips = settings.voice ? await loadVoiceClips() : null;'));
  assert.ok(src.includes("if (plan.kind !== 'voice') return;"));
  assert.ok(src.includes('if (!track.ok) return;'));
  assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(src));
});

test('hook: outside plays and pauses reach the screen; the end and errors are handled', () => {
  const src = read('src/features/session/audio/useSessionVoice.ts');
  const listener = src.slice(src.indexOf("p.addListener('playbackStatusUpdate'"), src.indexOf('return () => sub.remove();'));
  assert.ok(listener.includes('if (trackFinished(positionMs, end, !!status.didJustFinish)) trackEnded.current = true;'));
  assert.ok(listener.includes('const change = externalChange({'));
  assert.ok(listener.includes('latest.current.onExternalPause();'));
  assert.ok(listener.includes('latest.current.onExternalResume();'));
  // An error mid-session: stop driving, release, give the clock back at the voice's position.
  assert.ok(listener.includes('setDriving(false);\n        release(playerRef);\n        latest.current.onFallback(at);'));
  // The app's own play and pause, from what the session wants (not the app being in front).
  assert.ok(src.includes('const cmd = playerCommand(want, p.playing);'));
  assert.ok(src.includes('commanded.current = { want, at: Date.now() };'));
  // The clock while driving: the live position, or exactly the end once finished.
  const read_ = src.slice(src.indexOf('const readElapsedMs = useCallback('));
  assert.ok(read_.includes('if (trackEnded.current) return end;'));
  assert.ok(read_.includes('const positionMs = p.currentTime * 1000;'));
  assert.ok(read_.includes('return voiceElapsedMs(positionMs, end);'));
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
