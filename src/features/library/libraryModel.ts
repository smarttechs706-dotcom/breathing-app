// Pure logic for the Library tab (LibraryScreen.tsx): filters, counts and the
// card-image lookup. No React Native imports, so it is tested directly in Node
// (tests/library/library.test.cjs).

export type Category = 'Calm' | 'Sleep' | 'Energy' | 'Recovery';
export type Badge = 'Leaf' | 'Moon' | 'Zap' | 'Heart';

// The fields the Library needs from a session (src/types/models.ts Session).
export interface LibrarySession {
  id: string;
  title: string;
  category: Category;
  durationSec: number;
  badge: Badge;
}

export type CategoryFilter = 'For You' | Category;
export const CATEGORIES: readonly CategoryFilter[] = ['For You', 'Calm', 'Sleep', 'Energy', 'Recovery'];

// Real counts from the fetched catalog; 0 while loading or on an error.
export function countFor(sessions: readonly LibrarySession[] | null, category: CategoryFilter): number {
  if (!sessions) return 0;
  if (category === 'For You') return sessions.length;
  return sessions.filter((s) => s.category === category).length;
}

// Category first, then a case-insensitive title match on the trimmed query.
export function filterSessions<T extends LibrarySession>(
  sessions: readonly T[] | null,
  category: CategoryFilter,
  query: string
): T[] {
  if (!sessions) return [];
  const byCategory = category === 'For You' ? [...sessions] : sessions.filter((s) => s.category === category);
  const q = query.trim().toLowerCase();
  if (!q) return byCategory;
  return byCategory.filter((s) => s.title.toLowerCase().includes(q));
}

export function formatDuration(durationSec: number): string {
  return `${Math.round(durationSec / 60)} min`;
}

// Card icon per badge: Ionicons outline versions of the existing badge map
// (Leaf -> eco, Moon -> bedtime, Zap -> bolt, Heart -> favorite). Taken from
// the session's own badge field, never re-derived from category or title.
export const BADGE_ICON: Record<Badge, string> = {
  Leaf: 'leaf-outline',
  Moon: 'moon-outline',
  Zap: 'flash-outline',
  Heart: 'heart-outline',
};

// Card image file per session id (in ./images). A session without an entry
// gets the fallback card. Source PNGs stay in assets/design-reference/.
export const CARD_IMAGE_FILES: Record<string, string> = {
  'deep-exhale': 'library-deep-exhale.jpg',
  'morning-reset': 'library-morning-reset.jpg',
  'calm-focus': 'library-calm-focus.jpg',
  'stress-relief': 'library-stress-relief.jpg',
  'wind-down': 'library-wind-down.jpg',
  'box-breathing': 'library-box-breathing.jpg',
};

export function hasCardImage(sessionId: string): boolean {
  return sessionId in CARD_IMAGE_FILES;
}
