// node scripts/import-voice-clips.mjs <clip folder> --tier free-test|paid
//
// Imports the 44 voice guidance clips made by scripts/generate-voice-clips.mjs
// into the app: assets/audio/voice/<id>.wav plus assets/audio/voice/SOURCE.json.
// Offline, plain Node, no packages; it never reads or prints any key.
//
// Checks first, writes nothing unless every check passes:
// - the folder has manifest.json and all 44 clip ids from the committed voice
//   script (src/features/session/audio/voiceScript.ts);
// - each file is a 16-bit mono 22.05 kHz PCM WAV, not silent, and its size and
//   duration match the manifest; the manifest's output format is the expected
//   riff-22050hz-16bit-mono-pcm;
// - after trimming (below), every phase length the editor allows gets a voice
//   under the app's fit rule (src/features/session/audio/fitRule.ts): the
//   import fails if any would get nothing.
// Trimming: trailing silence is cut to 120 ms after the last sound, found in
// 5 ms windows (a window is sound if its peak reaches -50 dBFS). Leading
// silence is kept as it is (decided 2026-11-18; revisit after hearing it).
// Reported, not fatal: a cue with under 100 ms to spare at its shortest phase,
// and a sentence too long for its own phase length (the cue is used there).
//
// --tier is required: "free-test" (made on the free F0 tier, for testing) or
// "paid" (pay-as-you-go). It is recorded in SOURCE.json; the release gate
// (npm run check:voice-release) fails unless it is "paid".
// The destination is always <repo>/assets/audio/voice; there is no option to
// write anywhere else.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const OUTPUT_FORMAT = 'riff-22050hz-16bit-mono-pcm';
export const RATE = 22050;
export const WINDOW_MS = 5;
export const THRESHOLD_DBFS = -50;
export const THRESHOLD = Math.round(32768 * 10 ** (THRESHOLD_DBFS / 20)); // 104
export const KEEP_TAIL_MS = 120;
export const MIN_CUE_SPARE_MS = 100;
export const TIERS = ['free-test', 'paid'];
export const VOICE_DIR = path.join('assets', 'audio', 'voice');

// Every phase length the editor allows (customPattern limits; a 0-second hold
// or rest is skipped and needs no voice).
export const PHASE_RANGES = { inhale: [2, 10], hold: [1, 10], exhale: [2, 12], rest: [1, 10] };

function app() {
  const { loadTs } = require(path.join(REPO_ROOT, 'tests/auth/helpers.cjs'));
  return {
    script: loadTs('src/features/session/audio/voiceScript.ts'),
    fit: loadTs('src/features/session/audio/fitRule.ts'),
    wav: loadTs('src/features/session/audio/wav.ts'),
  };
}

export class ImportError extends Error {}

// --- Arguments ------------------------------------------------------------------

export function parseArgs(argv) {
  let from = null;
  let tier = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tier') {
      tier = argv[++i];
      if (tier === undefined) throw new ImportError('--tier needs a value: free-test or paid');
    } else if (a === '--out' || a.startsWith('--out=')) {
      throw new ImportError('there is no --out: clips are always imported into assets/audio/voice');
    } else if (a.startsWith('--')) {
      throw new ImportError(`unknown option ${a}`);
    } else if (from === null) {
      from = a;
    } else {
      throw new ImportError(`unexpected argument ${a}`);
    }
  }
  if (!from) throw new ImportError('give the clip folder: node scripts/import-voice-clips.mjs <folder> --tier free-test|paid');
  if (!TIERS.includes(tier)) throw new ImportError('--tier is required: free-test or paid');
  return { from: path.resolve(from), tier };
}

// --- Trimming ----------------------------------------------------------------------

// Sample index just after the last sound window (0 if silent).
export function soundEnd(samples, rate = RATE) {
  const win = Math.round((WINDOW_MS * rate) / 1000);
  for (let w = Math.ceil(samples.length / win) - 1; w >= 0; w--) {
    let peak = 0;
    for (let i = w * win; i < Math.min(samples.length, (w + 1) * win); i++) peak = Math.max(peak, Math.abs(samples[i]));
    if (peak >= THRESHOLD) return Math.min(samples.length, (w + 1) * win);
  }
  return 0;
}

// The clip with its trailing silence cut to KEEP_TAIL_MS (never longer than it
// was; leading silence untouched). null for a silent clip.
export function trimTail(samples, rate = RATE) {
  const end = soundEnd(samples, rate);
  if (end === 0) return null;
  const keep = Math.round((KEEP_TAIL_MS * rate) / 1000);
  return samples.subarray(0, Math.min(samples.length, end + keep));
}

export function wavFile(samples, rate, wav) {
  const data = wav.samplesToBytes(samples);
  const out = new Uint8Array(wav.HEADER_BYTES + data.length);
  out.set(wav.wavHeader(data.length, rate), 0);
  out.set(data, wav.HEADER_BYTES);
  return out;
}

const msOf = (n, rate = RATE) => (n * 1000) / rate;

// --- Fit report ----------------------------------------------------------------------

