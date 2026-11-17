// Offline tests for scripts/generate-voice-clips.mjs (the Azure clip
// generator): SSML, the voice and rate options, the manifest, and the safety
// rules (missing environment variables, the key never shown or stored, never
// writing into the repo's assets). No network: `fetch` is a stand-in that
// returns synthetic WAVs. Temporary folders are deleted afterwards.
// Run with:
//   node --test tests/session/voiceClipGenerator.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');
const { pathToFileURL } = require('node:url');

const repo = path.join(__dirname, '..', '..');
const SCRIPT = path.join(repo, 'scripts/generate-voice-clips.mjs');
const KEY = 'TEST-KEY-0123456789abcdef-secret';
const ENV = { AZURE_SPEECH_KEY: KEY, AZURE_SPEECH_REGION: 'westeurope' };

let gen;
const tempDirs = [];
before(async () => {
  gen = await import(pathToFileURL(SCRIPT).href);
});
after(() => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
});
function tempDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-gen-test-'));
  tempDirs.push(d);
  return d;
}

// A WAV as Azure returns it for riff-22050hz-16bit-mono-pcm: `ms` of silence.
function wavBytes(ms, { rate = 22050, channels = 1, bits = 16 } = {}) {
  const blockAlign = (channels * bits) / 8;
  const data = Math.round((rate * ms) / 1000) * blockAlign;
  const b = Buffer.alloc(44 + data);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + data, 4);
  b.write('WAVEfmt ', 8, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * blockAlign, 28);
  b.writeUInt16LE(blockAlign, 32);
  b.writeUInt16LE(bits, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(data, 40);
  return b;
}

// A stand-in for fetch: records each call; answers with `respond(call)`.
function fakeFetch(respond = () => ({ status: 200, body: wavBytes(1500) })) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const call = { url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body };
    calls.push(call);
    const r = respond(call, calls.length);
    if (r instanceof Error) throw r;
    const body = r.body ?? Buffer.alloc(0);
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
      json: async () => r.json,
    };
  };
  fn.calls = calls;
  return fn;
}

async function runGen(argv, { env = ENV, fetchImpl = fakeFetch() } = {}) {
  const lines = [];
  const code = await gen.run(argv, { env, fetchImpl, log: (s) => lines.push(String(s)), wait: async () => {}, now: () => new Date('2026-11-18T09:00:00Z') });
  return { code, lines, out: lines.join('\n'), calls: fetchImpl.calls };
}

const noKeyIn = (label, text) => assert.ok(!String(text).includes(KEY), `${label}: the key must never appear`);

// --- SSML ------------------------------------------------------------------------

test('SSML: Cora Multilingual pinned to en-US, slower rate, no style', () => {
  const ssml = gen.buildSsml('Breathe in slowly for four seconds', { voice: 'en-US-CoraMultilingualNeural', rate: '-15%' });
  assert.equal(
    ssml,
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' +
      '<voice name="en-US-CoraMultilingualNeural"><lang xml:lang="en-US"><prosody rate="-15%">Breathe in slowly for four seconds</prosody></lang></voice>' +
      '</speak>'
  );
  assert.ok(!/express-as|mstts:/.test(ssml), 'no style element');
});

test('SSML: en-US-CoraNeural needs no lang element; text is XML-escaped', () => {
  const ssml = gen.buildSsml('Rest & <breathe> "now"', { voice: 'en-US-CoraNeural', rate: '+5%' });
  assert.equal(
    ssml,
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' +
      '<voice name="en-US-CoraNeural"><prosody rate="+5%">Rest &amp; &lt;breathe&gt; &quot;now&quot;</prosody></voice>' +
      '</speak>'
  );
  assert.equal(gen.isMultilingual('en-US-CoraNeural'), false);
  assert.equal(gen.isMultilingual('en-US-CoraMultilingualNeural'), true);
});

