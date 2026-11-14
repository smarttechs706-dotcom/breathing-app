# Architecture — Breathe

## Tech stack
- **Frontend:** React Native + Expo + TypeScript (Expo Router)
- **Backend:** Next.js (App Router, TypeScript) — standalone project, separate
  repo from the mobile app
- **Database:** Supabase (Postgres) — accessed ONLY through the Next.js API,
  never directly from the mobile app
- **Auth:** Supabase Auth, email + password, through `supabase-js` for AUTH ONLY
- **Hosting (backend):** Vercel
- **Design source:** Stitch-generated DESIGN.md + HTML exports (see
  /assets/design-reference/) — these are the visual source of truth

## Key architectural decision: Next.js API layer in front of Supabase
The mobile app calls a custom Next.js REST API, which then talks to Supabase.
All data goes through that API with a Bearer token. The mobile app uses
`@supabase/supabase-js` for auth only, through `getAuth()` in
`src/auth/supabase.ts`, and holds only the publishable key. `npm run
check:auth` fails on `.from()`, `.rpc()`, storage or a server key in app code.

**Why:** full code ownership and portability (no platform lock-in), direct
debuggability (read our own API code and logs instead of a third-party
abstraction), and precise control over business logic (streak calculation,
mood-delta rules) that's easier to express correctly in real code than
through a low-code backend layer.

**Updated (2026-11-06):** the mobile app never reaches Supabase data directly,
for anything, ever. Auth is the one exception, for accounts only.
`breathing-app-api` is the sole data gateway, using the `service_role` key
only. Consequence: Supabase
Row Level Security on the underlying tables must still be enabled with
deny-all policies for `anon`/`authenticated` — `service_role` bypasses
RLS regardless, so this costs the API nothing, but the anon key is
publicly discoverable and RLS is the only thing stopping it from reading/
writing the tables directly, bypassing this API entirely.

## Repo structure

### Mobile app (`breathing-app/`)
```
breathing-app/
├── PRD.md
├── architecture.md
├── CLAUDE.md
├── app/
│   ├── (tabs)/
│   │   ├── home.tsx
│   │   ├── library.tsx
│   │   └── insights.tsx
│   ├── onboarding/
│   ├── session-player.tsx
│   ├── change-password.tsx
│   └── settings.tsx
├── src/
│   ├── theme/tokens.ts       # generated from DESIGN.md — colors, type, spacing, radius
│   ├── components/BreathingRing.tsx
│   ├── data/sessions.ts      # local fallback/seed data, mirrors backend catalog
│   ├── api/client.ts         # fetch wrapper, points at the Next.js API base URL
│   └── types/models.ts       # shared data models (see below)
└── assets/design-reference/  # Stitch DESIGN.md, HTML exports, screenshots
```

### Backend (`breathing-app-api/`)
```
breathing-app-api/
├── CLAUDE.md
├── app/api/
│   ├── sessions/route.ts     # GET, optional ?category=
│   ├── checkin/route.ts      # POST (Bearer)
│   ├── insights/route.ts     # GET (Bearer)
│   └── user/route.ts         # DELETE (Bearer), removes the account
├── lib/supabase.ts           # server-side Supabase client (service_role key)
└── types/models.ts           # kept in sync with mobile app's types/models.ts
```

## Colors — source of truth
When implementing `src/theme/tokens.ts`, use DESIGN.md's **frontmatter token
values** (the YAML block at the top — exact hex codes under `colors:`) as
the source of truth. The prose "Colors" section further down in DESIGN.md
(under "## Colors") is descriptive/explanatory only — e.g. it references an
Indigo-to-Purple gradient using different hex values than the frontmatter's
`primary`/`primary-container` tokens. Where the two disagree, the frontmatter
YAML wins.

## Data models (shared shape across frontend & backend)

```typescript
interface Session {
  id: string;
  title: string;
  category: 'Calm' | 'Sleep' | 'Energy' | 'Recovery';
  durationSec: number;
  phaseConfig: { inhale: number; hold: number; exhale: number };
  badge: 'Leaf' | 'Moon' | 'Zap' | 'Heart';
  pattern: 'rings' | 'wave' | 'starburst' | 'dot-grid' | 'spiral' | 'bloom';
}

interface Checkin {
  id: string;
  userId: string;    // response only, set by the API from the token
  sessionId: string;
  preMood: number;   // 1-5
  postMood: number;  // 1-5
  createdAt: string; // ISO timestamp
}

interface Streak {
  userId: string;    // response only, set by the API from the token
  currentStreak: number;
  longestStreak: number;
  lastSessionDate: string; // ISO date
}
```

## Locked reference data — Library session mapping
Do not re-derive this from category or title. This is final, confirmed data.

Updated 2026-09-19 by explicit product decision to match `src/data/
sessions.ts` (title/category renames + a corresponding badge fix — see
that file's header comment for the full reasoning, including why the
badge column changed for Morning Reset and Stress Relief):

