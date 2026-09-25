# Frontend Audit #2 (deep pass) — Breathe (breathing-app)

**Date:** 2026-09-26
**Scope:** Full read-only diagnostic audit of the mobile app (`breathing-app/`), with a specific focus on its now-live connection to the real backend (`breathing-app-api/`) — loading/error/empty states under real network conditions, data-shape integrity between frontend and backend, and any leftover dummy data from before the API was wired in. Covers every screen, shared component, and shared state.
**Method:** Read every screen/component/data/type/theme/config file directly. Cross-referenced against `PROGRESS.md` (all ~3,475 lines, via its full section index plus targeted reads of every entry from the backend-wiring phase onward), `CLAUDE.md`, `DESIGN.md`, `architecture.md`, `AUDIT.md` (2026-09-19), `AUDIT-2.md` (2026-09-20), and `COLOR-AUDIT.md`, so already-found/already-fixed items are not re-reported as new. Cross-checked the frontend's `src/types/models.ts` against the backend's `types/models.ts` with a literal `diff`, and cross-checked every field each screen reads from an API response against the actual backend route code (`breathing-app-api/app/api/{sessions,checkin,insights}/route.ts`) — no `BACKEND-AUDIT.md` exists in the backend repo, so the route code itself is the source of truth used here. Ran `npx tsc --noEmit` (clean) and targeted `grep`s across `app/` and `src/` for stale imports, `TODO`/`console.*`, and dummy-data references, rather than trusting prior write-ups. **This document is the only file created as part of this audit — no code was modified.**

---

## Executive Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 (1 resolved 2026-09-26) |
| Medium | 4 |
| Low | 4 |
| Info | 3 |
| **Total** | **13** |

`npx tsc --noEmit` is clean. No crash-risk bugs were found. The two **High** findings were both new, both about the live-backend integration specifically (the category this audit was asked to focus on), and both are real code-verified facts, not hypotheses:

1. **[HIGH — RESOLVED 2026-09-26]** ~~Four screens still read session content (title, description, duration, breathing pattern, badge) from the local static catalog (`src/data/sessions.ts`), never from the live `GET /api/sessions` backend~~ — Home's Featured Session hero card, `app/session-player.tsx` (the screen every session is actually *played* on), Library's Quick Start button's target, and Player's Quick Suggestions. Library's session **grid** and Insights were the only places actually reading the live catalog for session content. **Fixed — see "RESOLVED (2026-09-26)" below for the full before/after and the new dedicated "session not found" state that replaces the old silent-fallback behavior.**
2. **[HIGH — still open]** No fetch has a timeout anywhere in the app. `src/api/client.ts`'s three functions (`fetchSessions`, `postCheckin`, `fetchInsights`) all call plain `fetch()` with no `AbortController`/timeout. Home, Library, Insights, and Player's streak card all show an indefinite loading spinner if the backend is merely *slow* (not down) — there is no escape hatch besides backgrounding the app. This is distinct from the already-handled "request fails outright" case (all four screens handle an outright failure/rejection correctly, with error text + Retry). **Out of scope for the 2026-09-26 fix pass (only the finding above was requested) — remains open.**

Everything else is Medium/Low/Info-level. See below, organized by screen, followed by what was checked and confirmed unchanged from `AUDIT.md`/`AUDIT-2.md`/`COLOR-AUDIT.md` (not re-reported).

---

## Data-shape integrity (new category for this pass)

### Frontend/backend `types/models.ts` — byte-for-byte diff, not just eyeballed

```
$ diff breathing-app/src/types/models.ts breathing-app-api/types/models.ts
2c2
< // Keep in sync with breathing-app-api/types/models.ts once the backend exists.
---
> // Keep in sync with breathing-app/src/types/models.ts.
```

The actual `Session`/`Checkin`/`Streak` interfaces are **identical**, no drift. The only difference is a stale comment on the frontend's copy — it still says "once the backend exists," which is no longer true. **[Info]** Worth a one-line update next time either file is touched, not urgent.

### Every field each screen reads — cross-checked against the real route code

