# Frontend Audit #2 — Breathe (breathing-app)

**Date:** 2026-09-20
**Scope:** Full read-only re-audit of the mobile app (`breathing-app/`), covering everything built/changed since `AUDIT.md` (2026-09-19) — Settings, the gear-icon navigation wiring, the Session Player focus-guard fix, and the color-standardization pass — plus a full re-sweep of every screen. No backend exists yet, so backend/auth/network-security categories remain out of scope.
**Method:** Read every screen/component/data/type/theme/config file directly (not from memory of `PROGRESS.md`'s history), cross-referenced against `PROGRESS.md` (all ~2,986 lines), `PRD.md`, `architecture.md`, `CLAUDE.md`, `DESIGN.md`, `COLOR-AUDIT.md`, and `AUDIT.md`. Ran `npx tsc --noEmit` (clean) and targeted `grep`s (for `console.log`/debug leftovers, `radii.xl` usage, `android_ripple`, etc.) rather than trusting prior write-ups. Computed WCAG relative-luminance contrast ratios by hand for the color-standardization changes rather than eyeballing screenshots, since that pass was verified in `PROGRESS.md` only by visual screenshot comparison. **The original audit pass (2026-09-20) was read-only** — no code was changed, `AUDIT-2.md` was the only file created. **A same-day follow-up (also 2026-09-20, see the two "RESOLVED" sections directly below) then fixed the two Medium findings** — this remains the only document updated to record that work; the code changes themselves are described, with before/after numbers, in those sections.

---

## Executive Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 3 (2 resolved 2026-09-20, 1 still open) |
| Low | 7 |
| Info | 3 |
| **Total** | **13** |

`npx tsc --noEmit` is clean. `AUDIT.md`'s one High finding (Session Player's `BackHandler` not focus-aware) is **confirmed fixed and still correctly in place** — see the dedicated re-check below. No new crash-risk or data-corruption bugs were found. The most significant new findings are:

1. **[MEDIUM — RESOLVED 2026-09-20]** ~~The 2026-09-19 CTA color-standardization pass measurably reduced text/icon contrast on a dark background, below WCAG AA minimums on several elements~~ — this was verified only by eye (screenshot comparison) in `PROGRESS.md`, never measured. The darker gradient stop (`inversePrimary`, `#3c55bf`) used as a flat foreground color, and the dark navy button-text colors (`onPrimaryContainer`/`onPrimaryFixed`) used against it, both computed to contrast ratios around 2.2–2.9:1 against this app's near-black background/surfaces — below the 3:1 (UI/graphical) and 4.5:1 (normal text) WCAG AA thresholds. **Fixed and re-measured — see "RESOLVED (2026-09-20): color-standardization contrast fix" below for the full before/after numbers.**
2. **[MEDIUM — RESOLVED 2026-09-20]** ~~Two `GlassCard`s elsewhere in the app use `radii.xl` (48px) without the defensive corner-clip wrapper that Insights needed for the exact same radius~~, on the exact same component, to fix a confirmed on-device Android `BlurView` corner-clipping bug. Session Player's *active*-phase card and Onboarding's 3 "How It Works" step cards were very likely reproducing the same sharp-corner bug Insights already root-caused and fixed, just never re-checked elsewhere. **Fixed — both now wrapped in the same `cardClip`-style defensive wrapper Insights uses. See "RESOLVED (2026-09-20): Android corner-clip fix" below.**
3. **[MEDIUM — still open]** `BreathingRing`'s pause/resume animation restart, from `AUDIT.md`, is still unfixed — confirmed by direct code read, not re-derived from the prior write-up. Every pause/resume during an active session still restarts the ring's animation from "inhale," regardless of which breath sub-phase is actually showing. **Out of scope for the 2026-09-20 fix pass (only the two findings above were requested) — remains open.**

Everything else is Low/Info-level polish, largely re-confirmations that `AUDIT.md`'s existing Low/Info findings are still present and unchanged (not regressions, not fixed either).

---

## RESOLVED (2026-09-20): color-standardization contrast fix

