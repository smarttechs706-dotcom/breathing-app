// Offline tests for the voice clip import (scripts/import-voice-clips.mjs) and
// the release gate (scripts/check-voice-release.mjs). Clips are synthetic
// WAVs shaped like Azure's (leading silence, a beep for the speech, padding);
// every import goes into a temporary stand-in repo, never the real assets.
// Run with:
//   node --test tests/session/voiceImport.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');
const { pathToFileURL } = require('node:url');

const { loadTs } = require('../auth/helpers.cjs');

const repo = path.join(__dirname, '..', '..');
const vs = loadTs('src/features/session/audio/voiceScript.ts');
const wav = loadTs('src/features/session/audio/wav.ts');
const RATE = 22050;
const ms2s = (ms) => Math.round((ms * RATE) / 1000);

let imp;
let gate;
const temps = [];
before(async () => {
  imp = await import(pathToFileURL(path.join(repo, 'scripts/import-voice-clips.mjs')).href);
  gate = await import(pathToFileURL(path.join(repo, 'scripts/check-voice-release.mjs')).href);
});
after(() => {
  for (const d of temps) fs.rmSync(d, { recursive: true, force: true });
});
function temp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temps.push(d);
  return d;
}

// Lead silence, a 1 kHz beep for the speech, then trailing silence.
function clipSamples({ lead = 150, speech, trail }) {
  const s = new Int16Array(ms2s(lead + speech + trail));
  const a = ms2s(lead);
  for (let i = 0; i < ms2s(speech); i++) s[a + i] = Math.round(8000 * Math.sin((2 * Math.PI * 1000 * i) / RATE));
  return s;
}
const toWav = (samples, rate = RATE) => {
  const data = wav.samplesToBytes(samples);
  const out = Buffer.alloc(44 + data.length);
  Buffer.from(wav.wavHeader(data.length, rate)).copy(out, 0);
  Buffer.from(data).copy(out, 44);
  return out;
};

// Speech lengths like the real clips: cues short (padded to 1820 ms total like
// Azure's), sentences about 55 ms per character with ~350 ms of trailing silence.
const CUE_SPEECH = { 'cue-in': 500, 'cue-hold': 250, 'cue-out': 640, 'cue-rest': 330 };
function shapeFor(c) {
  if (c.kind === 'cue') {
    const speech = CUE_SPEECH[c.id];
    // Leads as measured on the real cues (cue-rest 125 ms, the others ~150 ms).
    const lead = c.id === 'cue-rest' ? 125 : 150;
    return { lead, speech, trail: c.id === 'cue-hold' ? 360 : 1820 - lead - speech };
  }
  return { lead: 180, speech: c.text.length * 55, trail: 350 };
}

// A clip folder with manifest.json. `edit(shapes)` may change shapes first;
// `after(dir, manifest)` may break things afterwards.
function clipFolder({ shapes: change, after: breakIt } = {}) {
  const dir = temp('voice-clips-');
  const shapes = Object.fromEntries(vs.allClips().map((c) => [c.id, shapeFor(c)]));
  if (change) change(shapes);
  const manifest = { voice: 'en-US-CoraMultilingualNeural', rate: '-15%', outputFormat: 'riff-22050hz-16bit-mono-pcm', date: '2026-11-17T20:33:34.508Z', clips: [] };
  for (const c of vs.allClips()) {
    const bytes = toWav(clipSamples(shapes[c.id]));
    fs.writeFileSync(path.join(dir, `${c.id}.wav`), bytes);
    manifest.clips.push({ id: c.id, file: `${c.id}.wav`, bytes: bytes.length, durationMs: Math.round(((bytes.length - 44) / 2 / RATE) * 1000) });
  }
  if (breakIt) breakIt(dir, manifest);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dir;
}

function runImport(argv, repoRoot = temp('voice-repo-')) {
  const lines = [];
  const code = imp.run(argv, { repoRoot, log: (s) => lines.push(String(s)) });
  return { code, out: lines.join('\n'), lines, voiceDir: path.join(repoRoot, 'assets/audio/voice'), repoRoot };
}

// --- Trimming -------------------------------------------------------------------

