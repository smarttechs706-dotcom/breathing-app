# Production-Readiness Audit — security + performance

**Date:** 2026-09-29
**Type:** Read-only pass. No source, config, or database state was modified. The only file created is this one.
**Scope:** both repos — `breathing-app/` (Expo app, EAS config, Metro proxy) and `breathing-app-api/` (Next.js routes, `lib/`, config, tracked dev config).
**Baseline:** everything already found in `BACKEND-AUDIT.md` (findings 3-13 still open; 1-2 resolved), `AUDIT.md`, `AUDIT-2.md`, `COLOR-AUDIT.md`, `FRONTEND-AUDIT-2.md` and the "Known deviations"/"deferred" items in `PROGRESS.md` is **not repeated** here. Where a new finding is an extension of an existing one, it says so.

## Method and limits (read this first)

- Read the source of all 3 API routes, `lib/`, `next.config.ts`, `.mcp.json`, `.gitignore`s, and — in the mobile app — `src/api/client.ts`, `src/utils/*`, `app/_layout.tsx`, `app/session-player.tsx`, `app/settings.tsx`, the tab screens' data-fetching code, `TimePickerModal.tsx`, `BreathingRing.tsx`, `BreathOrb.tsx`, `SessionThumbnail.tsx`, `app.json`, `eas.json`, `metro.config.js`.
- Ran `npm audit --omit=dev` in both repos and pattern-searched tracked files in both repos for key material (none found).
- **Not done:** the live Supabase project was **not** re-inspected (no Supabase tool was available this session), so database-level statements below (RLS, the `record_checkin` grants, index state) rely on `BACKEND-AUDIT.md`, not a fresh check. No load test was run; the performance findings are from code reading and the arithmetic stated in each finding. The generated Android manifest (`allowBackup` etc.) was not inspected — the affected findings say so.
- Severity = impact at real user scale / for a broader test group, not for the current single test device.

## Summary

| ID | Finding | Location | Severity |
|---|---|---|---|
| S1 | Production build has no API URL configured; silently falls back to `http://localhost:3000` | `src/api/client.ts:13`, `eas.json` | **High** (release blocker) — ✅ **RESOLVED 2026-09-29** (EAS variables + runtime guard; guard uncommitted until reviewed) |
| S2 | Foreground notifications are suppressed (no `setNotificationHandler`); earlier "MIUI heads-up" explanation is unsupported | `src/utils/reminders.ts`, `app/_layout.tsx` | **Medium** — ✅ **RESOLVED 2026-09-29** (commit `d542481`, confirmed on-device) |
| S3 | `userId` is the only credential but is generated with `Math.random()` | `src/utils/deviceId.ts:13-22` | Medium |
| S4 | Identifier is sent in the URL query string on a read endpoint | `src/api/client.ts:63`, `insights/route.ts:56` | Medium |
| S5 | Dev tunnel publishes the dev machine's Metro **and** the DB-backed API to the internet | `metro.config.js:20-47` | Medium (testing period only) |
| S6 | Tracked `.mcp.json` grants a write-capable Supabase MCP on the only (production) project | `breathing-app-api/.mcp.json` | Medium |
| S7 | Database schema/functions exist only in Supabase; nothing in either repo can recreate them | `breathing-app-api/` (no migrations) | Medium |
| S8 | Backend fix + audit are uncommitted; no CI, no tests, no deploy config in either repo | both repos | Medium |
| S9 | Mood history is health-adjacent personal data with no deletion path or privacy surface | whole system | Medium (compliance) |
| S10 | Double Confirm could in theory schedule two daily reminders (code-reading only; never observed) | `settings.tsx:106-112`, `reminders.ts:104-131` | Low |
| S11 | No reconcile of "enabled" setting vs. what the OS actually has scheduled | `reminders.ts`, `_layout.tsx:24-26` | Low-Medium |
| S12 | Error text from all 3 routes returned to the client and never logged server-side | all routes (`insights:99-111`, `sessions:43`, `checkin:64-66`) | Low-Medium |
| S13 | Dev-client APK is the only EAS profile; no preview/production profile | `eas.json` | Low-Medium |
| S14 | AsyncStorage identity may be included in Android auto-backup (unverified) | `app.json` | Low |
| S15 | `next dev` binds to the LAN; unauthenticated API reachable by anything on the network | `package.json` `dev` script | Low |
| S16 | Reminder text is visible in the notification shade/lock screen for a wellbeing app | `reminders.ts:116-119` | Low |
| S17 | Custom-scheme deep links expose every route; scheme is unverified | `app.json:5` | Low |
| S18 | Repo hygiene: stale UTF-16 dump, dev-only `npm audit` advisories, no security headers | various | Low / Info |
| P1 | `/api/insights` all-time query is unbounded **and silently truncates at 1,000 rows** | `insights/route.ts:79-83, 124-130` | **High** (wrong data + O(n) cost) |
| P2 | Time-picker wheel drives ~120 animated nodes per column from the JS thread | `TimePickerModal.tsx:130-190` | Medium |
| P3 | Session timer counts ticks, not wall-clock, and the screen can sleep mid-session | `session-player.tsx:199-205` | Medium |
| P4 | Static catalog is fetched 4+ times per app use, never cached, no HTTP caching headers | `home:82`, `library:64`, `player:144`, `session-player:126`, `sessions/route.ts` | Medium |
| P5 | Player tab refetches insights on every focus **and** blur | `app/(tabs)/player.tsx:113-130` | Medium |
| P6 | `/api/insights` makes 5 separate round trips to the DB per request | `insights/route.ts:66-96` | Medium |
| P7 | No fetch timeout/abort anywhere in the client | `src/api/client.ts:21,38,65` | Medium |
| P8 | Whole Session Player re-renders every second, including blur/glass subtrees | `session-player.tsx:172, 199-205` | Low-Medium |
| P9 | Infinite animations keep running off-screen | `BreathOrb.tsx`, `BreathingRing.tsx:44-63` | Low |
| P10 | Illustration PNGs are ~1.4 MB, decoded at full size for 80px thumbnails | `assets/illustrations/`, `SessionThumbnail.tsx` | Low |
| P11 | Forward-looking scale items (unpaginated lists, `ScrollView` for lists, unbounded 30-day list) | `library.tsx`, `insights/route.ts:68-73` | Low |

