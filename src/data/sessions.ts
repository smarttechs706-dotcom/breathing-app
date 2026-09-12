import type { Session } from '../types/models';

// Local fallback/seed data — mirrors the future backend catalog
// (breathing-app-api's `sessions` table via GET /api/sessions).
//
// id/title/category/badge/pattern come from architecture.md's LOCKED
// "Library session mapping" table — do not re-derive these from category
// or title (see CLAUDE.md house rules).
//
// durationSec comes from PRD.md's session catalog table (minutes * 60) —
// NOT from the session-player-code.html Stitch mockup, which shows "10 MIN
// SESSION" for Deep Exhale. That's the same kind of Stitch placeholder-filler
// mismatch PRD.md already calls out for Library's category tab counts, so
// PRD.md's table wins.
//
// description: only Deep Exhale has real Stitch copy (from home-code.html).
// Note: session-player-code.html gives Deep Exhale a *different* description
// ("Designed to activate your parasympathetic nervous system...") — flagging
// this Stitch source inconsistency for resolution when Session Player is
// built; using the Home export's copy here since this file currently only
// backs the Home screen's Featured Session.
// The other 5 sessions have no Stitch-sourced copy anywhere in
// assets/design-reference/ (library-code.html only shows title + icon, no
// description) — their description text below is placeholder and should be
// revisited (real copywriting or a Stitch update) before the Library/Session
// Player build steps.
//
// phaseConfig (inhale/hold/exhale seconds): not specified anywhere in
// PRD.md/architecture.md/DESIGN.md yet — placeholder values consistent with
// PRD's "paced/extended-exhale breathing" (exhale longer than inhale).
export const sessions: Session[] = [
  {
    id: 'deep-exhale',
    title: 'Deep Exhale',
    category: 'Calm',
    durationSec: 18 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8 },
    badge: 'Leaf',
    pattern: 'rings',
    description:
      'Let go of tension and return to your body. Slow, grounding breaths to release and soften your mind.',
  },
  {
    id: 'morning-reset',
    title: 'Morning Reset',
    category: 'Sleep',
    durationSec: 18 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8 },
    badge: 'Moon',
    pattern: 'wave',
    description:
      'Ease into the day with a gentle, grounding breath pattern that clears overnight grogginess.',
  },
  {
    id: 'calm-focus',
    title: 'Calm Focus',
    category: 'Calm',
    durationSec: 15 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8 },
    badge: 'Leaf',
    pattern: 'starburst',
    description:
      'Steady, even breathing to settle a busy mind and sharpen focus before a task.',
  },
  {
    id: 'stress-relief',
    title: 'Stress Relief',
    category: 'Energy',
    durationSec: 10 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8 },
    badge: 'Zap',
    pattern: 'dot-grid',
    description:
      'A quick reset for high-pressure moments — short, extended-exhale breaths to lower tension fast.',
  },
  {
    id: 'wind-down',
    title: 'Wind Down',
    category: 'Sleep',
    durationSec: 12 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8 },
    badge: 'Moon',
    pattern: 'spiral',
    description:
      'Slow the nervous system down at the end of the day to prepare the body for rest.',
  },
  {
    id: 'box-breathing',
    title: 'Box Breathing',
    category: 'Recovery',
    durationSec: 12 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 4 },
    badge: 'Heart',
    pattern: 'bloom',
    description:
      'Equal-count inhale, hold, and exhale to restore balance and steady the heart rate.',
  },
];

export const getSessionById = (id: string): Session | undefined =>
  sessions.find((session) => session.id === id);

// Placeholder "For You" pick for the Home screen's Featured Session hero
// card — matches the Stitch home-code.html mockup, which features Deep
// Exhale. Real personalization logic is out of scope until the backend
// exists (see architecture.md's API contract).
export const featuredSession: Session = sessions[0];