| Screen reads | Backend route | Fields the UI consumes | Present in the real response? |
|---|---|---|---|
| Library grid (`fetchSessions`) | `GET /api/sessions` (`route.ts:17-27`) | `id,title,category,durationSec,phaseConfig,badge,pattern,description` | **Yes**, all 7 — `toSession()` maps every DB column 1:1, no gaps |
| Home/Insights snapshot (`fetchInsights`) | `GET /api/insights` (`route.ts:128-135`) | `checkins[]`, `streak.currentStreak`, `totalSessions`, `sessionsThisWeek`, `mindfulMinutes`, `monthOverMonthDelta` | **Yes**, all present, matching `InsightsResponse` in `client.ts` exactly |
| Session Player (`postCheckin`) | `POST /api/checkin` (`route.ts:121`) | `Streak` return value (unused — `handleDone` discards the response, only checks for a thrown error) | **Yes**, though the frontend never reads the updated streak from this response at all — see the Session Player section below |

### A real, legitimate-backend-response null case the UI already handles correctly

`GET /api/insights` (`route.ts:105-107`): a brand-new user with no `streaks` row yet returns `streak: { userId, currentStreak: 0, longestStreak: 0, lastSessionDate: "" }` — note `lastSessionDate` is an **empty string**, not `null` and not a valid ISO date. Grepped the whole app for `lastSessionDate` and `longestStreak` usage: **neither is read anywhere in the frontend** (`currentStreak` is the only `Streak` field any screen displays). So this legitimate empty-string edge case currently can't cause a bad date-parse or a broken render — but it's worth knowing before either field is ever wired into a screen (e.g., a future "longest streak: 8 days" stat), since `lastSessionDate: ""` would need explicit handling, not an assumption that it's always parseable.

### [HIGH] Session content: 4 screens use the local catalog, never the live backend

Grepped every import of `src/data/sessions.ts` app-wide:

```
app/(tabs)/home.tsx:32:      import { featuredSession } from '../../src/data/sessions';
app/(tabs)/library.tsx:27:    import { featuredSession } from '../../src/data/sessions';
app/(tabs)/player.tsx:22:     import { getSessionById } from '../../src/data/sessions';
app/session-player.tsx:23:    import { featuredSession, getSessionById } from '../src/data/sessions';
```

- **`app/(tabs)/home.tsx`** — the entire Featured Session hero card (the single most prominent element on the Home screen) reads `featuredSession.title`, `.description`, `.durationSec` straight from the local file. Never calls `fetchSessions()`.
- **`app/session-player.tsx:84`** — `const session = getSessionById(sessionId ?? '') ?? featuredSession;`. This is the screen every breathing session actually plays on — title, description, duration badge, `phaseConfig` (breathing timing), badge, and the id sent to `POST /api/checkin` all come from this local lookup, **never** from `GET /api/sessions`.
- **`app/(tabs)/library.tsx:27,100`** — the session *grid* correctly uses `fetchSessions()`, but the Quick Start button's target session (`featuredSession.id`) is still the local one.
- **`app/(tabs)/player.tsx:22`** — Quick Suggestions (added this session) also reads from the local catalog, consistent with the rest of the app's current pattern — not a new problem, but not a fix either.

**Concrete failure scenario this enables today, not hypothetically:** if the backend's `sessions` table ever diverges from `src/data/sessions.ts` — an admin renames a session, changes its duration, or (more importantly) adds a 7th session — Library's grid (real data) would show the new/changed session correctly, but:
1. Tapping that new session opens `session-player.tsx`, whose `getSessionById(sessionId)` finds nothing in the local catalog and **silently falls back to `featuredSession`** (Deep Exhale) — the user sees Deep Exhale's title, description, and breathing pattern instead of the session they actually tapped, with **no error, no warning**.
2. Finishing that session calls `postCheckin({ sessionId: session.id, ... })` with `session.id` now equal to `'deep-exhale'` (the fallback's id, not the session the user actually opened) — **the checkin is silently mis-attributed** to the wrong session in the backend, which would then corrupt that user's real `mindfulMinutes`/session-history data going forward, since `mindfulMinutes` is computed server-side from `checkins → sessions.duration_sec` via a join (`insights/route.ts:71`, `109-115`) keyed on whatever `session_id` was actually stored.

At the *current* moment this isn't visibly broken (the local catalog and the backend's seed data are presumably still in sync), but the architecture has no safeguard against them drifting, and drifting silently is exactly the failure mode — nothing would error or warn until someone happened to compare the two by hand. This is squarely the kind of "leftover dummy/hardcoded fallback from before the real API was wired in" this audit was asked to find, and it's the most consequential one in the app: it affects the core play-a-session flow, not a cosmetic corner.