---

## Security

### S1 — Production builds have no API base URL and fall back to `http://localhost:3000` (High)
**Status 2026-09-29 — ✅ RESOLVED.** Runtime guard added: `getApiBaseUrl()` in `src/api/client.ts` throws in a release build (`!__DEV__` and not Expo Go) if the URL is missing, not `https://`, or ends in `.invalid`; every request calls it, and `app/_layout.tsx` calls it once at startup and exports expo-router's `ErrorBoundary` so the message is shown on screen. Verified by running the real function text under simulated conditions (7 cases: release with undefined / `http://` / `.invalid` throws, release with real https passes, dev client and Expo Go keep the localhost fallback) and `tsc`. **Not verified:** the ErrorBoundary screen actually rendering on a device, which needs a preview/production EAS build. The earlier partial-status text follows. Done: `eas.json` now has `development`, `preview` and `production` profiles, each bound to an EAS environment; `EXPO_PUBLIC_API_BASE_URL` is set as an EAS project variable in all three (development = the current tunnel URL, kept out of git; preview/production = the deliberately invalid `https://api-url-not-configured.invalid`, to be replaced with the real API URL). (Superseded: the runtime guard described above closes the remaining gap that a build made outside these profiles would silently use `localhost`.)
**Where:** `src/api/client.ts:13` (`process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'`); `eas.json` (no `env` on any profile); `.gitignore:34` (`.env*.local` is ignored).
**What/why:** `EXPO_PUBLIC_*` values are inlined into the JS bundle at bundle time. Today it works because the value comes from the developer's `.env.local` via Metro. An EAS cloud build works from the git-tracked tree, so `.env.local` is not part of it, and `eas.json` defines no `env`. A build produced without Metro therefore contains **no** URL and will call `http://localhost:3000` — which on a phone is the phone itself. Every screen would show its error state. Release Android builds also block cleartext HTTP by default, so even a mistakenly configured `http://` production URL would fail to connect, and nothing in `client.ts` rejects `http://` or a missing variable at startup, so the failure is silent and looks like "server down".
**Fix (described only):** define `EXPO_PUBLIC_API_BASE_URL` per profile in `eas.json` `env` (or EAS environment variables); make `client.ts` throw/log loudly at startup if the value is missing or non-`https` in a non-dev build; keep the `localhost` fallback for `__DEV__` only.

