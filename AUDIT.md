# Frontend Audit — Breathe (breathing-app)

**Date:** 2026-09-19
**Scope:** Full read-only audit of the mobile app (`breathing-app/`) — every screen, every shared component, shared state, config. No backend exists yet, so backend/auth/network-security categories are out of scope per instruction.
**Method:** Read every screen/component/data/type/config file in the repo; cross-referenced against PROGRESS.md's full history, PRD.md, architecture.md, CLAUDE.md, and DESIGN.md; ran `npx tsc --noEmit` (clean); spun up an isolated, disposable Expo web server (torn down after, no source files touched) and used `playwright-cli` to click-test every settings-gear icon and its return path, and to empirically verify a hypothesis about Session Player state during navigation. This document is the only file created or modified as part of this audit.

---

## Executive Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 3 |
| Low | 5 |
| Info | 2 |
| **Total** | **11** |

No crash-risk or data-corruption bugs were found, and `npx tsc --noEmit` is clean. The one **High** finding is a real, novel behavioral bug — not a hypothesis — confirmed by direct testing this session:

1. **[HIGH] Session Player's Android hardware-back handler is not focus-aware, and today's new Settings-navigation wiring makes it exercisable for the first time.** Navigating from an *active* breathing session to Settings does **not** unmount Session Player (confirmed empirically — its elapsed-time timer kept running in the background). Its `BackHandler` listener (`app/session-player.tsx:181-188`) has no `useIsFocused()` guard, so on Android, pressing the hardware back button while looking at the *Settings* screen (reached from an active session) would fire Session Player's own handler and pop up "Exit session? Your progress won't be saved" **over the Settings screen**, and confirming "Exit" clears `activeSessionId` while Session Player is still mounted at `phase: 'active'` underneath — a real context/UI desync. This scenario was impossible before this session's work (there was previously no way to `push` another screen on top of Session Player without unmounting it); it is a direct, newly-introduced side effect of wiring the settings gear icon into `session-player.tsx`.
2. **[MEDIUM]** Same root cause, different symptom: Session Player's elapsed-time timer and breath-phase cycle keep running **invisibly** while Settings is open on top of it. A long-enough visit to Settings during an active session can cause the session to silently auto-complete in the background.
3. **[MEDIUM]** Tapping the Settings gear during the `active` phase bypasses the existing "Exit session?" confirmation entirely — every other way of leaving the active phase (X button, Android hardware back) is guarded; the new Settings link isn't, which is an inconsistency even though (per finding #2's mechanics) no progress is actually destroyed.
4. **[MEDIUM]** `BreathingRing`'s pulse animation restarts from the "inhale" stage on every pause/resume, regardless of which breathing sub-phase the on-screen label is actually showing — repeated pausing increasingly desyncs the visual ring from the phase text.

Everything else is Low/Info-level polish. See below for the full breakdown, organized by screen in PROGRESS.md's build order, followed by a section listing what was checked and deliberately excluded because it's already a known/accepted decision in PROGRESS.md.

---

## Home (`app/(tabs)/home.tsx`)

### Functional
- **[Low] Duplicate/dead dummy-data source for "sessions this week."** `home.tsx:30` hardcodes `snapshot.sessionsThisWeek = 12` locally. `src/data/insights.ts:42` separately exports `sessionsThisWeek = 12` — which is **never imported anywhere** (confirmed via project-wide grep). Two independent copies of the same placeholder stat exist; if either is ever changed without the other, Home and Insights would silently disagree on "sessions this week" even though they're meant to be narratively consistent (per `insights.ts`'s own comment, which says it deliberately reuses Home's numbers). *Suggested fix: have Home import `sessionsThisWeek` from `src/data/insights.ts` instead of redeclaring it, and delete the unused export if it truly has no other purpose, or keep the export but have Home consume it — either way, one source of truth.*
- Begin button, Featured Session hero data, and the newly-wired Settings icon (`home.tsx:63-69`) were all click-tested this session (Settings) or in prior sessions (Begin) and work correctly — no issues found.

### UI/Layout
- Nothing new. Confirmed the settings-icon Pressable (`padding: spacing.base` = 8, `hitSlop={12}`) gives an effective touchable area of roughly 64×64 around the 24px icon — comfortably clears the ~44×44pt minimum despite the visible box itself being ~40×40.

