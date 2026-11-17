// node scripts/generate-voice-clips.mjs [options]
//
// Generates the 44 voice guidance clips (40 sentences and 4 cues, from the
// committed script src/features/session/audio/voiceScript.ts) with Azure
// text-to-speech, as 16-bit mono 22.05 kHz WAV files, the format the mixer
// expects. Plain Node (built-in fetch), no packages.
//
// Secrets: the key and region come ONLY from the environment variables
// AZURE_SPEECH_KEY and AZURE_SPEECH_REGION. They are never printed, logged,
// written to a file or put on the command line; the dry run shows the key as
// "****". Output lists only clip names and sizes.
//
// Options:
//   --out <folder>     where to write (default: %TEMP%/breathease-voice-clips/<voice>,
//                      outside the repo). Never inside the repo's assets folder.
//   --voice <name>     default en-US-CoraMultilingualNeural (en-US-CoraNeural also works)
//   --rate <percent>   speaking rate, -50% to +50% (default -15%)
//   --only <ids>       just these clips, e.g. in-04,hold-07,out-12
//   --dry-run          print what would be sent (key masked); send nothing, write nothing
//   --voice-info       ask Azure's voice list for this voice's locale and styles, then stop
//
// Styles: no speaking style (mstts:express-as) is sent. None is documented for
// en-US-CoraMultilingualNeural or en-US-CoraNeural to our knowledge; check
// with --voice-info, which prints the voice's own StyleList.
//
// Existing clips are skipped. After a run, manifest.json in the output folder
// lists each clip (id, file, bytes, duration from the WAV header) with the
// voice, rate and date; no secrets.
//
// Rate limit: the free F0 tier allows about 20 requests a minute, so a full
// run of 44 clips may end with some clips failing with HTTP 429 (each is
// retried twice, then reported). Simply run it again: existing clips are
// skipped, so only the missing ones are requested.
//
// Setting the key in Windows PowerShell without echoing it or keeping it in
// the command history (run in your own window; never paste the key into a
// command):
//   $s = Read-Host 'Azure speech key' -AsSecureString
//   $env:AZURE_SPEECH_KEY = [System.Net.NetworkCredential]::new('', $s).Password
//   $env:AZURE_SPEECH_REGION = 'westeurope'   # your resource's region
//   node scripts/generate-voice-clips.mjs --dry-run --only in-04
//   node scripts/generate-voice-clips.mjs --only in-04,hold-07,out-12
//   Remove-Item Env:AZURE_SPEECH_KEY, Env:AZURE_SPEECH_REGION   # when done

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_VOICE = 'en-US-CoraMultilingualNeural';
export const DEFAULT_RATE = '-15%';
export const OUTPUT_FORMAT = 'riff-22050hz-16bit-mono-pcm';
export const WAV_RATE = 22050;
const USER_AGENT = 'breathease-voice-clip-generator';
const MASK = '****';

// --- The script (the 44 clips) ------------------------------------------------

export function loadClips() {
  const { loadTs } = require(path.join(REPO_ROOT, 'tests/auth/helpers.cjs'));
  return loadTs('src/features/session/audio/voiceScript.ts').allClips();
}

// --- Options --------------------------------------------------------------------

export function defaultOutDir(voice, tmp = os.tmpdir()) {
  return path.join(tmp, 'breathease-voice-clips', voice);
}

// -15%, +10%, 0%: whole percent from -50 to +50.
export function parseRate(raw) {
  const m = /^([+-]?)(\d{1,2})%$/.exec(String(raw));
  if (!m) return null;
  const n = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  if (n < -50 || n > 50) return null;
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n)}%`;
}

const VOICE_NAME = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9]+Neural$/;

export function isMultilingual(voice) {
  return /MultilingualNeural$/.test(voice);
}

export function parseArgs(argv, clipIds) {
  const out = { voice: DEFAULT_VOICE, rate: DEFAULT_RATE, only: null, outDir: null, dryRun: false, voiceInfo: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${a} needs a value`);
      return v;
    };
    if (a === '--voice') out.voice = value();
    else if (a === '--rate') out.rate = value();
    else if (a === '--only') out.only = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--out') out.outDir = value();
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--voice-info') out.voiceInfo = true;
    else throw new UsageError(`unknown option ${a}`);
  }
  if (!VOICE_NAME.test(out.voice)) throw new UsageError(`not a voice name: ${out.voice}`);
  const rate = parseRate(out.rate);
  if (!rate) throw new UsageError(`--rate must be a whole percent from -50% to +50%, e.g. -15%`);
  out.rate = rate;
  if (out.only) {
    const unknown = out.only.filter((id) => !clipIds.includes(id));
    if (unknown.length) throw new UsageError(`unknown clip id(s): ${unknown.join(', ')}`);
    if (out.only.length === 0) throw new UsageError('--only needs at least one clip id');
  }
  out.outDir = path.resolve(out.outDir ?? defaultOutDir(out.voice));
  return out;
}

