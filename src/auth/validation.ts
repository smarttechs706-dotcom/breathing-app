export const MIN_PASSWORD_LENGTH = 8;

export const MAX_FIRST_NAME_LENGTH = 30;

export function normalizeEmail(raw: string): string {
  return raw.trim();
}

// Catches typos only. Supabase and the confirmation email decide what is real.
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Home's greeting has fixed space, so the stored name stays short and on one line.
export function normalizeFirstName(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, MAX_FIRST_NAME_LENGTH)
    .trim();
}

export function isValidNewPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
