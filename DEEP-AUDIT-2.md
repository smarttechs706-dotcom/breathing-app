# Deep Audit #2 — bugs + security, both repos (`breathing-app`, `breathing-app-api`)

**Date:** 2026-10-01
**Type:** Read-only audit. **No source, config or database state was modified.** The only file created in either repo is this one. (Scratch test scripts and screenshots live in the session scratchpad outside both repos.)
**Scope:** every source/config file in both repos, the live Supabase project (`mwvagnkisltkuthcvwlj`), the running API and Expo web server, and the full git history of both repos.
**Baseline respected:** nothing resolved in `BACKEND-AUDIT.md`, `PRODUCTION-READINESS-AUDIT.md` or `FRONTEND-AUDIT-2.md` is re-listed. Items they carry as *still open* are only touched in "Part C" (confirmed still accurate, with today's evidence) — plus the places where today's evidence changes their severity or status.

## How this audit was done (and what it did not do)

- Read in full before auditing: both `CLAUDE.md`, `architecture.md`, `BACKEND-AUDIT.md`, `PRODUCTION-READINESS-AUDIT.md`, `FRONTEND-AUDIT-2.md`, both `PROGRESS.md` files, then every route, lib, config, screen, component and util in both repos.
- **Database re-verified live, not from audit text** (grants have drifted silently before): RLS + policies, table/column/function privileges, default ACLs, constraints, indexes, extensions, publications, roles, the function bodies, both advisors, data-consistency queries, 24 h of platform logs.
- **Probed as an outsider** with the public anon key: REST reads on all three tables, both RPCs, the OpenAPI root, GraphQL, Auth settings/sign-up endpoint, Storage. All **read-only or rejected before any write**; after the probes the database still held exactly 9 check-ins / 3 streaks (checked).
- **API probes** on the local dev server: wrong methods, malformed/oversized bodies, hostile strings, URL-length, header inspection, 80 rapid requests. Every POST used was rejected at validation or rolled back by the foreign key; no rows were written (checked).
- **UI behavior tests** with Playwright on the running **Expo web** build, with `/api/sessions` shortened to 3-4 s and `/api/checkin` + (where noted) `/api/insights` **intercepted**, so nothing real was written.
- Full-history secret scan of both repos; `npm audit` on both.
- **Not done / limits:** the UI tests ran on **web, not on the Android phone** — D-02 and D-03 are navigation/logic defects that very likely behave the same natively, but that is not verified. Tabs mount lazily on web, so the first-launch triple-fetch seen in the phone's Metro log could not be reproduced there (D-14 was tested at the logic level instead). No load test. No built APK/AAB was inspected (Android manifest findings are from the config-plugin source). `next dev`, not a production build, was the server under test. Vercel does not exist yet.

## Summary

| ID | Finding | Where | Severity |
|---|---|---|---|
| D-01 | Installed `next@16.3.5` has an advisory rated **Critical** (RCE in `next/og`); **not reachable** in this codebase today | `breathing-app-api/package.json:13` | **High** (advisory Critical; reachability: none found) |
| D-02 | Every completed session leaves a duplicate, still-mounted copy of the whole tab tree (reproduced: 1→4 Home instances over 3 sessions); Back needs N presses and shows stale Homes | `session-player.tsx:400` (also `:265`) | Medium |
| D-03 | Leaving a **completed** session with X / hardware Back at the mood step discards it — no save, no confirmation (reproduced: 0 POSTs) | `session-player.tsx:286-295, 260-267, 309-317` | Medium |
| D-04 | The client trusts API response shapes; any wrong-shaped 200 crashes the **whole app** into the root error screen with a raw JS error (reproduced for 5 shapes) | `src/api/client.ts:56,77,100`; `app/_layout.tsx:20` | Medium |
| D-05 | `anon` and `authenticated` hold **every** table privilege (incl. DELETE, TRUNCATE) on all 3 tables; default ACLs re-grant them on every future table/function — only RLS-with-zero-policies stands in the way | Supabase `public` schema | Medium |
| D-06 | Supabase Auth **public sign-up is open** although the app never uses Supabase Auth | Supabase Auth settings | Medium |
| D-07 | **Neither repo has a git remote** — every commit exists only on this laptop; no CI | both repos | Medium |
| D-08 | 80 third-party agent-instruction files are tracked in the API repo (the mobile repo ignores the same class) | `breathing-app-api/.claude/skills/**`, `.agents/skills/**`, `.gitignore` | Low-Medium |
| D-09 | The backend Supabase client has no request timeout | `lib/supabase.ts:28-33` | Low-Medium |
| D-10 | Both mood selectors start at 3; a skipped selector submits a fabricated "Neutral" indistinguishable from a real answer | `session-player.tsx:191-192` | Low-Medium |
| D-11 | No per-user/day limit on check-ins: `totalSessions`, `mindfulMinutes`, `sessionsThisWeek` are unbounded self-reported numbers | `record_checkin`, `get_insights` | Low-Medium |
| D-12 | A user's first check-in leaves the Mood Trend chart empty (reproduced) | `MoodTrendChart.tsx:42,78` | Low |
| D-13 | Unexpected throws in 2 routes return Next's own non-JSON 500 without CORS headers | `insights/route.ts:73-75`, `checkin/route.ts:68-69` | Low |
| D-14 | `getDeviceId()` has no in-flight de-duplication (concurrent first calls mint different ids; benign today — tested) | `src/utils/deviceId.ts:26-46` | Low |
| D-15 | Malformed `phase_config` can spin the breath timer at 0 ms (DB has no CHECK, client no guard); not reproduced | `session-player.tsx:254-256`, `BreathingRing.tsx:46-60` | Low |
| D-16 | `record_checkin` and `get_insights` use different `search_path` hardening | DB functions | Info |
| D-17 | `graphql_public.graphql()` is anon-executable; safe only because `pg_graphql` is not enabled | Supabase | Info |
| D-18 | The legacy anon JWT is still active (expires 2036) next to the new publishable key | Supabase API keys | Info |
| D-19 | `HEAD /api/sessions` runs the full DB query | `sessions/route.ts:29-48` | Info |
| D-20 | Stale tunnel hostname / LAN IPs in committed docs | `PROGRESS.md:2400,2582-2583` | Info |

**Critical: 0 · High: 1 · Medium: 6 · Low-Medium: 4 · Low: 4 · Info: 5.** Part C re-checks the previously-open items from the three audits and records where today's evidence changes one (S14 upgraded to confirmed; S8 partly stale; #7 and #3/#4 now backed by live evidence).

---

# Part A — Findings

## D-01 — `next@16.3.5` has a Critical advisory (High; not currently reachable)
**Where:** `breathing-app-api/package.json:13` (`"next": "16.3.5"`, exact pin) and `:23` (`eslint-config-next` pinned to the same version).
**What/why:** `npm audit --omit=dev` now reports **1 critical** (the earlier audit recorded 0): GHSA-vcvr-r3jv-pc5j, "Next.js: Remote Code Execution in `next/og` `ImageResponse`", affecting `>=16.2.0 <16.3.6`. Fix available **without a major bump: 16.3.8**. I searched the app for `next/og`, `ImageResponse`, `opengraph-image`, `twitter-image`, `icon`/`apple-icon` routes: **none exist** (`app/` has the 3 API routes, `favicon.ico`, the boilerplate page and layout), so I found no path to the vulnerable code today. Rated High rather than Critical for that reason; it becomes Critical the moment anyone adds an OG/icon route, and a deploy to Vercel with a known-critical dependency is the wrong first deploy.
**Fix (described only):** bump `next` and `eslint-config-next` to `16.3.8` (exact pins, same minor), re-run `npm audit`, typecheck and the 3 routes; add `npm audit --omit=dev --audit-level=high` to CI (see D-07).

## D-02 — Every completed session adds another full copy of the tab tree (Medium)
**Where:** `app/session-player.tsx:400` (`router.replace('/home')` after a successful check-in); same call in `exitSession` `:265` (no-history fallback).
**What/why (reproduced on Expo web, 3 consecutive completed sessions, API intercepted):**

| | start | after session 1 | after session 2 | after session 3 |
|---|---|---|---|---|
| `history.length` | 2 | 3 | 4 | 5 |
| Home screens mounted in the DOM | 1 | 2 | 3 | 4 |
| Orb `<img>` (infinite pulse animation) mounted | 1 | 2 | 3 | 4 |
| `/api/sessions` calls (cumulative) | 1 | 3 | 5 | 7 |
| `/api/insights` calls (cumulative) | 1 | 2 | 3 | 4 |

`replace('/home')` swaps the Session Player for a **new** `(tabs)` navigator and leaves the original one underneath, so the stack grows by one full tab tree (Home, Library, Player, Insights — each with its own state, fetches and looping animations) per session. User-visible: pressing Back from Home does not leave the app; it reveals an older, **stale** Home (4 presses to get out after 3 sessions). Resource-visible: memory and background work grow with every session in a process's lifetime. **Not verified on the Android device**; the mechanism is expo-router/react-navigation state logic, so I expect the same, but treat that as unconfirmed.
**Fix (described only):** return to the existing tabs instead of replacing onto a new one — pop the Session Player (`router.back()`/dismiss to the tabs, then `navigate` to Home) rather than `replace`; verify with the same counters.

## D-03 — Leaving a completed session at the mood step silently throws it away (Medium)
**Where:** `app/session-player.tsx:286-295` (`confirmIfActive` only guards `phase === 'active'`), `:260-267` (`exitSession`), `:309-317` (hardware Back → `handleExitPress`). The save happens only in `handleDone` (`:393-409`).
**What/why:** architecture.md specifies "post-mood: back can exit directly (session is already complete)" — true for *progress*, but the check-in is not saved until Done. A user who finishes a 10-minute session and taps X (or presses Android Back) at "How do you feel now?" leaves with **no check-in, no streak credit, no warning**. Reproduced: finished a session, tapped X at post-mood → left the screen, **0** `POST /api/checkin` sent. Silent data loss on the app's core action; a broken streak is the most visible symptom. (The save-failed path is a documented decision; this is the success path.)
**Fix (described only):** at post-mood, either confirm before leaving ("Save your session first?") and/or save when the active phase completes (post-mood value updated afterwards), so completion is never lost to an exit.

## D-04 — The client trusts response shapes; a wrong-shaped 200 takes down the whole app (Medium)
**Where:** `src/api/client.ts:56, 77, 100` (`return response.json()` with no validation); consumers read fields unguarded (`home.tsx:345,361`, `insights.tsx:165-166,182`, Library's `sessions.filter`, `session-player.tsx:243-246`); a single root `ErrorBoundary` at `app/_layout.tsx:20`.
**What/why:** the per-screen "error + Retry" UI only handles *rejected* fetches and non-2xx. A 200 with the wrong shape throws during render, and the root boundary replaces the entire app (tab bar included) with "Something went wrong" + the raw JS error. Reproduced (API intercepted, 200 responses):

| Server returns | Screen result |
|---|---|
| `/api/insights` → `{}` on Home | "Cannot read properties of undefined (reading '0')" |
| `/api/insights` → `{}` on Insights | "checkins is not iterable" |
| `/api/insights` with `streak: null` | "Cannot read properties of null (reading 'currentStreak')" |
| `/api/sessions` → `{}` on Library | "sessions.filter is not a function" |
| a session with `phaseConfig: null` opened in the player | "Cannot read properties of null (reading 'inhale')" |

Plausible real triggers: a bad deploy, a proxy/captive portal answering with JSON, version skew between an old app build and a changed API, or a hand-edited `sessions` row. No data is at risk, but the failure mode is a dead app instead of a retry.
**Fix (described only):** validate/normalize each response in `client.ts` (a small runtime shape check) and throw a typed error the existing `.catch` handlers already display; optionally add a per-screen error boundary so one bad payload does not remove navigation.

## D-05 — `anon` and `authenticated` hold every privilege on all 3 tables; defaults re-grant them forever (Medium)
**Where:** Supabase `public` schema (no repo file — see S7). Verified live today:
- `information_schema.role_table_grants`: for `checkins`, `sessions`, `streaks`, both `anon` and `authenticated` have **DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE** (plus matching column-level grants).
- `pg_default_acl` in schema `public` (owners `postgres` and `supabase_admin`): every *future* table gets all of those privileges for `anon`/`authenticated`/`service_role`, every future function gets `EXECUTE` for them, every sequence `USAGE`.
- RLS is enabled on all 3 tables with **zero policies** (advisor `rls_enabled_no_policy` ×3, informational). Outsider probes confirm it is working today: anon `GET` on `checkins`, `streaks` and `sessions` all returned `[]`; both RPCs return `permission denied` (platform log, 42501).

**What/why:** the only thing between a holder of the (public) anon key and the full data set — including `DELETE` — is RLS with no policies. That is one layer, and it is the *same* drift class that left `record_checkin` executable by anon for five days: the earlier revoke only removed `PUBLIC`, and the default ACLs hand the grants straight back for every new object. Concretely, any one of these opens everything: someone adds a permissive policy (e.g. a `using (true)` read policy "so the catalog loads"), toggles RLS off in the dashboard, or creates a new table/function without remembering to revoke. `TRUNCATE` is not governed by RLS at all; it is not reachable through PostgREST today, but it is a privilege no public role should hold.
**Fix (described only):** `revoke all on all tables in schema public from anon, authenticated` (service_role keeps its own); `alter default privileges … in schema public revoke all on tables/functions/sequences from anon, authenticated` for the roles that create objects (`postgres`; `supabase_admin` may need Supabase support/dashboard); add a recurring check that lists every grant to `anon`/`authenticated` (the `aclexplode` query used today) and fails on anything unexpected; export it with the rest of the schema (S7).

## D-06 — Supabase Auth sign-up is open, though the app has no accounts (Medium)
**Where:** Supabase Auth settings. `GET /auth/v1/settings` with the anon key: `disable_signup: false`, email provider enabled, `mailer_autoconfirm: false`. I confirmed the sign-up endpoint is live by sending a deliberately invalid payload (rejected on password strength; `auth.users` still has 0 rows — nothing was created).
**What/why:** architecture.md is explicit that v1 has no Supabase Auth at all, yet anyone with the anon key can register accounts. Consequences: (1) email-sending abuse against the project's auth mail quota/reputation; (2) every self-registered user gets the `authenticated` role, which today holds the same full table privileges as `anon` (D-05) — so any future policy written `to authenticated` / `auth.uid() is not null` would be satisfied by strangers; (3) it adds an attack surface (login, password reset, magic links) the product does not use.
**Fix (described only):** disable sign-ups (and unused providers) in the Auth settings until real auth is designed; keep the anon key's reach to nothing.

## D-07 — No git remote anywhere; no CI (Medium)
**Where:** `git remote -v` is empty in **both** repos; only `master` exists (the repo's stated main branch is `main`).
**What/why:** all 38 mobile commits, the API history, and the written record of the 7 database migrations (S7) exist on one laptop. A disk failure, theft or accidental `rm -rf`/`git clean` loses the only copy; there is also nothing to review changes against or to run checks on (S8 notes CI is missing; "no off-machine copy at all" is new). Today's commits (`5d9b379`, `203cf4c`, `ae2ab90`, `1dff68a`) are local only.
**Fix (described only):** create private remotes for both repos and push; protect `main`; then add the minimal CI from S8 (typecheck, `npm audit --audit-level=high`, a test for streak/insights rules).

## D-08 — Third-party agent-instruction files are tracked in the API repo (Low-Medium)
**Where:** `breathing-app-api/.claude/skills/**` (40 files) and `.agents/skills/**` (40 files, a duplicate set) tracked in git; `breathing-app-api/.gitignore` has no rule for either; `skills-lock.json` is tracked but nothing verifies it. (The mobile repo's `.gitignore` explicitly excludes this class and says why.)
**What/why:** these markdown files are loaded as *instructions* by coding agents working in the repo. Tracking them means a change in a commit, a merge, or a compromised re-install silently alters agent behavior — in a repo whose tracked `.mcp.json` grants write access to the only (production) database (S6). It also doubles repo noise.
**Fix (described only):** match the mobile repo (gitignore both directories, install via the lockfile), or pin and hash-verify them in CI; keep a single copy.

## D-09 — The backend's Supabase client has no timeout (Low-Medium)
**Where:** `breathing-app-api/lib/supabase.ts:28-33` (`createClient` with default `fetch`).
**What/why:** a stalled PostgREST call holds the route handler (and on Vercel, a billed function invocation) until the platform limit. This is the backend half of P7; the repo's own measurements recorded 2-4 s spikes and a 27 s stall, so it is not hypothetical. `/api/insights` and `/api/checkin` then return nothing for that whole window, and the client has no timeout either.
**Fix (described only):** pass a `global.fetch` that applies `AbortSignal.timeout(~8000)`; map the abort to a clean 504.

## D-10 — Untouched mood selectors submit a fabricated "Neutral" (Low-Medium)
**Where:** `app/session-player.tsx:191-192` (`useState(3)` for both moods; `MoodSelector` has no "unset" state).
**What/why:** "Begin Journey" and "Done" work without touching the mood rows, so a user who skips them records pre=3 / post=3 — a real-looking value. Home's "Current mood" and Insights' Mood Trend are built from `postMood` (PROGRESS.md, 2026-09-24), so they display a mood the user never reported, and the server cannot tell it from a real answer. Silent wrong data rather than a crash.
**Fix (described only):** start unselected and require a choice (or store `null` and exclude it from the derived views).

## D-11 — Check-in volume is unbounded, so the headline stats are unbounded (Low-Medium)
**Where:** `record_checkin` (inserts a `checkins` row on every call, including when the streak is a no-op for the day) and `get_insights` (sums every row).
**What/why:** extends BACKEND-AUDIT #4/#9 with the data-integrity consequence: nothing limits check-ins per user per day, so `totalSessions`, `sessionsThisWeek` and `mindfulMinutes` (each row adds a session's full duration) can be pushed arbitrarily high by a script, or accidentally by a retry after a lost response (no idempotency). The numbers stop meaning "time actually spent breathing".
**Fix (described only):** idempotency key on check-ins (`unique(user_id, idempotency_key)`), and/or a sanity cap (e.g. one counted session per session-duration window).

## D-12 — A first check-in leaves the Mood Trend card empty (Low)
**Where:** `src/components/MoodTrendChart.tsx:42` (`if (points.length === 1) return 'M x,y'`) and `:78`.
**What/why:** reproduced with exactly one check-in: the stroked path is `M 300,60` (length 0) and the fill path has zero width, so nothing is drawn. A new user's first completed session shows an empty "Mood Trend" card. Two points or more draw correctly.
**Fix (described only):** draw a dot (or a short flat line) for a single point, or show an empty-state line of text.

## D-13 — Unexpected exceptions in two routes escape as non-JSON, header-less 500s (Low)
**Where:** `app/api/insights/route.ts:73-75` (`data as InsightsRow` then `row.checkins.map` — `data` being `null` throws); `app/api/checkin/route.ts:68-69` (`toStreak(row)` with `row` undefined if the RPC ever returns an empty set). Neither handler has a try/catch.
**What/why:** an exception here yields Next's own error response, which lacks the `Access-Control-Allow-Origin` header — so on web the failure shows up as a CORS error instead of a 500, hiding the cause; nothing is logged (S12). Not triggered today (both functions always return a row).
**Fix (described only):** wrap each handler body in try/catch, log server-side, and return `corsJson({error}, {status: 500})`.

## D-14 — `getDeviceId()` has no in-flight de-duplication (Low; benign today)
**Where:** `src/utils/deviceId.ts:26-46`.
**What/why:** the 2026-10-01 Metro log shows Home, Insights and the Player tab issuing `fetchInsights` within 3 ms of each other on launch, i.e. three concurrent first calls to `getDeviceId()`. On a *fresh install* (no stored id) each mints its own UUID. Tested at the logic level with the real source and an async storage stub: 3 callers returned **3 distinct ids**, but the id that ends up in memory always matched the one persisted (**0 mismatches in 300** jittered trials), so check-ins stay attributed to the stored id and the stray ids are only used for harmless read-only first fetches. Latent, not a live bug — one reordered async write would split an identity (and see S3: the id is the only credential).
**Fix (described only):** memoize the in-flight promise so concurrent callers share one generation.

## D-15 — A malformed `phase_config` can spin the breath timer (Low; not reproduced)
**Where:** `app/session-player.tsx:254-256` (`setTimeout(…, durations[sub] * 1000)`), `BreathingRing.tsx:46-60`; DB `sessions.phase_config` is `jsonb` with no CHECK (only `duration_sec > 0`, category/badge/pattern are constrained).
**What/why:** if all four durations were 0 (or non-numeric → `NaN` → 0 ms) the sub-phase timer would reschedule itself continuously. Reading the code, not reproduced; only `service_role` can write the table, so this is an admin-error/bad-seed risk, and a `null` config already crashes (D-04). Today all 6 rows have the 4 required keys (checked).
**Fix (described only):** DB CHECK that each duration is a positive number; clamp in the client.

## D-16 to D-20 — Info
- **D-16:** `record_checkin` is `search_path = public`; `get_insights` is `search_path = ''`. Harmless today (`PUBLIC` has no `CREATE` on `public`), but inconsistent hardening; align both to `''` with schema-qualified names.
- **D-17:** `graphql_public.graphql()` is executable by `anon`; the endpoint answers "pg_graphql extension is not enabled", so there is no exposure. Enabling `pg_graphql` later would expose schema introspection to the anon key unless D-05 is done first.
- **D-18:** `get_publishable_keys` lists the legacy `anon` JWT as active (exp 2036-09-21) alongside the new publishable key. Both are public by design; when moving to production, consider disabling the legacy key so a rotation has a defined path.
- **D-19:** `HEAD /api/sessions` executes the full DB query (1.27 s measured) because Next maps HEAD onto the GET handler; harmless, but a free way to cause DB work.
- **D-20:** `PROGRESS.md:2400,2582-2583` still contain a past tunnel hostname and the phone's LAN IP; not secrets, just stale and unnecessary.

---

# Part B — Verified clean today (so nothing is assumed)

| Area | Evidence |
|---|---|
| RLS | enabled on `checkins`, `sessions`, `streaks`; zero policies; anon `GET` on all three returns `[]` (`/rest/v1/*`, live) |
| Function grants (re-verified, not assumed) | `get_insights` and `record_checkin`: ACL = `postgres`, `service_role` only (`aclexplode`); anon calls → 401 / `42501 permission denied` (also in platform logs) |
| Schema exposure | `/rest/v1/` OpenAPI root requires a secret key; `/storage/v1/bucket` → `[]`, no buckets; `supabase_realtime` publishes no tables; `pg_graphql` disabled |
| Auth | `auth.users` = 0; `anonymous_users:false`; no social providers (but see D-06) |
| Secrets | full-history scan of **both** repos (all commits/branches): no `sb_secret_`, JWTs, private keys, tokens; no `.env`/key files ever committed; `lib/supabase.ts` is `server-only`, key read from env only |
| Input handling (live) | wrong methods → 405; empty/`null`/array/number-`userId` bodies → 400; mood `9` → 400; 20 KB URL → 431; SQL-ish and emoji `user_id` and `<script>` `category` are inert (JSON only, parameterized, no reflection into HTML) |
| Atomicity | the FK-failing check-in rolled back completely (0 stray rows) — the record_checkin transaction works |
| Data integrity | 9 consistency checks on live data: 0 orphans, 0 streak/last-date mismatches, 0 future timestamps, 0 non-UUID ids, 0 test rows, all 6 sessions have the 4 phase keys |
| Platform logs (24 h) | only my own probes and the app's normal traffic; no outside requests, no unexpected writes |
| Client hygiene | `console.*` count in `app/`+`src/`: 0; exactly 3 `fetch` call sites; no WebView/`eval`/`Linking`/`dangerouslySetInnerHTML`; double-tapping Done sends **1** POST (the button disables in time) |
| New this week | the Name feature (`userName.ts`, `UserNameModal.tsx`): input is trimmed/capped/validated, never sent to the API, storage failures fail safe (see D-08 note under S14 for the backup caveat) |

---

# Part C — Previously-open items, re-checked today

**BACKEND-AUDIT.md**
- **#3** invalid `sessionId` → 500 + raw Postgres text: **still accurate, live:** `{"error":"insert or update on table \"checkins\" violates foreign key constraint \"checkins_session_id_fkey\""}`.
- **#4** no rate limit: **still accurate:** 80 rapid requests → 80 × HTTP 200.
- **#5** no generated `Database` type: still accurate (`lib/supabase.ts:28`). **#6** the specific `as unknown as` cast is gone, but `insights/route.ts:73` (`data as InsightsRow`) is an equally unchecked assertion — same concern (see D-04/D-13).
- **#7** no length caps / body limit: **still accurate; now with evidence:** a **6 MB** request body is fully parsed before validation (400 after 50 ms) — `checkin/route.ts:26`.
- **#8** UTC-only streak day: still accurate (`record_checkin` uses `(now() at time zone 'utc')::date`); **the frontend mirrors it** — `insights.tsx:35,42,47-48` bucket the calendar and mood trend by UTC date, so for the actual test user (Asia/Dubai, UTC+4) sessions between 00:00 and 04:00 local land on the *previous* day's cell.
- **#9** no idempotency: still accurate (see D-11 for the consequence). **#10** unbounded delta: unchanged logic. **#11** whitespace `user_id`: still accurate (`?user_id=%20%20` → 200 zero-state). **#12** composite index: still only `user_id` / `session_id` indexes (`get_insights` also range-filters `created_at`; fine at this scale). **#13** boilerplate page: still present.

**PRODUCTION-READINESS-AUDIT.md**
- **S3** `Math.random` id: still accurate (`deviceId.ts:17-21`). **S4** id in query string: still accurate (`client.ts:92`).
- **S5** dev tunnel proxy: `metro.config.js` unchanged; currently Expo runs `--lan`, not `--tunnel`.
- **S6** write-capable `.mcp.json`: unchanged and tracked.
- **S7** migrations only in Supabase: still open — `list_migrations` returns exactly 7, none in the repo.
- **S8**: the backend is now committed (`5d9b379`, `203cf4c`), so the "uncommitted" half is stale; the "no CI/tests/deploy config" half stands, and D-07 adds "no remote".
- **S9** no deletion path / privacy surface: still accurate (no delete route; `DELETE` → 405; Settings has Name, Daily Reminder, About).
- **S11/S12** unchanged (`reminders.ts` swallows errors at `:148`; routes still return raw `error.message` and log nothing).
- **S14** Android auto-backup — **upgraded from "unverified" to "confirmed by the config-plugin default":** `@expo/config-plugins/build/android/AllowBackup.js:26` returns `config.android?.allowBackup ?? true` and `app.json` has no override, so `android:allowBackup="true"`. AsyncStorage (device id, reminder settings, and — since 2026-10-01 — the user's **name**) is eligible for Google auto-backup/transfer: a restored phone clones the identity and copies the name. Built-manifest not inspected.
- **S16/S17** unchanged. **S18** hygiene: `project-code-summary.txt` still tracked; **`npm audit` mobile is now 13 moderate + 1 HIGH** (`brace-expansion`, transitive via Expo build tooling; dev-only, not in the app bundle), backend is the new D-01.
- **P3** wall-clock timer + keep-awake: still open (`session-player.tsx:222` counts ticks; no keep-awake dependency). **P7** no fetch timeout: still open (`client.ts` has no `AbortController`). **P8/P9** unchanged.

**FRONTEND-AUDIT-2.md and earlier**
- `BreathingRing` resume restarts from inhale (`BreathingRing.tsx:41-69`): still open. `MoodSelector` bubbles: `hitSlop` count 0, still open.
- Player's Calm Streak card silently disappears on failure (`player.tsx:139-141, 307`): still open.
- Home's "···" icon on "Your Snapshot" is purely decorative: re-confirmed today (`home.tsx`, no `Pressable`; the mockup has a bare `<button>` and `architecture.md:212` names it but defines no behavior).
- Not re-verified this pass: Library's empty-state wording, Settings' missing `ScrollView`.

---

## Suggested order of work
1. **Before any deploy:** D-01 (bump `next`), D-05 + D-06 (revoke public grants/default ACLs, disable sign-up), D-07 (remote + CI), then the standing S7 (migrations into the repo) so D-05's fix is reviewable.
2. **Before real testers:** D-03 (completed session lost on exit), D-02 (stack growth/Back), D-04 (shape validation), D-10 (fabricated moods), D-09/P7 (timeouts), D-11 (idempotency).
3. **Polish:** D-12 (one-point chart), D-13, D-14, D-15, D-08, then D-16–D-20.
