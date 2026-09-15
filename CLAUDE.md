# CLAUDE.md — breathing-app (mobile)

Read PRD.md, architecture.md, and PROGRESS.md before starting any work in
this repo.

## House rules — never violate these
- **Never call Supabase directly from this app.** No `@supabase/supabase-js`
  as a dependency, no Supabase client code, no Supabase auth. All data goes
  through the Next.js API defined in architecture.md.
- **Never re-derive the Library session mapping** (badge/category/pattern).
  Use the locked table in architecture.md exactly as given — it's the result
  of extensive verification, not a starting guess.
- **Don't reintroduce real biometric data** (heart rate, blood oxygen,
  stress %). This app uses manual mood check-ins only — see PRD.md "Out of
  scope" for why.
- **Match the Stitch design reference exactly** for visual work — colors,
  typography, spacing come from `assets/design-reference/DESIGN.md` and the
  HTML exports in that folder. Don't improvise a different visual style.

## Working style
- Read PROGRESS.md at the start of every session to see what's already
  built before starting new work. Update it at the end of each session with
  what changed and what's next.
- Build one screen or feature at a time. Test/verify before moving to the
  next — don't batch multiple screens into a single unreviewed change.
- When reporting on a fix (e.g. "the mapping now matches"), show the actual
  data/state (a printed table, a real code diff) rather than just describing
  what should be true. Claims and actual rendered output have diverged before
  in this project's design phase — verify, don't just assert.
- If a design decision in PRD.md or architecture.md seems wrong or outdated,
  flag it and ask rather than silently deviating.

## Build/run commands
(fill in once the fresh Expo project is scaffolded — e.g. `npx expo start`,
test commands, lint commands)

## Skills in use
- frontend-design (Anthropic) + impeccable — for visual polish decisions
- Context7 — for up-to-date Expo/library API references
- Playwright CLI — for visual verification of built screens against design
  references in assets/design-reference/

## Current build order
1. Theme tokens (`src/theme/tokens.ts`) from DESIGN.md
2. Home (dummy/placeholder data)
3. Library, using the locked session mapping (dummy/placeholder data)
4. Session Player (3 states, dummy/placeholder data)
5. Insights (dummy/placeholder data)
6. Onboarding (3 screens)
7. Settings — **no Stitch design exists yet**; needs a design pass or
   written spec before starting this step, see PRD.md
8. Scaffold breathing-app-api/ and build the real backend (see
   architecture.md's API contract)
9. Wire all screens to the real backend API, replacing dummy data
10. Notifications (daily reminder, weekly recap)