### S2 — Foreground notifications are suppressed; the earlier MIUI explanation is not supported by the code (Medium)
**Status 2026-09-29 — ✅ RESOLVED.** Confirmed on-device both ways: with no handler, a foreground reminder fired (alarm wakeups 5 -> 7) but nothing was posted; after adding `initNotificationHandler()` (commit `d542481`), foreground fires at 20:18 and 20:21 were posted while the app was open (SystemUI log, app in foreground 20:14:46-20:22:34) and seen by the user. `PROGRESS.md`'s MIUI attribution has been corrected. The original hypothesis text below is kept for the record. Caveat: audible alert while foregrounded is unconfirmed.
**Where:** `grep` across `app/` and `src/` finds **no** `setNotificationHandler` and no notification listeners; `src/utils/reminders.ts` and `app/_layout.tsx:24-26` only create the channel and schedule.
**What/why:** with no handler set, `expo-notifications` does not display a notification that arrives while the app is in the foreground. The on-device alarm evidence from 2026-09-29 (app woke at ~17:46, ~17:49 and 18:00) is consistent with the two earlier "no notification" tests having been run with the app open, and the 18:00 one — which was seen — arriving with the app backgrounded. This is a hypothesis from code plus the alarm stats, not something reproduced. It means the "MIUI heads-up display issue" attribution recorded in `PROGRESS.md` (Phase 7 section) is **not established** and that entry should be corrected once this is tested. It also matters beyond testing: a user who happens to have the app open at reminder time sees nothing.
**Fix (described only):** register `Notifications.setNotificationHandler` once at startup (show banner/list, no sound if desired) and verify by testing a reminder with the app foregrounded; then correct the PROGRESS.md attribution.