test('trim: trailing silence cut to 120 ms after the last sound; leading silence untouched', () => {
  assert.equal(imp.THRESHOLD, 104, '-50 dBFS');
  assert.equal(imp.WINDOW_MS, 5);
  assert.equal(imp.KEEP_TAIL_MS, 120);
  const s = clipSamples({ lead: 180, speech: 500, trail: 1140 });
  const t = imp.trimTail(s);
  const end = imp.soundEnd(s);
  assert.ok(Math.abs(end - ms2s(680)) <= ms2s(5), 'sound ends at lead + speech (5 ms windows)');
  assert.equal(t.length, end + ms2s(120));
  assert.deepEqual([...t.subarray(0, ms2s(200))], [...s.subarray(0, ms2s(200))], 'lead and onset unchanged');
  // A tail already under 120 ms is kept as it is; a silent clip is refused.
  const short = clipSamples({ lead: 100, speech: 400, trail: 60 });
  assert.equal(imp.trimTail(short).length, short.length);
  assert.equal(imp.trimTail(new Int16Array(ms2s(800))), null);
  // Quiet noise under -50 dBFS (|x| < 104) counts as silence.
  const noisy = clipSamples({ lead: 100, speech: 400, trail: 900 });
  for (let i = ms2s(500); i < noisy.length; i++) noisy[i] = i % 2 ? 90 : -90;
  assert.ok(Math.abs(imp.trimTail(noisy).length - ms2s(620)) <= ms2s(5));
});

// --- Import ----------------------------------------------------------------------

test('import: 44 trimmed WAVs with valid headers and SOURCE.json, into assets/audio/voice only', () => {
  const r = runImport([clipFolder(), '--tier', 'free-test']);
  assert.equal(r.code, 0, r.out);
  const files = fs.readdirSync(r.voiceDir).sort();
  assert.equal(files.length, 45);
  assert.ok(files.includes('SOURCE.json'));
  for (const c of vs.allClips()) {
    const bytes = fs.readFileSync(path.join(r.voiceDir, `${c.id}.wav`));
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    assert.equal(v.getUint32(4, true), bytes.length - 8, `${c.id}: RIFF size`);
    assert.equal(v.getUint32(40, true), bytes.length - 44, `${c.id}: data size`);
    const parsed = wav.parseWav(new Uint8Array(bytes));
    assert.equal(parsed.rate, 22050);
    const shape = shapeFor(c);
    const expected = Math.min(ms2s(shape.lead + shape.speech + shape.trail), imp.soundEnd(clipSamples(shape)) + ms2s(120));
    assert.equal(parsed.samples.length, expected, c.id);
  }
  // cue-in: 1820 ms as made, about 150 + 500 + 120 = 770 ms after the trim
  // (the sound ends on a 5 ms window, so up to 5 ms more).
  const cueIn = /cue-in\.wav {2}1820 ms -> (\d+) ms/.exec(r.out);
  assert.ok(cueIn && +cueIn[1] >= 770 && +cueIn[1] <= 775, r.out);
  assert.ok(!/^Warning:/m.test(r.out), 'clips shaped like the real ones raise no warning');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(r.voiceDir, 'SOURCE.json'), 'utf8')), {
    voice: 'en-US-CoraMultilingualNeural',
    rate: '-15%',
    date: '2026-11-17T20:33:34.508Z',
    outputFormat: 'riff-22050hz-16bit-mono-pcm',
    tier: 'free-test',
  });
  assert.match(r.out, /Imported 44 clips into assets[\\/]audio[\\/]voice \(tier free-test\); every phase length gets a voice\./);
  // Nothing else was written in the stand-in repo.
  assert.deepEqual(fs.readdirSync(r.repoRoot), ['assets']);
  assert.deepEqual(fs.readdirSync(path.join(r.repoRoot, 'assets')), ['audio']);
});

test('import: --tier is required (free-test or paid); there is no --out', () => {
  const dir = clipFolder();
  for (const argv of [[dir], [dir, '--tier'], [dir, '--tier', 'free'], [dir, '--tier', 'PAID'], [dir, '--tier', 'paid', '--out', 'x'], [dir, '--tier', 'paid', '--out=x'], ['--tier', 'paid']]) {
    const r = runImport(argv);
    assert.equal(r.code, 2, argv.join(' '));
    assert.equal(fs.existsSync(r.voiceDir), false, `${argv.join(' ')}: nothing written`);
  }
  const paid = runImport([dir, '--tier', 'paid']);
  assert.equal(paid.code, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(paid.voiceDir, 'SOURCE.json'), 'utf8')).tier, 'paid');
});

