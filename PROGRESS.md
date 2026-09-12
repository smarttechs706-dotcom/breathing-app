# Progress

## Status
Workspace scaffolded, folder structure set up, PRD.md/architecture.md/CLAUDE.md
in place, design references loaded, theme tokens done, Expo Router wired up,
Home screen built and visually verified against the Stitch reference.

## Done
- Scaffolded Expo project (`breathing-app`) with TypeScript template
- Created folder structure: `app/(tabs)/`, `app/onboarding/`, `src/theme/`, `src/components/`, `src/data/`, `src/api/`, `src/types/`, `assets/design-reference/`
- Added PRD.md, architecture.md, and CLAUDE.md
- Loaded design references into `assets/design-reference/`
- Built `src/theme/tokens.ts` from `assets/design-reference/DESIGN.md`'s
  frontmatter YAML (colors, typography, rounded, spacing) — per
  architecture.md's "Colors — source of truth" rule, not the prose Colors
  section. All 47 color values programmatically diffed against DESIGN.md
  with zero mismatches; typography/radii/spacing converted with documented
  unit conversions (em→px, rem→px). Typechecks clean under strict mode.
- Wired up Expo Router (was missing despite architecture.md assuming it):
  installed `expo-router` + peers, replaced the classic `App.tsx`/`index.ts`
  entry with `expo-router/entry`, added `app/_layout.tsx` (root) and
  `app/(tabs)/_layout.tsx` (shared bottom nav: Home/Library/Player/Insights,
  matching Home/Insights' Stitch icon set, not Library's inconsistent one)
- Built `src/types/models.ts` (Session/Checkin/Streak, +`description` field
  on Session — an intentional, flagged extension architecture.md's interface
  didn't include but both Home and Session Player's content specs require)
  and `src/data/sessions.ts` (the 6-session catalog using architecture.md's
  LOCKED badge/category/pattern mapping and PRD.md's durations — not the
  session-player-code.html mockup's inconsistent "10 MIN SESSION")
- Built Home screen (`app/(tabs)/home.tsx`, dummy data): top bar, gradient
  "Alex" name text, Featured Session hero card (Deep Exhale, real Stitch
  copy), Your Snapshot (mood/sessions/streak cards) — new components
  `GlassCard`, `GradientText`, `BreathOrb` in `src/components/`
- Installed `@expo-google-fonts/plus-jakarta-sans` and loaded it in
  `app/_layout.tsx` — first render used a fallback serif until this was
  added; caught via visual verification, not just asserted
- Verified Home visually: ran the app in Expo web via `expo start --web`,
  drove it with `playwright-cli`, and screenshotted it side by side against
  `assets/design-reference/home-screenshot.png` — layout, copy, colors,
  icons, and (after the font fix) typography all match
- Placeholder stub screens for Library/Player/Insights tabs (not designed
  yet — just enough for the tab navigator to have valid routes)

## Known deviations (flagged, not silent)
- `BreathOrb` is a programmatic gradient-sphere placeholder, not the actual
  Stitch hero illustration (a hotlinked third-party Google-hosted image we
  don't own) — swap for real artwork/Lottie later
- Session descriptions: only Deep Exhale has real Stitch copy (from
  home-code.html). session-player-code.html gives Deep Exhale a *different*
  description than home-code.html does — same-session inconsistency between
  two Stitch exports, unresolved, to revisit at the Session Player step. The
  other 5 sessions have no Stitch-sourced copy anywhere and use placeholder
  text pending real copywriting
- `phaseConfig` (inhale/hold/exhale seconds) per session is placeholder —
  not specified anywhere in PRD.md/architecture.md/DESIGN.md yet
- `app.json`'s `userInterfaceStyle` changed from `light` to `dark` (the
  scaffold default didn't match DESIGN.md's dark-only design system)

## Fixes from user visual review (2026-09-12, same day)
User compared the built Home screen against home-screenshot.png directly
and caught 2 real gaps my own earlier verification missed, plus asked for
a fuller screenshot:
- **Gradient "Alex" text not rendering** — root cause: this app's own
  `GradientText.tsx` (native `MaskedView` approach) is correct for
  iOS/Android, but `@react-native-masked-view/masked-view`'s *own* web shim
  (`node_modules/@react-native-masked-view/masked-view/js/MaskedView.web.js`)
  is a no-op — it renders only the flat mask text and silently discards the
  gradient, on every project that uses this library on web, not just this
  one. Fixed with a `GradientText.web.tsx` platform override using CSS
  `background-clip: text` (Metro auto-resolves `.web.tsx` for web builds).
  Verified via computed-style inspection (`backgroundImage`,
  `-webkit-background-clip`), not just a screenshot.
  - Side-lesson: Metro didn't pick up the *new* file until the dev server
    was fully killed and restarted (`taskkill` by PID + `--clear`) — editing
    an existing file hot-reloads fine, but a newly created file didn't
    trigger a rescan on this Windows setup (no Watchman). Worth remembering
    for future new-file verification loops.
  - Also discovered while debugging: `TaskStop` on the original background
    dev-server task didn't actually kill the underlying node process (it
    kept serving/logging afterward) — had to find and `taskkill` the real
    PID directly.
- **No active-tab pill highlight on bottom nav** — `app/(tabs)/_layout.tsx`
  was rendering icon and label as separate tab bar slots with just a tint
  color change; home-code.html wraps active-tab icon+label together in one
  `bg-primary-container/20 rounded-xl` pill. Fixed by combining icon+label
  into one `TabButtonContent` component (rendered via `tabBarIcon`, with
  `tabBarShowLabel: false`) with a conditional pill background when focused.
- Took a full-page screenshot (temporarily resized the browser viewport
  taller, since the RN Web ScrollView scrolls an inner container rather
  than the document body — `page.screenshot({fullPage: true})` doesn't
  capture inner-scrolled content) — confirmed Sessions and Streak cards
  render correctly, matching the reference.