export class UsageError extends Error {}

// The output folder must never be the repo's assets (or inside it), where
// clips would be bundled into the app without review.
export function isForbiddenOutDir(dir, repoRoot = REPO_ROOT) {
  // Forward slashes and lower case, so C:\X\assets and c:/x/Assets/ compare equal.
  const norm = (p) => path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const assets = norm(path.join(repoRoot, 'assets'));
  const d = norm(dir);
  return d === assets || d.startsWith(`${assets}/`);
}

// --- Request ---------------------------------------------------------------------

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// One clip's SSML: the voice, the language pinned to en-US for a multilingual
// voice, a slower rate. No style element (see the header).
export function buildSsml(text, { voice, rate }) {
  const body = `<prosody rate="${escapeXml(rate)}">${escapeXml(text)}</prosody>`;
  const inner = isMultilingual(voice) ? `<lang xml:lang="en-US">${body}</lang>` : body;
  return (
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' +
    `<voice name="${escapeXml(voice)}">${inner}</voice>` +
    '</speak>'
  );
}

export function endpoint(region) {
  if (!/^[a-z0-9]+$/.test(region)) throw new UsageError('AZURE_SPEECH_REGION must be a region name such as westeurope');
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

export function voicesEndpoint(region) {
  if (!/^[a-z0-9]+$/.test(region)) throw new UsageError('AZURE_SPEECH_REGION must be a region name such as westeurope');
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
}

export function buildHeaders(key) {
  return {
    'Ocp-Apim-Subscription-Key': key,
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
    'User-Agent': USER_AGENT,
  };
}

// The headers as they may be shown: the key replaced by ****.
export function maskedHeaders(headers) {
  return { ...headers, 'Ocp-Apim-Subscription-Key': MASK };
}

// --- WAV check ---------------------------------------------------------------------

// { rate, channels, bits, dataBytes, durationMs } for a PCM WAV, else null.
export function wavInfo(bytes) {
  const b = Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length);
  if (b.length < 12 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') return null;
  let fmt = null;
  for (let at = 12; at + 8 <= b.length; ) {
    const id = b.toString('ascii', at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === 'fmt ' && at + 24 <= b.length) {
      fmt = { format: b.readUInt16LE(at + 8), channels: b.readUInt16LE(at + 10), rate: b.readUInt32LE(at + 12), byteRate: b.readUInt32LE(at + 16), bits: b.readUInt16LE(at + 22) };
    } else if (id === 'data' && fmt) {
      const dataBytes = Math.min(size, b.length - at - 8);
      if (fmt.format !== 1 || fmt.byteRate <= 0) return null;
      return { rate: fmt.rate, channels: fmt.channels, bits: fmt.bits, dataBytes, durationMs: Math.round((dataBytes / fmt.byteRate) * 1000) };
    }
    at += 8 + size + (size % 2);
  }
  return null;
}

export function isExpectedWav(info) {
  return !!info && info.rate === WAV_RATE && info.channels === 1 && info.bits === 16 && info.dataBytes > 0;
}

// --- Manifest ------------------------------------------------------------------------

export function buildManifest(dir, clips, { voice, rate, date = new Date() }) {
  const entries = [];
  for (const c of clips) {
    const file = `${c.id}.wav`;
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) continue;
    const bytes = fs.readFileSync(full);
    const info = wavInfo(bytes);
    entries.push({ id: c.id, file, bytes: bytes.length, durationMs: info ? info.durationMs : null });
  }
  return { voice, rate, outputFormat: OUTPUT_FORMAT, date: date.toISOString(), clips: entries };
}

