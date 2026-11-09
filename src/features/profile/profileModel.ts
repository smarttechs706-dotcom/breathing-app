// Pure helpers for the Profile tab (ProfileScreen.tsx): stat labels, the
// reminder status text and the list of rows. No React Native imports, so it
// is tested directly in Node (tests/profile/profile.test.cjs).

function count(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

// "1 day", "0 days", "12 days"
export function dayCount(days: number): string {
  const n = count(days);
  return n === 1 ? '1 day' : `${n} days`;
}

// "1 session", "0 sessions"
export function sessionCount(sessions: number): string {
  const n = count(sessions);
  return n === 1 ? '1 session' : `${n} sessions`;
}

// "10 min"
export function minutesLabel(minutes: number): string {
  return `${count(minutes)} min`;
}

// Same shape as src/utils/reminders.ts ReminderSettings.
export interface ReminderState {
  enabled: boolean;
  hour: number | null;
  minute: number | null;
}

// "8:00 PM", or "Off" when the reminder is off or has no time yet. The one
// wording for the reminder, on Profile and on the Reminder screen.
export function reminderLabel(settings: ReminderState | null): string {
  if (!settings || !settings.enabled || settings.hour === null || settings.minute === null) {
    return 'Off';
  }
  const period = settings.hour >= 12 ? 'PM' : 'AM';
  const hour12 = settings.hour % 12 === 0 ? 12 : settings.hour % 12;
  return `${hour12}:${String(settings.minute).padStart(2, '0')} ${period}`;
}

// Rows in the Profile list. They only link to screens; nothing here changes a
// setting. Change password, Privacy Policy and Sign out live in Settings.
export type ProfileRowKey = 'settings' | 'reminder';

export interface ProfileRow {
  key: ProfileRowKey;
  label: string;
  icon: string; // Ionicons outline name
  target: { kind: 'route'; href: '/settings' | '/reminder' };
}

export const PROFILE_ROWS: readonly ProfileRow[] = [
  { key: 'settings', label: 'Settings', icon: 'settings-outline', target: { kind: 'route', href: '/settings' } },
  // Opens the Reminder screen (app/reminder.tsx), the one place to change it.
  { key: 'reminder', label: 'Daily reminder', icon: 'alarm-outline', target: { kind: 'route', href: '/reminder' } },
];