// For every phase length: what the fit rule chooses with these clip lengths.
// Returns { none: [...], cueTight: [...], sentenceFallback: [...] }.
export function fitReport(durations, { script, fit }) {
  const none = [];
  const cueTight = [];
  const sentenceFallback = [];
  for (const [phase, [lo, hi]] of Object.entries(PHASE_RANGES)) {
    const cue = script.cueClipId(phase);
    const spare = lo * 1000 - fit.FIT_MARGIN_MS - durations[cue];
    if (spare < MIN_CUE_SPARE_MS) cueTight.push({ id: cue, phaseSec: lo, spareMs: Math.round(spare) });
    for (let s = lo; s <= hi; s++) {
      const sid = script.sentenceClipId(phase, s);
      const choice = fit.chooseVoice(s * 1000, sid ? durations[sid] : null, durations[cue]);
      if (choice === 'none') none.push({ phase, sec: s });
      else if (choice === 'cue' && sid) sentenceFallback.push({ id: sid, phaseSec: s });
    }
  }
  return { none, cueTight, sentenceFallback };
}

// --- Run --------------------------------------------------------------------------------

export function run(argv, { repoRoot = REPO_ROOT, log = console.log } = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    if (e instanceof ImportError) {
      log(`Stopped: ${e.message}`);
      return 2;
    }
    throw e;
  }
  try {
    return importClips(opts, { repoRoot, log });
  } catch (e) {
    if (e instanceof ImportError) {
      log(`Import failed, nothing written: ${e.message}`);
      return 1;
    }
    throw e;
  }
}

function importClips({ from, tier }, { repoRoot, log }) {
  const { script, fit, wav } = app();
  const clips = script.allClips();

  // Manifest.
  const manifestPath = path.join(from, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new ImportError(`no manifest.json in ${from}`);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new ImportError('manifest.json is not valid JSON');
  }
  if (manifest.outputFormat !== OUTPUT_FORMAT) throw new ImportError(`manifest outputFormat is not ${OUTPUT_FORMAT}`);
  for (const k of ['voice', 'rate', 'date']) {
    if (typeof manifest[k] !== 'string' || !manifest[k]) throw new ImportError(`manifest has no ${k}`);
  }
  const entries = new Map((Array.isArray(manifest.clips) ? manifest.clips : []).map((c) => [c.id, c]));
  const missing = clips.filter((c) => !entries.has(c.id) || !fs.existsSync(path.join(from, `${c.id}.wav`)));
  if (missing.length) throw new ImportError(`missing clip(s): ${missing.map((c) => c.id).join(', ')}`);

  // Each clip: format, manifest match, trim.
  const trimmed = {};
  const durations = {};
  const lines = [];
  for (const c of clips) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(from, `${c.id}.wav`)));
    const entry = entries.get(c.id);
    if (entry.file !== `${c.id}.wav` || entry.bytes !== bytes.length) throw new ImportError(`${c.id}: does not match manifest.json`);
    const parsed = wav.parseWav(bytes);
    if (!parsed || parsed.rate !== RATE) throw new ImportError(`${c.id}: not a 16-bit mono 22.05 kHz WAV`);
    const ms = msOf(parsed.samples.length);
    if (typeof entry.durationMs !== 'number' || Math.abs(entry.durationMs - ms) > 1) throw new ImportError(`${c.id}: duration does not match manifest.json`);
    const t = trimTail(parsed.samples);
    if (!t) throw new ImportError(`${c.id}: silent`);
    trimmed[c.id] = t;
    durations[c.id] = msOf(t.length);
    lines.push(`${c.id}.wav  ${Math.round(ms)} ms -> ${Math.round(durations[c.id])} ms`);
  }

  // Fit rule over every phase length.
  const report = fitReport(durations, { script, fit });
  for (const w of report.cueTight) log(`Warning: ${w.id} leaves only ${w.spareMs} ms to spare at a ${w.phaseSec} s phase (speech unusually long)`);
  for (const f of report.sentenceFallback) log(`Note: ${f.id} is longer than its ${f.phaseSec} s phase; the cue is used there`);
  if (report.none.length) {
    throw new ImportError(`no voice would fit: ${report.none.map((n) => `${n.phase} ${n.sec} s`).join(', ')}`);
  }

  // Write: the 44 clips and SOURCE.json.
  const out = path.join(repoRoot, VOICE_DIR);
  fs.mkdirSync(out, { recursive: true });
  const known = new Set(clips.map((c) => `${c.id}.wav`).concat('SOURCE.json'));
  const extra = fs.readdirSync(out).filter((f) => !known.has(f));
  if (extra.length) log(`Warning: other files in ${VOICE_DIR} were left alone: ${extra.join(', ')}`);
  for (const c of clips) fs.writeFileSync(path.join(out, `${c.id}.wav`), wavFile(trimmed[c.id], RATE, wav));
  const source = { voice: manifest.voice, rate: manifest.rate, date: manifest.date, outputFormat: manifest.outputFormat, tier };
  fs.writeFileSync(path.join(out, 'SOURCE.json'), JSON.stringify(source, null, 2) + '\n');
  for (const l of lines) log(l);
  log(`Imported 44 clips into ${VOICE_DIR} (tier ${tier}); every phase length gets a voice.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(run(process.argv.slice(2)));
}