test('import: missing, malformed or mismatched clips fail and write nothing', () => {
  const cases = {
    'missing clip file': (dir) => fs.rmSync(path.join(dir, 'hold-07.wav')),
    'missing manifest entry': (_, m) => (m.clips = m.clips.filter((c) => c.id !== 'out-12')),
    'size differs from manifest': (_, m) => (m.clips.find((c) => c.id === 'in-04').bytes += 2),
    'duration differs from manifest': (_, m) => (m.clips.find((c) => c.id === 'in-04').durationMs += 50),
    'wrong output format': (_, m) => (m.outputFormat = 'riff-24khz-16bit-mono-pcm'),
    'no voice in manifest': (_, m) => delete m.voice,
    '44.1 kHz clip': (dir, m) => {
      const b = toWav(clipSamples({ speech: 900, trail: 300 }), 44100);
      fs.writeFileSync(path.join(dir, 'rest-03.wav'), b);
      Object.assign(m.clips.find((c) => c.id === 'rest-03'), { bytes: b.length });
    },
    'stereo clip': (dir, m) => {
      const b = toWav(clipSamples({ speech: 900, trail: 300 }));
      b.writeUInt16LE(2, 22);
      fs.writeFileSync(path.join(dir, 'rest-04.wav'), b);
      Object.assign(m.clips.find((c) => c.id === 'rest-04'), { bytes: b.length });
    },
    'not a WAV': (dir, m) => {
      const b = Buffer.from('<html>error</html>');
      fs.writeFileSync(path.join(dir, 'cue-out.wav'), b);
      Object.assign(m.clips.find((c) => c.id === 'cue-out'), { bytes: b.length });
    },
    'silent clip': (dir, m) => {
      const b = toWav(new Int16Array(ms2s(1820)));
      fs.writeFileSync(path.join(dir, 'cue-in.wav'), b);
      Object.assign(m.clips.find((c) => c.id === 'cue-in'), { bytes: b.length, durationMs: 1820 });
    },
  };
  for (const [label, breakIt] of Object.entries(cases)) {
    const r = runImport([clipFolder({ after: breakIt }), '--tier', 'free-test']);
    assert.equal(r.code, 1, label);
    assert.match(r.out, /^Import failed, nothing written: /m, label);
    assert.equal(fs.existsSync(r.voiceDir), false, `${label}: nothing written`);
  }
  const noManifest = temp('voice-clips-');
  assert.equal(runImport([noManifest, '--tier', 'paid']).code, 1);
});

test('fit report: a tight cue is reported; a phase with no voice fails the import', () => {
  // cue-hold: about 150 + 380 + 120 = 650 ms, so about 50 ms to spare at a 1 s hold
  // (a few ms less: the sound ends on a 5 ms window).
  const tight = runImport([clipFolder({ shapes: (s) => (s['cue-hold'] = { lead: 150, speech: 380, trail: 360 }) }), '--tier', 'free-test']);
  assert.equal(tight.code, 0, 'a warning, not a failure');
  const spare = /Warning: cue-hold leaves only (\d+) ms to spare at a 1 s phase \(speech unusually long\)/.exec(tight.out);
  assert.ok(spare && +spare[1] >= 45 && +spare[1] <= 50, tight.out);
  // cue-rest: 150 + 700 + 120 = 970 ms, too long for a 1 s rest: no voice there.
  const none = runImport([clipFolder({ shapes: (s) => (s['cue-rest'] = { lead: 150, speech: 700, trail: 970 }) }), '--tier', 'free-test']);
  assert.equal(none.code, 1);
  assert.ok(none.out.includes('Import failed, nothing written: no voice would fit: rest 1 s'), none.out);
  assert.equal(fs.existsSync(none.voiceDir), false);
  // A sentence longer than its own phase is noted (its cue is used there).
  const ok = runImport([clipFolder(), '--tier', 'free-test']);
  assert.ok(ok.out.includes('Note: in-02 is longer than its 2 s phase; the cue is used there'), ok.out);
});