### Consistency
- Colors/typography/spacing all trace to `tokens.ts` (generated from `DESIGN.md`'s frontmatter — spot-checked several values, no drift found between `DESIGN.md` and `tokens.ts`). No hardcoded hex/px found beyond the already-documented `backgroundGlow` flat-circle approximation (see "Checked and excluded" below).

---

## Library (`app/(tabs)/library.tsx`)

### Functional
- Search input, category tab filtering, Quick Start, session-card navigation, and the settings icon (`library.tsx:91-97`) were all traced/tested and work correctly (search + category combine correctly via `visibleSessions`'s `useMemo` at lines 59-67; category counts sum correctly to 6).
- No pull-to-refresh anywhere in the app (not expected at this build stage — there's no live data to refresh yet).

### UI/Layout
- **[Info] No `KeyboardAvoidingView` anywhere in the app.** Library's search `TextInput` (`library.tsx:121-127`) is the app's only text input, and it sits near the top of the screen, so it's very unlikely to be obscured by the keyboard today. Flagging only because this will matter the moment any future screen (e.g., a real Settings reminder-time picker, or a future feedback field) puts a text input lower on screen.
- **[Low] Category-tab touch target.** `categoryTab` (`library.tsx:304-313`) is `paddingVertical: spacing.base*1.25` (10) around ~16px label text plus a small count badge — roughly 36-40px tall, no `hitSlop`. Below the ~44pt guideline, though this is a common, low-risk pattern (five adjacent pill tabs of exactly 44pt height would look oversized) — flagging as a minor, not urgent, item.

### Consistency
- `topBar` height is 64 here vs. Home/Insights' 56 — **this is already documented, intentional drift** (Home/Insights were deliberately trimmed for "first-paint fit," Library/Player were not — see PROGRESS.md's "Tab-bar-overlap investigation: CLOSED"). Re-checked whether today's settings-icon change makes this matter more: it doesn't — the icon is vertically centered within `topBar` via `alignItems:'center'` regardless of the bar's height, so there's no misalignment or functional impact. Not re-reporting as a new finding.

---

## Session Player (`app/session-player.tsx`)

### Functional — High/Medium (see Executive Summary for full detail)
- **[High]** `BackHandler` listener (lines 181-188) has no focus-awareness (`useIsFocused()` not used anywhere in the codebase — confirmed via grep). Combined with the fact that `router.push('/settings')` (the new settings-icon wiring, line 255) does **not** unmount Session Player — empirically confirmed: elapsed time (`00:15` → `00:48`) and phase label continued advancing correctly while Settings was the visible screen and after navigating back — pressing Android hardware back while on Settings (reached from an active session) will trigger Session Player's `handleExitPress()`, showing "Exit session? Your progress won't be saved" **over the Settings UI**, and tapping "Exit" clears `activeSessionId` while Session Player remains mounted at `phase:'active'` underneath, a real state desync (the Player tab could then wrongly show its "No session in progress" empty state while Session Player, if reached again, would still show/resume the active UI). Not testable on web (`BackHandler` has no web equivalent — same standing limitation this project has flagged before for the original exit dialog), but the mechanism is direct API semantics, not speculation, and the load-bearing premise (Session Player doesn't unmount) was directly tested and confirmed. *Suggested fix: gate `session-player.tsx`'s `BackHandler` listener (and/or its `handleExitPress` calls generally) with `useIsFocused()` from `@react-navigation/native` (already a transitive dependency via expo-router) so it only intercepts hardware back while Session Player is actually the visible/focused screen.*
- **[Medium]** Same mounted-in-background mechanism: the elapsed-time `setInterval` (lines 116-122) and the breath-sub-phase `setTimeout` chain (lines 134-152) both keep running while Settings is open on top, since neither is gated on focus. A sufficiently long visit to Settings during an active session will silently flip `phase` to `'post-mood'` (line 125-129's auto-advance effect) in the background; returning from Settings would show "Session Complete" with no visible countdown/transition, which would likely read as broken/jarring rather than expected. *Same fix as above (`useIsFocused()`) would also address this, or alternatively pause the interval/timeout chain specifically while unfocused.*
- **[Medium]** Tapping the settings gear during `active` phase (line 254-260) has **zero** confirmation, while the X button and hardware back (both routed through `handleExitPress`, lines 167-176) explicitly guard the active phase with an "Exit session?" alert. Given finding above, no progress is actually lost by tapping Settings — but the inconsistency (one exit path guarded, one not) is still a real UX gap a user could reasonably be confused by, especially before finding #1's dialog surprises them later. *Suggested fix: either route the settings-icon press through the same `handleExitPress`-style confirmation when `phase === 'active'`, or (simpler, given data isn't actually lost) leave it unguarded but ensure finding #1 is fixed so there's no confusing dialog later.*

### Functional — Other
- **[Medium] `BreathingRing` pause/resume doesn't preserve animation position across the phase cycle.** `src/components/BreathingRing.tsx:41-69`: the `useEffect` restarts the *entire* `Animated.sequence` (inhale→hold→exhale→rest) from scratch every time `paused` flips back to `false`, always beginning with the "inhale" `1→1.15` step — regardless of which `breathSubPhase` the on-screen label (`session-player.tsx`'s independent `setTimeout` chain) is actually showing at that moment. The label's own timer, meanwhile, resumes counting from wherever its own state was, unaffected by the ring's restart. This builds on the already-documented "two independent timing mechanisms... not frame-perfectly synced" limitation (PROGRESS.md, Session Player build entry) but is a more specific, actionable case: every pause/resume cycle compounds the drift, rather than it being a fixed, steady-state small offset. Also, because `Animated.timing`'s duration is fixed regardless of the animated value's *current* position, resuming mid-inhale (e.g. `scale` frozen at 1.08) causes the ring to visibly move less distance than normal in the same duration — an apparent slow-down, not a clean resume. *Suggested fix: track (or derive) which sub-phase + elapsed-within-sub-phase the animation should be in in a way that both the label timer and the ring animation read from, and have the ring's resume logic jump straight to the correct sub-phase's animation leg using the remaining duration, not always "inhale" with a full duration.*
- **[Low] `MoodSelector` touch targets below ~44pt with no compensation.** `src/components/MoodSelector.tsx:84-93`: the 5 mood-emoji buttons are 40×40 with **no `hitSlop`** — unlike nearly every other interactive element in the app (Home/Library/Player/Insights/Session Player's icon buttons all use `hitSlop={12}` or similar). Affects both the pre-mood "How are you feeling?" picker and the post-mood "How do you feel now?" picker (same shared component, both instances in `session-player.tsx`). *Suggested fix: add `hitSlop={4}`-`{8}` to the bubble `Pressable`, consistent with the rest of the app.*
- `handleDone`'s `// TODO: POST /api/checkin...` (line 199) is an already-known, correctly-flagged stub (no backend yet) — not a new finding.
- Exit-confirmation Alert, hardware-back handling, and gesture-disabling during `active` were spot-checked for continued presence (all still there, matching architecture.md's spec) — no regressions found in the base behavior itself, only the new interaction with Settings noted above.

### UI/Layout
- No overlap, scroll, or safe-area issues found across all 3 phases.

### Consistency
- Session Player already uses its own local `topBarButton` pattern (`padding: spacing.base`) that Home/Library/Player/Insights' new settings-icon wiring copied exactly — good consistency, confirmed by direct comparison.

---

## Tab bar / navigation (`app/(tabs)/_layout.tsx`)

### Functional
- All 4 tabs navigate correctly (confirmed via code read + the settings-icon click-testing incidentally exercising Home/Library/Player/Insights tab navigation this session).
- Re-confirmed the Android-specific fixes documented in PROGRESS.md are still intact, via direct grep/read (not just assumed from history):
  - `tabBarButton` pattern (not `tabBarIcon`/`tabBarLabel`) — present on all 4 `Tabs.Screen` entries.
  - No `android_ripple` anywhere in the app (project-wide grep: zero matches).
  - The pill-shape background was fully removed (LinkedIn-style fill-swap icons) — confirmed no `tabContentActive`/pill styling remains.
  - Icon choices (`home`/`library`/`play-circle`/`trending-up` + outline variants, all Ionicons) unchanged from the documented fix.
- No new functional issues found here.

### UI/Layout
- Nothing new to report; the previously-deferred pill-width cosmetic issue is moot since the pill was removed entirely (see "Checked and excluded").

---

## Insights (`app/(tabs)/insights.tsx`)

### Functional
- Settings icon (added this session, `insights.tsx:118-124`) click-tested and confirmed working, including the back-button round trip.
- Re-confirmed `chunk()` (avoiding `flexWrap`) is still used for both the consistency calendar (line 162) and the stat-card grid (line 184) — the documented Android `flexWrap` fix is intact, not regressed.
- `MoodTrendChart` (`src/components/MoodTrendChart.tsx`) guards the zero-data case (`if (points.length === 0) return null`, line 78) — no crash risk if `moodTrend` were ever empty.

### UI/Layout
- No overlap/scroll/safe-area issues found. `cardClip` (BlurView corner-clip workaround) still present on all 3 card types.

### Consistency
- No hardcoded values found beyond the already-documented, accepted approximations.

---

## Onboarding — Welcome / How It Works / Build the Habit (`app/onboarding/*.tsx`)

### Functional
- All navigation (Next/Next/Get Started, Skip from every screen, Enable Reminders' dummy `Alert.alert`) traced in code and matches PROGRESS.md's documented on-device-confirmed behavior — no regressions found.
- No settings gear icon exists on any onboarding screen (by design — these screens only have a florist icon + Skip in the header) — correctly out of scope for the settings-navigation audit.
- `setOnboardingComplete()` calls are all `async`/`await`ed correctly before navigating; no race condition where navigation could fire before the flag is persisted.

### UI/Layout
- No new issues. "How It Works" is correctly the only one of the 3 that scrolls (its content genuinely overflows one viewport at a phone width); Welcome and Build-the-Habit use `justifyContent:'center'` fixed layouts appropriately for their shorter content.

### Consistency
- **[Low] Inconsistent `hitSlop` on "Skip" buttons.** Onboarding's Skip/back-style text buttons use `hitSlop={8}` (`welcome.tsx:35`, `build-habit.tsx:84`, `how-it-works.tsx:54`), while every icon-button elsewhere in the app (Session Player, and today's new Home/Library/Player/Insights settings icons) uses `hitSlop={12}`. Given "Skip" is rendered as plain 12px label text with no background box, its raw visual hit area is small (a short word at 12px height) — even with `hitSlop={8}`, the effective vertical touch target is roughly in the low-30s px, still under the ~44pt guideline. Not a functional bug (the button works when tapped accurately), but a minor accessibility/reachability polish item. *Suggested fix: bump these to `hitSlop={12}` (or larger) to match the rest of the app and get closer to the 44pt guideline.*

---

## Settings (`app/settings.tsx`) — built this session

### Functional
- Header back button, and the reminder toggle's local state, both work as implemented (confirmed via click-testing this session and in the prior conversation turn). No persistence yet (`AsyncStorage`/`expo-notifications`) — this is explicitly, correctly flagged in PROGRESS.md as out of scope for this build step, not re-reported here.
- Reachable now from all 5 gear-icon locations app-wide (Home, Library, Player, Insights, Session Player) — all 5 click-tested this session, all navigate to `/settings` and all 5 "Go back" round-trips return to the correct originating screen (Home→Home, Library→Library, Player→Player, Insights→Insights, Session-Player→Session-Player).

### UI/Layout
- **[Low] `ReminderToggle`'s effective touch target sits exactly at, not above, the ~44pt floor.** `app/settings.tsx`: `toggleTrack` is 48×28 with `hitSlop={8}`, giving an effective tappable area of 64×44 — the height lands exactly on the commonly-cited minimum with zero margin. Not urgent, but tighter than everything else in the app (which generally clears 44pt with room to spare via `hitSlop={12}`). *Suggested fix: bump the toggle's `hitSlop` to 10-12 for a small margin above the floor, purely for consistency with the rest of the app's touch-target sizing.*

### Consistency
- Colors/typography/radii all traced to `tokens.ts` and matched against `settings-code.html`'s inline Tailwind config hex-for-hex (done when the screen was built this session) — no drift found on re-check.

---

## Shared components / state

- **`src/components/GlassCard.tsx`** — no new issues. Its fixed `rgba(30,41,59,0.4)` tint (rather than the literal per-screen `bg-surface-container/70` token from the Stitch source) is an already-documented, deliberate, app-wide approximation used identically on every screen — not re-reported.
- **`src/state/ActiveSessionContext.tsx`** — clean; `useMemo` correctly scoped to `[activeSessionId]`; the `useActiveSession()` hook correctly throws if used outside the provider (fails loud, not silently `undefined`). No leak risk (plain `useState`, no subscriptions/timers here).
- **`src/components/BreathOrb.tsx`** — its `Animated.loop` is properly torn down (`return () => loop.stop()`, line 31) on unmount. No leak.
- **`src/components/BreathingRing.tsx`** — animation is properly stopped on unmount/dependency change (`scale.stopAnimation()` in the cleanup, line 67) — no leak, but see the pause/resume desync finding above (Session Player section).
- **`src/components/SessionThumbnail.tsx`** — the `meta &&` guard (line 81) safely handles an unrecognized `sessionId` by rendering an empty container instead of crashing; no session in today's catalog hits this path, but it's a real, correct guard, not just an assumption. No issues.
- **`src/data/insights.ts`** — see the dead-export finding under Home above.
- **`src/types/models.ts`** — `Session.phaseConfig`'s 4-field shape and `description` field are both intentional, already-flagged extensions beyond architecture.md's original interface (documented inline and in PROGRESS.md) — not new findings.
- **`src/utils/onboarding.ts`** — both functions correctly fail-safe (`getOnboardingComplete` fails open to `false`/show-onboarding-again rather than crash or wrongly hide onboarding forever; `setOnboardingComplete` is best-effort). No issues.
- **`app/index.tsx`** — no race condition; `mounted` guard on the async `getOnboardingComplete()` call correctly prevents a `setState` after unmount.

### Config-level (Info only, not a code bug)
- **[Info]** `app.json`'s `android.predictiveBackGestureEnabled: false` disables Android 13+'s predictive-back preview animation app-wide. This is a distinct mechanism from `session-player.tsx`'s per-screen `gestureEnabled` (React Navigation) and its `BackHandler` override — it doesn't by itself enforce the exit-confirmation guard, it only suppresses the newer gesture-preview animation. It isn't documented anywhere in PROGRESS.md as a deliberate choice tied to the exit-confirmation work, so flagging for confirmation that it's intentional (e.g., a known compatibility consideration with `react-native-screens`' `gestureEnabled` under Android's predictive-back API) rather than a default that crept in unnoticed.
- **[Info]** No lint or test script exists in `package.json` (only `start`/`android`/`ios`/`web`). Not a bug, just worth noting for whenever a CI/quality-gate step is set up later.

---

## Checked and excluded — already known/accepted per PROGRESS.md

The following were explicitly re-checked this audit and found unchanged/still valid — **not** re-reported as new findings:

- Tab-bar-overlap resolution (Home/Insights "fits before scroll" retired; Library/Player's "clears after full scroll" policy) — see PROGRESS.md's "Tab-bar-overlap investigation: CLOSED."
- Home/Insights (`topBar` height 56) vs. Library/Player (`topBar` height 64) drift — confirmed still present, confirmed still purely cosmetic (icon stays centered regardless), confirmed today's settings-icon change doesn't interact with it.
- Library's "last session card needs a scroll under the floating tab bar" — confirmed as the deliberately-accepted policy, not re-tested as a bug.
- Tab-bar active-pill shape — moot; the pill was removed entirely in favor of icon-fill-swap (2026-09-14 decision), re-confirmed no pill styling remains anywhere.
- `BreathOrb`/`SessionThumbnail` real-illustration swap, content-box centering fix, transparent-background swap — all re-confirmed present and consistent with PROGRESS.md's history; no regressions.
- Morning Reset/Stress Relief category+badge rename and the resulting, intentional divergence from architecture.md's locked table — confirmed resolved per the 2026-09-19 entry; architecture.md's table now matches `sessions.ts`.
- `GlassCard`'s tint-color approximation of "glass surface" vs. DESIGN.md's literal token value — confirmed still a deliberate, app-wide, documented approximation.
- Deep-linked/missing `sessionId` fallback to `featuredSession` in `session-player.tsx` — confirmed present and correctly guards a malformed link.

---

## Notes on method / limitations

- Backend, auth, and network-security checks were explicitly out of scope per instruction (no backend exists yet).
- Anything gated behind native-only APIs with no web equivalent (Android hardware `BackHandler`, iOS/Android edge-swipe gesture suppression, native `Alert.alert` dialogs) could not be directly exercised by this audit's web-based verification — consistent with this project's own repeatedly-documented standing limitation. Where this affected a finding (the High-severity BackHandler issue), it's called out explicitly, and the finding is based on direct API semantics plus an empirically-confirmed premise (Session Player staying mounted), not speculation.
- This audit did not modify, fix, or refactor any code — `AUDIT.md` is the only file created.