*Was left unfixed by the original diagnostic pass (read-only, per instruction) — fixed in a dedicated follow-up. See "RESOLVED (2026-09-26)" immediately below.*

---

## RESOLVED (2026-09-26): all 4 screens rewired to the live session catalog

Fixed exactly the 4 screens this finding named — Home's Featured Session card, `app/session-player.tsx`, Library's Quick Start target, and Player's Quick Suggestions — and nothing else (`git diff --stat` confirms no other files changed). All four now call the same `fetchSessions()` (`src/api/client.ts`) Library's grid already used; no new API function was needed since no single-session-by-id endpoint exists and adding one would have meant touching the backend, out of scope.

- **Home** (`app/(tabs)/home.tsx`): the Featured Session card now has its own independent `featuredSession`/`featuredError` state and fetch (parallel to, not merged with, the existing Snapshot section's `insights` fetch — preserves this screen's existing per-section-independent-gating pattern). Looks up a new `FEATURED_SESSION_ID = 'deep-exhale'` constant in the live list (matching architecture.md's locked table, not just "whichever session the unordered Supabase query returns first"), with its own loading spinner and error+Retry UI (reusing the Snapshot section's existing `snapshotCenterState`-family styles, not new ones). A genuinely empty live catalog is treated as the error branch (a friendly message) rather than left as a permanently-stuck spinner.
- **Library** (`app/(tabs)/library.tsx`): the simplest of the four — Quick Start now looks up the same `FEATURED_SESSION_ID` from the `sessions` state this screen already fetches for its grid, instead of a separate local import. No new fetch. Guarded to no-op (not crash) if the catalog is empty.
- **Player** (`app/(tabs)/player.tsx`): Quick Suggestions now fetches live via its own `quickSuggestions`/`loadQuickSuggestions` effect (parallel to the existing Calm Streak fetch), with real loading (small inline spinner) and error (`"Couldn't load suggestions." + Retry`) states — explicitly *not* the silent-omission pattern the Calm Streak stat still uses (that's a separate, still-open Low finding from this same audit, intentionally left alone).
- **Session Player** (`app/session-player.tsx`) — the significant one. The old `getSessionById(sessionId ?? '') ?? featuredSession` synchronous local lookup is gone entirely. Replaced with a `sessions`/`fetchError` fetch (identical shape/pattern to Library's), a derived `session = sessions?.find(s => s.id === sessionId) ?? null`, and **three explicit states checked in order before any phase UI renders**: the fetch failed (icon + message + real error text + Retry), still loading (spinner), or fetch succeeded but no session matches the id (a **dedicated "Session not found." state** — different icon, different copy, a "Back to Library" action — not the same UI as a network error, and not a silent substitution). All three states keep the top bar (and its working X/settings buttons) visible via a new shared `TopBar` component, mirroring `insights.tsx`'s own existing module-level `TopBar` pattern. Every hook that reads `session.*` (`setActiveSessionId`, the auto-advance-to-post-mood effect, the breath sub-phase cycle) is now guarded with an `if (!session) return;` so a session can only be marked "active" for the Player tab once it has genuinely resolved from live data — previously this fired immediately even for a malformed/unrecognized deep link, since the old fallback made *something* always immediately available.

**The specific risk this closes:** opening a `sessionId` that doesn't exist in the live catalog now shows "Session not found." with no way to proceed into a breathing session at all — there is no code path left that can silently substitute a different session's content or let `handleDone` submit a checkin under the wrong `sessionId`.

**`src/data/sessions.ts` is now fully unused app-wide** — confirmed via `grep -rn "from '.*data/sessions'" app src`, zero matches. Per instruction, **not deleted** — flagging here as now-fully-dead code for a future cleanup pass, same treatment `src/data/insights.ts` already got after the Insights/Home backend-wiring phase (see `PROGRESS.md`).

**Verified:**
- `npx tsc --noEmit`: clean.
- `git diff --stat` against the pre-fix baseline: only the 4 named screens changed (`app/(tabs)/home.tsx`, `app/(tabs)/library.tsx`, `app/(tabs)/player.tsx`, `app/session-player.tsx`) — no other file touched, confirming scope was respected.
- Interactively, on an isolated Expo web server (port 8094, phone's 8081 and the backend's own port 3000 left running/untouched throughout), via `playwright-cli`:
  - Confirmed via `playwright-cli requests` that Home, Library, Player, and Session Player each independently issue their own real `GET /api/sessions` call (not a shared cache, not a stale value) and render the live response (Deep Exhale / Box Breathing with their real durations).
  - Tapping Home's Begin and Library's Quick Start both correctly resolved to `sessionId=deep-exhale` from the live list and opened Session Player with the correct live content.
  - **Simulated a full backend failure** (`playwright-cli route "**/api/sessions*" --status=500`) and reloaded Home, Library, Player, and Session Player: all four showed the expected error state with real error text (`GET /api/sessions failed: 500`) and a working Retry button; removing the simulated failure and tapping Retry correctly recovered real data on all four (screenshotted before/after for each).
  - **Navigated directly to `/session-player?sessionId=this-session-does-not-exist`**: confirmed the dedicated "Session not found." state renders (distinct copy/icon from the error state), the top bar's X and settings remain functional, and "Back to Library" correctly navigates there — no substitution of Deep Exhale or any other session occurred.
  - Browser closed, isolated web server stopped, temp screenshot/snapshot files deleted afterward.

### [HIGH — still open] No fetch timeout anywhere — `src/api/client.ts`

```ts
export async function fetchSessions(...) { const response = await fetch(url.toString()); ... }
export async function postCheckin(...) { const response = await fetch(url.toString(), {...}); ... }
export async function fetchInsights(...) { const response = await fetch(url.toString()); ... }
```

No `AbortController`, no `signal`, no timeout anywhere in the file (confirmed by reading it in full — 73 lines, 3 functions, all plain `fetch`). Traced what each of the 4 consuming screens does while a request is outstanding:

- **Home** (`insights === null`): `ActivityIndicator` in the Snapshot section, indefinitely.
- **Library** (`sessions === null`): full-screen `ActivityIndicator`, indefinitely.
- **Insights** (`insights === null`): full-screen `ActivityIndicator`, indefinitely.
- **Player** (`currentStreak === null`, this session's new code): inline `ActivityIndicator` next to "Calm Streak," indefinitely.

All four correctly handle an outright *rejected* fetch (backend down, DNS failure, etc.) with an error message + Retry button — that path was checked and works. The gap is specifically a *slow-but-not-failing* backend (a cold Vercel function, a slow Supabase query, a flaky mobile connection): every one of these screens has no way to time out and offer a retry — the spinner just spins forever unless the user force-backgrounds the app. Given this app will run on real mobile networks (the entire point of the "test on your phone" workflow used earlier this session), this is a realistic, not edge-case, scenario. *Suggested fix: wrap each `fetch` with an `AbortController` + a reasonable timeout (e.g. 10-15s), and surface a timeout as the same error+Retry UI each screen already has for outright failures — the UI plumbing for that already exists on 3 of the 4 screens.*

---

## Home (`app/(tabs)/home.tsx`)

### Functional
- Begin button (`Pressable`/`onPress`, not `onTouchEnd` — the old bug stays fixed), settings gear, and the real `fetchInsights` wiring for the Snapshot section were all re-traced and correct.
- **[High — RESOLVED 2026-09-26, see above]** Featured Session card was 100% local dummy data, never fetched — now fetches live via `fetchSessions()`, with its own loading/error/Retry handling.
- **[Medium, carried over from `AUDIT.md`/`AUDIT-2.md`, still unfixed]** `home.tsx:31` (now shifted a few lines from the wiring work, same content) — actually **re-checked and this is now resolved**: the old hardcoded local `sessionsThisWeek = 12` no longer exists in the file at all; `sessionsThisWeek` now comes from `insights.sessionsThisWeek` (the real API field). `src/data/insights.ts`'s still-exported, still-unused `sessionsThisWeek = 12` is the only remaining half of this — see "Shared components" below. Not re-scoring this as open since the actual Home-side bug (two independently-hardcoded copies disagreeing) can no longer happen; only a genuinely dead, unimported export remains.
- **[Low, carried over, still unfixed]** The "···" more-options icon on "Your Snapshot" (`home.tsx:162`) is still a bare `MaterialIcons`, not a `Pressable` — still looks tappable, still does nothing. Unchanged from `AUDIT-2.md`.

### UI/Layout, Consistency
- No new issues. Loading/error/zero-state handling for the Snapshot section (spinner / error+Retry / real zeros with `—` for no-mood) all re-confirmed correct by direct code read, matching what `PROGRESS.md`'s "Verified live with real seeded data" entry already established on-device.

---

## Library (`app/(tabs)/library.tsx`)

### Functional
- Search + category filtering (now over the *real* fetched `sessions` array via `useMemo`), Quick Start, session-card navigation, settings icon, loading/error states — all re-traced and correct.
- **[High — RESOLVED 2026-09-26, see "RESOLVED" above]** Quick Start's target was a local `featuredSession.id`, not from the fetched list — now looked up from this screen's own already-fetched live `sessions` state.
- **[Medium, new] Empty-state message doesn't distinguish "no results for your search/filter" from "the catalog itself is empty."** `library.tsx:274-276`: `visibleSessions.length === 0` always renders `"No sessions match your search."`, even when `query` is empty and `selectedCategory === 'For You'` — i.e., even when the real backend's `sessions` table legitimately has zero rows (a plausible pre-seeding or misconfiguration state, and explicitly one of the "legitimate backend responses" this audit was asked to trace). A user seeing that message with an empty search box and "For You" selected would reasonably conclude the *app* is broken or their search is the problem, when actually the catalog is empty. *Suggested fix: branch the empty message on whether `query`/`selectedCategory` are at their defaults — something like "No sessions available yet" for a genuinely empty catalog vs. the current "No sessions match your search" only when a search/filter is actually active.*

### UI/Layout, Consistency
- No new issues beyond what `AUDIT.md`/`AUDIT-2.md` already carry forward (category-tab touch target, no `KeyboardAvoidingView` — both still present, both already tracked, not re-scored here).

---

## Session Player (`app/session-player.tsx`)

### Functional
- **[High — RESOLVED 2026-09-26, see "RESOLVED" above]** Used to read session content from the local catalog exclusively, with a silent fallback to Deep Exhale for any unrecognized id — the most consequential instance of this app-wide issue, since this is the screen every real session is played and checked in from. Now fetches live, and a genuinely unrecognized id shows a dedicated "Session not found." state instead of substituting a different session.
- **[Medium, new] `POST /api/checkin`'s response (an updated `Streak`) is fetched but never used.** `handleDone` (`:228-244`): `await postCheckin({...})` — the resolved `Streak` value is discarded entirely; only a thrown error is handled. The user is routed straight to `/home`, which then does its *own*, separate `fetchInsights()` call to get the just-updated streak. This works (confirmed via `PROGRESS.md`'s on-device verification: Home's streak card showed the correct fixture value after a real checkin), but it's a redundant round-trip — the exact data Home needs is already sitting in the `postCheckin` response and gets thrown away, then re-fetched a moment later. Not a bug (no incorrect data shown, no crash), but worth flagging as an efficiency/simplicity gap now that the backend exists — one plausible reason a future "why does Home flash a loading spinner right after finishing a session" report would come in.
- Focus-guard fix (`AUDIT.md`'s High finding) re-confirmed still correctly in place: `useIsFocused()` gates the elapsed timer, the breath sub-phase cycle, and the `BackHandler`; the settings-gear press routes through the same `confirmIfActive()` as the X button and hardware back. No regression.
- `BreathingRing`'s pause/resume restart-from-inhale desync (`AUDIT.md`/`AUDIT-2.md` Medium, still open) — re-confirmed still present by direct read of `BreathingRing.tsx:41-69`: the effect still always starts `loop()` from the inhale leg on every `paused → false` transition, with no tracking of which sub-phase to resume into. Not touched by any session since `AUDIT-2.md`.
- `MoodSelector`'s 40×40 mood bubbles still have no `hitSlop` (`AUDIT.md`/`AUDIT-2.md` Low, still open, unchanged).
- **[Confirmed working, not a finding]** `saving`/`saveError` state around `postCheckin`: a failed checkin keeps `preMood`/`postMood` in state, shows a real error box + "Try Again" (re-runs the same `handleDone`, so it resends the identical completed session rather than losing it) — this is exactly the kind of real-network-failure handling this audit was asked to verify, and it's correctly built.

### UI/Layout, Consistency
- Active-phase corner-clip fix (`AUDIT-2.md` Medium, resolved 2026-09-20) re-confirmed still present (`activeCardClip` wrapper, `session-player.tsx:372,593-597`). No regression.

---

## Player (`app/(tabs)/player.tsx`) — rebuilt this session, audited fresh

This screen changed completely since `AUDIT-2.md` (which audited the old "No session in progress" empty state); auditing it in full rather than diffing against the old version.

### Functional
- `activeSessionId` redirect effect, and the real `fetchInsights()` call for the Calm Streak stat, both correct — traced the `cancelled` guard (prevents a post-unmount `setState`) and the early-`return` when a session is active (no wasted fetch).
- **[Medium — RESOLVED 2026-09-26, see "RESOLVED" above]** Quick Suggestions used the local catalog (`getSessionById`) — now fetches live via `fetchSessions()`, with its own explicit loading/error+Retry handling (not the silent-omission pattern the adjacent Calm Streak stat still uses — that one stays open, out of scope for this fix).
- **[Low, new] Streak-fetch failure is silently swallowed — no error UI, unlike every other screen's fetch in this app.** `player.tsx`: on a rejected `fetchInsights()`, `currentStreak` is set to `undefined`, and `{currentStreak !== undefined && (<GlassCard>...)}` means the **entire Calm Streak card just disappears** with no error message and no Retry — a real inconsistency against Home/Library/Insights, which all show explicit error text + a Retry button on the same class of failure. A user on a flaky connection would see a Player screen that looks like it simply has no streak feature, not one that failed to load. *Suggested fix: match the small-inline pattern already used for the loading state — e.g. a muted "Couldn't load" instead of omitting the card outright — or a minimal Retry affordance.*
- No `hitSlop` on the "Explore Library" button or the Quick Suggestion pills — consistent with (not worse than) the app's existing mixed `hitSlop` coverage (already tracked as Low elsewhere for similar elements); not separately scored.

### UI/Layout, Consistency
- **[Confirmed, positive finding]** Re-checked this new screen against `AUDIT-2.md`'s two resolved Medium findings to make sure neither regressed: the hero card uses `radii.lg` (32px) and the stat card uses `radii.md` (24px) — both below the `radii.xl` (48px) threshold that triggers the Android `BlurView` corner-clip bug, so no new instance of that bug was introduced. The "Explore Library" gradient reuses the exact already-fixed `[colors.inversePrimary, colors.onPrimaryFixedVariant]` + white-text pattern from `AUDIT-2.md`'s contrast fix, not the old low-contrast recipe. The new Calm Streak card's `#fb923c` orange icon/tint also happens to now match Home's and Insights' streak treatment (from this session's separate color-consistency fix) — all three streak indicators in the app are now visually consistent, confirmed by re-reading all three files side by side.
- Status pill ("Breath Player") and Quick Suggestion pill text colors (`colors.tertiary`/`colors.primary` on `colors.surfaceContainerHigh`-based backgrounds) were spot-checked by eye against the same "light token on near-black surface" pattern `AUDIT-2.md` already computed as passing (≥10:1) for `colors.primary`/`colors.tertiary` elsewhere in the app — not independently re-computed to that audit's same hand-math rigor, but no visual contrast concern found.

---

## Insights (`app/(tabs)/insights.tsx`)

### Functional
- Settings icon, `chunk()`-based grids, `MoodTrendChart`'s zero-data guard, and the full `fetchInsights` wiring (mood trend, consistency calendar, all 4 stat cards) all re-confirmed correct, matching `PROGRESS.md`'s on-device-verified real-data and zero-state checks (exact DOM-level checks for the calendar and chart path, not just screenshots — already independently verified, not re-derived here).
- `formatMindfulMinutes`'s two-tier fix (this session, 2026-09-25 — "0h" for sub-60-minute users) re-confirmed present and correct by direct read.
- Today's streak-color fix (Insights' Current Streak card now matching Home's `#fb923c` treatment) re-confirmed present, scoped only to the streak card — Total Sessions/Mindful Minutes/Vs Last Month untouched, matching the fix's own stated scope.
- Full-screen gating (spinner/error+Retry) on `insights === null`/`error` is appropriate here since every element on this screen depends on the same one fetch, unlike Home's per-section gating.

### UI/Layout, Consistency
- No new issues. `cardClip` corner-clip workaround still present on all card types.

---

## Settings (`app/settings.tsx`)

### Functional
- Header back, reminder toggle's local state — both work. No persistence (`AsyncStorage`/`expo-notifications`) yet — correctly, explicitly out of scope per `CLAUDE.md`'s build order (step 10, not started), not re-reported as a bug. Not backend-related at all (no fetch), so out of scope for this pass's live-data focus.

### UI/Layout
- **[Low, carried over from `AUDIT-2.md`, still unfixed]** Still no `ScrollView` — the only content screen in the app without one, same risk (short devices / larger font scale) already documented.
- **[Low, carried over, still unfixed]** `ReminderToggle`'s 64×44 effective touch target still sits exactly at the ~44pt floor, not above it.

---

## Onboarding (`app/onboarding/*.tsx`)

Not touched by any commit since `e8e4985` (the `AUDIT-2.md` fix pass itself), confirmed via `git log --since=2026-09-20 -- app/onboarding/`, and has no `fetch`/`api/client` usage at all (grepped, zero matches) — correctly out of scope for a live-backend-focused pass. Not re-read line-by-line this session; `AUDIT-2.md`'s findings (Skip buttons' `hitSlop={8}` vs. the rest of the app's `{12}`, the corner-clip fix already applied to How It Works' step cards) stand as the current, unchanged state.

---

## Tab bar (`app/(tabs)/_layout.tsx`)

### Functional
- All 4 tabs navigate correctly. Re-confirmed via direct grep: zero `android_ripple` usages, `tabBarButton` pattern present on all 4 `Tabs.Screen` entries, active-tint contrast fix (`colors.primary`, not `inversePrimary`) still in place. No changes since `AUDIT-2.md`, no regressions.

---

## Shared components / state

- **`src/api/client.ts`** — see the two High findings above (no timeout; `postCheckin`'s response is only ever discarded-except-for-errors by its one caller). Otherwise clean: consistent error-throwing pattern (`if (!response.ok) throw new Error(...)`) across all 3 functions, easy for every screen to `.catch()` uniformly — this consistency is a real strength of the design.
- **`src/data/insights.ts`** — **confirmed still fully dead code**, not a new finding (already flagged in `PROGRESS.md`'s "Home + Insights wired to GET /api/insights" entry, left in place deliberately per that session's "don't touch other files" instruction). Re-verified via grep: only `MoodPoint` (the type) is still imported anywhere (`insights.tsx`, `MoodTrendChart.tsx`); every value export (`moodTrend`, `streak`, `totalSessions`, `sessionsThisWeek`, `mindfulMinutes`, `monthOverMonthDelta`, `consistencyCalendar`) has zero remaining importers app-wide. Listing here because the audit explicitly asked to confirm no leftover dummy data remains — this is real, currently-inert dummy data still sitting in the repo, already tracked as a known cleanup item, not newly discovered.
- **`src/data/sessions.ts`** — not dead (see the High finding above — very much still live, just not from the backend). `getSessionById`'s `undefined` return for an unrecognized id is the mechanism behind that finding's silent-fallback risk.
- **`src/components/GlassCard.tsx`, `ActiveSessionContext.tsx`, `BreathOrb.tsx`, `SessionThumbnail.tsx`, `BreathingRing.tsx`, `MoodSelector.tsx`, `MoodTrendChart.tsx`, `GradientText.tsx`/`.web.tsx`** — all re-read in full this pass. No new issues beyond what's already tracked (`BreathingRing`'s pause/resume desync, `MoodSelector`'s missing `hitSlop` — both carried over, not re-scored). `SessionThumbnail`'s per-image `contentBox` scaling math re-verified correct by re-reading the formula directly.
- **`app/_layout.tsx`, `app/index.tsx`** — unchanged, both re-confirmed clean (font-loading gate, `ActiveSessionProvider` wiring, the `mounted` guard against a post-unmount `setState` in the onboarding check).

### Config-level (Info only)
- **[Info, carried over]** `app.json`'s `android.predictiveBackGestureEnabled: false` — still present, still not documented anywhere as a deliberate choice.
- **[Info, carried over]** Still no `lint`/`test` script in `package.json`.
- **[Info, new]** `src/types/models.ts`'s header comment is stale ("once the backend exists") now that it does — see "Data-shape integrity" above.

---

## Checked and excluded — re-confirmed unchanged, not re-reported as new findings

- The WCAG contrast fix and the Android `BlurView` corner-clip fix, both from `AUDIT-2.md` (2026-09-20) — re-confirmed present at every original call site (tab bar, Library category tabs, Mood Trend chart stroke, all 6+1 CTA gradients, Session Player's active card, Onboarding's step cards). No regressions found anywhere, including in this session's new/changed files (Player, Insights).
- `COLOR-AUDIT.md`'s CTA gradient standardization — re-confirmed still consistent across Home/Library/Player/Session Player/Onboarding.
- Session Player's `BackHandler` focus-guard fix (`AUDIT.md`'s original High finding) — re-confirmed correctly in place, see the Session Player section above.
- Tab-bar-overlap policy (clears after full scroll, not before) — unchanged, not re-investigated from scratch this pass since no screen's scroll/padding logic changed since `AUDIT-2.md` confirmed it.
- `phaseConfig`'s 4-field shape vs. `architecture.md:78`'s undocumented 3-field spec, and `PRD.md`'s stale "Wind Down" naming — both still open, pure documentation drift, already tracked, not re-scored.
- Badge↔category convention (Leaf/Calm, Moon/Sleep, Zap/Energy, Heart/Recovery) — re-confirmed in sync between `sessions.ts` and `architecture.md`'s locked table.

---

## Notes on method / limitations

- The original 2026-09-26 pass was a pure code-reading + `diff`/`grep` audit — no dev server was started, no on-device or web-based interactive testing was performed (the instruction was explicitly read-only/diagnostic, and the two prior audits already established the project's pattern of doing interactive verification as a *separate*, non-read-only pass). Anything requiring native-only APIs or a live network round-trip to observe (the actual spinner behavior under a real slow connection, the real-device rendering of this session's new Player screen) was flagged based on direct code inspection of the relevant logic, not observed empirically in that pass.
- **A same-day follow-up (also 2026-09-26) then fixed the one High finding this note used to caveat** — this document is the only one updated to record that work; the code changes themselves, with the full before/after and interactive verification, are described in the "RESOLVED (2026-09-26)" section above. That follow-up pass touched exactly the 4 files named there (`app/(tabs)/home.tsx`, `app/(tabs)/library.tsx`, `app/(tabs)/player.tsx`, `app/session-player.tsx`) plus this document and `PROGRESS.md` — confirmed via `git diff --stat` against the same working-tree baseline the original audit was read against — nothing else. Unlike the original pass, this follow-up *did* verify interactively (isolated Expo web server, `playwright-cli`, a simulated backend failure via request interception), since fixing (not just diagnosing) a live-network-dependent bug isn't meaningfully verifiable by code reading alone.
- The backend's actual database schema (whether `checkins.session_id` has a foreign-key constraint against `sessions.id`) still could not be verified — no `.sql`/migration file exists in `breathing-app-api`'s repo (schema is presumably managed directly in the Supabase dashboard). This no longer affects the resolved High finding itself (there's no longer any code path that can send a checkin for a session that doesn't exist in the live catalog), but remains an open question about the backend's own data integrity if it were ever queried/written outside this app.
- Every finding above is sourced from a direct file read or a literal command (`diff`, `grep`, or — for the 2026-09-26 follow-up — `playwright-cli requests`/screenshots) reproduced inline — nothing is re-asserted from `PROGRESS.md`'s narrative history without independently re-checking the current code.