// --- Run ------------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Returns the exit code. `env`, `fetchImpl`, `log` and `wait` are passed in so
// every rule is tested offline (tests/session/voiceClipGenerator.test.cjs).
export async function run(argv, { env = process.env, fetchImpl = globalThis.fetch, log = console.log, wait = sleep, now = () => new Date() } = {}) {
  const clips = loadClips();
  let opts;
  try {
    opts = parseArgs(argv, clips.map((c) => c.id));
  } catch (e) {
    if (e instanceof UsageError) {
      log(`Stopped: ${e.message}`);
      return 2;
    }
    throw e;
  }

  const key = env.AZURE_SPEECH_KEY;
  const region = env.AZURE_SPEECH_REGION;
  const missing = [!key && 'AZURE_SPEECH_KEY', !region && 'AZURE_SPEECH_REGION'].filter(Boolean);
  if (missing.length) {
    log(`Stopped: set ${missing.join(' and ')} in this terminal's environment first (the values are never printed).`);
    return 2;
  }
  let url;
  try {
    url = opts.voiceInfo ? voicesEndpoint(region) : endpoint(region);
  } catch (e) {
    log(`Stopped: ${e.message}`);
    return 2;
  }
  if (!opts.voiceInfo && !opts.dryRun && isForbiddenOutDir(opts.outDir)) {
    log("Stopped: the output folder must not be inside the repo's assets folder. Review clips first, then copy them in.");
    return 2;
  }

  if (opts.voiceInfo) {
    const res = await fetchImpl(url, { headers: { 'Ocp-Apim-Subscription-Key': key, 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      log(`Voice list failed: HTTP ${res.status}`);
      return 1;
    }
    const list = await res.json();
    const v = Array.isArray(list) ? list.find((x) => x.ShortName === opts.voice) : null;
    if (!v) {
      log(`${opts.voice}: not in this region's voice list`);
      return 1;
    }
    log(`${v.ShortName}: locale ${v.Locale}, styles ${JSON.stringify(v.StyleList ?? [])}, secondary locales ${JSON.stringify(v.SecondaryLocaleList ?? [])}`);
    return 0;
  }

  const selected = opts.only ? clips.filter((c) => opts.only.includes(c.id)) : clips;
  const headers = buildHeaders(key);

  if (opts.dryRun) {
    log(`Dry run: nothing is sent or written.`);
    log(`POST ${url}`);
    log(`Headers: ${JSON.stringify(maskedHeaders(headers))}`);
    log(`Output folder: ${opts.outDir}`);
    for (const c of selected) log(`${c.id}.wav  ${buildSsml(c.text, opts)}`);
    return 0;
  }

  fs.mkdirSync(opts.outDir, { recursive: true });
  let failed = 0;
  for (const c of selected) {
    const file = path.join(opts.outDir, `${c.id}.wav`);
    if (fs.existsSync(file) && fs.statSync(file).size > 44) {
      log(`${c.id}.wav  skipped (exists, ${fs.statSync(file).size} bytes)`);
      continue;
    }
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      let res;
      try {
        res = await fetchImpl(url, { method: 'POST', headers, body: buildSsml(c.text, opts) });
      } catch {
        log(`${c.id}.wav  failed: network error`);
        break;
      }
      if (res.status === 429 && attempt < 3) {
        await wait(2000 * attempt);
        continue;
      }
      if (!res.ok) {
        log(`${c.id}.wav  failed: HTTP ${res.status}`);
        break;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!isExpectedWav(wavInfo(bytes))) {
        log(`${c.id}.wav  failed: not a 22.05 kHz 16-bit mono WAV`);
        break;
      }
      fs.writeFileSync(file, bytes);
      log(`${c.id}.wav  ${bytes.length} bytes`);
      done = true;
    }
    if (!done) failed++;
  }

  const manifest = buildManifest(opts.outDir, clips, { voice: opts.voice, rate: opts.rate, date: now() });
  fs.writeFileSync(path.join(opts.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  log(`manifest.json  ${manifest.clips.length} of ${clips.length} clips${failed ? `, ${failed} failed` : ''}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run(process.argv.slice(2)).then((code) => process.exit(code));
}
