// Held at module level, not in the screen, so leaving and returning does not
// reset the wait. Lost when the app is killed, when Supabase's own rate limit
// still applies. Not keyed by email: a per-address wait could hint at accounts.

export type CooldownKey = 'resend' | 'forgot';

export const COOLDOWN_SECONDS = 60;

const endsAt = new Map<CooldownKey, number>();

export function startCooldown(key: CooldownKey, now = Date.now()): void {
  endsAt.set(key, now + COOLDOWN_SECONDS * 1000);
}

export function cooldownSecondsLeft(key: CooldownKey, now = Date.now()): number {
  const end = endsAt.get(key);
  return end === undefined ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
}
