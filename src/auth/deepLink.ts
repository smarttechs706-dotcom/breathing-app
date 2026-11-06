// Pure validator for email links. A link can only ever lead to verifyOtp, so
// anything that does not match exactly is treated as no link at all.

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
