# Deep Audit #3 — mobile app (`breathing-app`) — tab-bar investigation + newest code

**Date:** 2026-10-09
**Commit audited:** `08bba55` (HEAD, working tree clean). The newest EAS preview build (`8bb2f3f4`, 2026-10-08) was built from this exact commit.
**Type:** Read-only. No source, config, EAS or database state was changed; no push; the live `DELETE /api/user` endpoint was never called. The only file created in the repo is this one. (A copy of the preview APK was downloaded into the session scratchpad, outside the repo, for inspection.)
**Baseline respected:** `DEEP-AUDIT-2.md` and `FRONTEND-AUDIT-2.md` were read first. Resolved items (D-02, D-03, D-10, the High "live catalog" finding) are not re-listed. Open items are mentioned only where today's evidence changes their status or severity (marked **status change**).

## Read this first — two things that differ from the brief

1. **No adb device was visible, so there are no phone screenshots.** `adb devices -l` returned an empty list twice, including after `adb kill-server` / `start-server` (Android SDK platform-tools present, daemon starts fine). The phone is probably not connected, not authorised ("Allow USB debugging" prompt), or in charge-only mode. Everything in Part 1 is therefore derived from the code, the vendored `expo-blur` / `expo-router` source, and the built APK — not from a screenshot. I say what is proven and what is inferred below. Once the phone shows up in `adb devices`, the 4-screenshot check in "Verification plan" takes a couple of minutes.
2. **The exit alert on the phone does not say what the code says.** You reported "Exit session? Your progress **will** be saved". The source says `"Your progress won't be saved"` (`app/session-player.tsx:293`, unchanged since the first commit of that file, `bcbc40b`), and the string in the newest APK's JS bundle is also `Your progress won't be saved`. See Part 3 — the likely cause is a misread of the apostrophe, but I could not rule out an older build on the phone.

## Summary

| ID | Finding | Where | Severity |
|---|---|---|---|
| F-01 | Tab bar is ~72 % see-through on Android: expo-blur's default `blurMethod` is `none`, which paints only a 27.5 %-opaque dark tint | `app/(tabs)/_layout.tsx:127-129, 211-215` | **Medium** (visible on every tab, every launch) |
| F-02 | The session clock counts 1-second ticks; nothing keeps the screen awake or uses wall-clock time, so a screen timeout mid-session stalls or distorts it (**status change:** P3, now rated higher) | `session-player.tsx:225-231, 245-263` | **High** |
| F-03 | While a check-in save is in flight, X and hardware Back are ignored, and `postCheckin` has no timeout — a stalled request traps the user on the screen | `session-player.tsx:328, 363-371`; `client.ts:67` | **Medium** |
| F-04 | The settings gear mid-session shows "Exit session? … won't be saved" but "Exit" does not exit — it opens Settings and the session survives | `session-player.tsx:352, 291-300` | **Medium** (wrong wording) |
| F-05 | Reminder startup re-apply: `cancelAll` runs first, so a failed re-schedule silently leaves the user with **no reminder** while Settings still says "on" | `reminders.ts:106-107, 151-157, 170-178` | **Medium** |
| F-06 | "Delete my data" ignores the result of cancelling the reminder; a failed cancel leaves the OS reminder alive after "Your data has been deleted" | `deleteMyData.ts:60-75` | Low-Medium |
| F-07 | Built manifest confirms `android:allowBackup="true"` (**status change:** S14 from "config default" to "confirmed in the APK"); the delete dialog says "there is no backup" | built APK manifest; `deleteMyData.ts:11-12` | Low-Medium |
| F-08 | Sessions cache stores unvalidated responses; one wrong-shaped 200 poisons the cache for the process and crashes Player tab / Session Player on every later mount (**status change:** D-04) | `sessionsCache.ts`; `session-player.tsx:132-135`; `player.tsx:161-162` | Low-Medium |
| F-09 | All 4 `fetch` call sites still have no timeout; the new DELETE call adds a permanent "deleting" spinner, and F-03 shows a worse consequence (**status change:** P7) | `client.ts:50, 67, 94, 110` | Medium |
| F-10 | `useRefreshOnNewCheckin` marks the check-in as "seen" before the refresh succeeds; a failed silent refresh is never retried | `checkinSignal.ts:21-26` | Low |
| F-11 | Accessibility: icon-only buttons unlabeled (X, settings gear, pause), mood bubbles 40 dp with no `hitSlop` and no meaningful label, no reduced-motion handling | several | Low-Medium |
| F-12 | Delete flow: local clears are best-effort but success is reported regardless; a fallback in-memory device id would "delete" the wrong id | `deleteMyData.ts:53-77`; `deviceId.ts:39-45` | Low |
| F-13 | Pre-D-10 check-ins (mood fabricated as 3) are still in the data and still shown as "Current mood" / in the trend | `home.tsx:183`; DB | Low (cannot size it — DB not queried) |
| F-14 | Release process: both preview builds, the development build and the production remote counter are all `versionCode 1`; preview has no `autoIncrement` | `eas.json:2-4, 15-21`; EAS remote | Medium (process) |
| F-15 | `APP_VERSION = '1.0.0'` is hard-coded in Settings, separate from `app.json` | `settings.tsx:25` | Info |
| F-16 | APK requests permissions the app does not use (`SYSTEM_ALERT_WINDOW`, external storage read/write) | built APK manifest | Info |
| F-17 | Large-font-scale / text-overflow risk in fixed-height rows — not tested | `home.tsx:428, 461`; `session-player.tsx:715, 905, 920` | Info (unverified) |

**Critical: 0 · High: 1 · Medium: 6 · Low-Medium: 4 · Low: 3 · Info: 3.**

---

# Part 1 — Why the Home tab bar is see-through (investigated first)

## What overlaps what

The tab bar is a transparent, absolutely-positioned bar that draws **over** the screen content; the screen's `ScrollView` scrolls *under* it. Because the bar's background is only ~28 % opaque, whatever content is behind it (on Home, the "Your Snapshot" cards — the "sessions / THIS WEEK" card in particular) is clearly visible behind the **Home / Library / Player / Insights** icons and labels. It does not touch the system navigation buttons, because the bar height already includes `insets.bottom` (see below) — so it sits above them. The overlap is purely *content under a translucent bar*, not *bar under system bar*.

## Why — proven from source (not from a screenshot)

| Layer | Evidence |
|---|---|
| The bar's own background is transparent | `app/(tabs)/_layout.tsx:211-215` — `position: 'absolute'`, `backgroundColor: 'transparent'`, `borderTopWidth: 0`. |
| The only thing painted behind the icons is a `BlurView` | `_layout.tsx:127-129` — `<BlurView intensity={40} tint="dark" … />`; no `blurMethod`, no `blurTarget`. |
| On Android that `BlurView` does **not blur** | `node_modules/expo-blur/build/BlurView.js` `_getBlurMethod()` → `providedMethod ?? 'none'` (types file: `@default 'none'`, `@platform android`). Real blur on Android needs `blurMethod="dimezisBlurView"` **and** a `blurTarget` (a `BlurTargetView` wrapping the content to blur); this app passes neither. |
| What `none` paints instead: a flat tint of alpha ≈ 27.5 % | `ExpoBlurView.kt:188/196` → `setBackgroundColor(tint.toBlurEffect(radius))`; `TintStyle.kt:58-63`: `DARK -> ((255 * intensity * 0.69).toInt() shl 24) + rgb(25,25,25)`. With `intensity = 40` → alpha `floor(255 × 0.4 × 0.69)` = **70 / 255 = 27.5 %**, colour `rgb(25,25,25)`. So ~72 % of whatever is behind the bar shows through. |
| iOS looks fine, Android does not | iOS gets a real `UIVisualEffectView` blur at the same intensity, so the design (glass bar) looked right in the Stitch reference and on web; Android silently degrades to the thin tint. |

**Computed legibility at the worst spot** (light card text `#e1e3e4` under the bar): bar tint over it composites to roughly `rgb(170,171,172)`; the inactive tab label (`#c5c5d5` at 70 %) against that is **≈ 1.24 : 1**, and the active label (`#b9c3ff`) **≈ 1.35 : 1** (WCAG needs 4.5 : 1 for the 11-12 px labels). That is the "hard to read" you see. Over empty dark background the labels are fine (≈ 10 : 1), which is why only the part of the screen with content behind it looks broken.