### S3 — The device UUID is the only credential but is generated with `Math.random()` (Medium)
**Where:** `src/utils/deviceId.ts:13-22`.
**What/why:** the comment calls this "a local grouping identifier, not a security credential", but the backend treats `userId` as the sole key to a person's mood history: `GET /api/insights?user_id=<id>` returns it to anyone who presents the id, and `POST /api/checkin` writes under it. `Math.random()` is not a CSPRNG; the resulting ids are weaker than a v4 UUID's 122 bits suggests. Practical exploitability is low (ids are not enumerable in a useful way), but the design premise in the comment contradicts how the id is used, and this is cheap to fix.
**Fix (described only):** use a CSPRNG-backed UUID (e.g. `expo-crypto`'s `randomUUID`), and update the comment; existing installs can keep their stored id.

### S4 — The identifier travels in the URL query string (Medium)
**Where:** `src/api/client.ts:63` (`url.searchParams.set('user_id', userId)`), `insights/route.ts:56`.
**What/why:** because `user_id` acts as a bearer credential (S3), putting it in a GET URL means it lands in every request log on the path: Vercel/edge access logs, the Expo tunnel provider, Metro's proxy, any future CDN or WAF. A header or POST body is not logged by default. This extends, not repeats, the accepted "no-auth v1" decision — that decision covers *guessing* another user's id, not the id leaking out of logs.
**Fix (described only):** send the id in a request header (e.g. `X-User-Id`) or move insights to POST; when real auth arrives, replace with a token.

### S5 — The dev tunnel exposes the developer machine's Metro and the live DB-backed API publicly (Medium, testing period)
**Where:** `metro.config.js:20-47`; `.env.local` holds the tunnel URL.
**What/why:** `expo start --tunnel` publishes Metro at a public `https://…exp.direct` URL, and `metro.config.js` forwards every `/api/*` request on it to `localhost:3000`. While tested against real Supabase data, anyone who obtains the tunnel hostname can read/write the backend with the `service_role` key's authority (subject to the existing no-auth model) and fetch the app's source and source maps from Metro. The hostname (`…-smarttech1-8081.exp.direct`) is stable across restarts (observed 2026-09-29) and has been written into chat logs/notes. The proxy also forwards all request headers as-is and has no timeout or body limit.
**Fix (described only):** point dev testing at a separate Supabase project with disposable data; rotate/avoid publishing the tunnel hostname; stop the tunnel when not testing; long-term, test against the deployed API and drop the proxy.

### S6 — Tracked `.mcp.json` grants a write-capable MCP on the only Supabase project (Medium)
**Where:** `breathing-app-api/.mcp.json` (tracked; URL enables `database`, `account`, `functions`, `branching`, `development`, `debugging`, with no `read_only=true`).
**What/why:** no secret is in the file (auth is per-user OAuth), but anyone running an agent in that repo with access to the Supabase org gets `execute_sql`/DDL rights on what is currently the single, production-bound project. Earlier sessions did use it to insert and delete rows and run migrations. One mistaken prompt or hostile file the agent reads could alter or drop production data.
**Fix (described only):** split dev and prod Supabase projects; make the tracked config `read_only=true` and scoped to the dev project; keep write-capable access as an untracked local override.

### S7 — The schema, RLS state, and `record_checkin` function exist only in Supabase (Medium)
**Where:** `breathing-app-api/` has no `supabase/migrations/` (or any SQL file); `PROGRESS.md` references migrations `add_record_checkin_atomic_rpc` and `fix_record_checkin_variable_conflict` applied through the MCP.
**What/why:** the DB cannot be recreated, reviewed in a PR, diffed between environments, or restored to a known state from the repo. The security posture that `BACKEND-AUDIT.md` relies on (RLS deny-all, `revoke … from public`, `grant execute … to service_role`) is invisible to code review and can drift silently. It also blocks S6's fix (a separate dev project needs the schema to be reproducible).
**Fix (described only):** export current schema and functions into versioned migration files (Supabase CLI) and commit them; apply changes only through those files.

### S8 — Backend changes uncommitted; no CI, tests, or deployment config (Medium)
**Where:** `breathing-app-api` `git status`: `BACKEND-AUDIT.md` (staged, new), `PROGRESS.md` and `app/api/checkin/route.ts` (staged), `app/api/insights/route.ts` (modified, unstaged). Mobile `package.json` scripts have only `start/android/ios/web`; backend has `lint` only; neither repo has tests, a CI config, or a `vercel.json`.
**What/why:** the atomic-checkin fix and the stale-streak read fix — the two most important correctness changes on the backend — exist only in a working tree. Nothing gates a merge on typecheck/lint, and nothing exercises the concurrency and streak rules that took the most effort to get right. (The mobile app's own work is committed as of `5ae1ce2`.)
**Fix (described only):** commit the backend work; add a minimal CI job (typecheck + lint, plus a test for the streak/insights rules and one concurrent-checkin test); add deploy config and environment documentation before the first Vercel deploy.

### S9 — Mood history has no deletion path or privacy surface (Medium, compliance)
**Where:** system-wide; no delete/export route in `app/api/`, nothing in Settings (`app/settings.tsx` has only Daily Reminder and About).
**What/why:** pre/post mood ratings tied to a persistent device id are health-adjacent personal data. There is no way for a user to erase it (uninstalling leaves the server rows), no in-app privacy notice, and no retention policy. `CLAUDE.md` correctly forbids real biometrics; this is about the mood data that does exist. Broader testing with real users raises the bar (store policies and GDPR/CCPA-style regimes expect a deletion route and a privacy policy link).
**Fix (described only):** add `DELETE /api/user` (removes `checkins` + `streaks` for an id), a Settings "Delete my data" action, and a privacy-policy link; define retention.

### S10 — Double-tapping Confirm could schedule two daily reminders (Low, theoretical)
**Status update 2026-09-29:** downgraded from Low-Medium. This finding came from reading the code, never from an observed duplicate. The two fires seen at 20:18 and 20:21 during the foreground-notification re-test were two separate manual tests (per the user), so they are **not** evidence of this race. It remains a plausible interleaving worth a cheap guard, but there is no reproduction.
**Where:** `app/settings.tsx:106-112` (`handleConfirmTime`), `src/utils/reminders.ts:104-131`, Confirm `Pressable` at `TimePickerModal.tsx:306`.
**What/why:** the picker is closed only *after* `await applyReminderSchedule` and `await saveReminderSettings`. Two quick taps run two `applyReminderSchedule` calls concurrently; each does `cancelAll…` then `schedule…`, and the interleaving cancel-A, cancel-B, schedule-A, schedule-B leaves two DAILY notifications, so the user gets duplicates every day. Same exposure in the toggle-off path and in `build-habit.tsx:93`. Not reproduced.
**Fix (described only):** serialize `applyReminderSchedule` (single in-flight promise/mutex) and disable Confirm while a save is pending.

### S11 — Nothing reconciles the saved setting with what the OS has scheduled (Low-Medium)
**Where:** `src/utils/reminders.ts` (no read of `getAllScheduledNotificationsAsync`), `app/_layout.tsx:24-26` (startup only creates the channel).
**What/why:** "enabled" lives in AsyncStorage; the actual schedule lives in the OS. Any path that loses one and not the other (OEM task-killers clearing alarms, restored backup, a failed schedule call swallowed by the empty `catch {}` at `reminders.ts:127`, already documented) leaves Settings showing a time that will never fire, with no signal. Combined with the swallowed errors this is undiagnosable in the field.
**Fix (described only):** on app start, if `enabled`, compare against `getAllScheduledNotificationsAsync()` and reschedule if missing; have `applyReminderSchedule` return success/failure and surface failure in Settings.

### S12 — Raw error text returned by every route and never logged (Low-Medium)
**Where:** `checkin/route.ts:64-66`, `insights/route.ts:99-111`, `sessions/route.ts:43`.
**What/why:** `BACKEND-AUDIT.md` #3 covers the checkin route's status code and message leak. The same `error.message` pattern is in the other two routes, and *none* of the three logs the error server-side (`console.error` is absent). Result: schema/constraint text leaks to callers, and in production the operator has no record of failures — nothing to search when users report problems.
**Fix (described only):** log the full error server-side with request context; return a generic message and proper status codes to clients.

### S13 — `eas.json` contains only a dev-client profile (Low-Medium)
**Where:** `eas.json` (`build.development` only: `developmentClient: true`, `distribution: internal`, APK).
**What/why:** there is no `preview` or `production` profile, so no way to build an installable non-dev app or a Play-store AAB. The existing profile ships the Expo dev launcher, which lets whoever holds the APK point it at an arbitrary Metro server; it should not be handed to anyone outside the tester group.
**Fix (described only):** add `preview` (internal, no dev client) and `production` (AAB, `autoIncrement`) profiles with per-profile `env` (ties into S1).

### S14 — Android auto-backup may carry the device identity to another phone (Low, unverified)
**Where:** `app.json` (no `android.allowBackup` override; the generated manifest was not inspected).
**What/why:** if `allowBackup` is on (Expo's default template), AsyncStorage (`breathe_device_id_v1`, reminder settings) can be restored onto a new device, so two devices then share one `userId` and one streak — an identity clone made by the OS. Marked unverified because the generated manifest was not read.
**Fix (described only):** inspect the generated manifest; set `allowBackup` false (or exclude the AsyncStorage database) if a shared identity is not wanted.

### S15 — `next dev` listens on the LAN (Low)
**Where:** `breathing-app-api/package.json` `dev` script.
**What/why:** the dev server prints and serves on a network address, exposing the unauthenticated API (with real data) to anything on the same Wi-Fi.
**Fix (described only):** bind to `localhost` (`-H 127.0.0.1`) when only the local Metro proxy needs it.

### S16 — Reminder copy is visible on the lock screen (Low)
**Where:** `src/utils/reminders.ts:116-119` ("Time to breathe" / "Take a mindful pause with Breathe."). The channel default lock-screen visibility on the test device was `-1000` (app default).
**What/why:** the notification names the app and its purpose on a locked screen. Fairly neutral copy, but for a stress/wellbeing app some users will want it discreet.
**Fix (described only):** use neutral copy or set `visibility: PRIVATE` with a public version; optionally let users choose.

### S17 — Deep links expose every route; scheme is unverified (Low)
**Where:** `app.json:5` (`"scheme": "breathingapp"`).
**What/why:** any app or web page can open `breathingapp://session-player?sessionId=…`, `…/settings`, `…/onboarding/*`. Nothing sensitive is reachable and `sessionId` is validated against the live catalog (`session-player.tsx:144`), so impact is nuisance-level. Custom schemes can also be claimed by other installed apps.
**Fix (described only):** if links are ever used for anything sensitive, move to verified https app links; otherwise no action.

### S18 — Hygiene / informational (Low)
- `project-code-summary.txt` is tracked, UTF-16 encoded, 1,063 lines, and stale (last touched in `da18dcc`). No secrets found, but it is dead weight that will mislead. Delete or ignore.
- `npm audit --omit=dev`: backend **0** vulnerabilities; mobile **13 moderate**, all via Expo build-time tooling (`decode-uri-component` DoS, `uuid` bounds check, through `@expo/config`/`prebuild-config`). Not shipped in the app bundle; track, don't block.
- No security headers or `poweredByHeader` change in `next.config.ts`; JSON-only API so low value, but `X-Content-Type-Options: nosniff` is a free addition.
- Key-material search of tracked files in both repos: clean.

---

## Performance

### P1 — `/api/insights` all-time query is unbounded and silently truncates at 1,000 rows (High)
**Where:** `insights/route.ts:79-83` (`.select("sessions(duration_sec)").eq("user_id", userId)`, no limit) and `:124-130` (`totalSessions = allTimeRows.length`, minutes summed client-side).
**What/why:** this pulls one joined row per check-in the user has ever made just to count and sum them. Cost grows linearly with usage on every Home/Insights/Player load. Worse, PostgREST/Supabase caps responses at its `max-rows` setting (default 1,000): a user past 1,000 check-ins gets `totalSessions` stuck at 1,000 and `mindfulMinutes` under-counted, with **no error** — the same "silently wrong" failure mode as `BACKEND-AUDIT.md` #6 but a different mechanism (and 1,000 is reachable within a couple of years of daily use or by a scripted client, given no rate limit). The 1,000 default is Supabase's documented behavior; the project's own setting was not checked.
**Fix (described only):** compute `count` and `sum(duration_sec)` in the database (one RPC or a view, or a maintained summary column) instead of fetching rows; return only aggregates.

### P2 — Time-picker wheel is animated from the JS thread on ~120 nodes per column (Medium)
**Where:** `TimePickerModal.tsx:130-138` (`Animated.event(..., { useNativeDriver: false })`) and `:167-197` (two `scrollY.interpolate` nodes per row, for every row).
**What/why:** the minutes column has 60 rows × 2 interpolations = 120 animated style bindings updated from JS on every scroll event (`scrollEventThrottle={16}`), three columns per picker. That is the JS-driven-animation worst case; expect dropped frames on mid/low-end Android during a fling. The modal also mounts the full wheel twice on open (the `openToken` remount at lines 247-251 re-keys all three columns). Not measured on a slow device — the test phone is fast.
**Fix (described only):** drive opacity/scale natively (`useNativeDriver: true` works for `Animated.ScrollView` scroll events; compute the committed value from `onMomentumScrollEnd`), or render only the ±3 rows around the centre.

### P3 — Session timer counts ticks, not time; the screen can sleep mid-session (Medium)
**Where:** `session-player.tsx:199-205` (`setInterval` adding 1 per tick); no `expo-keep-awake` in `package.json` or anywhere in `app/`/`src/`.
**What/why:** elapsed time is "number of ticks seen", so any period where JS is throttled or suspended (screen off, backgrounded, a JS stall) simply doesn't count: a 10-minute session can run much longer than 10 minutes of real time, and never auto-completes while the phone is locked. With no keep-awake, Android's screen timeout (30 s-2 min) will turn the screen off during a breathing session, which is the app's central use case. Affects every user, not just testers.
**Fix (described only):** derive elapsed from a start timestamp (`Date.now()`) so it self-corrects, and hold a keep-awake lock while `phase === 'active'` (released on pause/exit).

### P4 — The static 6-row catalog is refetched from four places and never cached (Medium)
**Where:** `fetchSessions()` at `home.tsx:82`, `library.tsx:64`, `player.tsx:144`, `session-player.tsx:126`; `sessions/route.ts` returns no `Cache-Control`; the handler reads `searchParams`, so Next treats it as dynamic.
**What/why:** every screen mount, every retry, and every entry to the Session Player triggers a full request + a Supabase query for data that changes only on a deploy. At scale this is the highest-volume endpoint doing the least useful work (function invocation + DB round trip per call), and on poor networks it adds a spinner before each session starts.
**Fix (described only):** add `Cache-Control: public, s-maxage=…, stale-while-revalidate` on `/api/sessions`; add a small in-memory (optionally AsyncStorage-persisted) cache in the client so screens share one fetch.

### P5 — The Player tab refetches insights on every focus *and* blur (Medium)
**Where:** `app/(tabs)/player.tsx:113-130` — the effect depends on `[activeSessionId, isFocused]` and only `return`s early when `isFocused && activeSessionId`; otherwise it always calls `fetchInsights`.
**What/why:** the effect re-runs when the tab gains focus and again when it loses focus, so one visit to the tab = two `/api/insights` calls, and `/api/insights` is the most expensive endpoint (P1, P6). It is a leftover of the earlier redirect-loop fix (documented in the file's own comment) rather than an intended refresh policy.
**Fix (described only):** fetch only when focused (and ideally reuse a shared insights cache with a short TTL).

### P6 — `/api/insights` makes five separate database round trips per request (Medium)
**Where:** `insights/route.ts:66-96` (five queries in one `Promise.all`).
**What/why:** parallelism hides latency but not cost: five HTTP calls to PostgREST per request from a serverless function, each with its own connection/TLS overhead and per-request Supabase accounting. The load multiplies with P4/P5 and the lack of rate limiting (`BACKEND-AUDIT.md` #4). Fine for ten users, expensive for ten thousand.
**Fix (described only):** consolidate into one SQL function returning the whole insights payload in a single call (also resolves P1); short-TTL cache per user.

### P7 — No fetch timeout or abort anywhere in the client (Medium)
**Where:** `src/api/client.ts:21, 38, 65` — bare `fetch`, no `AbortController`, no retry policy.
**What/why:** on a captive portal or stalled connection a request can hang for the OS-level timeout (minutes); Home, Library, Insights and Session Player all show a spinner until then. The pending state only resolves with an error UI if the request *fails*. Unmounted screens still call `setState` when late responses arrive (Home, Library, Insights, Session Player have no cancellation; only Player's streak fetch has a `cancelled` guard).
**Fix (described only):** wrap requests with a timeout (`AbortController`, e.g. 10-15 s), cancel on unmount, and allow one automatic retry with backoff for idempotent GETs.

### P8 — The whole Session Player re-renders every second (Low-Medium)
**Where:** `session-player.tsx:172` (`elapsedSec` state at screen level), `:199-205` (1 Hz tick).
**What/why:** each tick re-renders the full screen: `ScrollView`, `GlassCard` (native `BlurView` + tint layers), labels, and rebuilds `PHASE_LABEL`/`phaseSubLabel` objects, when only the two time labels and the progress bar change. On low-end Android with a blur view in the tree this is avoidable work for the entire (10-18 min) session.
**Fix (described only):** isolate elapsed/progress into a small child component (or drive the progress bar with an `Animated` value), memoize the static parts.

### P9 — Infinite animations keep running when not visible (Low)
**Where:** `BreathOrb.tsx:14-31` (endless `Animated.loop`, tab screens stay mounted so it runs while another tab is showing); `BreathingRing.tsx:44-63` keeps looping while the Session Player is unfocused behind Settings (only its timers are gated on focus).
**What/why:** native-driver animations are cheap but not free (compositing, wakeups, battery). Small individually; adds up on a phone kept on the app.
**Fix (described only):** gate both on `useIsFocused()`/`paused`.

### P10 — Illustration assets are large PNGs decoded at full size (Low)
**Where:** `assets/illustrations/` — 7 PNGs, 80-295 KB each (~1.36 MB total); `SessionThumbnail.tsx` renders ~430×430 images into 80×80 boxes.
**What/why:** larger APK/download than necessary, and each thumbnail decodes a full-resolution bitmap (~0.7 MB in memory each at 430×430×4 bytes → ~4.4 MB for the six in the Library) for a tiny display size.
**Fix (described only):** ship WebP at the display resolution (2-3× of 80 px for thumbnails).

### P11 — Forward-looking scale items (Low)
- `library.tsx` renders the catalog with `ScrollView` + `.map` (fine for 6 items; use `FlatList` if the catalog becomes dynamic).
- `insights/route.ts:68-73` returns every check-in from the last 30 days with no limit (a heavy user or scripted client makes this payload unbounded); the app only needs day-level data for the chart/calendar.
- `applyReminderSchedule` (`reminders.ts:109`) cancels **all** scheduled notifications; the planned weekly recap (architecture.md "Notifications") would be wiped by the daily reminder's reschedule. Give each notification a stable identifier and cancel by id.

---

## Suggested order of work

1. **Before any broader testing:** S1 (URL/env per build profile + startup guard), S2 (notification handler — and correct the PROGRESS.md attribution), P3 (keep-awake + wall-clock timer), P1 (aggregate in SQL), S8 (commit backend work).
2. **Before public release:** S3/S4 (real random id, header not query), S9 (deletion + privacy), S7 (migrations in repo), S6 (split dev/prod Supabase), S12 (server-side logging), S13 (production profile), existing BACKEND-AUDIT items #3, #4 and #7 (rate limit, length caps).
3. **Scale/polish:** P4-P7, then P2, P8-P11, S10-S11, S14-S18.