## Done (continued)
- Built Library screen (`app/(tabs)/library.tsx`, dummy data): search bar,
  5 category tabs (For You/Calm/Sleep/Energy/Recovery), Quick Start button,
  6-session grid — reuses `GlassCard` and `GradientText` from Home unchanged
  plus one new component, `SessionThumbnail` (per-pattern gradient
  placeholder, same rationale as `BreathOrb`). Home, `_layout.tsx`, theme
  tokens, and all existing components were left untouched per instruction —
  this was additive-only work.
  - Category tab counts are REAL, computed from `src/data/sessions.ts`
    (For You 6, Calm 2, Sleep 2, Energy 1, Recovery 1) — not
    library-code.html's placeholder mockup numbers (292/45/38/24)
  - Search + category filtering both verified interactively (typed "Box" →
    only Box Breathing shown; tapped Sleep tab → only Morning Reset + Wind
    Down shown)
  - Quick Start navigates to `/session-player?sessionId=deep-exhale` (same
    route Home's Begin uses) — verified it correctly shows Expo Router's
    "Unmatched Route" screen (no crash), matching the expected state since
    Session Player doesn't exist yet
  - Session cards use the real 6-session catalog with the locked
    badge→icon mapping (Leaf→eco, Moon→bedtime, Zap→bolt, Heart→favorite),
    not hardcoded per-screen content
  - Verified visually: ran a *second*, separate dev server on port 8082
    (left the port-8081 server the user was phone-testing with completely
    untouched) and screenshotted with `playwright-cli` against
    `assets/design-reference/library-screenshot.png`

## Known deviations (Library, flagged not silent)
- PRD.md is internally inconsistent: its Core Screens list names Library's
  tabs "For You/Calm/Recovery/Sleep" (4, no Energy), but its own
  category-count example includes "Energy 1" — only meaningful with an
  Energy tab, since Stress Relief's real category is Energy. Built 5 tabs
  (For You + all 4 real categories from `types/models.ts`) since that's
  what the example counts (and this session's task instructions) implied
- Search bar built as dark glass (`rgba(0,0,0,0.2)`) per DESIGN.md's
  explicit "Inputs" spec and library-code.html's own `.glass-input` CSS
  class — NOT matching library-screenshot.png, which renders it solid
  white. That white render reads as a Tailwind-forms-plugin artifact in the
  Stitch export, not an intentional style, since it contradicts both the
  written spec and the mockup's own CSS
- Quick Start button built with the vivid `primary-container`→
  `inverse-primary` gradient library-code.html's CSS specifies — the
  reference screenshot renders it very low-contrast/muted, which looks like
  a similar screenshot-capture artifact rather than intended design
- Session thumbnails are per-pattern gradient placeholders (not real
  Stitch illustrations — same hotlinked-third-party-image issue as Home's
  BreathOrb)

## Bug: bottom tab bar invisible on physical Android (found + fixed)
User tested on a physical Android device via Expo Go after Library shipped
and found the bottom tab bar completely invisible — worked fine in every
web-based verification. Root-caused via `git bisect`-style diagnostics
(user directed each step) rather than guessing:
- Diagnostic #1: swapped `BlurView` for a plain solid-color View — still
  invisible. Ruled out `expo-blur`.
- Diagnostic #2: reverted the custom `TabButtonContent` (combined
  icon+label pill via `tabBarIcon` + `tabBarShowLabel:false`) to Expo
  Router's plain default separate `tabBarIcon`/`tabBarLabel` — tab bar
  appeared. Isolated the cause to that custom component.
- Root cause, confirmed by reading Expo Router's own vendored source
  (`node_modules/expo-router/build/react-navigation/bottom-tabs/views/
  {BottomTabItem,TabBarIcon}.js` — this project doesn't depend on
  `@react-navigation/bottom-tabs` directly; Expo Router vendors its own
  copy): whatever `tabBarIcon` returns is forced into a hard-coded 24x24
  box, and the tab item's outer View sets
  `overflow: variant === 'material' ? 'hidden' : 'visible'`. Android's
  bottom-tab variant is `'material'`, so our pill (much bigger than
  24x24) was silently clipped to nothing there specifically, while
  iOS/web use `overflow: 'visible'` and never clip it — exactly why the
  web screenshot always looked right.
- Fix: render the pill via `tabBarButton` instead of `tabBarIcon`/
  `tabBarLabel`. It replaces the whole tab button before any of that
  fixed-size icon-slot logic runs, so the pill renders at the tab's real
  size on every platform (`focused` arrives as the button's
  `aria-selected` prop). Restored `BlurView` since it was never the
  actual bug.

## Fix: wrong tab icons on-device (found + fixed)
After the tab bar itself was fixed, on-device testing showed Library and
Player rendering the *wrong glyph entirely* (a briefcase-like icon, a
play-circle) despite the code using architecture.md's documented names
(`grid_view`, `air`). Confirmed the code was correct (verified codepoints
against the installed `@expo/vector-icons@15.1.1` glyphmap — `grid-view`
0xe9b0, `air` 0xefd8, `insights` 0xf092, all present and self-consistent).
Root cause: `home` (codepoint 0xe88a, one of Material Icons' original 2014
glyphs) rendered correctly while the three comparatively recent additions
(`grid_view`, `air`, `insights`) didn't — pointing at Expo Go's bundled
MaterialIcons font predating those codepoints' current assignment (Expo Go
ships its own font copy tied to the SDK version, separate from this
project's npm-installed font). Rather than depend on the user's Expo Go
build being current, swapped to icons from Material Icons' original/early
batch (low 0xe1xx-0xe6xx codepoints), picking the closest visual/semantic
match — reasoning documented inline in `app/(tabs)/_layout.tsx`:
- Library: `grid-view` → `apps` (same "grid of items" meaning)
- Player: `air` → `waves` (undulating line reads as breathing rhythm)
- Insights: `insights` → `show-chart` (trend line, arguably an even more
  literal fit for an analytics screen)

## Done (continued): Session Player
Built `app/session-player.tsx` per architecture.md's "Session Player
implementation (explicit — do not deviate)" section — one screen, internal
`currentPhase: 'pre-mood' | 'active' | 'post-mood'` state, no separate
routes. Home, Library, `_layout.tsx`, theme tokens, and all previously
existing components were left untouched (verified via `git status` before
committing) — additive-only work. New files: `app/session-player.tsx`,
`src/components/BreathingRing.tsx` (the file architecture.md's repo
structure already names for this), `src/components/MoodSelector.tsx`
(shared by the pre-mood "How are you feeling?" picker and the post-mood
"After" picker).

- Accepts `sessionId` via `useLocalSearchParams` and loads real data via
  `getSessionById` (falls back to `featuredSession` if missing/invalid —
  guards a malformed deep link; Home/Library always pass a real id today)
- Each phase's content matches architecture.md's spec: duration badge +
  title + description + mood picker + Begin Journey (pre-mood); phase
  label + BreathingRing + sub-label + elapsed/total + progress bar + pause
  (active); checkmark + headline + mindful-minutes + before/after mood
  comparison + Done (post-mood)
- Back-button behavior exactly as specified: X button and Android hardware
  back (`BackHandler`) both show a confirmation Alert during `active` only;
  `pre-mood`/`post-mood` exit directly (`router.back()`, falling back to
  `router.replace('/home')` if there's no history — e.g. a direct deep
  link). Never steps backward between phases, only forward or exits
  entirely. Also disables the swipe-back gesture during `active`
  (`<Stack.Screen options={{ gestureEnabled: phase !== 'active' }} />`) so
  it can't bypass the confirmation the button/hardware-back enforce
- Done stubs the checkin API call as a `// TODO: POST /api/checkin...`
  comment (backend doesn't exist yet) and navigates to Home regardless,
  per instruction
- Fade+scale transition between phases via `Animated.Value`, per
  architecture.md's "animated smoothly (fade/scale)" requirement

### Flagged conflicts between architecture.md and the design reference (not silently resolved)
1. **Stacked-page vs. one-screen.** session-player-code.html and its
   screenshot render all 3 phases stacked vertically on one long
   scrollable page with "expand_more" chevron dividers between them —
   i.e. all 3 states visible at once. architecture.md's section is headed
   "(explicit — do not deviate)" and requires one phase visible at a time.
   Resolution: treated the stacked layout as a Stitch design-review
   presentation convention (showing all 3 states together for a reviewer),
   not the intended runtime behavior — architecture.md's explicit heading
   wins. Built one-phase-at-a-time with a fade/scale transition; the
   chevron dividers have no equivalent and were omitted. Each phase's
   internal layout/colors/spacing/copy structure was still copied exactly
   from its section of the HTML.
2. **Deep Exhale's description text differs between screens.**
   session-player-code.html's Deep Exhale description ("Designed to
   activate your parasympathetic nervous system...") differs from
   home-code.html's ("Let go of tension and return to your body...") for
   the *same* session — already flagged when Home was built. architecture.md
   says to "pull actual copy per session from the sessions catalog, not
   hardcoded per-screen," implying one canonical value. Resolution: reused
   the existing shared `sessions.ts` `description` field (Home's already-
   committed text) here rather than add a second field or edit the shared
   one, since editing it would change Home's already-verified output and
   this task forbids touching Home. Session Player's Deep Exhale text
   won't literally match session-player-code.html's wording as a result.

### Other flagged decisions
- Swapped the mockup's `air` icon (breathing-ring icon, duration-badge
  icon) for `waves` — `air` is the exact icon that rendered as the wrong
  glyph on this user's physical Android device due to Expo Go's font
  version (see the tab bar fix above); reusing it here would reintroduce
  the same bug in a new place
- The mockup's breathing-sub-phase labels only show one static combo
  ("Inhale..." headline + "Hold for 4 seconds" sub-label) — not a full
  cycle. Implemented headline/sub-label pairs for all three sub-phases
  (Inhale.../Breathe in for Ns, Hold.../Hold for Ns, Exhale.../Breathe out
  for Ns), cycling per the session's own `phaseConfig` durations — a
  reasonable fill-in for a gap the mockup's single frame doesn't specify,
  not an explicit spec
- The breathing pulse animation (`BreathingRing`, driven by `Animated`) and
  the phase-label text cycle (driven by a separate `setTimeout` chain) are
  two independent timing mechanisms tied to the same `phaseConfig`
  durations, not one shared driver — close enough for this dummy-data
  build, but not frame-perfectly synced; flagging rather than
  overengineering it before there's a reason to

### Verified interactively (not just asserted) via Expo web + playwright-cli
Ran on a *third*, separate dev server (port 8082) — left the user's
phone-testing server on 8081 completely untouched throughout. Confirmed:
loading two different sessions via `sessionId` (Deep Exhale 18 min, Box
Breathing 12 min) with correct real data; mood picker selection; Begin
Journey transition; breathing sub-phase cycling matching `phaseConfig`
exactly (verified elapsed-time math against phase transitions); pause
freezing both the elapsed timer and the sub-phase cycle; resume
continuing correctly; Done navigating to `/home`; X exit on `pre-mood`
falling back to `/home` when there's no navigation history, vs. correctly
`router.back()`-ing to `/library` when reached via a real in-app tap;
Quick Start (Library) and Begin (Home's button) both now route to a real
screen instead of the earlier expected 404. Post-mood was verified by
briefly forcing the initial state default to `'post-mood'`, screenshotting,
then reverting immediately (waiting a real 18 minutes for it wasn't
practical) — confirmed reverted cleanly via `grep` afterward.

### NOT verifiable from the web preview — needs on-device confirmation
Per the explicit ask to be cautious about native/web differences after
the tab bar bug:
- **The active-phase exit confirmation dialog itself.** `react-native-web`'s
  `Alert.alert` is a **complete no-op** (confirmed by reading
  `node_modules/react-native-web/src/exports/Alert/index.js` — an empty
  function body). So on web, tapping X during `active` silently does
  nothing (fails closed, not open — arguably safe, but unverifiable this
  way). On native this should show a real Alert with Cancel/Exit buttons.
  **Please test this specifically.**
- **The Android hardware back button** during each phase — `BackHandler`
  has no web equivalent to test at all.
- **The swipe-back / predictive-back gesture suppression**
  (`gestureEnabled: false`) during `active` — no web equivalent either.
- General native-vs-web rendering of `Animated` scale transforms,
  `BlurView`-adjacent glass-card layering, and gradient thumbnails under
  real GPU/compositor behavior, given the tab bar bug's lesson that web
  parity doesn't guarantee native parity.

### Found but NOT fixed (Home is off-limits for this task)
While testing Library/Home's navigation into the new Session Player route,
found that **Home's "Begin" button doesn't reliably fire on tap** — it's
a plain `<View onTouchEnd={...}>` in `app/(tabs)/home.tsx`
(`beginButton`/`onTouchEnd` around line 79-86), not a `Pressable` with
`onPress`. `onTouchEnd` bypasses React Native's gesture-responder system
that `Pressable`/`TouchableOpacity` properly integrate with, so this is a
plausible cross-platform reliability issue, not just a Playwright quirk —
confirmed via Playwright that the button did not navigate on click. Left
untouched since Home is explicitly off-limits for this task; recommend
fixing it (swap to `Pressable`/`onPress`) as a quick, isolated follow-up.
`session-player.tsx`'s own buttons all use `Pressable`/`onPress`
consistently, so this pattern wasn't reintroduced in new code.

## Deep Exhale data correction (2026-09-12, user decision)
User resolved the previously-flagged Deep Exhale conflict explicitly:
session-player-code.html's version is now canonical everywhere — 10 min
(was 18 min) and "Designed to activate your parasympathetic nervous
system, lowering your heart rate and melting away residual tension." (was
Home's "Let go of tension..." text). Updated:
- `src/data/sessions.ts` — the single source of truth Home/Library/Session
  Player all read from; updated its comments to reflect the resolution
  instead of the old flagged-conflict language
- `PRD.md`'s session catalog table (18 min → 10 min), with an inline note
  explaining why it now differs from its original value
- `app/session-player.tsx`'s flagged-conflict comment, updated to mark it
  resolved rather than open

Confirmed (not just asserted) via a fresh isolated dev server (port 8082,
phone-testing server on 8081 untouched) that all three consuming surfaces
now agree:
- Home's Featured Session card: "10 min" + new description (note: the
  new description is a little longer, so Home's existing 3-line clamp —
  unchanged, not touched — now truncates slightly earlier;
  "...residual tension." gets cut off. Inherent to Home's untouched
  truncation setting, not a new bug)
- Library's Deep Exhale row: "10 min"
- Session Player: duration badge "10 MIN SESSION", new description text,
  active-phase total time "10:00", post-mood "10 Mindful Minutes"

Screenshots of all 3 Session Player phases (plus Home and Library) with
the corrected data were copied to the user's Desktop:
`home-deepexhale-fix.png`, `library-deepexhale-fix.png`,
`session-player-phase1-premood.png`, `session-player-phase2-active.png`,
`session-player-phase3-postmood.png`. Phase 3 was captured the same way
as before (briefly forcing the initial state to `'post-mood'`,
screenshotting, then reverting — confirmed clean via `grep` immediately
after).

## Bug: Player tab not navigating (found + fixed)
User reported the Player tab doing nothing on tap, suspecting the
tabBarButton switch (from the Android tab bar fix) broke the Player →
Library redirect, which was implemented via a separate `listeners.tabPress`
handler calling `e.preventDefault()`.

Investigated by reading Expo Router's vendored `BottomTabBar.js`: the
`onPress` passed into `tabBarButton` as `props.onPress` is exactly what
emits the `tabPress` event `listeners.tabPress` catches — that chain is
navigation-core logic, unaffected by tabBarIcon vs. tabBarButton. Verified
empirically on web (Playwright): tapping Player *did* correctly redirect
to `/library` with the pre-existing code, contradicting the hypothesis as
the literal cause.

Fixed anyway, since the reported symptom is real even if not reproducible
from web and the underlying design was genuinely fragile — 3 linked pieces
(`TabButton` must forward `props.onPress` → that emits `tabPress` → a
*separate* `listeners.tabPress` handler must catch and `preventDefault()`
it) that could silently drift out of sync, exactly the failure mode
reported. Removed the indirection: Player's `tabBarButton` now calls
`router.replace('/library')` directly with no dependency on the tabPress
event system at all. Re-verified all 4 tabs (Home/Library/Player/Insights)
on web after the change — no regressions.

## Behavior change: Player tab gets its own dedicated screen (2026-09-12)
User asked for a real change of behavior, not another fix to the redirect:
Player should never silently redirect to Library — it should always show
its own content, with a dedicated empty state ("No session in progress" +
"Start a Session" button → Library) when nothing's playing, and the real
Session Player UI when a session genuinely is active.

Required a small piece of app-wide shared state, since `session-player.tsx`
(top-level route) and the Player tab (`app/(tabs)/player.tsx`) are separate
screens with no other link between them:
- New `src/state/ActiveSessionContext.tsx` — a minimal React Context
  (`activeSessionId: string | null`), wrapping the app in `app/_layout.tsx`
- `session-player.tsx` sets it on mount (any phase counts as "in
  progress" — the spec doesn't pin down whether pre-mood alone counts,
  treated broadly since the whole flow is "the session"), clears it on
  exit/Done, and on unmount as a safety net
- `app/(tabs)/player.tsx` rewritten: renders the empty state when
  `activeSessionId` is null; when set, `useEffect`-redirects to the real
  `/session-player?sessionId=...` route
- `app/(tabs)/_layout.tsx`'s Player tab reverted to the normal
  `tabBarButton` pattern (matching Home/Library/Insights) — the special-
  cased `onPress` override from the previous fix is gone; the screen
  itself now owns this decision

**Flagged architectural note:** `session-player.tsx` has no bottom tab bar
while mounted (matches the Stitch mockup's "focused transactional view"
with the shell suppressed), and its cleanup clears `activeSessionId` on
unmount. Since leaving that screen by any path (X, hardware back, Done)
unmounts it, there's currently no way to be looking at the Player tab
while `activeSessionId` is still truthy — the "show the real in-progress
session" branch is wired correctly but not reachable through today's
navigation flow. This is more correctness/future-proofing (e.g. if a
"minimize session" feature is added later) than a commonly-hit path right
now; a fuller version — lifting the actual phase/timer state so the tab
could render live progress inline without a navigation hop — would be a
bigger refactor. Flagged rather than silently overstating what's testable.

Verified on web (isolated port-8082 server, phone server on 8081
untouched): tapping Player now lands on `/player` (own route, not
redirected); its empty state renders correctly; "Start a Session"
navigates to `/library`; tapping Player from Home confirmed it no longer
redirects. The "active" redirect branch was verified by code review only,
per the reachability note above.

## Two bugs from on-device screenshots (found + fixed) + Player visual rebuild
### Bug 1: every tab showed a solid rectangular box, not just the active one
Root cause: `android_ripple={{borderless:true}}` on `TabButton`'s outer
`Pressable` — a known Android/RN quirk where the ripple's native surface
can render as a *persistent* tinted background at rest (not just on
press), clipped to the library's own ancestor View
(`BottomTabItem.js`: `overflow: variant==='material'?'hidden':'visible'`,
`borderRadius: 16` — a soft rectangle, matching "rectangular box", not our
pill's `radii.full`). Removed `android_ripple` entirely and forced the
outer Pressable's background to transparent unconditionally (the
library's own `props.style` carries its own active/inactive
`backgroundColor` we don't want layered under our own pill) — now only
our own `tabContentActive` pill can ever be visible, only when focused.
This is Android-specific and doesn't reproduce on web, so re-verified only
that the fix caused no regression there (Home's pill still shows
correctly, others still plain) — the actual fix needs on-device
confirmation.

### Bug 2: Player screen's tab bar appeared duplicated top and bottom
`app/(tabs)/player.tsx` was a bare centered `View` with no `SafeAreaView`/
`ScrollView`, unlike every other screen in the app. Rebuilt it to use the
exact same structural pattern as Home/Library (root View + background
glow + `SafeAreaView` + top bar + `ScrollView`) rather than diagnosing the
old structure's exact failure mode — conforming to the already-verified-
working pattern resolves it regardless of the precise mechanism. Verified
on web: single tab bar at the bottom only, no duplication, no gap.

### Visual rebuild (no Stitch export exists for this screen)
Per instruction, rebuilt to match the app's established visual language
rather than sitting as a disconnected placeholder, since Player's empty
state wasn't part of the original Stitch design handoff:
- Same top bar as Home/Library: avatar, gradient "Breathe" title, settings
- Same background glow treatment as Home (identical values)
- Message + icon + CTA now live inside a centered `GlassCard`
  (`src/components/GlassCard`, unchanged, reused as-is)
- "Start a Session" upgraded from a flat-color button to the same
  gradient-pill treatment used by Library's Quick Start and Session
  Player's Begin Journey, for visual consistency across primary CTAs

Verified on web: screenshot matches the app's visual language (top bar,
glow, glassmorphic card, gradient button); "Start a Session" still
navigates to `/library` correctly. Screenshots copied to the user's
Desktop: `tabbar-fix.png`, `player-rebuilt.png`. Both changed files
(`_layout.tsx`, `player.tsx`) are existing files, so the phone server
should Fast Refresh automatically — no restart needed this time.

## Bug 1, round 2: active tab still a hard-edged rectangle, not a pill
User's on-device screenshot showed the previous fix only half-worked: the
box now correctly appears on only the active tab (the `android_ripple`
removal fixed that part), but its *shape* was still a hard rectangle
instead of the pill from home-code.html's spec.

Root cause found: the earlier fix only overrode `backgroundColor` on the
outer `Pressable`, but never touched `borderRadius` — the library's own
per-tab `style` (`BottomTabItem.js`, Android's "material" variant) also
sets `borderRadius: 16` (a soft rectangle), which we were still
inheriting unmodified. Rather than keep cancelling out individual
properties one at a time as each one surfaces, stopped inheriting the
library's decorative styling altogether: `TabButton` now extracts only
`flex` (needed so all 4 tabs share the row equally) from the library's
style via `StyleSheet.flatten`, and discards everything else. Only our
own `tabContent`/`tabContentActive` (`radii.full`) can paint a background
now, on any platform — there's no other style source left that could
leak through.

Verified on web: pill still renders correctly and moves with the active
tab (Home → Library, screenshotted both), equal-width spacing preserved
by the `flex` extraction. This bug was never reproducible on web in the
first place (it's Android's "material" tab-bar variant specifically), so
web verification here only confirms no regression — **the actual fix
still needs on-device screenshot confirmation**, per the user's explicit
request not to consider this fixed until then. Screenshots copied to the
user's Desktop: `tabbar-fix2.png`, `tabbar-library-active.png`.

## Bug: Home's scrolled content overlapping the bottom tab bar (found + fixed)
User's on-device screenshot showed Home's "Your Snapshot" section (mood
card, streak card) crammed together and overlapping the bottom tab bar at
the end of the scroll.

Root cause: Home/Library/Player's `ScrollView` all used a hardcoded
`paddingBottom: 140` guess, meant to clear the absolutely-positioned tab
bar (`tabBarStyle.height: 84` + the device's real bottom safe-area inset,
which the tab bar also factors in via React Navigation's own
`insets.bottom` handling) — 140 was apparently not enough headroom on the
user's actual device.

Fixed properly instead of guessing a bigger number: switched all three
screens to `useBottomTabBarHeight()`, which returns the tab bar's real
rendered height (including safe-area insets) at runtime — exactly the
pattern the library's own type comments recommend for this exact problem.
This hook isn't re-exported from the top-level `expo-router` package
(there's no separate `@react-navigation/bottom-tabs` dependency — expo-
router vendors its own copy internally), so it's imported from
`expo-router/build/react-navigation/bottom-tabs`, a deep, undocumented
path — flagged as a fragility risk (could break on an expo-router
upgrade that reorganizes this internal path), but it's still the correct
fix, not a magic-number guess.

Checked (per instruction) whether the same bug affects the other screens:
- **Library**: same hardcoded-140 pattern, same fix applied
- **Player** (the new empty-state screen): same hardcoded-140 pattern,
  same fix applied
- **Insights**: not affected — still just a centered placeholder stub
  (`flex:1, justifyContent:'center'`, no `ScrollView`), nothing tall
  enough to ever need bottom clearance. Not built yet (build order step 5)

Verified on web (isolated port-8082 server, phone server on 8081
untouched): resized the viewport taller to see full content without
scrolling on all three screens — visible clearance between the last
card/element and the tab bar on Home, Library, and Player, no
overlap. Screenshots copied to the user's Desktop: `home-padding-fix.png`,
`library-padding-fix.png`, `player-padding-fix.png`. Web has no
device-specific safe-area inset to stress-test, so this should be
re-confirmed on-device, though the mechanism itself (reading the tab
bar's actual rendered height rather than guessing) is correct by
construction regardless of device.

## Overlap bug persisted after full clean reconnect — useBottomTabBarHeight() itself is suspect
User did a full force-stop + clear-cache + reconnect (ruling out staleness
definitively — the bundle was independently confirmed correct beforehand)
and the overlap was still there, identical to before, on both Home and
Library. This means the `useBottomTabBarHeight()` fix itself isn't
working as intended on this device.

Read the hook's own source to check whether it could be silently
returning 0/wrong via a dual-module-instance bug (importing the deep path
resolving to a different copy of the context than what `Tabs` actually
provides): `useBottomTabBarHeight.js` explicitly **throws** if the
context is genuinely missing ("Couldn't find the bottom tab bar height...").
Since the app isn't crashing on-device, the hook must be reading a real
value from the correctly-connected context — just an apparently too-small
one for this device's actual on-screen tab bar footprint. (On web, for
reference, it correctly reports `84`, matching our set `tabBarStyle.height`
exactly, with no extra inset — web has none to add.)

Per instruction: added a temporary on-screen debug badge on Home
(top-right, red, `tabBarHeight = {value}`) rendering the hook's raw
return value, so the actual on-device number can be read directly instead
of guessed at. Simultaneously, and as the actual fix, replaced the
hook-based padding on Home/Library/Player with a flat
`SAFE_MIN_TAB_BAR_CLEARANCE = 200` constant — a generous fixed overestimate
instead of an unreliable "precise" value, per the user's explicit
preference. The hook call was removed entirely from Library/Player (no
longer used for anything); Home still calls it, but only to feed the
debug badge.

**Awaiting the user's next on-device screenshot to read the actual
`tabBarHeight = N` value off the debug badge** — this will tell us
whether the hook is returning something clearly wrong (e.g. 0, or a very
small number) vs. a plausible-but-still-insufficient value, which
determines whether this internal hook is trustworthy at all for future
use or should be abandoned for good.

Verified on web only that the badge renders and the flat padding doesn't
break layout — this is a device-specific bug, so web can't validate the
fix itself, only that nothing regressed. Confirmed via `curl` + `grep`
against the freshly restarted server's actual served bundle that both the
debug badge and the flat fallback are present before asking for another
reconnect (force-stop + clear cache, same procedure as last time, since
that's what's required to guarantee a clean bundle lands).

## Overlap bug, continued: tabBarHeight confirmed correct (83.91) — still overlapping
User's debug badge screenshot: `tabBarHeight = 83.9111328125` — a
completely normal, correct value. Combined with the flat 200px fallback
already in place, the padding value itself is no longer a plausible
suspect. Yet the Streak card still visually overlapped the tab bar in
the screenshot.

Investigated the three directions requested:
1. Re-read `home.tsx`'s actual JSX: `contentContainerStyle` is a plain
   array `[styles.scrollContent, {paddingBottom: 200}, debugStyles.
   contentBorder]` applied directly to the one and only `ScrollView` — no
   evidence of the value being applied to the wrong element
2. Grepped the whole app for `<Tabs` and every `position: 'absolute'` —
   confirmed only one `<Tabs>` navigator exists (no duplicate tab bar) and
   no other absolutely-positioned element sits near the bottom of Home
   besides the one real tab bar
3. Added the requested lime border around the ScrollView's entire content
   area (including the bottom padding) — its bottom edge will show
   exactly where the padded content actually ends, relative to the tab bar

**New working theory, based on re-reading the screenshot itself**: the
photo may show Home in its *initial, not-yet-scrolled* position, not
scrolled all the way down. `paddingBottom` only extends how far content
*can* scroll — it has zero effect on what's already visible before any
scrolling happens. An absolutely-positioned floating tab bar will always
overlay whatever content sits at that fixed screen position pre-scroll;
that's inherent to this UI pattern (same as e.g. Instagram's feed
scrolling under its bottom bar), not necessarily a bug. The real test is
whether the Streak card fully clears the tab bar *after* scrolling all
the way down — which may not have been tried yet.

Also noticed a recurring, likely-unrelated visual artifact across
multiple screenshots: a ghost settings-gear icon floating over the hero
card, and the BreathOrb looking cut off/blended. `BreathOrb.tsx` combines
a continuous `Animated` scale loop with `elevation: 20` — a known
Android/RN combination that can cause native compositing "ghosting" of
nearby fixed UI during animation. Not yet investigated further since it
doesn't obviously relate to the padding/overlap bug (different part of
the screen), but flagging it as a separate open item.

