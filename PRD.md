# PRD — Breathe (working title)

## Problem
UAE-based professionals face frequent, short bursts of work stress — between
meetings, mid-shift, after a hard call — with no fast, low-effort way to reset.
Existing wellness apps (Calm, Headspace) are built around long-form evening
rituals, not quick daytime resets, and aren't localized to the UAE/GCC context.

## Target user
UAE-based professionals who want a quick stress reset during the workday, not
a bedtime wellness ritual. Busy, task-oriented, using the app in short bursts
(2-18 min), not as a long evening practice.

**Not yet validated with real users** — this is the working hypothesis from
product reasoning. Validation (customer conversations, landing page test)
should run in parallel with the build, and copy/positioning may shift once
real signal comes in.

## Core problem this solves
Guided breathing technique (paced/extended-exhale breathing) triggers real,
short-term parasympathetic nervous system activation — lowers perceived
stress in minutes. This is a stress-regulation tool, NOT a medical/respiratory
treatment device — copy and marketing must never imply treatment of
diagnosed respiratory or medical conditions.

## Core loop
Browse → Play → Check in → See result → Come back

1. User opens app, sees a personalized "For You" session
2. Picks a session (or uses Quick Start for zero-friction entry)
3. Pre-session mood check-in (1-5 slider)
4. Guided breathing session (animated visual pacer, timed phases)
5. Post-session mood check-in, sees before/after delta
6. Returns via streak motivation + reminder notifications

## Core screens (v1)
1. **Onboarding** (3 screens, first launch only) — Welcome → How it Works →
   Build the Habit, ends in "Get Started" + optional notification permission
   - **Copy override:** the Stitch export for "How it Works" includes 
     the line "Choose from guided breaths, body scans, or nature sounds" 
     on the "Pick a session" step. This references features not in this 
     app's scope. Use instead: "Choose a guided breathing session matched 
     to how you're feeling."
2. **Home** — greeting, Featured Session hero card, Snapshot (mood/sessions/streak)
3. **Library** — search, category tabs (For You/Calm/Sleep/Energy/Recovery —
   5 tabs: For You plus all 4 real session categories; an earlier draft of
   this list said 4 tabs and omitted Energy, which didn't match the
   category-count example below it), Quick Start button, session grid
   - Category tab counts must reflect real counts from the 6-session
     catalog (as of 2026-09-19: "Calm 3", "Sleep 1", "Energy 1",
     "Recovery 1" — see the session catalog table below) — NOT the Stitch
     mockup's placeholder numbers (e.g. "For You 292", "Calm 45"), which
     were illustrative filler for the design mockup only
   - Quick Start immediately begins the current "For You" recommended
     session — skips Library browsing entirely, opens Session Player
     directly at the pre-mood phase
4. **Session Player** — ONE screen with internal state, not 3 separate
   navigable screens/routes. Transitions between 3 phases as component state
   (`currentPhase = 'pre-mood' | 'active' | 'post-mood'`): pre-session mood →
   active breathing ring → post-session mood + delta. No navigation or
   back-button stepping between phases — see architecture.md for the full
   rationale and back-button behavior.
5. **Insights** — mood trend chart, streak calendar, stat cards
6. **Settings** — reminder time, notification toggle (not yet designed)

## Retention hooks (v1 priority order)
1. Streak counter + loss-aversion nudge
2. Pre/post mood delta (the core "reward" moment)
3. Daily reminder notification (time-of-day based)
4. Weekly recap notification
5. Time-of-day aware "For You" personalization
6. Progress visualization (Insights screen)

## Out of scope for v1
- Real biometric integration (HealthKit/Google Fit) — deliberately using
  manual mood entry instead, to avoid permission friction and scope creep
- User accounts/auth — device-based UUID only for v1
- Paywall/monetization — add only once approaching real launch with a
  validated pricing model; not needed for validation testing
- Multi-language/Arabic localization — noted as a possible differentiator,
  not committed for v1
- Calendar integration (workplace-aware scheduling) — a possible v2
  differentiator, not v1

## Success signals to watch post-launch
- Day-2 and Day-7 retention (does the streak/reminder loop actually work)
- Sessions per active user per week
- Mood delta trend over time (are check-ins showing real improvement)
- Notification opt-in rate

## Session catalog (v1, 6 sessions)
| Session | Category | Duration |
|---|---|---|
| Deep Exhale | Calm | 10 min |
| Morning Reset | Energy | 18 min |
| Calm and Focus | Calm | 15 min |
| Stress Relief | Calm | 10 min |
| Wind Down | Sleep | 12 min |
| Box Breathing | Recovery | 12 min |

Deep Exhale's duration (originally 18 min in this table) and description
were updated to match session-player-code.html's version — 10 min,
"Designed to activate your parasympathetic nervous system, lowering your
heart rate and melting away residual tension." — made canonical everywhere
by explicit product decision (2026-09-12), overriding this table's
original value and home-code.html's differing description text.

"Calm Focus" was renamed to "Calm and Focus" (title only), Morning Reset
moved from Sleep to Energy, and Stress Relief moved from Energy to Calm —
explicit product decision (2026-09-19). This makes this table (and the
category counts above) diverge from architecture.md's LOCKED "Library
session mapping" table, which still lists the old title/category values —
flagged as a known, intentional deviation there, not silently re-derived.