test('request: Azure REST endpoint, WAV format header, key only in its header', () => {
  assert.equal(gen.endpoint('westeurope'), 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.throws(() => gen.endpoint('evil.example.com/x'), /region name/);
  const h = gen.buildHeaders(KEY);
  assert.equal(h['X-Microsoft-OutputFormat'], 'riff-22050hz-16bit-mono-pcm');
  assert.equal(h['Content-Type'], 'application/ssml+xml');
  assert.equal(h['Ocp-Apim-Subscription-Key'], KEY);
  assert.equal(gen.maskedHeaders(h)['Ocp-Apim-Subscription-Key'], '****');
  assert.ok(!/@|dell|smarttech/i.test(h['User-Agent']), 'a generic user agent, nothing personal');
});

// --- Options ---------------------------------------------------------------------

test('options: defaults, voice, rate, only; bad values are refused', () => {
  const ids = gen.loadClips().map((c) => c.id);
  assert.equal(ids.length, 44);
  const d = gen.parseArgs([], ids);
  assert.equal(d.voice, 'en-US-CoraMultilingualNeural');
  assert.equal(d.rate, '-15%');
  assert.equal(d.only, null);
  assert.equal(d.dryRun, false);
  assert.equal(d.outDir, path.resolve(os.tmpdir(), 'breathease-voice-clips', 'en-US-CoraMultilingualNeural'));
  assert.ok(!d.outDir.toLowerCase().startsWith(repo.toLowerCase()), 'default folder is outside the repo');
  const o = gen.parseArgs(['--voice', 'en-US-CoraNeural', '--rate', '-20%', '--only', 'in-04,hold-07,out-12', '--dry-run'], ids);
  assert.deepEqual([o.voice, o.rate, o.only, o.dryRun], ['en-US-CoraNeural', '-20%', ['in-04', 'hold-07', 'out-12'], true]);
  assert.equal(gen.parseArgs(['--rate', '10%'], ids).rate, '+10%');
  assert.equal(gen.parseArgs(['--rate', '0%'], ids).rate, '0%');
  for (const bad of [['--rate', '-60%'], ['--rate', 'slow'], ['--rate', '-15'], ['--only', 'in-01'], ['--voice', 'Cora'], ['--frobnicate'], ['--out']]) {
    assert.throws(() => gen.parseArgs(bad, ids), gen.UsageError, bad.join(' '));
  }
});

// --- Safety ------------------------------------------------------------------------

test('safety: missing key or region stops before anything is sent, without printing values', async () => {
  for (const env of [{}, { AZURE_SPEECH_KEY: KEY }, { AZURE_SPEECH_REGION: 'westeurope' }]) {
    const r = await runGen(['--only', 'in-04', '--out', tempDir()], { env });
    assert.equal(r.code, 2);
    assert.match(r.out, /Stopped: set (AZURE_SPEECH_KEY|AZURE_SPEECH_REGION)( and AZURE_SPEECH_REGION)?/);
    assert.equal(r.calls.length, 0);
    noKeyIn('missing env message', r.out);
    assert.ok(!r.out.includes('westeurope'), 'the region value is not printed either');
  }
});

test('safety: never writes into the repo assets folder (any spelling of the path)', async () => {
  for (const dir of ['assets', 'assets/audio/voice', 'ASSETS\\audio\\voice\\', 'assets/']) {
    assert.equal(gen.isForbiddenOutDir(path.join(repo, dir)), true, dir);
    const r = await runGen(['--only', 'in-04', '--out', path.join(repo, dir)]);
    assert.equal(r.code, 2, dir);
    assert.equal(r.calls.length, 0, `${dir}: nothing sent`);
  }
  assert.equal(fs.existsSync(path.join(repo, 'assets/audio/voice')), false, 'no voice folder was created');
  assert.equal(gen.isForbiddenOutDir(path.join(repo, 'assets-review')), false, 'a sibling name is fine');
  assert.equal(gen.isForbiddenOutDir(os.tmpdir()), false);
});

test('dry run: shows endpoint, masked headers and SSML; sends and writes nothing', async () => {
  const out = tempDir();
  fs.rmSync(out, { recursive: true });
  const r = await runGen(['--dry-run', '--only', 'in-04,rest-01', '--out', out]);
  assert.equal(r.code, 0);
  assert.equal(r.calls.length, 0, 'no request');
  assert.equal(fs.existsSync(out), false, 'no folder, no files');
  assert.ok(r.out.includes('POST https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1'));
  assert.ok(r.out.includes('"Ocp-Apim-Subscription-Key":"****"'));
  assert.ok(r.out.includes('in-04.wav  <speak'), 'one SSML line per clip');
  assert.ok(r.out.includes('Rest for one second'));
  noKeyIn('dry run', r.out);
});

// --- Generating (fake fetch) -------------------------------------------------------

test('run: one request per clip, WAVs saved, names and sizes printed, manifest without secrets', async () => {
  const out = tempDir();
  const r = await runGen(['--only', 'in-04,hold-07,out-12', '--out', out]);
  assert.equal(r.code, 0);
  assert.equal(r.calls.length, 3);
  for (const c of r.calls) {
    assert.equal(c.method, 'POST');
    assert.equal(c.url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    assert.equal(c.headers['Ocp-Apim-Subscription-Key'], KEY, 'the key goes only in the request header');
    assert.match(c.body, /<prosody rate="-15%">/);
  }
  assert.ok(r.calls[0].body.includes('Breathe in slowly for four seconds'));
  assert.deepEqual(fs.readdirSync(out).sort(), ['hold-07.wav', 'in-04.wav', 'manifest.json', 'out-12.wav']);
  // Output: only clip names and sizes (plus the manifest line).
  for (const line of r.lines) assert.match(line, /^(in-04|hold-07|out-12)\.wav  \d+ bytes$|^manifest\.json  \d+ of 44 clips/);
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(m.voice, 'en-US-CoraMultilingualNeural');
  assert.equal(m.rate, '-15%');
  assert.equal(m.outputFormat, 'riff-22050hz-16bit-mono-pcm');
  assert.equal(m.date, '2026-11-18T09:00:00.000Z');
  assert.deepEqual(m.clips.map((c) => c.id), ['in-04', 'hold-07', 'out-12'], 'in script order');
  for (const c of m.clips) {
    assert.equal(c.file, `${c.id}.wav`);
    assert.equal(c.bytes, wavBytes(1500).length);
    assert.equal(c.durationMs, 1500, 'from the WAV header');
  }
  // The key is nowhere: not in the output, the manifest or any file.
  noKeyIn('output', r.out);
  for (const f of fs.readdirSync(out)) noKeyIn(f, fs.readFileSync(path.join(out, f)).toString('latin1'));
  assert.ok(!/AZURE|KEY|westeurope/i.test(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')));
});

test('run: existing clips are skipped; the manifest lists everything in the folder', async () => {
  const out = tempDir();
  await runGen(['--only', 'in-04', '--out', out]);
  const r = await runGen(['--only', 'in-04,cue-in', '--out', out]);
  assert.equal(r.calls.length, 1, 'only the new clip is requested');
  assert.ok(r.calls[0].body.includes('>Breathe in<'));
  assert.ok(r.out.includes('in-04.wav  skipped (exists,'));
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.deepEqual(m.clips.map((c) => c.id), ['in-04', 'cue-in']);
});

test('run: failures are reported by status only, leave no file, and the run exits 1', async () => {
  const cases = [
    ['HTTP 401', () => ({ status: 401, body: Buffer.from(`bad key ${KEY}`) }), /failed: HTTP 401/],
    ['wrong format', () => ({ status: 200, body: wavBytes(800, { rate: 24000 }) }), /not a 22\.05 kHz 16-bit mono WAV/],
    ['stereo', () => ({ status: 200, body: wavBytes(800, { channels: 2 }) }), /not a 22\.05 kHz 16-bit mono WAV/],
    ['not a WAV', () => ({ status: 200, body: Buffer.from('<html>error</html>') }), /not a 22\.05 kHz 16-bit mono WAV/],
    ['network', () => new Error(`socket hang up ${KEY}`), /failed: network error/],
  ];
  for (const [label, respond, msg] of cases) {
    const out = tempDir();
    const r = await runGen(['--only', 'hold-07', '--out', out], { fetchImpl: fakeFetch(respond) });
    assert.equal(r.code, 1, label);
    assert.match(r.out, msg, label);
    assert.equal(fs.existsSync(path.join(out, 'hold-07.wav')), false, `${label}: no file`);
    noKeyIn(label, r.out);
  }
});

test('run: a 429 (too many requests) is retried, then succeeds', async () => {
  const out = tempDir();
  const r = await runGen(['--only', 'rest-02', '--out', out], {
    fetchImpl: fakeFetch((_, n) => (n === 1 ? { status: 429 } : { status: 200, body: wavBytes(900) })),
  });
  assert.equal(r.code, 0);
  assert.equal(r.calls.length, 2);
  assert.ok(fs.existsSync(path.join(out, 'rest-02.wav')));
});

test('voice info: prints locale and styles from Azure\'s list, never the key', async () => {
  const list = [{ ShortName: 'en-US-CoraMultilingualNeural', Locale: 'en-US', StyleList: [], SecondaryLocaleList: ['fr-FR'] }];
  const r = await runGen(['--voice-info'], { fetchImpl: fakeFetch(() => ({ status: 200, json: list })) });
  assert.equal(r.code, 0);
  assert.equal(r.calls[0].url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/voices/list');
  assert.equal(r.calls[0].method, 'GET');
  assert.equal(r.out, 'en-US-CoraMultilingualNeural: locale en-US, styles [], secondary locales ["fr-FR"]');
  noKeyIn('voice info', r.out);
});

test('source: the key is read only from the environment and only sent as the request header', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.equal((src.match(/AZURE_SPEECH_KEY/g) || []).length >= 1, true);
  assert.ok(src.includes('const key = env.AZURE_SPEECH_KEY;'));
  // Every code line (comments stripped) that uses `key` is one of these: read
  // from the environment, the missing check, and the request headers.
  const allowed = [
    'export function buildHeaders(key) {',
    "'Ocp-Apim-Subscription-Key': key,",
    'const key = env.AZURE_SPEECH_KEY;',
    "const missing = [!key && 'AZURE_SPEECH_KEY', !region && 'AZURE_SPEECH_REGION'].filter(Boolean);",
    "const res = await fetchImpl(url, { headers: { 'Ocp-Apim-Subscription-Key': key, 'User-Agent': USER_AGENT } });",
    'const headers = buildHeaders(key);',
  ];
  const keyLines = src
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => /\bkey\b/.test(l));
  for (const l of keyLines) assert.ok(allowed.includes(l), `unexpected use of key: ${l}`);
  assert.equal(keyLines.length, allowed.length);
  assert.ok(!/log\([^)]*\bkey\b|writeFileSync\([^)]*\bkey\b|JSON\.stringify\(headers\)/.test(src), 'never logged or written');
  assert.ok(!/process\.argv[^\n]*KEY|--key/.test(src), 'never taken from the command line');
  assert.ok(!/assets\/audio\/voice['"]/.test(src.replace(/\/\/.*$/gm, '')), 'no write path into the app assets');
});