Not resolved yet — the debug badge and lime border are both still in
place. Asked the user to explicitly scroll all the way down before
screenshotting this time, to distinguish "not-yet-scrolled" from a real
persistent overlap.

## Mystery solved: the "ghost settings icon" was never our bug
The recurring floating gear icon visible in every on-device screenshot so
far turned out to be **Expo Go's own developer-menu overlay button** (the
"Tools" pill + blue gear circle) — clearly visible once the user sent an
actual screen capture instead of a phone photo. Retracting the earlier
`BreathOrb` elevation/animation-ghosting theory entirely; that was chasing
a non-issue.

## Overlap bug, continued: real scroll instrumentation added, blunt 300px test
User's follow-up screenshot (a real capture, fully scrolled per their
description) still showed the mood card overlapping the tab bar — but the
lime border's bottom edge wasn't visible anywhere in the frame, running
off the bottom of the screen. If that were genuinely the maximum scroll
position, the content's bottom edge should sit at or above the viewport
bottom, not still extend past it — inconsistent with "fully scrolled,"
though this was read from a screenshot, not measured.

Rather than keep interpreting screenshots, added real instrumentation to
Home's `ScrollView` instead:
- `onLayout` → `layoutHeight` (the ScrollView's own viewport height)
- `onContentSizeChange` → `contentHeight` (actual rendered content height,
  including paddingBottom)
- `onScroll` (`scrollEventThrottle={16}`) → `scrollY` (current offset)
- Debug badge now shows all four numbers plus the computed
  `maxScrollY = contentHeight - layoutHeight` — if `scrollY` at rest after
  scrolling "to the bottom" is meaningfully less than `maxScrollY`, the
  `ScrollView` itself is the one capping how far it scrolls, independent
  of whether `paddingBottom` is large enough — which would point at a
  height-calculation or clipping bug rather than a padding-value problem.

Also applied the user's requested blunt test: bumped
`SAFE_MIN_TAB_BAR_CLEARANCE` from 200 to 300 on all three screens
(Home/Library/Player). If the overlap persists identically at 300px, that
confirms padding value isn't the mechanism at all.

Confirmed via `curl` + `grep` against the freshly restarted server's
actual served bundle that both the 300px value and the full scroll
instrumentation are present. Awaiting the user's next on-device
screenshot with all 5 debug numbers visible to get a definitive,
measured answer instead of another visual read.

## Overlap bug: RESOLVED — was never a calculation bug
User's instrumented debug data settled it conclusively:
- At `scrollY=0` (initial load, nothing scrolled yet): mood card
  overlapped the tab bar
- At `scrollY=580.7` (= `maxScrollY` exactly, i.e. genuinely fully
  scrolled): content cleared the tab bar correctly, full margin visible
  above the Streak card

So `useBottomTabBarHeight()`, the padding math, and the ScrollView's
height calculations were all correct the entire time. The "bug" was
inherent, expected behavior of a floating (`position: absolute`) tab bar
sitting over content taller than one screen: nothing has been scrolled
yet on first load, so the tab bar necessarily overlays whatever content
happens to fall in its footprint at the top of the page. Every fix
attempted along the way (the deep-import hook, the flat 300px value, all
of it) was chasing a symptom that padding can't address, since padding
only affects how far content *can* scroll, not what's visible before any
scrolling happens.

**Also resolved as a side note**: the recurring "ghost settings icon"
seen in multiple earlier screenshots is Expo Go's own developer-menu
overlay button ("Tools" pill + gear), confirmed once a real screen
capture was sent instead of a phone photo. Not our bug; the earlier
`BreathOrb` elevation/animation-ghosting theory is retracted.

### Actual fix: tighten first-frame spacing so key content clears the tab bar without scrolling
Trimmed vertical spacing on Home (`app/(tabs)/home.tsx`) by a calculated
~98dp total — comfortably more than the ~84dp tab bar footprint that was
overlapping the mood card — without resizing any element (kept purely to
spacing/padding, per the user's ask):
- `topBar` height: 64 → 56
- `scrollContent.paddingTop`: `spacing.sectionGap` (40) → `spacing.base * 2.5` (20)
- `scrollContent.gap` (between Featured Session and Your Snapshot sections): 40 → 20
- `section.gap` (used by both sections' internal title-to-content spacing): `spacing.base * 2` (16) → `spacing.base * 1.25` (10)
- `heroCard.padding`: `spacing.base * 3` (24) → `spacing.base * 2` (16)
- `heroContent.gap` (orb→title→description→footer): `spacing.base * 2` (16) → `spacing.base * 1.25` (10)
- `heroFooter.marginTop`: `spacing.base` (8) → `spacing.base * 0.5` (4)

Reverted `SAFE_MIN_TAB_BAR_CLEARANCE` (the flat-300 blunt-test value) back
to the precise `useBottomTabBarHeight() + spacing.base * 2` on all three
screens (Home/Library/Player) — the hook is now proven correct on-device,
so the precise value is the right one to actually ship, not an oversized
guess.

**Removed all debug instrumentation** added during this investigation:
the red debug badge (tabBarHeight/layoutHeight/contentHeight/scrollY/
maxScrollY readout), the `onLayout`/`onContentSizeChange`/`onScroll`
handlers and their state, and the lime content-boundary border. Confirmed
via `curl` + `grep` against the freshly restarted server's actual served
bundle that all of it is gone and only the real
`const tabBarHeight = useBottomTabBarHeight();` declarations remain.

Verified on web (isolated port-8082 server) that the trimmed layout looks
clean, not cramped, and the mood card now sits with clear margin at a
standard phone viewport size on first load. Web never reproduced this
specific bug (its available height happened to be enough), so this is
awaiting final on-device confirmation that the mood card now clears the
tab bar without needing to scroll first.

## Bug: active-tab pill oversized vs. home-screenshot.png (found + fixed)
User compared the on-device pill against `assets/design-reference/
home-screenshot.png` closely and found it wasn't tightly fitted around
just the icon+label like the reference — it looked oversized/extending
beyond them.

Checked the exact intended values first rather than guessing: home-code
.html's CSS for this element is `px-4 py-1` — Tailwind's *default*
spacing scale (not one of DESIGN.md's overridden custom keys), i.e. 16px
horizontal / 4px vertical. `tabContent` in `app/(tabs)/_layout.tsx`
already had exactly `paddingHorizontal: 16, paddingVertical: 4` — the
padding values were already textbook-correct, so the oversized look had
a different cause.

Root cause: `TabButton`'s outer `Pressable` (`app/(tabs)/_layout.tsx`)
had no explicit `alignItems`. React Native Views default to
`alignItems: 'stretch'`, so the inner `tabContent` pill was being
stretched to fill the Pressable's entire flex-width (a full quarter of
the tab bar), rather than sizing to hug just its own icon+label content
like the reference. Fixed by adding `alignItems: 'center'` to the
Pressable, so `tabContent` sizes to its own intrinsic content width and
is centered within its tab slot instead of stretching to fill it.

Verified on web (isolated port-8082 server): the pill now hugs the
icon+label snugly on both Home and Library, matching the reference
image's proportions — confirmed via screenshot, not just asserted. Dev
server restarted fresh and confirmed via `curl`/`grep` that this exact
fix is in the served bundle. Awaiting the user's fresh on-device
screenshot to confirm the sizing visually matches before considering
this done, per their explicit request.

## Pill sizing bug, round 4: alignItems on parent didn't hold on Android
User did a genuine full force-stop + clear-cache + reconnect and
confirmed the pill was still wide with the verified-correct
`alignItems: 'center'` code running — ruling out staleness definitively
and pointing at a real Android-specific layout difference: the parent's
`alignItems: 'center'` (round 3) constrains the child's width on web but
apparently doesn't hold the same way on this Android device/RN version.

Fixed by applying the constraint directly to `tabContent` instead of
relying on the parent:
- `alignSelf: 'center'` — overrides whatever the parent's `alignItems`
  does for this specific child
- `flexGrow: 0` / `flexShrink: 0` — prevents the parent's flex layout
  from resizing it at all

Combined with the existing `paddingHorizontal: 16` / `paddingVertical: 4`
(already confirmed exact-matching `home-code.html`'s `px-4 py-1`), this
should make `tabContent` sizeable only by its own icon+label content
plus padding, regardless of platform-specific parent-stretch behavior.

Verified on web (both Home and Library) that this causes no regression —
pill still renders correctly. Dev server restarted fresh and confirmed
via `curl`/`grep` against the actual served bundle that this exact fix
(`alignSelf: 'center'`, `flexGrow: 0`, `flexShrink: 0`) is present.
Awaiting the user's on-device screenshot — this is the 4th attempt at
this specific pill-sizing issue, so treating it as unconfirmed until they
see it themselves, not asserting it's fixed.

## Deferred: tab bar pill-shape cosmetic issue (2026-09-12, user decision)
User decided to set the active-tab pill sizing issue aside — 4 rounds of
fixes attempted (background transparency, `alignItems` on the parent,
then on the element itself with `flexGrow`/`flexShrink: 0`), each
verified correct on web and confirmed via `curl`/`grep` against the
actual served bundle, but still rendering as a wider box on-device as of
the last check. Explicitly deprioritized as **cosmetic, not functional**
— the tab bar is fully usable (correct navigation, correct active-tab
indication color, just not pill-shaped/snug). Noted here as a known
visual-polish item to revisit later, alongside the session thumbnail/
BreathOrb placeholder art (`src/components/SessionThumbnail.tsx`,
`src/components/BreathOrb.tsx` — programmatic gradients standing in for
real Stitch illustrations, both hotlinked third-party images this project
doesn't own).

## Known visual polish backlog (not blocking, revisit later)
- Active-tab pill in `app/(tabs)/_layout.tsx` (`tabContent`/
  `tabContentActive`) renders as a wider box on at least one Android
  device despite 4 verified-correct attempts — deferred, cosmetic only
- `BreathOrb` (Home) and `SessionThumbnail` (Library) are programmatic
  gradient placeholders, not real Stitch illustrations
- Home's "Begin" button uses `onTouchEnd` instead of `Pressable`/
  `onPress` (pre-existing, found while testing Session Player
  integration) — likely unreliable on real devices, not yet fixed since
  Home was off-limits for that task

## Next
- Awaiting on-device confirmation of: (1) all 3 Session Player phases
  render/transition correctly, (2) the active-phase exit confirmation
  dialog, hardware back button, and gesture-swipe suppression all behave
  correctly (untestable from web), (3) the Player tab's new empty state
  and "Start a Session" button
- Build Insights screen (build order step 5) — in progress

## Blockers
- None

---

## Session — 2026-09-11

### Completed
- Verified the Context7 MCP server was already registered and connected
  (`claude mcp list`) — no config change was needed
- Audited the available Claude Code skills and confirmed `frontend-design`
  (referenced in CLAUDE.md's "Skills in use") was missing from the
  environment
- Added `anthropics/claude-code` as a plugin marketplace
  (`claude-code-plugins`) and installed the official `frontend-design`
  plugin (v1.1.0, user scope) — confirmed active as
  `frontend-design:frontend-design` in the skill list
- Investigated the `ui/ux pro ma skill` entry surfaced by `claude mcp list`
  (pointing at `github.com/nextlevelbuilder/ui-ux-pro-max-skill`); determined
  it is an account-level claude.ai connector, not a `claude mcp`-managed
  server, so it can't be removed via the CLI

### In Progress
- None — this session was tooling/environment setup only; no app code
  changed

### Known Issues
- `ui/ux pro ma skill` connector (unverified third-party source: 
  github.com/nextlevelbuilder/ui-ux-pro-max-skill) is still connected at the
  claude.ai account level and failing (HTTP 422 "Invalid content from
  server"). Can only be removed via claude.ai → Settings → Connectors, not
  the CLI. User declined to install/trust it — flagged as unverified.

### Next Steps
- Build theme tokens (`src/theme/tokens.ts`) from DESIGN.md — still the next
  item in the locked build order
- Build Home screen (dummy/placeholder data)
- Build Library screen, using the locked session mapping (dummy/placeholder
  data)

---

## Session — 2026-09-12

### Completed
- Built `src/theme/tokens.ts` from `assets/design-reference/DESIGN.md`'s
  frontmatter YAML — `colors`, `typography`, `radii`, `spacing` exports
- Followed architecture.md's "Colors — source of truth" rule: used the
  frontmatter YAML hex values, ignored DESIGN.md's prose "## Colors" section
  (which describes a different Indigo-to-Purple/Cyan-to-Blue gradient)
- Verified with a Node script that programmatically parsed DESIGN.md's
  frontmatter and diffed all 47 color tokens against `tokens.ts` —
  zero mismatches (full table shown in-session, not just asserted)
- Converted `letterSpacing` (em → px, `em * fontSize`) and `rounded` (rem →
  px, `rem * 16`) since React Native has no em/rem units — conversions
  documented inline in `tokens.ts`
- Confirmed `npx tsc --noEmit` passes clean under the repo's strict
  tsconfig

### In Progress
- None — Home screen completed and verified this session (see below)

### Completed (continued, same session)
- Discovered the repo wasn't actually wired for Expo Router despite
  architecture.md assuming it (still had the vanilla `App.tsx`/`index.ts`
  entry) — flagged to the user before installing anything; confirmed to set
  it up properly rather than build Home standalone
- Installed `expo-router` + `react-native-safe-area-context`,
  `react-native-screens`, `expo-linking`, `expo-constants`,
  `expo-linear-gradient`, `expo-blur`, `@react-native-masked-view/masked-view`,
  `@expo/vector-icons`, `expo-font`, `react-dom`, `react-native-web`,
  `@expo-google-fonts/plus-jakarta-sans` (all via `npx expo install` for
  SDK 57 compatibility; needed `--legacy-peer-deps` for a pre-existing
  react/react-dom peer version conflict introduced by expo-router's own
  transitive deps, unrelated to anything in this repo). `npx expo-doctor`:
  21/21 checks pass
  - Built `app/_layout.tsx` (root layout + font loading gate) and
  `app/(tabs)/_layout.tsx` (shared tab bar); `app/index.tsx` redirects `/`
  to `/home` since architecture.md names the file `home.tsx`, not `index.tsx`
- Built `src/types/models.ts`, `src/data/sessions.ts`, and the Home screen
  itself with dummy data (see Done section above)
- Caught a real typography bug via actual visual verification, not
  assertion: first render fell back to a system serif because
  Plus Jakarta Sans wasn't loaded; fixed by installing the font package and
  gating root render on `useFonts`
- Fixed two RN Web console warnings surfaced during verification
  (`pointerEvents` prop → `style.pointerEvents`); left native `shadow*`
  props as-is since they're correct for iOS/Android and only warn on the
  web preview target used for this verification

### Known Issues
- (carried over) `ui/ux pro ma skill` connector still unresolved — see
  2026-09-11 session
- See "Known deviations" above (placeholder orb, placeholder session copy
  for 5/6 sessions, placeholder phaseConfig, inconsistent Deep Exhale
  description between two Stitch exports)

### Next Steps
- Build Library screen, using the locked session mapping (dummy/placeholder
  data)