Fixed exactly the elements identified as failing WCAG AA in the "Color-standardization contrast check" section below — no other colors touched (Insights' stat icons, `GradientText` titles, Session Player's own already-correct "Begin Journey" button, the settings gear icon, etc. were all left exactly as they were, per instruction). Contrast ratios below are computed with the same WCAG relative-luminance formula used in the original finding, not re-asserted by eye.

**Standalone foreground text/icons directly on a dark background** (`app/(tabs)/_layout.tsx`'s active tab tint, `app/(tabs)/library.tsx`'s active category-tab border/label/count, `src/components/MoodTrendChart.tsx`'s line stroke): reverted from `colors.inversePrimary` to `colors.primary` — the same token these elements used before the 2026-09-19 pass, and the only token in `tokens.ts` light enough to clear 4.5:1 against this app's near-black background with real margin.

| Element | Before (`inversePrimary` #3c55bf vs. `#111415`) | After (`primary` #b9c3ff vs. `#111415`) | AA needs |
|---|---|---|---|
| Tab bar active icon/label | 2.86:1 — **fail** | **10.85:1 — pass** | 3:1 (icon) / 4.5:1 (label) |
| Library active category-tab label/count text | ~2.86:1 — **fail** | **~10.85:1 — pass** | 4.5:1 |
| Mood Trend chart line stroke | 2.86:1 — **fail** | **10.85:1 — pass** | 3:1 (graphical) |

**CTA button gradient text/icons** (Home's Begin, Library's Quick Start, Player's Start a Session, and all 3 onboarding buttons — 6 buttons total): the underlying problem was mathematical, not just a wrong text color — the old gradient's two stops (`primaryContainer` L≈0.281, `inversePrimary` L≈0.112) are too close in luminance for *any* single flat text color to hit 4.5:1 against both ends at once (dark text passes only the light end at ~4.5:1, white text passes only the dark end at ~6.5:1 and falls to ~3.2:1 at the light end). Fixed by narrowing the gradient into `[colors.inversePrimary, colors.onPrimaryFixedVariant]` (`#3c55bf` → `#1f3ba6`, both existing `tokens.ts`/DESIGN.md-frontmatter tokens, both dark enough — L≈0.112 and L≈0.062 — that white text clears 4.5:1 at every point) with white (`#ffffff`) text/icon color throughout, matching the approach Session Player's own "Begin Journey" button already used successfully (left untouched, not part of this fix).

| Button | Before: text vs. `primaryContainer` end | Before: text vs. `inversePrimary` end | After: white text vs. `inversePrimary` end (new light stop) | After: white text vs. `onPrimaryFixedVariant` end (new dark stop) |
|---|---|---|---|---|
| Home Begin, Library Quick Start, Player Start a Session (`onPrimaryContainer` text) | 4.54:1 — pass (barely) | **2.23:1 — fail** | **6.47:1 — pass** | **9.40:1 — pass** |
| Onboarding Next / NEXT / Get Started (`onPrimaryFixed` text) | 5.39:1 — pass | **2.64:1 — fail** | **6.47:1 — pass** | **9.40:1 — pass** |

Since both new gradient stops move monotonically darker across all 3 RGB channels (R:60→31, G:85→59, B:191→166), luminance decreases monotonically along the gradient too — the 6.47:1 figure (at the lighter `inversePrimary` stop) is the *worst* point anywhere in the gradient, so every intermediate pixel is ≥6.47:1, comfortably clearing 4.5:1 throughout, not just at the two sampled endpoints.

**Files changed:** `app/(tabs)/_layout.tsx`, `app/(tabs)/library.tsx`, `app/(tabs)/home.tsx`, `app/(tabs)/player.tsx`, `app/onboarding/welcome.tsx`, `app/onboarding/how-it-works.tsx`, `app/onboarding/build-habit.tsx`, `src/components/MoodTrendChart.tsx`.

**Verified:** `npx tsc --noEmit` clean. Visually re-verified on an isolated Expo web server (port 8110, torn down after) via `playwright-cli` at a real phone viewport (iPhone 15 emulation): screenshotted Welcome/How It Works/Build Habit's CTA buttons, Home (tab bar + Begin button), and Library (active category pill + Quick Start button) — white text and icons are clearly legible end-to-end across every gradient button, and the tab bar/category-tab/light-blue accent text is clearly legible against the dark background in all cases. No console errors. Native Android rendering of `LinearGradient`/text is not a class of bug this project has ever seen diverge from web (unlike the `BlurView` corner-clip issue below), so this is not flagged as needing separate on-device confirmation.

---

## RESOLVED (2026-09-20): Android corner-clip fix

Applied the exact same defensive wrapper technique `insights.tsx`'s `cardClip` style already uses (an extra `overflow:'hidden'` + matching `borderRadius` `View` outside the `GlassCard`, forcing a second clip boundary outside the native `BlurView`) to the two other `radii.xl` `GlassCard`s found in the app:

- **`app/session-player.tsx`** — the *active*-phase card is now wrapped in a new `activeCardClip` style (`{ flex: 1, borderRadius: radii.xl, overflow: 'hidden' }` — `flex: 1` preserves the card's existing fill-the-available-space sizing inside `phaseContainer`, which the wrapper now sits between).
- **`app/onboarding/how-it-works.tsx`** — each of the 3 step cards is now wrapped in a new `stepCardClip` style (`{ borderRadius: radii.xl, overflow: 'hidden' }`), moved the `key` prop from the `GlassCard` to the new wrapping `View` since that's now the mapped element.

No other `GlassCard` usage in the app was touched — Home/Library/Player/Settings/Session Player's pre-mood and post-mood cards all use `radii.lg` (32px), which has never been shown to trigger this bug, and were left exactly as they were.

**Verified:** `npx tsc --noEmit` clean. Visually re-verified on the same isolated web server: Session Player's active phase (breathing ring) and How It Works' step cards both render with correctly rounded corners, no layout regression (the active card still fills the available vertical space correctly, sizing unchanged). Web has never reproduced this specific bug in the first place (it's Android `BlurView`-specific, per `PROGRESS.md`'s original root-cause investigation on Insights), so this confirms no regression only, not the actual Android fix — **no Android device was available in this session (no ADB pairing active — this project's standing connectivity blocker, see `PROGRESS.md`'s "Blockers" section) to directly confirm the corners now render rounded on-device.** The fix is code-identical to Insights' own already-on-device-confirmed fix for the exact same component at the exact same radius, so it's expected to resolve the same way, but per this project's own standing rule, treat this as *not yet on-device confirmed* until the user checks it on their phone.

---

## Priority item: tab-bar / scroll-content overlap re-verification

Re-investigated from scratch per explicit instruction, not assumed closed because `PROGRESS.md` says so.

**Mechanism, re-confirmed by direct code read (not history):** `app/(tabs)/_layout.tsx`'s tab bar is a floating overlay (`tabBarStyle: { position: 'absolute', height: 84 }`, `tabBarBackground` a `BlurView`). All 4 tab screens compute their `ScrollView`'s `paddingBottom` identically:
```
{ paddingBottom: tabBarHeight + spacing.base * 2 }
```
verified byte-for-byte present in `home.tsx:76`, `library.tsx:103`, `player.tsx:76`, `insights.tsx:133`, all via the same `useBottomTabBarHeight()` deep import from `expo-router/build/react-navigation/bottom-tabs`. This matches `PROGRESS.md`'s "Tab-bar-overlap investigation: CLOSED (2026-09-19)" entry exactly — no drift found, no screen reverted to a hardcoded padding guess.

**Policy re-confirmed:** per the 2026-09-19 decision, Home/Library/Player/Insights are *not* required to fit all content above the fold before any scrolling — only to fully clear the tab bar *after* a full scroll, same as Library's original policy (Instagram/Spotify-style). This is a floating-overlay-over-scrollable-content pattern, not a defect, and the code inspected here matches that accepted policy on all 4 screens with no exceptions.

**Screens without a tab bar at all** (so this class of bug structurally cannot occur there): `app/session-player.tsx` and `app/settings.tsx` are both top-level routes outside the `(tabs)` group and render no bottom nav while mounted — confirmed by reading both files; neither imports `useBottomTabBarHeight` or renders `<Tabs>`.

**New observation, not a regression of the closed investigation:** `app/settings.tsx` has **no `ScrollView` at all** — its `content` is a plain `View` (`settings.tsx:74`) holding two `GlassCard`s directly. This is fine at the two cards' current size on a typical phone, but it's the *only* content screen in the app built without a `ScrollView`, breaking the pattern every other screen (including the no-tab-bar Session Player) uses for exactly this robustness reason. On a short device or with larger system font scaling (the "Daily Reminder" card's time text uses `headlineLg`, 32px, which grows further under accessibility text-scaling), content could extend below the visible area with **no way to reach the About card** — there's no tab bar to blame here, but the same "don't assume it always fits" lesson this project already learned the hard way on Home/Insights applies. Flagged below as a Low/Medium finding, not re-filed under the tab-bar mechanism since it's a different root cause (missing scroll container, not tab-bar overlap).

**Conclusion: the tab-bar-overlap fix is intact and has not regressed.** No code change needed or made.

---

## Re-check: Session Player focus-guard fix (`AUDIT.md`'s High finding)

Read `app/session-player.tsx` directly rather than trusting `PROGRESS.md`'s "RESOLVED on-device" entry.

- `useIsFocused()` (from `expo-router`'s top-level export, not a deep import) is called once (`session-player.tsx:88`) and threaded into:
  - The elapsed-time timer's guard + dependency array (`:126,131`) — `if (phase !== 'active' || paused || !isFocused) return;`
  - The breath sub-phase cycle's guard + dependency array (`:145,162`) — same pattern
  - The `BackHandler` listener (`:203`) — `if (!isFocused) return false;` before it would otherwise fire the exit confirmation, with a re-registering `useEffect` keyed on `[phase, isFocused]` so it never reads a stale closure
- The settings-gear press (`handleSettingsPress`, `:190`) is routed through the same `confirmIfActive()` helper as the X button and hardware back (`:189`), so all three exit-adjacent actions show the identical "Exit session?" confirmation during `active` — no longer an unguarded fourth path.
- **No leftover debug instrumentation**: grepped `app/` and `src/` for `console.log`/`console.warn`/`console.error` — zero matches anywhere in the project. The only `TODO` in the file is the pre-existing, correctly-flagged `POST /api/checkin` stub (line 220), not diagnostic cruft.
- `npx tsc --noEmit`: clean.

**This fix is confirmed still correctly in place, code-verified, not just re-asserted from history.**

---

## Home (`app/(tabs)/home.tsx`)

### Functional
- Begin button confirmed using `Pressable`/`onPress` (the `onTouchEnd` bug from early builds is still fixed, no regression) — navigates to `/session-player?sessionId=deep-exhale` correctly.
- Settings gear navigates to `/settings` correctly (`Pressable`, `hitSlop={12}`).
- **[Low, carried over from `AUDIT.md`, still unfixed]** `home.tsx:31` still hardcodes `sessionsThisWeek = 12` locally, and `src/data/insights.ts:42` still separately exports an identical, still-unused `sessionsThisWeek` (confirmed via project-wide grep — zero importers). Two independent copies of the same placeholder stat, only synced by coincidence.
- **[Low, new]** The "···" more-options icon on "Your Snapshot" (`home.tsx:133`) is a bare `MaterialIcons`, not wrapped in any `Pressable` — it's visually identical in weight/placement to every other icon-button in the app (which are all tappable), so it reads as interactive but does nothing on tap. This is consistent with "not built yet" (no options menu exists), but worth flagging before backend work adds real actions here, so it doesn't get silently skipped.

### UI/Layout
- No overlap/scroll issues (see priority item above).

### Consistency
- **[Medium, new — RESOLVED 2026-09-20]** Begin button's gradient (`primaryContainer → inversePrimary`) with `onPrimaryContainer` text had measurably low contrast (~2.23:1) at the gradient's darker end. Fixed — see "RESOLVED (2026-09-20): color-standardization contrast fix" above.
- **[Low, new]** Begin button's `Pressable` has no pressed-state visual feedback (no opacity/scale change), unlike onboarding's CTA buttons, which all implement `style={({ pressed }) => [..., pressed && styles.xPressed]}`. Minor interaction-feedback inconsistency, not a functional bug.

---

## Library (`app/(tabs)/library.tsx`)

### Functional
- Search + category filtering, Quick Start, session-card navigation, settings icon — all re-traced and correct, matching `AUDIT.md`'s prior confirmation.
- The category-tab row is a horizontal `ScrollView` nested inside the screen's vertical `ScrollView` (`library.tsx:131-170`) — a standard RN pattern (orthogonal scroll axes), no gesture-conflict risk observed in code; not flagging as a bug.

### UI/Layout
- **[Low, carried over, still present]** Category tabs (`categoryTab`, `library.tsx:304`) remain ~36-40px tall with no `hitSlop`, below the ~44pt guideline. Unchanged since `AUDIT.md`.
- **[Info, carried over, still present]** Still no `KeyboardAvoidingView` anywhere in the app; still low-risk since Library's search input sits near the top of the screen.

### Consistency
- **[Medium, new — RESOLVED 2026-09-20]** Category-tab active state (border/label/count badge, all `colors.inversePrimary`) had the same contrast regression as the other standardized elements. Fixed — see "RESOLVED (2026-09-20): color-standardization contrast fix" above.
- **[Low, new]** Quick Start button, same missing pressed-state feedback as Home's Begin button.

---

## Session Player (`app/session-player.tsx`)

### Functional
- Focus-guard fix re-verified correct, see dedicated section above.
- **[Medium, carried over from `AUDIT.md`, confirmed still unfixed]** `BreathingRing`'s pause/resume desync. Re-read `src/components/BreathingRing.tsx:41-69` directly: the `useEffect`'s dependency array still includes `paused`, and the effect body still always calls `loop()` from scratch (starting with the inhale leg) whenever `paused` flips back to `false` — there is no tracking of which sub-phase/elapsed-within-sub-phase the ring should resume into. This is unrelated to the focus-guard fix (different file, different mechanism) and was not touched by that work. Still reproducible by: start a session, let it run partway into "hold" or "exhale," pause, resume — the ring visibly snaps back to the inhale animation leg while the on-screen phase label (driven by a separate, correctly-resuming `setTimeout` chain in `session-player.tsx`) continues from wherever it was. Every pause/resume compounds the drift further.
- **[Low, carried over, confirmed still unfixed]** `MoodSelector`'s 5 mood-emoji bubbles (`src/components/MoodSelector.tsx:84-93`) are still 40×40 with no `hitSlop`, unlike nearly every other interactive element in the app.

### UI/Layout
- **[Medium, new — RESOLVED 2026-09-20]** The *active*-phase `GlassCard` (`session-player.tsx:341`, `radius={radii.xl}`, i.e. 48px) had no defensive corner-clip wrapper. Insights needed exactly this radius-and-component combination wrapped in an extra `overflow:'hidden'` View (`cardClip`, `insights.tsx:266-269`) to work around a confirmed-on-device Android `BlurView` corner-clipping bug (2 of 4 corners render sharp instead of rounded once the radius grew past `radii.lg`/32px — see `PROGRESS.md`'s "stat card corners uneven" entry). Session Player's pre-mood and post-mood cards use `radii.lg` (the same radius Home/Library/Player use, never shown to trigger the bug) so they're not at risk — only the *active* card, the screen a user looks at for the entire duration of every real session, used the higher-risk radius with no mitigation. This was never re-checked against the Insights fix because the two pieces of work happened in different, unconnected sessions. **Fixed — wrapped in the same `cardClip`-style technique Insights uses; see "RESOLVED (2026-09-20): Android corner-clip fix" above. Still awaiting on-device confirmation (no Android device available this session), same as Insights' original fix needed at the time.**
- **[Low, new]** "Begin Journey" button (`session-player.tsx:326-335`) also has no pressed-state feedback, consistent with the Home/Library/Player CTAs but inconsistent with onboarding's buttons.

### Consistency
- Confirmed "Begin Journey" is the one primary CTA in the app that does **not** show the contrast regression below (it uses white text, `#ffffff`, rather than `onPrimaryContainer`/`onPrimaryFixed`) — this is the button the other 6 CTAs were brought in line with as part of the 2026-09-20 contrast fix (see above); "Begin Journey" itself was left untouched, per instruction, since it wasn't part of the flagged failure.

---

## Settings (`app/settings.tsx`)

### Functional
- Header back button (`router.back()`), reminder toggle's local state — both work as implemented. Reachable from all 5 gear icons app-wide (re-confirmed via code read of all 5 call sites: `home.tsx`, `library.tsx`, `player.tsx`, `insights.tsx`, `session-player.tsx` — all `router.push('/settings')`).
- No persistence yet (`AsyncStorage`/`expo-notifications`) — correctly out of scope per `CLAUDE.md`'s build order, not re-reported as a bug.

### UI/Layout
- **[Low/Medium, new — see priority-item section above]** No `ScrollView` — the only content screen in the app without one. Low risk at current content size and on typical devices, but no safety net if content grows or system font scale increases, unlike every other screen.
- **[Low, carried over, still present]** `ReminderToggle`'s effective touch target (48×28 track + `hitSlop={8}` = 64×44) still sits exactly at, not above, the ~44pt floor — unchanged from `AUDIT.md`.

### Consistency
- Colors/typography/radii still trace to `tokens.ts` correctly; re-checked `settings-code.html`'s hex values against `tokens.ts` for the two cards, no drift.

---

## Tab bar / navigation (`app/(tabs)/_layout.tsx`)

### Functional
- All 4 tabs navigate correctly. Re-confirmed via direct grep (not re-asserted from `PROGRESS.md`): zero matches for `android_ripple` anywhere in the app; `tabBarButton` pattern present on all 4 `Tabs.Screen` entries; no pill/background styling left anywhere (`tabContentActive` doesn't exist in the file at all — the LinkedIn-style icon-fill-swap fully replaced it, matching `AUDIT.md`'s prior confirmation).

### Consistency
- **[Medium, new — RESOLVED 2026-09-20]** Active-tab color (`tintColor`, `_layout.tsx:83`, and `tabBarActiveTintColor`, `:109`) was `colors.inversePrimary` — flat, on a translucent-dark `BlurView` tab bar background. Same contrast regression as the other standardized elements. Fixed — reverted to `colors.primary`; see "RESOLVED (2026-09-20): color-standardization contrast fix" above.

---

## Insights (`app/(tabs)/insights.tsx`)

### Functional
- Settings icon, `chunk()`-based non-wrapping grids (both the consistency calendar and the stat-card grid), and `MoodTrendChart`'s zero-data guard were all re-confirmed present and unchanged from `AUDIT.md` via direct code read.

### UI/Layout
- `cardClip` (the Android `BlurView` corner-clip workaround) confirmed present and correctly applied to all 3 card types on this screen (Mood Trend, Consistency, and both stat-card rows) — this screen itself has no regression; it's the *other* two `radii.xl` cards elsewhere in the app (flagged above) that never got the same treatment.

### Consistency
- **[Medium, new — RESOLVED 2026-09-20]** Mood Trend chart line stroke (`colors.inversePrimary`, `MoodTrendChart.tsx:112`) had a measurable, real contrast drop (2.86:1) against the card's dark background. Fixed — reverted to `colors.primary` (10.85:1); see "RESOLVED (2026-09-20): color-standardization contrast fix" above.
- The "Keep going" footer text and the stat-card icons (`colors.primary`/`secondary`/`tertiary`) were **not** touched by the color-standardization pass and remain the original light, high-contrast tones — confirmed unchanged, not re-reported as a new finding.

---

## Onboarding (`app/onboarding/*.tsx`)

### Functional
- Forward flow, Skip from every screen, `setOnboardingComplete()` await-ordering, AsyncStorage namespacing (`breathe_onboarding_complete_v1`) — all re-confirmed present and correct, no regressions.

### UI/Layout
- **[Medium, new — RESOLVED 2026-09-20]** How It Works' 3 step cards (`how-it-works.tsx:77`, `GlassCard radius={radii.xl}`) — same unmitigated Android corner-clip risk as Session Player's active card, flagged once above and counted once in the severity table, applied here too. Fixed — same `cardClip`-style wrapper technique; see "RESOLVED (2026-09-20): Android corner-clip fix" above.
- Welcome and Build-the-Habit remain fixed (`justifyContent:'center'`) layouts, not scrolling containers — reasonable for their current short content (already noted in `AUDIT.md`'s history as confirmed-fitting on a real device), but the same "no scroll safety net" caveat as Settings applies if either screen's content grows. Not re-scored as a separate finding since it's the same underlying pattern already captured under Settings.

### Consistency
- **[Medium, new — RESOLVED 2026-09-20]** All 3 CTA buttons (`Next`/`NEXT`/`Get Started`) shared the same `primaryContainer → inversePrimary` gradient with `onPrimaryFixed` text — same contrast regression as Home/Library's buttons, using a slightly different (also dark) text token. Fixed — see "RESOLVED (2026-09-20): color-standardization contrast fix" above.
- **[Low, carried over, still present]** Skip buttons' `hitSlop={8}` vs. the rest of the app's `hitSlop={12}` — unchanged from `AUDIT.md`.

---

## Color-standardization contrast check (2026-09-19 pass) — computed, not eyeballed [RESOLVED 2026-09-20 — see the dedicated section above for the fix and after-numbers; the analysis below is kept as the original diagnostic record]

`PROGRESS.md` verified every step of the CTA/accent color standardization (COLOR-AUDIT.md) by screenshot comparison only ("all fully legible against the new gradient," "no contrast regression"). Per `CLAUDE.md`'s explicit instruction to show real data rather than just assert, computed actual WCAG 2.x relative-luminance contrast ratios for the tokens involved:

| Pair | Foreground | Background | Computed ratio | WCAG AA needs | Result |
|---|---|---|---|---|---|
| Old tab bar / Begin button (pre-2026-09-19) | `colors.primary` `#b9c3ff` | `colors.background` `#111415` | **~10.8:1** | 3:1 (UI) / 4.5:1 (text) | Pass, with wide margin |
| New tab bar active icon/label, Library active category text, Mood Trend chart line | `colors.inversePrimary` `#3c55bf` | `colors.background` `#111415` (or equivalent near-black glass surface) | **~2.9:1** | 3:1 (UI) / 4.5:1 (text) | **Fails both** |
| CTA button text (Home/Library/Player/onboarding) at the gradient's `primaryContainer` end | `onPrimaryContainer` `#001e78` (Home/Library/Player) or `onPrimaryFixed` `#001356` (onboarding) | `primaryContainer` `#7189f6` | ~4.5:1 / ~5.4:1 | 4.5:1 (text) | Borderline pass |
| Same button text at the gradient's `inversePrimary` end | same as above | `inversePrimary` `#3c55bf` | **~2.2–2.6:1** | 4.5:1 (text) | **Fails** |

**Why this matters concretely:** these buttons are diagonal gradients (`start:{0,0} end:{1,1}`) on wide, short pills — for a typical pill shape the horizontal component dominates, so the *right* portion of each button (where trailing icons like the "Next"/"NEXT" arrow sit) renders closer to the `inversePrimary` end, i.e. the exact portion of the gradient where the text/icon contrast is weakest. This affects **6 CTA buttons app-wide**: Home's Begin, Library's Quick Start, Player's Start a Session, and all 3 onboarding buttons. Session Player's own "Begin Journey" (white text, `#ffffff`) does **not** have this problem — its contrast against `inversePrimary` computes to ~6.5:1 and against `primaryContainer` to ~3.2:1 (borderline-acceptable for its 18px semibold "large text" size) — it was already using a safer text color before this standardization pass touched anything else, and wasn't itself changed.

This isn't a hypothetical concern — it's the same class of defect this project has caught before by measuring rather than eyeballing (the tab-bar-overlap saga's whole arc was "screenshots looked fine, the real number said otherwise"). **Fixed 2026-09-20** — see "RESOLVED (2026-09-20): color-standardization contrast fix" above for the approach actually taken (white CTA text + a narrower, uniformly dark gradient; `colors.primary` restored for the standalone flat-foreground usages) and the full before/after numbers.

---

## Shared components / state

- **`src/components/GlassCard.tsx`** — unchanged, no issues; its own `overflow:'hidden'` wrapper is present but (per the Insights precedent) not sufficient on its own at `radii.xl` on Android — see the corner-clip finding above.
- **`src/state/ActiveSessionContext.tsx`** — unchanged, clean; `useMemo` scoping and the throwing `useActiveSession()` guard both re-confirmed correct.
- **`src/components/BreathOrb.tsx`** — `Animated.loop` still properly torn down on unmount (`return () => loop.stop()`). No leak.
- **`src/components/SessionThumbnail.tsx`** — the manual "cover-to-content-box" scaling fix (2026-09-19) re-read directly: math checks out (`scale = max(size/contentW, size/contentH)`, centered via `contentCx`/`contentCy`), `meta &&` guard still present for an unrecognized id. No issues found in the logic itself (on-device visual confirmation is a separate, already-flagged-pending item in `PROGRESS.md`, not re-litigated here).
- **`src/utils/onboarding.ts`** — both functions still fail-safe correctly (`getOnboardingComplete` fails open to `false`, `setOnboardingComplete` is best-effort). No issues.
- **`app/index.tsx`** — `mounted` guard on the async onboarding check still correctly prevents a post-unmount `setState`. No issues.
- **`app/_layout.tsx`** — unchanged; font-loading gate and `ActiveSessionProvider` wiring both correct.

### Config-level (Info only)
- **[Info, carried over]** `app.json`'s `android.predictiveBackGestureEnabled: false` — still present, still not documented anywhere as a deliberate choice tied to the exit-confirmation work. Re-flagging only because it was never resolved, not because anything changed.
- **[Info, carried over]** Still no `lint`/`test` script in `package.json` (only `start`/`android`/`ios`/`web`).

---

## Checked and excluded — re-confirmed unchanged, not re-reported as new findings

- Tab-bar-overlap policy (Home/Insights "clears after full scroll," Library/Player's identical policy) — re-verified via direct code read this round, see priority section above. No drift.
- `GlassCard`'s `rgba(30,41,59,0.4)` tint approximation of "glass surface" — still a deliberate, app-wide, unchanged approximation.
- Session Player's deep-linked/missing `sessionId` fallback to `featuredSession` — still present, still correct.
- `BreathOrb`/`SessionThumbnail` real-illustration swap and the centering/sizing fix — logic re-read and confirmed internally consistent (on-device visual confirmation remains a separate pending item per `PROGRESS.md`, not a code defect).
- Morning Reset/Stress Relief badge↔category convention and the architecture.md locked-table sync — re-read `sessions.ts` and `architecture.md`'s table side by side; still in sync (Leaf/Calm, Moon/Sleep, Zap/Energy, Heart/Recovery holds for all 6 sessions with no exceptions).
- `phaseConfig`'s 4-field `{inhale,hold,exhale,rest}` shape vs. `architecture.md`'s still-undocumented 3-field spec — confirmed still an open, already-flagged documentation debt (not a code bug); `architecture.md:78` and `:163-168` were not updated to match the 2026-09-17 product decision. Not re-scored as a new finding since it's pure documentation drift with no runtime effect — flagging again only so it doesn't silently age out of view.
- `PRD.md`'s catalog table still says "Wind Down" (not "Sleep Wind Down") — same category of already-flagged, intentional, tracked documentation debt, not re-scored.

---

## Notes on method / limitations

- Backend/auth/network-security: out of scope, no backend exists yet.
- Native-only APIs with no web equivalent (`BackHandler`, edge-swipe gesture suppression, native `Alert.alert`, `BlurView`'s Android-specific corner-clipping behavior) could not be directly exercised in this session (no on-device or web-server verification was run as part of this pass — this was a pure code-reading audit, per the read-only instruction). Where a finding depends on prior on-device-confirmed behavior (the `BlurView`/`radii.xl` corner-clip bug), it's traced to the specific `PROGRESS.md` entry that established it on this project's own hardware, not assumed from general RN knowledge.
- The contrast-ratio findings are computed from the exact hex values in `src/theme/tokens.ts` using the standard WCAG relative-luminance formula — reproducible by anyone re-running the same arithmetic, not a subjective read.
- The original audit pass did not modify, fix, or refactor any code. The 2026-09-20 follow-up fix pass touched exactly the 9 source files named in the two "RESOLVED" sections above and this document — nothing else (confirmed via `git diff --stat` against the same working-tree baseline the audit itself was read against). `AUDIT.md` was left untouched throughout, in both passes.
