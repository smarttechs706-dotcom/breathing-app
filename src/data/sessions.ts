import type { Session } from '../types/models';

// Local fallback/seed data — mirrors the future backend catalog
// (breathing-app-api's `sessions` table via GET /api/sessions).
//
// id/title/category/badge/pattern come from architecture.md's LOCKED
// "Library session mapping" table — do not re-derive these from category
// or title (see CLAUDE.md house rules).
//
// durationSec comes from PRD.md's session catalog table (minutes * 60),
// EXCEPT Deep Exhale — user explicitly decided (2026-09-12) to make
// session-player-code.html's version canonical for Deep Exhale instead:
// 10 min + "Designed to activate your parasympathetic nervous system,
// lowering your heart rate and melting away residual tension." PRD.md's
// table (originally 18 min) was updated to match, so this is no longer a
// silent deviation — flagged and resolved by explicit product decision,
// not a Stitch-mockup-filler guess. The other 5 sessions still use PRD.md's
// table durations as-is.
//
// description: only Deep Exhale has real Stitch copy (session-player-code.html,
// per the above) — no other session has Stitch-sourced copy anywhere in
// assets/design-reference/ (library-code.html only shows title + icon, no
// description). The other 5 sessions' descriptions below (added 2026-09-17)
// are written copy matching Deep Exhale's tone — one sentence naming the
// session's actual phaseConfig technique and the physiological reason it
// suits that session's mood/context — not Stitch-sourced, and should still
// be revisited if a real Stitch export ever supplies canonical copy.
//
// phaseConfig: explicit product decision (2026-09-17) — all 6 sessions use
// the same 4-4-8-4 BREATHE IN / HOLD / BREATHE OUT / REST pattern, replacing
// the prior per-session (mostly identical) 3-phase placeholder values.
// architecture.md:78 still documents the older 3-field { inhale, hold,
// exhale } shape and its "Inhale.../Hold for 4 seconds" copy convention —
// flagged as an intentional, known deviation rather than silently updated;
// see PROGRESS.md. `rest` is a new field (src/types/models.ts).
//
// title/category: explicit product decision (2026-09-19) — "Calm Focus"
// renamed to "Calm and Focus" (title only, id/description/duration/pattern
// unchanged); Morning Reset moved Sleep→Energy; Stress Relief moved
// Energy→Calm. "Wind Down" renamed to "Sleep Wind Down" (title only, same
// day, separate request).
//
// badge: checked the original Stitch source (library-code.html) before
// deciding — it assigns each session's badge icon 1:1 with its (then)
// category with zero exceptions (Calm→eco/Leaf, Sleep→bedtime/Moon,
// Energy→bolt/Zap, Recovery→favorite/Heart), confirming badge is a
// category indicator, not an independent per-session technique/feel
// attribute. So when Morning Reset and Stress Relief's categories moved
// above, their badges were updated to match the convention rather than
// left pointing at the old category: Morning Reset Moon→Zap (Sleep→Energy),
// Stress Relief Zap→Leaf (Energy→Calm) — resolved 2026-09-19, not left as a
// flagged mismatch.
//
// architecture.md:103-110's LOCKED "Library session mapping" table has been
// updated to match all of the above (title/category/badge) as part of this
// same resolution, so it's back in sync with this file — this is an
// intentional, explicit update to the locked table, not a silent
// re-derivation (see CLAUDE.md's house rule and PROGRESS.md).
export const sessions: Session[] = [
  {
    id: 'deep-exhale',
    title: 'Deep Exhale',
    category: 'Calm',
    durationSec: 10 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8, rest: 4 },
    badge: 'Leaf',
    pattern: 'rings',
    description:
      'Slow, deep breathing to help you release tension and feel more relaxed.',
  },
  {
    id: 'morning-reset',
    title: 'Morning Reset',
    category: 'Energy',
    durationSec: 18 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8, rest: 4 },
    badge: 'Zap',
    pattern: 'wave',
    description:
      'Gentle breathing to help shake off morning grogginess and ease into your day.',
  },
  {
    id: 'calm-focus',
    title: 'Calm and Focus',
    category: 'Calm',
    durationSec: 15 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8, rest: 4 },
    badge: 'Leaf',
    pattern: 'starburst',
    description:
      'Slow, steady breathing to quiet a busy mind and help you focus.',
  },
  {
    id: 'stress-relief',
    title: 'Stress Relief',
    category: 'Calm',
    durationSec: 10 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8, rest: 4 },
    badge: 'Leaf',
    pattern: 'dot-grid',
    description:
      'A quick breathing reset to help you feel calmer when stress hits.',
  },
  {
    id: 'wind-down',
    title: 'Sleep Wind Down',
    category: 'Sleep',
    durationSec: 12 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8, rest: 4 },
    badge: 'Moon',
    pattern: 'spiral',
    description:
      'Slow breathing to help you relax and get ready for sleep.',
  },
  {
    id: 'box-breathing',
    title: 'Box Breathing',
    category: 'Recovery',
    durationSec: 12 * 60,
    phaseConfig: { inhale: 4, hold: 4, exhale: 8, rest: 4 },
    badge: 'Heart',
    pattern: 'bloom',
    description:
      'A steady breathing rhythm to help you reset and regain a sense of calm.',
  },
];

export const getSessionById = (id: string): Session | undefined =>
  sessions.find((session) => session.id === id);

// Placeholder "For You" pick for the Home screen's Featured Session hero
// card — matches the Stitch home-code.html mockup, which features Deep
// Exhale. Real personalization logic is out of scope until the backend
// exists (see architecture.md's API contract).
export const featuredSession: Session = sessions[0];
