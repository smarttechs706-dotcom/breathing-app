// npm run check:voice-release
//
// Release gate for the voice guidance clips: must pass before any store
// build (see PROGRESS.md). Fails unless assets/audio/voice/SOURCE.json says
// tier "paid" (clips regenerated on the pay-as-you-go tier and imported with
// --tier paid) and all 44 clips are present as 16-bit mono 22.05 kHz WAVs.
// Offline, plain Node, no packages. Not part of the normal test run.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Returns a list of problems; empty means the release gate passes.
export function checkVoiceRelease(repoRoot = REPO_ROOT) {
  const { loadTs } = require(path.join(REPO_ROOT, 'tests/auth/helpers.cjs'));
  const script = loadTs('src/features/session/audio/voiceScript.ts');
  const wav = loadTs('src/features/session/audio/wav.ts');
  const dir = path.join(repoRoot, 'assets', 'audio', 'voice');
  const problems = [];

  const sourcePath = path.join(dir, 'SOURCE.json');
  if (!fs.existsSync(sourcePath)) {
    problems.push('assets/audio/voice/SOURCE.json is missing (import the clips first)');
  } else {
    let source = null;
    try {
      source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    } catch {
      problems.push('SOURCE.json is not valid JSON');
    }
    if (source && source.tier !== 'paid') {
      problems.push(`SOURCE.json tier is ${JSON.stringify(source.tier)}, not "paid": regenerate the 44 clips on the pay-as-you-go tier and import with --tier paid`);
    }
  }

  const missing = [];
  const malformed = [];
  for (const c of script.allClips()) {
    const file = path.join(dir, `${c.id}.wav`);
    if (!fs.existsSync(file)) {
      missing.push(c.id);
      continue;
    }
    const parsed = wav.parseWav(new Uint8Array(fs.readFileSync(file)));
    if (!parsed || parsed.rate !== 22050 || parsed.samples.length === 0) malformed.push(c.id);
  }
  if (missing.length) problems.push(`missing clip(s): ${missing.join(', ')}`);
  if (malformed.length) problems.push(`not a 16-bit mono 22.05 kHz WAV: ${malformed.join(', ')}`);
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const problems = checkVoiceRelease();
  if (problems.length) {
    for (const p of problems) console.log(`check:voice-release FAILED: ${p}`);
    process.exit(1);
  }
  console.log('check:voice-release passed: 44 clips, tier "paid".');
}
