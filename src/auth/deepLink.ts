// Pure validator for email links. A link can only ever lead to verifyOtp, so
// anything that does not match exactly is treated as no link at all.

// The https page that forwards email links into the app.
export const AUTH_REDIRECT_URL = 'https://breathing-app-api.vercel.app/auth/callback';

export type AuthLinkType = 'email' | 'recovery';

export type AuthLink = { tokenHash: string; type: AuthLinkType };

// Shape seen on a device with flowType 'implicit': 56 lowercase hex characters
// with no prefix. If Supabase changes it, links fail safely here.
const TOKEN_HASH_RE = /^[a-f0-9]{56}$/;

function first(value: string | string[] | undefined | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function parseAuthLink(
  tokenHash: string | string[] | undefined | null,
  type: string | string[] | undefined | null
): AuthLink | null {
  const hash = first(tokenHash);
  const linkType = first(type);

  if (!hash || !TOKEN_HASH_RE.test(hash)) return null;
  if (linkType !== 'email' && linkType !== 'recovery') return null;
  return { tokenHash: hash, type: linkType };
}

// Every link from outside the app passes through here before routing (see
// app/+native-intent.tsx). The app has one inbound link, so anything else goes
// to the root route. Parsed by hand so it cannot throw on a malformed URL.
export function safeSystemPath(path: string): string {
  if (path.includes('expo-development-client')) return path;

  const [rawTarget, query = ''] = path.split('?');
  const target = rawTarget
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (target !== 'auth/callback') return '/';

  const params = new Map(
    query.split('&').map((pair): [string, string] => {
      const separator = pair.indexOf('=');
      return separator === -1 ? [pair, ''] : [pair.slice(0, separator), pair.slice(separator + 1)];
    })
  );
  const link = parseAuthLink(params.get('token_hash'), params.get('type'));
  return link ? `/auth/callback?token_hash=${link.tokenHash}&type=${link.type}` : '/';
}