| id | title | category | badge | pattern |
|---|---|---|---|---|
| deep-exhale | Deep Exhale | Calm | Leaf | rings |
| morning-reset | Morning Reset | Energy | Zap | wave |
| calm-focus | Calm and Focus | Calm | Leaf | starburst |
| stress-relief | Stress Relief | Calm | Leaf | dot-grid |
| wind-down | Sleep Wind Down | Sleep | Moon | spiral |
| box-breathing | Box Breathing | Recovery | Heart | bloom |

## API contract
Identity comes only from `Authorization: Bearer <access_token>`, read from
`getAuth().getSession()` in `src/api/client.ts`. The API ignores `userId` and
`user_id`, and the app never sends them.

- `GET {base_url}/api/sessions?category=` → `Session[]`. Public, no token
- `POST {base_url}/api/checkin` (Bearer) → body `{sessionId, preMood, postMood}`,
  inserts checkin, updates streak (increment if last session was yesterday,
  reset to 1 if gap >1 day, no-op if already checked in today), returns
  updated `Streak`
- `DELETE {base_url}/api/user` (Bearer) → removes the caller's check-ins, streak
  and account. The token stays valid for up to an hour, so the app signs out
  straight after
- `GET {base_url}/api/insights` (Bearer) → `{checkins: Checkin[] (last 30
  days), streak: Streak, totalSessions: number, sessionsThisWeek: number,
  mindfulMinutes: number, monthOverMonthDelta: number}` —
  `mindfulMinutes` is total session duration completed (sum of
  `durationSec` across checkins, in minutes); `monthOverMonthDelta` is
  percentage change in sessions completed vs. the prior 30-day period
  (matches the Insights screen's "+12% Vs Last Month" stat card)

Failures are handled in one place, `src/api/apiErrors.ts`, and screens show
`friendlyError(err)`:

| Reply | What the app does |
|---|---|
| 401 | Signs out once, Log in shows "Please sign in again." A check-in is held in memory and sent once if the same user logs back in |
| 503, no network, timeout | "Can't reach the server, try again" with a manual Retry. No sign-out, no automatic retry |
| 429 | "Too many requests, wait a moment." |
| Anything else | Generic text, never a status or server message |

## Session Player implementation (explicit — do not deviate)

Session Player is **one screen with internal state, not 3 separate
navigable screens/routes.**

- Single component (e.g. `app/session-player.tsx`) holds
  `currentPhase: 'pre-mood' | 'active' | 'post-mood'` as internal state and
  conditionally renders content based on it — no new route/URL per phase.
- Mood check-in data (preMood, postMood) lives in this component's state for
  the duration of the session — do not pass it through navigation params
  between separate screens, since there are no separate screens.
- Transitions between phases should be animated smoothly (fade/scale), not
  abrupt screen navigation — this matches the app's "weightless, continuous
  breathing rhythm" design language.
- **Back button behavior:** pressing back/exit during the `active` phase
  shows a confirmation dialog ("Exit session? Your progress won't be saved")
  rather than immediately dumping the user back to Library. During `pre-mood`
  or `post-mood` phases, back can exit directly without confirmation (no
  session progress to lose yet, or session is already complete).
- The back button/exit action never steps backward between phases (e.g. from
  `active` back to `pre-mood`) — it either continues forward or exits the
  whole session entirely.

### Real UI content per phase (sourced from Stitch export — use exactly)

**Phase 1 — pre-mood:**
- Top bar: close (X) icon left, "Breathe" title centered, settings icon right
- Duration badge (e.g. "10 MIN SESSION"), session title (e.g. "Deep Exhale")
- Description text explaining the session's physiological effect (e.g.
  "Designed to activate your parasympathetic nervous system, lowering your
  heart rate and melting away residual tension.") — pull actual copy per
  session from the sessions catalog, not hardcoded per-screen
- "How are you feeling?" label, 5-emoji mood row with "Stressed" (left) to
  "Calm" (right) labels underneath, selectable/slidable
- "Begin Journey" button (gradient pill, full width) — starts phase 2

**Phase 2 — active:**
- Current phase label centered above the ring (e.g. "Inhale...")
- Large breathing circle (`src/features/session/BreathCircle.tsx`: indigo disc
  with halo discs, the phase word inside, no icon). There is no orb anywhere
  in the app (removed 2026-11-14). Behind it, the looping background video
  under a 55% navy scrim; before and after the session, the session's own
  portrait painting instead (see PROGRESS.md, 2026-11-14)
- Secondary label below the ring for hold instructions (e.g.
  "Hold for 4 seconds") — updates per phase (inhale/hold/exhale) from the
  session's `phaseConfig`
- Elapsed time (left) / total duration (right) — e.g. "02:14" / "10:00"
- Progress bar showing session completion
- Pause/resume button (circular, icon-only) below the progress bar

**Phase 3 — post-mood:**
- Checkmark icon in a circular badge, centered
- "Session Complete" headline
- Subtext with actual minutes completed (e.g. "10 Mindful Minutes")
- "How do you feel now?" label
- Before/After mood comparison: the phase-1 mood emoji shown as "Before",
  an arrow, then the newly-selected "After" mood emoji/slider — both moods
  visible together, not just the after-mood alone
- "Done" button (full width) — marks phase complete, triggers the
  POST /api/checkin call, navigates back to Home

## Home screen — real UI content (sourced from Stitch export — use exactly)

- **Top bar:** avatar/profile icon (left) + "GOOD EVENING" uppercase label
  with the user's name below it in large gradient text (e.g. "Alex") — settings
  gear icon (right)
- **Featured Session section:** "Featured Session" headline + a small "NEW"
  pill badge (top-right of the section, not the card)
  - Hero card (glassmorphic, full width): the session's illustration
    (no orb; removed 2026-11-14), session title large (e.g. "Deep Exhale"), 2-3 line description
    text below it, a duration pill (e.g. "18 min") + a "Begin" button
    (gradient pill) side by side at the bottom of the card
  - Tapping "Begin" opens Session Player directly at the pre-mood phase for
    that session
- **"Your Snapshot" section:** headline + a "more options" (···) icon, top-right
  - 3 glassmorphic cards, vertically stacked (not side-by-side icons only —
    each is a full-width row card):
    1. **Mood card** — icon (left) + mood emoji (right), large mood word
       (e.g. "Calm") + "CURRENT MOOD" uppercase label underneath
    2. **Sessions card** — calendar icon (left) + small bar-chart glyph
       (right), large count + "sessions" (e.g. "12 sessions") +
       "THIS WEEK" uppercase label underneath
    3. **Streak card** — flame icon (left), large count + "days"
       (e.g. "5 days") + "CURRENT STREAK" uppercase label underneath, subtle
       orange tint on this card only (not a solid fill — glass card style
       matches the other two, just tinted)
- **Bottom nav:** per the shared bottom-nav component spec above

## Bottom navigation — Player tab behavior

Tapping the "Player" tab in the bottom nav when no session is active
redirects to the Library screen (not a dead/disabled tab, not a separate
empty state). The Player tab only shows the actual Session Player UI when
a session is genuinely in progress.

## Bottom navigation — shared component

Bottom nav is ONE shared component (app/(tabs)/_layout.tsx), not rebuilt
per screen. Use Home/Insights' version as the standard: icons are home,
grid_view (Library), air (Player), monitoring (Insights), each with a text
label underneath. Ignore the icon set and label-less style shown in the
Library Stitch export (subscriptions/play_circle/insights, no labels) —
that was Stitch generating inconsistent nav per screen; Home/Insights'
version wins.

## Auth (v1)
Required email + password accounts through Supabase Auth, with no guest mode.
The device UUID was removed in the Phase 5 API cutover.

- **Client:** `flowType: 'implicit'`. Email links use `verifyOtp` with a
  `token_hash`, which never reads a PKCE verifier, and the phone has no WebCrypto.
- **Session storage:** chunked SecureStore adapter. Sessions are about 2,300
  bytes, past the single-value size this adapter allows.
- **Links:** email → https page → `breathingapp://auth/callback` → `verifyOtp`.
  `src/auth/deepLink.ts` rejects anything not matching the known shape.
- **Status:** `src/auth/authStatus.ts` decides the one auth status; `AuthProvider`
  feeds it. A link flag is stored before `verifyOtp`, so a kill cannot skip
  the recovery or "Signed in as" screen.
- **Change password:** must check the current password with
  `signInWithPassword` first. Sessions from `verifyOtp` links skip Supabase's
  "Require current password" check, even for a wrong value (seen on a device,
  2026-11-06). `src/auth/changePassword.ts` does that, then calls `updateUser`
  with `current_password`. Nothing retries, and the 60 s wait starts only on a
  rate limit, so a typo can be corrected straight away.
- **Name:** `user_metadata.display_name`, set at sign-up and edited with
  `updateUser`. Home and Settings read it from the session through
  `src/auth/accountName.ts`. It is for display only. There is no local name.
- **Sign out:** `AuthProvider.signOut`, local scope, works with no signal. The
  route guards go to Log in. The daily reminder is a phone setting and stays.
- **Delete account:** see the API contract. The onboarding flag stays, so the
  phone lands on Log in.
- **Old installs:** `src/utils/legacyCleanup.ts` removes the old device id and
  local name by prefix at each launch, so neither key is named in code.
- **Known risk:** custom scheme links can be intercepted, and Android's system
  log records the full link. App Links fix this, after the closed test.

## Notifications
`expo-notifications` in the mobile app. Daily reminder scheduled locally on
device (user-configurable time in Settings); weekly recap requires a small
scheduled job — TBD whether this runs via a Vercel cron hitting an API route
or is triggered client-side on next app open after 7 days.