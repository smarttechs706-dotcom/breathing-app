// Fails if app code breaks the auth contract. This repo has no ESLint, so this
// is the lint step: `npm run check:auth`.
//
//   --cutover   also fail on device-id code. Add from Phase 5, once it is gone.
//   [root]      folder to check, defaults to the repo. Used to test this script.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const cutover = args.includes('--cutover');
const rootArg = args.find((arg) => !arg.startsWith('--'));
const root = resolve(rootArg ?? join(dirname(fileURLToPath(import.meta.url)), '..'));

const CLIENT_FILE = 'src/auth/supabase.ts';

// These names have their own .from() and are not the Supabase client.
const SAFE_FROM = /\b(Array|Uint8Array|Uint32Array|Buffer|Object|Set|Map)\.from\(/g;

const rules = [
  {
    message: 'supabase-js may only be imported in src/auth/supabase.ts',
    test: (line, file) =>
      file !== CLIENT_FILE && /from\s+['"]@supabase\/supabase-js['"]/.test(line),
  },
  {
    message: 'the Supabase client is auth only: no .from()',
    test: (line) => /\.from\(/.test(line.replace(SAFE_FROM, '')),
  },
  { message: 'the Supabase client is auth only: no .rpc()', test: (line) => /\.rpc\(/.test(line) },
  {
    message: 'the Supabase client is auth only: no storage',
    test: (line) => /\b(supabase|client)\.storage\b/.test(line),
  },
  {
    message: 'only getAuth() may leave src/auth/supabase.ts, never the client',
    test: (line, file) =>
      file === CLIENT_FILE && /export\s+(default\b|\{|(const|let)\s+client\b)/.test(line),
  },
  {
    message: 'server keys never belong in the app',
    test: (line) => /service_role|sb_secret_/.test(line),
  },
  {
    message: 'never log emails, tokens or passwords',
    test: (line) =>
      /console\.\w+\(/.test(line) && /email|token|password|session/i.test(line),
  },
];

if (cutover) {
  rules.push({
    message: 'device ids were replaced by accounts',
    // Phase 6: add breathe_user_name back here once src/utils/userName.ts is gone.
    test: (line) => /deviceId|getDeviceId|breathe_device_id/.test(line),
  });
}

function sourceFiles(folder) {
  let entries;
  try {
    entries = readdirSync(folder);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx)$/.test(entry) ? [path] : [];
  });
}

const failures = [];

for (const folder of ['src', 'app']) {
  for (const path of sourceFiles(join(root, folder))) {
    const file = relative(root, path).replaceAll('\\', '/');
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        for (const rule of rules) {
          if (rule.test(line, file)) failures.push(`${file}:${index + 1}  ${rule.message}`);
        }
      });
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  console.error(`\ncheck:auth failed with ${failures.length} problem(s).`);
  process.exit(1);
}

console.log(`check:auth passed${cutover ? ' (with --cutover)' : ''}.`);