test('fit report: with the trimmed lengths of the generated clips, every phase length gets a voice', () => {
  // The lengths measured on 2026-11-18 (trailing silence cut to 120 ms).
  const { loadTs: load } = require('../auth/helpers.cjs');
  const fit = load('src/features/session/audio/fitRule.ts');
  const measured = { 'cue-in': 803, 'cue-hold': 529, 'cue-out': 908, 'cue-rest': 579 };
  const durations = Object.fromEntries(vs.allClips().map((c) => [c.id, measured[c.id] ?? (c.kind === 'cue' ? 0 : 2500)]));
  for (const c of vs.allClips()) if (c.phase === 'hold' || c.phase === 'rest') if (c.kind === 'sentence') durations[c.id] = 1700;
  const r = imp.fitReport(durations, { script: vs, fit });
  assert.deepEqual(r.none, []);
  assert.deepEqual(r.cueTight, [], 'tightest: cue-rest 121 ms, cue-hold 171 ms, both over 100 ms');
});

// --- Safety ------------------------------------------------------------------------

test('safety: never writes outside <repo>/assets/audio/voice; never reads a key', () => {
  const src = fs.readFileSync(path.join(repo, 'scripts/import-voice-clips.mjs'), 'utf8');
  assert.ok(src.includes("export const VOICE_DIR = path.join('assets', 'audio', 'voice');"));
  assert.equal((src.match(/fs\.writeFileSync\(/g) || []).length, 2, 'the clips and SOURCE.json only');
  assert.ok(src.includes('fs.writeFileSync(path.join(out, `${c.id}.wav`)'));
  assert.ok(src.includes("fs.writeFileSync(path.join(out, 'SOURCE.json')"));
  assert.ok(src.includes('const out = path.join(repoRoot, VOICE_DIR);'));
  for (const f of ['scripts/import-voice-clips.mjs', 'scripts/check-voice-release.mjs']) {
    const s = fs.readFileSync(path.join(repo, f), 'utf8');
    assert.ok(!/process\.env|AZURE|SPEECH_KEY|fetch\(/.test(s), `${f}: no key, no network`);
  }
  // The real assets folder holds exactly the import's output: 44 clips and SOURCE.json.
  const voice = path.join(repo, 'assets/audio/voice');
  if (fs.existsSync(voice)) {
    assert.deepEqual(fs.readdirSync(voice).sort(), [...vs.allClips().map((c) => `${c.id}.wav`), 'SOURCE.json'].sort());
    assert.ok(imp.TIERS.includes(JSON.parse(fs.readFileSync(path.join(voice, 'SOURCE.json'), 'utf8')).tier));
  }
});

// --- Release gate ------------------------------------------------------------------

test('release gate: passes only with tier "paid" and all 44 valid clips', () => {
  const dir = clipFolder();
  const paid = runImport([dir, '--tier', 'paid']);
  assert.deepEqual(gate.checkVoiceRelease(paid.repoRoot), []);

  const free = runImport([dir, '--tier', 'free-test']);
  const p1 = gate.checkVoiceRelease(free.repoRoot);
  assert.equal(p1.length, 1);
  assert.equal(p1[0], 'SOURCE.json tier is "free-test", not "paid": regenerate the 44 clips on the pay-as-you-go tier and import with --tier paid');

  fs.rmSync(path.join(paid.voiceDir, 'out-07.wav'));
  fs.writeFileSync(path.join(paid.voiceDir, 'in-05.wav'), 'broken');
  assert.deepEqual(gate.checkVoiceRelease(paid.repoRoot), ['missing clip(s): out-07', 'not a 16-bit mono 22.05 kHz WAV: in-05']);

  fs.writeFileSync(path.join(free.voiceDir, 'SOURCE.json'), '{ not json');
  assert.deepEqual(gate.checkVoiceRelease(free.repoRoot), ['SOURCE.json is not valid JSON']);

  const empty = temp('voice-repo-');
  const p3 = gate.checkVoiceRelease(empty);
  assert.match(p3[0], /SOURCE\.json is missing/);
  assert.match(p3[1], /^missing clip\(s\): in-02, /);
});

test('release gate: its own npm command, not part of the normal test run; noted in PROGRESS.md', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['check:voice-release'], 'node scripts/check-voice-release.mjs');
  for (const [name, cmd] of Object.entries(pkg.scripts)) {
    if (name !== 'check:voice-release') assert.ok(!cmd.includes('check-voice-release'), name);
  }
  assert.ok(!fs.readdirSync(path.join(repo, 'tests'), { recursive: true }).some((f) => /check-voice-release\.test/.test(f)));
  const progress = fs.readFileSync(path.join(repo, 'PROGRESS.md'), 'utf8');
  assert.ok(progress.includes('regenerate the 44 clips on the pay-as-you-go tier and import with --tier paid'));
  assert.ok(progress.includes('`npm run check:voice-release`'));
});
