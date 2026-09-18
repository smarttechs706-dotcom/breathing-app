// Shared data models — mirrors architecture.md's "Data models" section.
// Keep in sync with breathing-app-api/types/models.ts once the backend exists.

export interface Session {
  id: string;
  title: string;
  category: 'Calm' | 'Sleep' | 'Energy' | 'Recovery';
  durationSec: number;
  // 4-phase pattern (2026-09-17 product decision): architecture.md:78
  // originally spec'd a 3-field { inhale, hold, exhale } shape — `rest`
  // is an intentional, flagged extension for the new BREATHE IN / HOLD /
  // BREATHE OUT / REST pattern applied to all 6 sessions. See PROGRESS.md.
  phaseConfig: { inhale: number; hold: number; exhale: number; rest: number };
  badge: 'Leaf' | 'Moon' | 'Zap' | 'Heart';
  pattern: 'rings' | 'wave' | 'starburst' | 'dot-grid' | 'spiral' | 'bloom';
  // Not in architecture.md's original interface, but required by both the
  // Home hero card and Session Player pre-mood copy ("pull actual copy per
  // session from the sessions catalog, not hardcoded per-screen") — flagged
  // as an intentional extension rather than a silent deviation.
  description: string;
}

export interface Checkin {
  id: string;
  userId: string;
  sessionId: string;
  preMood: number; // 1-5
  postMood: number; // 1-5
  createdAt: string; // ISO timestamp
}

export interface Streak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastSessionDate: string; // ISO date
}
