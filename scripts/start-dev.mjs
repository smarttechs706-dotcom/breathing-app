// npm run start:dev: Metro for the development app ("Breathease Dev",
// com.smarttech1.breathingapp.dev). Sets APP_VARIANT so app.config.ts gives
// Metro the development app's package and scheme, then runs `expo start
// --dev-client` with any extra arguments. Written in Node so it works the same
// in cmd, PowerShell and Git Bash (no packages needed).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cli = require.resolve('expo/bin/cli');

const child = spawn(process.execPath, [cli, 'start', '--dev-client', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, APP_VARIANT: 'development' },
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
