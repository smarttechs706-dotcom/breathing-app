import { normalizeFirstName } from './validation';

type AccountUser = { user_metadata?: Record<string, unknown> } | null | undefined;

// The name lives on the account, set at sign-up and edited with updateUser.
// Re-normalized on read, so a bad stored value can't reach the greeting.
export function accountFirstName(user: AccountUser): string | null {
  const name = user?.user_metadata?.display_name;
  if (typeof name !== 'string') return null;
  return normalizeFirstName(name) || null;
}

// Array.from keeps a character made of two code units, such as an emoji, whole.
export function accountInitial(name: string | null): string | null {
  return name ? Array.from(name)[0].toUpperCase() : null;
}

export function homeGreeting(name: string | null): string {
  return name ? `Hi, ${name}` : 'Hi there';
}