`GlassCard` (`src/components/GlassCard.tsx:18-19`) uses the same `BlurView` default plus a 40 % slate tint, so every card is also "fake glass" on Android — harmless there because cards sit over the flat `#111415` background, but it is the same root cause and means no card is actually blurring anything.

## Can the last card scroll clear of the bar? — yes, on all four tabs

| Tab | Bottom padding of scroll content | Evidence |
|---|---|---|
| Home | `tabBarHeight + spacing.base * 2` | `home.tsx:234-236` |
| Library | same | `library.tsx:170` |
| Player | same | `player.tsx:225` |
| Insights | same | `insights.tsx:243` |
| Session Player, Settings | not in the tab navigator — no bar to clear | — |

`tabBarHeight` comes from `useBottomTabBarHeight()`. `_layout.tsx:126` sets `height: 84 + insets.bottom`, and the vendored `BottomTabBar.js:102-105` returns a numeric custom height unchanged, so the hook returns `84 + insets.bottom`. (`insets.bottom` is also applied as `paddingBottom` inside the bar, `BottomTabBar.js:252`, which is why the icons sit above the 3-button nav bar — the 2026-09-29 fix `efdc329` is intact and working as designed.) So at the *end* of every scroll, the last card ends 32 dp above the bar. The problem is **not** missing padding; it is that content legitimately passes under the bar while scrolling and, at rest on Home, the lower snapshot cards already sit under it on a typical phone (Home's content is taller than one screen).

## Proposed fix (described only — not applied)

1. **Make the bar opaque on Android.** Replace the `tabBarBackground` `BlurView` with a plain `View` (`StyleSheet.absoluteFill`) filled with a solid theme colour — `colors.background` (`#111415`, so it merges with the screen) or a very slightly lighter surface token — plus a hairline top border (`rgba(255,255,255,0.08)`) so the bar still reads as a layer. Keep the `BlurView` only for iOS via `Platform.OS === 'ios'` if the glass look matters there. `backgroundColor: 'transparent'` on `styles.tabBar` can go (or stay; the child covers it).
2. **Keep the existing scroll padding** (`tabBarHeight + 32`) — it already clears an opaque bar.
3. **Do not try `blurMethod="dimezisBlurView"`** to keep the glass look: it needs a `BlurTargetView` wrapped around the screens, is marked experimental, and this project already lost time to Android layer/clipping quirks in this exact component (see the pill-shape comment at the top of `_layout.tsx` and the BlurView corner-clip fix). A solid bar is cheaper and robust.
4. **Design note (CLAUDE.md: match the Stitch reference):** the reference shows a frosted bar. A solid bar is a deliberate deviation on Android only; flag it to the owner rather than assume. A middle path is an 0.92-0.96 alpha dark fill — that keeps a hint of depth while dropping the see-through contrast to > 4.5 : 1 for the labels (to be re-measured once built).
5. Verification: see "Verification plan" at the end.

---

# Part 2 — Findings

## F-01 — Android tab bar is ~72 % transparent (Medium)
Fully explained in Part 1. **Where:** `app/(tabs)/_layout.tsx:127-129` (the `BlurView`), `:211-215` (transparent style). **Why it matters:** the primary navigation is hard to read on every screen with content behind it, on the platform the app is being tested on. **Fix (described only):** opaque background as above.

## F-02 — The session clock is tick-counted with no keep-awake and no wall-clock (High) — status change of P3
**Where:** `app/session-player.tsx:225-231` (`setInterval(() => setElapsedSec(s => s + 1), 1000)` — elapsed = number of ticks), `:245-263` (breath sub-phase chain of `setTimeout`s), `:234-239` (auto-advance when `elapsedSec >= durationSec`). No `AppState` listener, no `expo-keep-awake` (searched `app/` and `src/`: zero matches; not in `package.json`).
**What/why:** a breathing session is exactly the case where the user puts the phone down and closes their eyes for 5-10 minutes, so the Android screen timeout (typically 30 s - 2 min on Xiaomi) will fire in the middle of the **active** phase on a normal run. When the screen turns off the activity is paused; Android/MIUI is free to throttle or freeze the app's JS timers (aggressive on MIUI, and Doze later). The code counts ticks, not elapsed time, so any stalled interval makes the session *longer* than its stated duration (or never finish while the screen is off), and the sub-phase labels and the ring animation drift out of step with real time. Nothing in the code detects it, and nothing keeps the display on. I did not observe this on the phone (no device) — the mechanism is code-level and the same open item P3 recorded; I am raising it from "open" to **High** because it affects the one thing the app does and a normal use pattern triggers it. `isFocused` does not help: locking the screen does not change navigation focus, so the "pause while unfocused" guard (`:226`) does not fire.
**Fix (described only):** (a) hold a screen wake lock for the duration of the active phase (`expo-keep-awake`, activated on Begin and released on pause/exit/complete); (b) compute elapsed time from a recorded start timestamp (accumulate on pause) instead of counting ticks, so a throttled timer can only make the display late, never make the session longer; (c) listen to `AppState` to pause (or resync) when the app leaves the foreground.

## F-03 — A stalled save traps the user: X and Back are disabled while `saving`, and the request has no timeout (Medium)
**Where:** `session-player.tsx:328` (`if (saving) return;` at the top of `handleExitPress`), `:363-371` (hardware Back handler always returns `true` after calling it), `:305-322` (`saveCheckin` sets `saving` and awaits), `src/api/client.ts:67` (`fetch` with no timeout/signal).
**What/why:** D-03's fix deliberately ignores exits during a save to avoid a double action. Combined with no fetch timeout, a request that never completes (captive portal, dead mobile data, a Vercel cold start that hangs) leaves `saving === true` indefinitely: the Done button shows a spinner, X does nothing, **hardware Back does nothing** (the listener swallows it). The settings gear still works (it does not check `saving`), but that only moves the user to Settings, not out of the stuck screen. The only way out is to kill the app, which loses the unsaved check-in — the exact loss D-03 set out to prevent. The earlier phone test of "save with the API down" used a fast connection refusal, not a hang, so it did not exercise this path.
**Fix (described only):** a client-side timeout on every fetch (see F-09) that rejects into the existing `saveError` + "Try Again" UI, so `saving` always ends; optionally allow Back/X during a long-running save with the "Save your session?" prompt re-shown.

## F-04 — "Exit session?" is shown for the settings gear, but "Exit" does not exit (Medium)
**Where:** `session-player.tsx:352` (`handleSettingsPress = () => confirmIfActive(() => router.push('/settings'))`) and `:291-300` (`confirmIfActive` always uses the title "Exit session?" and message "Your progress won't be saved" with an **"Exit"** button).
**What/why:** tapping the gear during the active phase raises the same alert as X. Pressing "Exit" then merely navigates to Settings; the player stays mounted underneath with `phase === 'active'`, the timer and breath chain pause because `isFocused` goes false (`:226, :246`), and pressing Back from Settings returns to the *same* session at the same point. So the dialog's claims ("Exit", "progress won't be saved") are both false for this entry point — progress is in fact kept. A user who reads it literally will be afraid to open Settings, or will wrongly believe they lost a session they still have. (Related to Part 3.) Not reproduced on device.
**Fix (described only):** give the settings path its own dialog or no dialog at all (the session is safe), or at least a different title/button ("Leave this screen?" / "Open settings"); keep the destructive wording for X / Back only.

## F-05 — Startup reminder re-apply can silently erase the reminder (Medium)
**Where:** `src/utils/reminders.ts:106-107` (`const saved = await getReminderSettings(); if (saved.enabled) await applyReminderSchedule(saved);` — the returned `{ok:false}` is ignored), `:151` (`cancelAllScheduledNotificationsAsync()` runs *first*), `:157-168` (schedule), `:170-178` (catch → `console.warn`, returns `{ok:false}`); called from `app/_layout.tsx:32-35` on every cold start.
**What/why:** every launch now cancels the working daily reminder and creates a new one. If the second step throws (permission revoked in system settings, OS rejecting the channel, a transient native error), the first step has already removed the only reminder, the caller discards the failure, and Settings still shows "Daily Reminder: on, 6:00 PM". The user simply stops getting reminders with no sign of why — the same silent-failure class `4fb9274` set out to fix for the Settings screen, but the startup path was left out. (It also re-runs on each cold start, so one bad launch does not self-heal unless the user re-opens Settings.)
**Fix (described only):** schedule first, then cancel others (or only cancel when the schedule call succeeded); on `{ok:false}` at startup, mark the stored settings as needing attention so Settings can show an error; skip the whole re-apply when the channel creation failed or the OS permission is no longer granted.

## F-06 — "Delete my data" does not check that the reminder was actually cancelled (Low-Medium)
**Where:** `src/utils/deleteMyData.ts:62` (`() => applyReminderSchedule({ enabled:false, hour:null, minute:null })`) inside the loop at `:69-75`.
**What/why:** `applyReminderSchedule` never throws — it catches internally and returns `{ ok:false, error }` (`reminders.ts:170-178`) — so the `try/catch` around it at `:70-74` is dead for this entry and the failure is lost. If `cancelAllScheduledNotificationsAsync` fails, the app wipes the stored settings, tells the user "Your data has been deleted.", resets to onboarding, and the OS keeps firing "Time to breathe" every day with no way in the app to turn it off. PROGRESS.md already lists "the OS-level reminder actually being cancelled" as not verified on a device.
**Fix (described only):** inspect the result; if it is `{ok:false}`, keep the stored reminder settings and show a failure message (or retry), and only report deletion once the cancel succeeded. After the first real run, confirm with `adb shell dumpsys alarm | findstr breathingapp`.

## F-07 — `allowBackup="true"` confirmed in the built APK; delete dialog says "no backup" (Low-Medium) — status change of S14
**Where:** `aapt2 dump xmltree` of the newest APK's `AndroidManifest.xml`: `android:allowBackup=true` (and `enableOnBackInvokedCallback=false`, `screenOrientation=1`). `app.json` has no override. Dialog copy: `deleteMyData.ts:11-12` ("…It can't be undone, and there is no backup.").
**What/why:** AsyncStorage (device id, name, reminder settings, onboarding flag) is eligible for Google auto-backup and device-to-device transfer. Consequences: (1) a restored/new phone inherits the old device id — and with it, the user's history, since the id is the only credential; (2) after "Delete my data" the local keys are gone, but an older cloud backup can restore the **old id and name** after a reinstall — the server data is gone, but the user may expect the name and identity to be gone too; (3) the sentence "there is no backup" is accurate only for the server and is misleading for the phone. Previously this was "confirmed by the config-plugin default"; it is now confirmed in the built artifact.
**Fix (described only):** set `android.allowBackup: false` in `app.json` (or add backup-exclusion rules for the AsyncStorage database), then reword the dialog to say what is and is not deleted.

## F-08 — The sessions cache stores unvalidated data and amplifies D-04 (Low-Medium) — status change of D-04
**Where:** `src/state/sessionsCache.ts:14-16` (`cached = sessions`, no check); writers: `library.tsx` (`setCachedSessions(fresh)`), `home.tsx:143`, `player.tsx:173,187`, `session-player.tsx:143,153`; readers that assume an array: `session-player.tsx:132-135` (`cachedSessions?.some(...)` inside a `useState` initializer), `player.tsx:161-162` (`matchSuggestions(cached)` → `.find`).
**What/why:** D-04 (open) said a wrong-shaped 200 crashes the screen that renders it. The cache (added later, P4) makes that **sticky**: the first caller stores whatever `response.json()` returned, and a non-array (e.g. `{}` or `{"error":…}` with a 200 from a proxy or a bad deploy) then makes `.some` / `.find` throw in the initializer of every later Session Player / Player-tab mount for the rest of the process. Retrying from the error boundary does not clear it (module state survives). Low probability, but the recovery path is "force-stop the app".
**Fix (described only):** validate `Array.isArray` (and a minimal shape) in `fetchSessions` / before caching, and let readers treat a bad cache as a miss; this is the same fix D-04 asks for, now with a second reason.

## F-09 — No fetch timeout anywhere, now with a fourth call site (Medium) — status change of P7 / FRONTEND-AUDIT-2 "High, still open"
**Where:** `src/api/client.ts:50` (`fetchSessions`), `:67` (`postCheckin`), `:94` (`fetchInsights`), `:110` (`deleteUserData`, new) — no `AbortController`, no `signal`. (Re-rated Medium here because the first-load consequence — an endless spinner — is mild; the serious consequences are F-03 and the delete spinner.)
**What/why:** new consequences since the last audit: (a) F-03 (user trapped while saving); (b) `settings.tsx:103-118` sets `deleting = true` and the button is disabled until `deleteMyData()` returns — on a stalled request the card spins forever, Back works but the delete may still complete invisibly later; (c) Home/Library/Insights/Player spinners unchanged.
**Fix (described only):** one small `fetchWithTimeout` (about 10-15 s, `AbortSignal.timeout` or an `AbortController`) used by all four functions, surfacing a timeout as the same error + Retry the screens already show. Separate shorter bound for the DELETE and a longer one for POST so a slow cold start does not discard a legitimate save.

## F-10 — A failed silent refresh after a check-in is never retried (Low)
**Where:** `src/state/checkinSignal.ts:21-26` — `seenVersion.current = checkinVersion` is set before `refresh()` runs; Home/Insights `refreshAfterCheckin` (`home.tsx:113-119`, `insights.tsx:136-142`) swallow failures with `.catch(() => {})`.
**What/why:** if the refresh after a saved session fails (offline, timeout once F-09 exists), the version is already marked seen, so the tab keeps the pre-session numbers until another check-in is saved or the app restarts. The user sees "Total Sessions" not increase right after completing a session.
**Fix (described only):** advance `seenVersion` only when the refresh succeeds (have `refresh` return its promise), or fall back to the visible error + Retry state when a post-check-in refresh fails.

## F-11 — Accessibility gaps on the newest and most-used controls (Low-Medium)
- Icon-only `Pressable`s with no `accessibilityRole` / `accessibilityLabel`: the session player's close and settings buttons (`session-player.tsx:97, 103`), the pause/play button (`:602-608`, the key control during a session), Home/Library/Insights/Player settings gears. TalkBack reads them as unlabeled buttons. (Only `settings.tsx` back, name and delete rows have labels.)
- `MoodSelector.tsx:47-56`: bubbles are 40 × 40 dp (below the 48 dp Android target) with no `hitSlop` (open since FRONTEND-AUDIT-2); the label `"Mood 3 of 5"` gives no meaning (the emoji and the "Stressed … Calm" end labels are not exposed); the row is `role="radio"` without a radio-group container. With D-10 the user must now choose a mood to proceed, so a TalkBack or motor-impaired user who cannot hit/understand a bubble is blocked from starting or finishing a session.
- Disabled Begin/Done are conveyed with `accessibilityState` (good) but the hint text ("Pick how you're feeling to begin") is only a visual `Text`; fine for TalkBack as a sibling, but not tied to the button.
- No `AccessibilityInfo.isReduceMotionEnabled` handling for the looping orb/ring animations; the breathing phase label changes ("BREATHE IN" → "HOLD") with no live-region announcement.
- Contrast: the "Stressed / Calm" labels use `onSurfaceVariant` at 0.6 opacity → ≈ 4.4 : 1 on a glass card (computed), just under AA for small text; and see F-01 for the tab labels.
**Fix (described only):** add roles + labels to the icon buttons; enlarge/`hitSlop` the bubbles and give them descriptive labels ("Stressed", …, "Calm"); wrap in `accessibilityRole="radiogroup"`; honour reduce-motion; announce the sub-phase with a polite live region.

## F-12 — Delete flow reports success even if local resets partly failed or the wrong id was deleted (Low)
**Where:** `deleteMyData.ts:53-57` (`await deleteUserData(await getDeviceId())` inside the `try`) and `:69-75` (each clear's error is swallowed, function returns `true`); `deviceId.ts:39-45` (storage failure → in-memory fallback id).
**What/why:** (a) if AsyncStorage is unavailable, `getDeviceId()` returns a freshly-minted in-memory id, the server correctly says 2xx for an id that owns nothing, and the app reports "deleted" while the real id's data is untouched; (b) if `clearDeviceId` / `clearOnboardingComplete` throws after the server delete, the app still says "deleted" and may keep the old id and skip onboarding. Both need a failing AsyncStorage — rare, but the promise on screen is absolute. The `dismissAll()` + `replace('/')` sequence (`settings.tsx:114-117`) was only verified on web.
**Fix (described only):** distinguish "could not read the stored id" from "deleted", and return a partial-failure result that tells the user what remains.

## F-13 — Mood data from before D-10 is still the fabricated "3" (Low)
**Where:** `home.tsx:183` (`latestMood = insights?.checkins[0]?.postMood`), and the Insights mood trend — both read stored `postMood`/`preMood`.
**What/why:** D-10 only changes what new check-ins send. Any earlier check-in where the user skipped a selector stored 3 ("Neutral"/"Content"-range) and is indistinguishable from a real 3 forever. I did not query the database, so I cannot say how many; on a fresh tester install this is zero, on the owner's device it is non-zero. Home's "Current mood" can still show a mood the user never reported until a newer real check-in replaces it.
**Fix (described only):** acceptable to leave (state it in release notes), or tell testers to use "Delete my data" before the first real run; no code change needed.

## F-14 — versionCode is 1 on every build and nothing increments it for preview (Medium, process) — see Part 4
Detailed in Part 4.

## F-15 to F-17 — Info
- **F-15:** `settings.tsx:25` hard-codes `APP_VERSION = '1.0.0'`; it will not follow `app.json` or the build. Read it from the installed package info (`expo-application` / `expo-constants`) so the screen cannot disagree with the APK.
- **F-16:** the APK manifest includes `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `VIBRATE`, `POST_NOTIFICATIONS`, `INTERNET`, `ACCESS_NETWORK_STATE`, `DUMP` plus ~15 launcher-badge permissions (from `expo-notifications`). The reminder feature needs `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `WAKE_LOCK`; the overlay and external-storage permissions are not used by this app and widen the install-time disclosure. `android.blockedPermissions` in `app.json` can remove them. (No exact-alarm permission is present; reminder delivery was verified on-device earlier, so I left this alone.)
- **F-17:** several rows use fixed heights (`home.tsx:428, 461`; `session-player.tsx:715` top bar 64, `:905` pause 48, `:920` 64). With Android font scale at its largest (common on Xiaomi), titles and buttons in these slots may clip. Not tested — listed so it is on the checklist for the on-device pass.

---

# Part 3 — The mid-session exit alert (item 3)

**Exact wording in code** (`app/session-player.tsx:291-300`, function `confirmIfActive`):

```
Title:   Exit session?
Message: Your progress won't be saved          (straight apostrophe: won't)
Buttons: Cancel (cancel)   |   Exit (destructive)
```

The same string is in the newest APK's JS bundle (`Exit session?` and `Your progress won't be saved` both found in `index.android.bundle`; the string "Your progress will be saved" does not occur in the bundle, and `git log -S"progress will be saved"` finds no commit that ever contained it). It has been unchanged since the file's first commit (`bcbc40b`). **So the code does not say "will be saved".** Possible reasons for what you saw: the apostrophe in "won't" is small and easy to misread on a phone; or the installed APK is not one of the two preview builds (the older preview, `539ee4ae`, 2026-10-03, built from `9897f38`, also has "won't"). I could not read the phone, so I cannot tell which.

**What "Exit" does** (when the X is tapped; `session-player.tsx:327-351, 265-272`):
- `handleExitPress` → `confirmIfActive(exitSession)` → on "Exit" → `exitSession()`: `setActiveSessionId(null)`, then `router.back()` (or `router.replace('/home')` if there is no history).
- **No check-in is posted.** `postCheckin` is called only from `saveCheckin()` (`:305-322`), which is reached only from Done (`handleDone`) or the post-mood "Save" prompt. So leaving mid-session discards everything: no streak credit, no mindful minutes, no mood. There is no partial credit.

**Is the wording inaccurate?**
- For the **X / hardware Back** path: "Your progress won't be saved" is *true*, but weak. "Progress" sounds like a position bookmark (resume later); the real effect is that **the whole session is thrown away and never counted**. Also the destructive button is called "Exit", and the safe one "Cancel", which is ambiguous (cancel what?). So: accurate, but easy to misunderstand.
- For the **settings gear** path (F-04): the same dialog is *wrong* — "Exit" opens Settings, nothing is lost, and the session resumes on return.
- If the phone really showed "will be saved", that sentence would be false for the X path; the code does not produce it.

**Proposed corrected wording (not applied):**

| Path | Title | Message | Buttons |
|---|---|---|---|
| X / hardware Back during the active phase | `End this session?` | `You're partway through. If you leave now, this session won't be counted and no check-in will be saved.` | `Keep going` (cancel) · `End session` (destructive) |
| Settings gear during the active phase | `Open Settings?` | `Your session will pause and you can pick up where you left off.` | `Stay` (cancel) · `Open Settings` |

(Wording choices: "Keep going / End session" removes the Cancel-vs-Exit ambiguity; "won't be counted" says what the user actually loses. The existing post-mood prompts — "Save your session? / Your check-in hasn't been saved yet." and "Exit without saving?" — are accurate and need no change.)

---

# Part 4 — versionCode (item 6)

**Facts (verified, not assumed):**
- `app.json` has **no** `android.versionCode` (and no `ios.buildNumber`); `"version": "1.0.0"` is the human-readable versionName only.
- `eas.json:2-4`: `"cli": { "appVersionSource": "remote" }` — with `remote`, EAS keeps the build number on its servers and **ignores** any `versionCode` written in `app.json`.
- `eas.json`: `autoIncrement: true` exists **only** on the `production` profile (`:21`); `development` and `preview` have none.
- `eas build:version:get -p android -e preview | production | development` → **Android versionCode - 1** for all three (one shared remote counter).
- `eas build:list`: the last three Android builds (`8bb2f3f4` preview 2026-10-08, `539ee4ae` preview 2026-10-03, `13884643` development 2026-09-28) all have `appBuildVersion: "1"`. `aapt2 dump badging` on the newest APK: `package: name='com.smarttech1.breathingapp' versionCode='1' versionName='1.0.0'`.

**Why it matters:** a package install over an existing install needs the same signature and a `versionCode` that is not lower; **equal is not a downgrade**, so a manual sideload/`adb install -r` of a same-code APK normally works, but nothing treats it as *newer*: MIUI's installer sometimes refuses or mis-labels same-version installs, and any tool that compares codes (Play, Firebase App Distribution, MDM, an in-app update check) cannot tell build 2 from build 1. All three profiles share one package id, so the dev-client and preview APKs also overwrite each other and share AsyncStorage — worth knowing when testing.

**Proposal (not applied) — pick one:**
1. **Preferred:** add `"autoIncrement": true` to the `preview` profile in `eas.json`. With the remote source EAS bumps the shared counter on every preview build, so the next preview becomes 2, then 3. The existing production `autoIncrement` then continues from the same counter. (Do the same for `development` if you also sideload dev clients.)
2. **One-off bump before the next build:** `eas build:version:set -p android` (interactive; set it to `2`), or pass the value non-interactively with the CLI's version-set flag. This changes only EAS's remote value — no repo change — and is the right move if you want to bump *without* touching `eas.json`.
3. Do **not** put `android.versionCode` in `app.json` while `appVersionSource` is `remote` — it is ignored and will confuse the next reader. If you later move to `local`, the app.json value becomes authoritative and options 1-2 stop applying.
4. Whichever you choose, make Settings' "Version 1.0.0" follow the real build (F-15); consider also showing the build number so a tester can say which APK they have — this would have settled the "which build is on the phone?" question in Part 3.

---

# Part 5 — APK check (item 5)

Newest preview APK (`8bb2f3f4`, built from `08bba55`) downloaded to the scratchpad and inspected (`aapt2`, `unzip`, byte search of the Hermes bundle `index.android.bundle` and `assets/app.config`):

| Check | Result |
|---|---|
| API base URL | `https://breathing-app-api.vercel.app` — the only app URL in the bundle. Live check: `GET /api/sessions` → **HTTP 200**, 1.7 s. |
| Placeholder / local URLs | None. The single `.invalid` hit is the guard code in `getApiBaseUrl()`, not a configured URL. No `localhost:3000`. No `192.168.x.x` — the LAN IP in the git-ignored `.env.local` (`EXPO_PUBLIC_API_BASE_URL=http://192.168.0.178:8081`) did **not** leak into the build. |
| Env inlined | Only `EXPO_PUBLIC_API_BASE_URL` (and the framework's own `EXPO_PUBLIC_USE_RN_FETCH`). EAS `preview`/`production`/`development` each load exactly that one variable. |
| Secrets | No `sb_secret_`, `sb_publishable_`, `service_role`, `supabase`, JWT (`eyJhbGci…`) or private-key markers anywhere in the bundle or `app.config`. The app never contains Supabase code, consistent with CLAUDE.md. |
| `app.config` in the APK | Contains only public Expo config + EAS project id; no secrets. |
| Debug / cleartext | Not debuggable; no `usesCleartextTraffic` flag (so the https-only URL is also what Android enforces). |
| Backup | `allowBackup=true` — see F-07. |
| Permissions | see F-16. |
| Alert text present | `Exit session?`, `Your progress won't be saved`, `Save your session?`, `Exit without saving?`, `Delete all your data?`, `reminder-v2` all found — i.e. the build includes D-03, D-10, reminder-v2 and Delete my data, as expected for `08bba55`. |
| Signing / `npm audit` / dependency tree | not checked in this pass. |

---

# Part 6 — Review of the newest code (item 2) — what was verified OK

So nothing is assumed, here is what I read and found sound:
- **D-10 / `session-player.tsx` + `MoodSelector.tsx`:** moods start `null`; Begin is disabled and styled while `preMood === null` (`:541-545`); Done disabled while `postMood === null` (`:675-683`); `saveCheckin` refuses to send null moods (`:308`) so the API can never receive a fabricated value; `emojiForMood(null)` renders "–"; the post-mood exit alerts branch correctly on null (`:329-336`); `MoodSelector` shows an empty track for `null` and accepts `number | null`. Only residual issues are the accessibility ones in F-11.
- **Sessions cache (P4) correctness:** the session screen starts from the cache only if it contains the requested id, refreshes in the background *without* setting state (so `session` keeps a stable reference and the timers do not restart), and falls through to the blocking fetch otherwise (`:132-159`). Home/Library/Player each guard "non-empty" before treating a cache as a hit. Aside from F-08 (unvalidated writes) it behaves as documented.
- **checkinSignal:** the counter is bumped only after a successful `postCheckin` (`:314`), skips the first focus, and covers Home, Insights and the Player tab's own refresh; a Library-launched session → Save → Back still refreshes Home on next focus. Aside from F-10 it is correct.
- **reminder-v2 channel:** `initNotificationChannel` creates the HIGH-importance channel before re-applying; the channel id is passed in the DAILY trigger (`:166`); Expo Go / web guards are present at every entry. Aside from F-05 it is correct.
- **Delete my data:** server delete first, local reset only on success (`:55-58`); in-memory device-id cache is reset (`deviceId.ts:51-53`); confirm/destructive/failure strings match the spec; the 429/500/network paths leave local data intact. Aside from F-06/F-12 it is correct. `deleteUserData` does not read the response body (consistent with D-04).
- **Back-handler:** the effect's dependency list now includes everything `handleExitPress` reads, so no stale-closure save; `enableOnBackInvokedCallback=false` in the built manifest confirms the hardware-Back listener is the active path (predictive back is off).

## Still open from earlier audits, re-confirmed unchanged (not re-argued)
D-01, D-04 (see F-08), D-05/D-06 (Supabase side — not observable from the mobile repo; PROGRESS.md says the next session), D-07 (no git remote — `git remote -v` not re-checked), D-12, D-14, D-15, Settings has no `ScrollView`, `BreathingRing` resume restarts from inhale, Home "···" icon is decorative, Player Calm Streak card silently disappears on failure.

---

# What I could NOT check

- **The phone itself.** No adb device was visible (empty `adb devices -l` twice), so: no screenshots of the see-through tab bar, no confirmation of exactly which build/version is installed, no check that the alert text on screen matches the code, no `dumpsys alarm` look at the reminder, no verification that F-02 (timers stall when the screen sleeps) actually happens on this Xiaomi / MIUI. F-01's cause is proven from source; its *appearance* is inferred and computed, not seen.
- **Native `Alert` dialogs and `dismissAll()` + `replace('/')` on Android** (only exercised on web by the previous session) — read, not run.
- **Anything behind the Supabase / Next.js side:** the API repo and the live database were not audited here (the mobile audit is read-only on the app). I did not call `DELETE /api/user`, `POST /api/checkin`, or any write endpoint; the only network call I made was one `GET /api/sessions`. D-05 and D-06 status is unknown from this repo.
- **Which of the two preview APKs is installed on the phone**, and whether the "will be saved" text you saw came from a different build or was a misreading.
- **Expo web / Playwright runs** — none this pass; no new behavioural tests were run.
- **TalkBack, Android font-scale at maximum, dark/light system themes, tablets, iOS** — not tested (F-11 and F-17 are code-reading findings).
- **MIUI-specific behaviour** (battery restrictions, app freezing, installer rules for same-versionCode APKs) — described from general Android behaviour, not tested.
- **`npm audit`, APK signing certificate, release `.aab`/production profile** — not examined this pass.
- **Measured contrast on screen** — the ratios in F-01/F-11 are computed from the token colours and the verified tint alpha, not sampled from a screenshot.

---

## Verification plan once the phone is connected (read-only)
1. `adb devices -l` shows the phone as `device`.
2. `adb -s <serial> exec-out screencap -p > home-top.png` with Home at scroll top; again after a scroll that puts the "THIS WEEK" card behind the bar; then Library, Player, Insights. Compare: expect card text visible through the bar labels (F-01).
3. After the fix: same four screenshots; labels readable, last card still clears the bar at full scroll.
4. `adb shell dumpsys package com.smarttech1.breathingapp | findstr versionCode` — read the installed code before and after the next build (Part 4).
5. With the app mid-session, `adb shell input keyevent 26` (screen off), wait 30 s, screen on: compare the session clock with a stopwatch (F-02).
