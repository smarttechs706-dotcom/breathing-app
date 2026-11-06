import { safeSystemPath } from '../src/auth/deepLink';

// Runs before routing on cold and warm starts. Must never throw, because that
// would take the app down on a malformed link.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return safeSystemPath(path);
  } catch {
    return '/';
  }
}
