# Progress

## Status
Workspace scaffolded, folder structure set up, PRD.md/architecture.md/CLAUDE.md
in place, design references loaded, theme tokens done, Expo Router wired up.
Build order steps 1-6 done and verified on-device: Home, Library, Session
Player, shared tab bar/navigation, Insights, and now Onboarding. Two known
cosmetic-only deferrals remain (tab bar active-pill width; Library's last
card requiring a scroll under the floating tab bar — both previously
investigated and understood, not regressions). This session (2026-09-16)
built Onboarding (3 screens) and confirmed all 3 screens plus every exit
path (Next/Next/Get Started, Skip, Enable Reminders) on-device. A later
same-week session (2026-09-17) added real "why this helps" descriptions
to the 5 sessions that lacked them, matching Deep Exhale's existing copy
style — additive-only, `src/data/sessions.ts` only. A same-week session
(2026-09-18) replaced `BreathOrb` (Home) and `SessionThumbnail` (Library)'s
programmatic-SVG placeholders with the user's 7 real illustration images
in `assets/illustrations/` — see "Real illustrations" section below. A
following 2026-09-18/19 session investigated a reported Home orb
flicker on-device (no bug found in the animation itself — see "Home orb
art investigation" below), then the user supplied a cleaned-up
transparent `hero-orb.png` and 6 cleaned-up session illustrations,
re-keyed `SessionThumbnail` from `pattern` to session `id`, and fixed two
real thumbnail bugs (off-center Deep Exhale, undersized Stress Relief) —
see the corresponding dated sections below for full detail. On-device
confirmation of the illustration/thumbnail-fix work is still pending
(adb connection to the user's phone needs re-pairing — see "Blockers").
A 2026-09-19 session made several data-only changes to
`src/data/sessions.ts` (title renames, category moves, a corresponding
badge fix synced into architecture.md's locked table — see the dated
entries below), then built Settings (build order step 7) once the user
supplied its design reference — `app/settings.tsx`, two cards (Daily
Reminder, About) per `settings-code.html`/`DESIGN.md`, additive-only, not
yet confirmed on-device (see "Done: Settings screen" below and
"Blockers"). Next up: Settings needs on-device confirmation, then
Notifications (build order step 10) and the backend (step 8) remain the
biggest unbuilt pieces.

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
- ~~`BreathOrb` (Home) and `SessionThumbnail` (Library) are programmatic
  gradient placeholders, not real Stitch illustrations~~ — DONE 2026-09-13
  (procedural SVG art pass), then superseded again 2026-09-18 once the
  user supplied real illustration PNGs — see "Real illustrations added"
  section below. Both components now render real `Image` assets from
  `assets/illustrations/`, awaiting on-device confirmation.
- ~~Home's "Begin" button uses `onTouchEnd` instead of `Pressable`/
  `onPress`~~ — DONE 2026-09-15, see "Fixed: Home's Begin button" below

## Next
- Awaiting on-device confirmation of: (1) all 3 Session Player phases
  render/transition correctly, (2) the active-phase exit confirmation
  dialog, hardware back button, and gesture-swipe suppression all behave
  correctly (untestable from web), (3) the Player tab's new empty state
  and "Start a Session" button
- Awaiting on-device confirmation of the new Insights screen (below)

## Done (continued): Insights screen (build order step 5)
Built `app/(tabs)/insights.tsx` per architecture.md's `/api/insights`
contract and `assets/design-reference/insights-code.html` /
`insights-screenshot.png`. Did not touch Home, Library, Session Player,
`_layout.tsx`, theme tokens, or any other existing component.

- New files: `src/data/insights.ts` (dummy data), `src/components/
  MoodTrendChart.tsx` (chart component), `app/(tabs)/insights.tsx`
  (screen, replacing the old placeholder stub)
- **Charting approach**: no charting library existed in this project yet,
  so flagged the dependency question to the user before installing
  anything. Confirmed choice: `react-native-svg` with a hand-drawn path
  (matching `insights-code.html`'s own approach of a hand-built SVG path
  + gradient + glow filter) rather than a full chart library like
  `victory-native` or `react-native-gifted-charts` — this is a single
  smooth wave, not a general-purpose chart, so a library would be
  overkill. Installed via `npx expo install react-native-svg
  --legacy-peer-deps`; `npx expo-doctor`: 21/21 checks pass. Confirmed
  `Filter`/`FeGaussianBlur`/`FeMerge`/`FeMergeNode` are all real exports
  of the package (checked `node_modules/react-native-svg`'s own type
  defs) before using them.
- `MoodTrendChart` builds a smooth quadratic-Bezier path from real
  `MoodPoint[]` data (mood 1-5 mapped to Y position), not a copy of
  `insights-code.html`'s literal hardcoded demo squiggle — mirrors its
  `Q ... T ...` path-command technique and its `waveGrad` gradient +
  `feGaussianBlur`/`feMerge` glow filter structure exactly, since the app
  needs to render this from real mood check-ins eventually.
- Dummy data in `src/data/insights.ts` matches
  `insights-screenshot.png`'s numbers exactly (Current Streak 5, Total
  Sessions 48, Mindful Minutes displayed as "12h" from a raw 720-minute
  value, Vs Last Month +12%) rather than being invented separately;
  streak/session counts reuse Home's existing dummy values for narrative
  consistency across screens. Consistency calendar is a fixed (not
  random-per-render) 28-cell array so it doesn't change on every reload.
- Swapped the streak stat's icon from `local-fire-department` to
  `whatshot`: checked the MaterialIcons glyphmap codepoints directly
  (`node_modules/@expo/vector-icons/.../MaterialIcons.json`) and found
  `local-fire-department` is a newer Material Symbols addition (same
  family as `grid_view`/`air`/`monitoring`, which rendered as the wrong
  glyph on Android's Expo Go bundled font earlier this session — see
  "Deferred" section above for that bug). `whatshot` is the classic fire
  icon from the original glyph set, same era as `home`/`settings`/
  `search`/`schedule`/`check-circle`/`trending-up` (all already in use
  or also used here) — used it instead to avoid repeating that bug.
  Flagged as a risk to specifically watch for on-device rather than
  assumed safe.
- Reused `useBottomTabBarHeight()` (same deep import as Home/Library/
  Player) for dynamic scroll bottom-padding, and `GlassCard`/
  `GradientText` for the cards and top-bar title, matching Home/Library's
  structural pattern exactly (same top bar, same `ScrollView`
  `contentContainerStyle` approach).
- `npx tsc --noEmit`: clean, no errors
- Verified on an isolated web server (port 8082, separate from the
  phone's port 8081 dev server) via `playwright-cli`: screenshotted at
  mobile viewport width (420px), confirmed visual match against
  `insights-screenshot.png` — header text, glowing mood-trend wave,
  4x7 consistency grid with "5 Week Streak"/"Keep going" footer, and all
  4 stat cards with icons/values/glow circles in a 2x2 grid. No console
  errors (one pre-existing, unrelated `shadow*`-deprecation warning).
  Isolated server and `.playwright-cli/` temp files torn down after.
- Restarted the phone-facing dev server fresh with `--clear` (required
  for new files, per this session's established Metro-staleness lesson)
  and confirmed via `curl` + `grep` against the actual served Android
  bundle that all the new Insights strings and the `whatshot` icon name
  are present in the real bundle bytes before handing back for on-device
  testing.
- **Not yet confirmed on-device** — per this session's repeated lesson
  that web verification alone has missed real Android-specific rendering
  differences (tab bar icons, pill sizing), this is not being considered
  done until the user confirms on their phone. Specifically watch for:
  the `whatshot` icon rendering correctly, the SVG glow filter rendering
  (native `react-native-svg` filter support can differ from the web SVG
  renderer used in the isolated-server check), and the consistency grid's
  7-column layout at real device width.

## Fixed (continued): two on-device Insights bugs
On-device testing found exactly the risks flagged above (icon glyphs) plus
one not anticipated (calendar grid). Both root-caused, not just patched:

1. **Consistency grid blank on Android, correct on web.**
   `calendarCell` used `width: '11.5%'` (percentage) + `aspectRatio: 1`
   inside a `flexDirection: 'row', flexWrap: 'wrap'` container. This is a
   known React Native/Yoga bug on Android: `aspectRatio` combined with a
   percentage-width child inside a wrapping flex row frequently fails to
   resolve a height (collapses to 0), while CSS flexbox on web handles
   the same combination without issue — exactly matching "renders on web,
   blank on Android." Fixed by restructuring into 4 explicit
   non-wrapping rows of 7 `flex: 1` cells (`chunk()` helper in
   `insights.tsx`) — removes the wrap+aspectRatio combination entirely
   rather than tuning percentages.

2. **Stat card glow circles rendering large/opaque, overlapping content
   on Android; fine on web.** `statGlow` was positioned with a *negative*
   offset (`right: -16, bottom: -16`), deliberately bleeding past the
   card edge and relying on the card's `overflow: 'hidden'` +
   `borderRadius` to clip it — inside a `GlassCard`, which also renders a
   native `BlurView`. Android has known unreliable clipping of
   negative-offset absolutely-positioned children through nested
   `overflow: hidden`, especially alongside a native blur surface — the
   same category of bug as the tab bar's `android_ripple`/`overflow`
   issues earlier this session. Fixed by containing the glow fully
   within the card's own bounds (`right: 0, bottom: 0`, no negative
   offset), shrinking it (96px → 64px) and lowering its opacity
   (`26` → `1F` hex alpha) — removes the dependency on Android's
   negative-offset clipping behavior entirely instead of tuning it.

3. **Two more wrong icon glyphs on-device**: `schedule` (Mindful
   Minutes) and `trending-up` (Vs Last Month) — same font-codepoint
   mismatch class of bug as the tab bar, but disproving the "codepoint
   range" theory from that earlier fix: `whatshot` (0xe80e) and
   `check-circle` (0xe86c) are confirmed working, while `schedule`
   (0xe8b5) and `trending-up` (0xe8e5) — codepoints in between/nearby —
   are confirmed broken. There's no clean numeric cutoff; it's
   icon-specific. Cross-referenced every icon confirmed working
   on-device so far this session and found the `0xe1xx`-`0xe6xx`
   codepoint band has a clean 100% track record (`apps`, `waves`,
   `show-chart`, `check` all live there). Swapped to `access-time`
   (0xe192) and `arrow-upward` (0xe5d8), both in that band.
- `npx tsc --noEmit`: clean
- Re-verified on the isolated web server (port 8082): no regression —
  grid still renders, glow circles still visible as subtle corner
  accents, new icons render correctly
- Restarted the phone-facing dev server fresh (`--clear`) and confirmed
  via `curl` + `grep` against the actual served Android bundle that
  `access-time`/`arrow-upward` are present and the old `11.5%`
  percentage-width string is gone
- **Still not confirmed on-device** — same standing lesson: web
  verification has already missed two of these three bugs once. Not
  considering this done until the user's phone confirms: (1) the
  consistency grid is now visible, (2) the glow circles are subtle and
  no longer overlapping the numbers, (3) both new icons render as an
  actual clock and an actual upward arrow.

## Fixed (continued): three more Insights issues found by pixel-checking
against the reference precisely
User checked the previous fix against `insights-code.html`/
`insights-screenshot.png` directly and found:

1. **Stat card glow circles shouldn't exist at all.** Re-read
   `insights-code.html`: it does technically have one
   (`absolute -right-4 -bottom-4 w-24 h-24 bg-primary/10 rounded-full
   blur-xl`), but with a real CSS Gaussian blur + 10% opacity it's
   essentially invisible in the rendered screenshot — my RN version had
   no blur (`BlurView`/backdrop-filter isn't available for a plain tinted
   `View`), so a flat semi-transparent circle was always going to be far
   more visible than the true blurred original, regardless of size/offset
   tuning. Removed `statGlow` entirely rather than chase an
   unreproducible blur effect.
2. **borderRadius was wrong on all 3 card types, not just stat cards.**
   `insights-code.html` uses `rounded-xl` on every `glass-card` (Mood
   Trend, Consistency, and all 4 stat cards) — but this project's own
   Tailwind config (inline in the HTML's `<script>` block) *overrides*
   `rounded-xl` to `3rem` (48px), not Tailwind's stock 12px. I'd used
   `radii.DEFAULT` (16px, i.e. plain `rounded`/1rem) uniformly instead of
   `radii.xl` (48px) — same file, same root cause, so fixed uniformly
   across all 3 `GlassCard` usages in `insights.tsx` rather than only the
   stat cards, since they all share the exact same reference class.
3. **"Vs Last Month" icon was the wrong shape, not just the wrong glyph
   codepoint.** The earlier fix (`trending-up` → `arrow-upward`) solved
   the font-mismatch but swapped to a plain arrow instead of a zigzag
   trend-line. Rather than guess again by icon name, rendered every
   candidate glyph as an actual image using the exact bundled
   `MaterialIcons.ttf` (a local `@font-face` HTML test page, served over
   `http://localhost` since Playwright blocks `file://`, screenshotted,
   then deleted) to compare real shapes side by side. `moving` (0xe501)
   turned out to be a pixel-for-pixel match for trending-up's
   zigzag-with-arrowhead look, and its codepoint sits in the
   `0xe1xx`-`0xe6xx` band with a clean track record. Swapped to it.
- `npx tsc --noEmit`: clean
- Re-verified on the isolated web server (port 8082): no regression —
  rounder cards, no glow circles, correct zigzag-arrow icon
- Restarted the phone-facing dev server fresh (`--clear`) and confirmed
  via `curl`/`grep` against the actual served Android bundle: `statGlow`
  string is gone, `"moving"` is present
- **Still awaiting on-device confirmation**

## Fixed (continued): stat card corners + Mood Trend chart edge-clipping
User pixel-checked the previous fix against the reference again and found
two more issues (this update was missed at the time — logging it now
alongside the round after it):

1. **Stat card corners uneven** (2 of 4 rounded, 2 sharp) — confirmed not
   a style bug in our own code (`borderRadius` is a single uniform number,
   no per-corner values anywhere). Root cause: `expo-blur`'s native
   `BlurView` on Android doesn't reliably clip to a rounded rect via the
   parent's `overflow: hidden`, especially at larger radii — this only
   became visible once the borderRadius fix above bumped the radius from
   16px to 48px. Since `GlassCard` (which renders the `BlurView`) is
   shared by Home/Library/Player, out of scope to modify, added a
   defensive fix scoped to `insights.tsx` only: wrap every `GlassCard` in
   its own `overflow: hidden` + matching `borderRadius` View
   (`cardClip`), forcing a second clip boundary outside the `BlurView`.
   Applied to all 3 card types since they all share the same radius and
   would likely hit the same bug.
2. **Mood Trend curve touching the card edges** — confirmed by comparing
   pixel positions against `insights-screenshot.png`: the reference has a
   small inset before the curve starts; `MoodTrendChart`'s first/last
   data point mapped exactly to the SVG viewBox's `x=0`/`x=600` (zero
   margin), unlike the vertical padding, which already existed. Added a
   matching `HORIZONTAL_PADDING` constant.
- `npx tsc --noEmit`: clean; re-verified on isolated web server (port
  8082): rounder-looking cards, curve now insets from both edges, no
  regression; dev server restarted fresh (`--clear`), confirmed via
  `curl`/`grep` that `cardClip`/`statCardClip` are present in the served
  bundle

## Fixed (continued): icon corruption regression + tab pill re-render bug
Two new bugs from on-device testing of the fix above, one in Insights and
one reopening the previously-deferred `_layout.tsx` pill issue:

1. **Stat card icons rendering corrupted/overlapping into the text**
   (Mindful Minutes' clock, Vs Last Month's arrow) — a regression from
   the `cardClip` wrapper fix. Root cause: `statGrid` used
   `flexDirection: 'row', flexWrap: 'wrap'` with `width: '47%'` cards —
   the exact same category of Android Yoga `flexWrap` unreliability
   already found twice this session (the consistency grid's collapsed
   cells). The corrupted icons were specifically the **second (wrapped)
   row** (`access-time`/`moving`, i.e. Mindful Minutes/Vs Last Month) —
   Yoga's wrap-position calculation for a wrapped row is the documented
   trouble spot, while the first row (before any wrap decision) rendered
   fine. Fixed the same way as the calendar grid: chunked `statCards`
   into explicit non-wrapping rows of `flex: 1` cells
   (`STAT_COLUMNS = 2`), removing `flexWrap` entirely rather than
   patching it. `cardClip`'s corner-radius fix from the round above is
   untouched — still wraps each `GlassCard` the same way, just inside a
   non-wrapping row now instead of a wrapped one.
2. **Reopened: active tab pill renders correctly on first load, becomes
   square after switching tabs, and stays square from then on** — new
   diagnostic info that disproved every earlier attempt's "static value"
   framing. Read `node_modules/expo-router/.../BottomTabItem.js` in full
   to check what's genuinely different between an initial-mount render
   and a later re-render. Root cause: `styles.tabContentActive` was
   conditionally **added to or removed from** the style array
   (`focused && styles.tabContentActive`) rather than always present, so
   `backgroundColor` didn't exist as a property at all until a tab
   transitioned to focused via re-render. Android has a known issue where
   a `backgroundColor` created by a later re-render (as opposed to
   present at initial mount) can produce a background drawable that
   doesn't pick up the View's `borderRadius`, rendering square instead of
   pill-shaped. This exactly explains why Home (mounts already-focused,
   gets the background from its very first render) always looked right,
   while every other tab (mounts unfocused, only gains the background via
   a later re-render once tapped) didn't, and why it never
   self-corrects afterward (the native background drawable, once created
   without the radius, isn't recreated by further re-renders). Fixed by
   always including `backgroundColor` as a property on `tabContent`,
   only ever changing its *value* (`transparent` vs. tinted) — never
   adding/removing it from the style array. Removed the now-unused
   `tabContentActive` style.
- `npx tsc --noEmit`: clean; re-verified on isolated web server: switched
  Home → Library via Playwright clicks, no regression (web never had this
  bug, so this doesn't prove the Android fix, only that nothing broke)
- Restarted the phone-facing dev server fresh (`--clear`), confirmed via
  `curl`/`grep` against the served Android bundle: `statRow` present,
  `tabContentActive` gone from actual code (one stale reference was only
  in a comment, since fixed)
- **Awaiting on-device confirmation of both**: (a) Insights stat cards
  with clean non-overlapping icons, (b) switching Home → Library keeps
  the active pill properly pill-shaped, not square

## Fixed (continued): real root cause of the "icon corruption" — tab bar
overlapping unscrolled content, not a stat-card bug at all
User reported the previous fix didn't help and proposed a better theory:
the floating tab bar's own icons/labels bleeding through the stat cards,
not a defect in the stat cards themselves — a "house-shape glyph fused
with 12h" is literally the Home tab's icon, and "jagged lines" the
Player tab's wave icon, both superimposed via the tab bar's translucent
`BlurView` background sitting directly over content that was still on
first-paint (never confirmed the previous flexWrap fix was wrong, but it
solved a different, real bug — not this one).

Verified with actual numbers instead of re-guessing: used Playwright to
measure real bounding boxes on the isolated web server (a 412x915
viewport, matching real Android layout math since this is pure
flexbox/padding, not one of the native-only Android quirks found
elsewhere this session). Confirmed: `useBottomTabBarHeight()` +
`scrollContent`'s `paddingBottom` calculation IS present and correct,
identical to Home/Library/Player — that half of the user's hypothesis
didn't hold. The other half did: on first paint (scrollY=0), the
"Mindful Minutes"/"Vs Last Month" row rendered at y=910-925 while the
tab bar's own footprint was y=839-915 — i.e. the row was measurably
*inside* the tab bar's floating overlay, and partially below the
viewport entirely. Same underlying class of issue as Home's original
scroll/first-paint investigation (a `position: absolute` floating tab
bar over content that hasn't been scrolled yet), not a z-index/paint-
order defect — no evidence z-index is actually wrong (content isn't
painting *through* the tab bar in a broken order; it's just physically
positioned behind the tab bar's translucent area on first load, which
is expected for a frosted-glass tab bar over unscrolled content).

Fixed the same way as Home's precedent: tightened first-paint vertical
spacing (topBar height, scrollContent's top padding/gap, both cards'
internal padding, Mood Trend chart height, stat card padding, stat row
gap, consistency grid gap) so the entire stat row sits above the tab
bar's footprint *before* any scrolling, instead of requiring the user to
scroll to see it clearly. No element was resized/removed, only spacing.
Iterated using the same Playwright bounding-box measurement after each
change until the stat row's card bottom cleared the tab bar top with a
~20px margin (was previously *inside* it by ~86px).
- `npx tsc --noEmit`: clean
- Re-verified via screenshot: all 4 stat cards now sit fully above the
  tab bar on first paint, no scrolling needed
- Restarted the phone-facing dev server fresh (`--clear`), confirmed via
  `curl`/`grep` against the served Android bundle that the new chart
  height (120) is present
- Note: exact clearance depends on the actual device's screen height,
  which wasn't measured (only a common 412x915 Android viewport was
  available for verification) — if an unusually short device still
  shows partial overlap, scrolling will fully resolve it per the same
  precedent already established for Home

## CONFIRMED on-device (2026-09-13): Insights fully verified, closing out this thread
Paired and connected the physical Android device over `adb` (wireless
debugging: `adb pair`, then `adb connect`) — this session's first
on-device screenshot captured directly (`adb exec-out screencap`) rather
than relying on the user to send one. Note: this device blocks
`adb shell input` (touch/key injection) and doesn't reliably give
`am start`-launched activities visual foreground focus — both look like
OEM-level wireless-ADB hardening (Xiaomi/HyperOS-based ROM) — so
navigation still requires the user to drive the phone by hand; only
screenshot capture is reliably automatable here.

With the user on the Insights screen (reached by switching tabs — the
exact scenario that used to break the pill), a real device screenshot
confirmed every open item from the last several fix rounds is actually
resolved:
- Mindful Minutes / Vs Last Month: clean, correct icons (clock,
  zigzag-arrow), no tab-bar bleed-through — the original reported bug
- All 4 stat cards: uniformly rounded corners (the `BlurView`
  clip-via-`overflow:hidden` bug is gone)
- No glow circles (removed, matches reference)
- Consistency grid: all 28 cells visible, correct 4x7 layout
- Mood Trend chart: curve has clear margin from both edges
- Active tab pill (Insights, reached via a tab switch): rounded corners,
  not square — the re-render `backgroundColor` bug fix holds up on
  device, not just on web

**Not yet re-fixed**: the pill's *width* is still wider than a snug
capsule — this is the separate, already-`deferred` cosmetic sizing issue
from earlier in the build (see "Deferred: tab bar pill-shape cosmetic
issue"), not a new regression, and remains intentionally out of scope
per that earlier decision.

Screenshot saved to the user's Desktop: `insights-ondevice-confirmed.png`.

**Insights screen (build order step 5) is now done** — Insights joins
Home/Library/Session Player as complete, committed-pending, and verified
on-device.

## Deferred again: pill-shape bug, deep root-cause investigation (2026-09-13)
New diagnostic info reopened this (see the "icon corruption" investigation
above): the active tab's pill renders correctly (rounded) on a genuinely
fresh app load, but the moment ANY tab switch happens, it permanently
becomes a hard rectangle — for every tab from then on, including ones
that were previously fine, and it never self-corrects. That "one-time,
global, irreversible, triggered by the first navigation" signature ruled
out every earlier per-tab style fix (all 4 previous rounds assumed a
static styling problem, not a navigation-triggered one).

Investigated with actual on-device ADB screenshots (this session gained
direct device access — see below) rather than more style-tweaking
guesses. Two concrete hypotheses tested and disproven:

1. **`detachInactiveScreens`** (react-native-screens, defaults to `true`
   on Android — physically detaches each tab's native Screen view from
   the window when it loses focus). Theory: the first tab switch is the
   first time any screen has ever been detached, a real window-level
   operation that could plausibly leave a lasting side effect on how the
   tab bar (a plain sibling View, not itself wrapped in a Screen)
   computes corner clipping afterward. **Tested**: set
   `detachInactiveScreens={false}` on `<Tabs>`, confirmed via `curl`/
   `grep` against the served bundle, did a clean Home->Library->Home
   round trip verified via ADB screenshots at each step (with a fully
   killed-and-relaunched Expo Go process, confirmed via PID change, to
   rule out stale JS/native state contaminating the test). Home still
   broke identically. **Disproven.** Reverted.
2. **`BlurView`** (the tab bar's `tabBarBackground`) as a required
   ingredient — theory: a second native compositing surface interacting
   with whatever the real mechanism is. **Tested**: swapped
   `tabBarBackground` for a plain solid-color `View`, confirmed in the
   served bundle, repeated the same clean fresh-process
   Home->Library->Home test via ADB. Library still broke identically
   with no BlurView present at all. **Disproven.** Reverted.

**Leading theory (not yet tested — no easy way to toggle it)**: read
`node_modules/expo-router/build/react-navigation/bottom-tabs/views/
{BottomTabBar,BottomTabView}.js` in full. Two things stand out:
- `BottomTabBar.js` renders the *entire* tab bar as `Animated.View`
  (not a plain `View`), with an always-present native-driven
  `transform: [{translateY: ...}]` bound to an `Animated.Value` (built
  for `tabBarHideOnKeyboard` support, which this app doesn't even use,
  but the animated wrapper and transform binding exist regardless).
- `BottomTabView.js` runs `Animated.parallel(...).start()` on a
  per-route `Animated.Value` (`tabAnims`) on every focus change, via
  `useNativeDriver: true` on Android — even under our default
  `animation: 'none'` preset (still an active, if 0-duration, native
  animated-node binding).
  
  Native-driven animated transforms are a known trigger for Android to
  promote a view to a hardware-accelerated compositing layer. Since the
  tab bar's `Animated.View` wraps all four of our pills as descendants,
  a layer promotion triggered by the *first* real animated-value change
  (i.e. the first actual tab switch, not the no-op mount-time
  animation-to-the-same-value) that doesn't cleanly revert afterward
  would explain every observed symptom: correct on fresh mount, broken
  after the first switch, broken permanently, broken for every tab
  including ones never directly switched to (they're all siblings under
  the same promoted layer).

**Why this isn't easily fixable right now**: unlike
`detachInactiveScreens`, this isn't exposed as a configurable prop —
it's load-bearing internal implementation inside expo-router's vendored
copy of `@react-navigation/bottom-tabs`. Actually testing/fixing it
would require either:
- `patch-package` to modify the vendored `BottomTabBar.js`/
  `BottomTabView.js` directly (strips or forces `useNativeDriver: false`
  on these animations) — directly tests the theory, but patches
  third-party code and is fragile across expo-router upgrades (a version
  bump can silently stop the patch from applying, or need rebasing
  against a rewritten internal file)
- Replacing expo-router's `<Tabs>` with a fully custom tab
  implementation (manual screen switching + our own tab bar, no
  `@react-navigation/bottom-tabs` machinery at all) — a real
  architectural rewrite, not a bug fix, and out of proportion to a
  cosmetic issue

Both options were presented to the user; **decision: defer again**,
this time with this full root-cause writeup so a future session doesn't
have to re-derive it from scratch. Also worth noting: since this lives
in expo-router's vendored internals rather than our own code, a future
expo-router/react-navigation version that changes this internal
implementation (e.g. removes the native-driven transform, or changes how
`tabAnims` binds) could resolve this naturally on its own without any
action from us — worth a quick recheck after any future expo-router
upgrade.

Tab bar's active-pill styling (`app/(tabs)/_layout.tsx`'s `tabContent`)
is unchanged from before this investigation — both diagnostic changes
(`detachInactiveScreens`, the `BlurView` swap) were fully reverted and
confirmed clean (`grep` for both shows only historical comments, no
active diagnostic code left in place).

## New capability this session: direct on-device ADB access
Paired (`adb pair`) and connected (`adb connect`) the user's physical
Android device over wireless debugging. This let screenshots be pulled
directly (`adb exec-out screencap`) instead of waiting on the user to
send files — used throughout the Insights confirmation and this pill
investigation. Two real constraints discovered on this specific device
(likely OEM/HyperOS-level wireless-ADB hardening, not a general Android
limitation):
- `adb shell input` (touch/key injection) throws
  `SecurityException: Injecting to another application requires
  INJECT_EVENTS permission` — can't simulate taps/back-presses remotely
- `am start`-launched activities don't reliably take visual foreground
  focus (confirmed via `dumpsys activity activities` showing the
  intended activity as "resumed" while the screenshot still showed a
  different app) — can't reliably drive navigation remotely either

Net effect: screenshots are directly automatable; navigation still
requires the user to physically drive the phone. `am force-stop` (used
to guarantee clean process kills for this investigation's rigor) and
`pidof`/`dumpsys` (used to verify a real process restart happened, by
PID) both worked fine — only input injection and window-focus-stealing
are restricted.

## Confirmed (user question, not a bug): Home's "Your Snapshot" staying
static after completing a session
This is expected at the current build stage, not a bug. `src/data/
sessions.ts`/Home's snapshot cards (`Calm`/`12 sessions`/`5 days`) are
all hardcoded dummy data per CLAUDE.md's build order — there is no
backend yet (`breathing-app-api`, build order step 8) and no real
`POST /api/checkin` endpoint for a completed session to actually write
to (Session Player's Done button already stubs this exact call as a
`// TODO: POST /api/checkin...` comment, per architecture.md's contract,
documented when Session Player was built). Real updates to this data
require: the backend existing, the checkin endpoint wired up, and Home
reading real data instead of the dummy import — none of which are in
scope until later build-order steps. Nothing to fix here now.

## Done: thumbnail art pass — BreathOrb and SessionThumbnail (real
illustrations, replacing flat-gradient placeholders)
Fully additive change per instruction: only `src/components/BreathOrb.tsx`
and `src/components/SessionThumbnail.tsx` were touched — `home.tsx`,
`library.tsx`, and every other screen/component are untouched (confirmed
via `git status` before and after).

**Investigated first, before writing any code**: both `home-code.html`
and `library-code.html`'s illustrations are hotlinked from
`lh3.googleusercontent.com/aida-public/...` — Google's AI Studio/"Stitch"
design-tool preview-image host, not a stable asset this project owns or
has a confirmed production license for (these read as ephemeral
design-session URLs). Flagged this to the user rather than silently
downloading and bundling them. Presented 3 options
(custom local SVG / download the hotlinked images / just refine the
existing gradients); **user chose custom local SVG illustrations**.

Built with `react-native-svg` — already installed for Insights'
`MoodTrendChart`, so no new dependency:
- **`BreathOrb`**: rebuilt off DESIGN.md's own spec for this element
  ("a large, central sphere that pulses with a soft glow", "soft,
  diffused radial gradients", "circular or soft-edged geometry") rather
  than trying to replicate the mockup's photo-illustration. A layered
  SVG sphere (soft blurred ambient-glow circle behind, a radial-gradient
  core for 3D depth, a small glossy highlight) inside the same pulsing
  `Animated.View` wrapper as before (animation logic unchanged).
- **`SessionThumbnail`**: previously a single flat gradient regardless of
  `pattern` — didn't visually distinguish any of the 6 sessions from
  each other. Now draws the actual named pattern as an SVG mark over a
  radial-gradient backdrop, matching each pattern's own `data-alt`
  description from the mockup: `rings` (concentric circles), `wave`
  (sine-wave path), `starburst` (radiating rays), `dot-grid` (3x3 dot
  grid), `spiral` (computed spiral path), `bloom` (overlapping soft
  petal circles) — all confirmed exported from `react-native-svg`'s
  root before use (`Circle`, `Line`, `Path`, `RadialGradient`, `Rect`,
  `Filter`, `FeGaussianBlur`, `G`).
- `npx tsc --noEmit`: clean
- Verified on the isolated web server (port 8082): both components
  render correctly, all 6 session patterns visually distinct
- Restarted the phone-facing dev server fresh (`--clear`), confirmed via
  `curl`/`grep` against the served Android bundle that the new SVG
  gradient/pattern ids are present
- **Confirmed on-device** (via direct ADB screenshots, force-stopping
  Expo Go between checks for clean reconnects): `BreathOrb` renders as a
  soft glossy gradient sphere with a highlight, matching the web
  preview; all 6 `SessionThumbnail` patterns render crisply and
  correctly on native Android — `react-native-svg`'s gradients and the
  small `feGaussianBlur` glow filter both work natively here, no
  web/native rendering gap this time.
- **Noted, not fixed** (out of scope for this task): Library's last
  session card ("Box Breathing") was seen overlapping the tab bar again
  in an on-device screenshot during this check, in the same way as an
  earlier-flagged, not-yet-revisited observation. Not investigated
  further here since it wasn't what this task was about — worth a
  dedicated look later, similar to the Home/Insights first-paint
  spacing fixes already done this session.

## Resolved: pill-shape bug closed by removing the pill (2026-09-14)
User made the call to stop chasing the Android hardware-layer-promotion
theory (see "Deferred again: pill-shape bug, deep root-cause
investigation" above — unfixable without patching expo-router's vendored
third-party code) and instead remove the pill/background shape entirely:
LinkedIn-style tab bar — active tab shown via a filled icon + primary
color, inactive tabs via an outlined icon + muted color, no background
box on any tab. Scope: `app/(tabs)/_layout.tsx` only, per instruction;
no other screen files touched (confirmed via `git diff --stat`).

- Checked all 3 Stitch HTML references (home-code.html, library-code.html,
  insights-code.html) before implementing: all three already encode this
  exact convention independently of the pill — active tab = Material
  Symbols `FILL 1` (solid), inactive = default `FILL 0` (outlined). The
  pill was always a separate layer on top of that convention, not the
  convention itself.
- `@expo/vector-icons`'s bundled `MaterialIcons` is a static, filled-only
  font with no outline counterpart or FILL-axis support. Swapped to
  `Ionicons` (already bundled in the same `@expo/vector-icons` package —
  no new dependency), which ships real outline/filled name pairs.
- New icon mapping (active / inactive): Home `home`/`home-outline`;
  Library `grid`/`grid-outline` (same "grid of items" meaning as the
  original `grid_view`); Player `play-circle`/`play-circle-outline`
  (Ionicons has no wind/air/waves icon; deliberately avoided
  pulse/fitness-style glyphs so the icon doesn't visually suggest real
  biometric data, per CLAUDE.md, and avoided reusing `leaf`/`moon`/`zap`/
  `heart`, the locked per-session badge icons used elsewhere); Insights
  `stats-chart`/`stats-chart-outline`.
- Removed `tabContent`'s pill styling (`alignSelf`, `flexGrow`/
  `flexShrink`, `paddingHorizontal`/`paddingVertical`, `borderRadius`) and
  the now-unused `tabContentActive` style entirely — `TabButton` now just
  swaps icon name + tint color on `focused`, no background layer at all.
- Flagged, not yet hit: same residual risk class as the earlier
  MaterialIcons codepoint bug — Expo Go bundles its own copy of icon
  fonts tied to its SDK version, so a glyph name present in the installed
  npm glyphmap can still fail to render on-device. Needs to stay on watch
  the same way the old MaterialIcons names did.
- `npx tsc --noEmit`: clean
- Verified on an isolated web server (Playwright): Home renders
  filled/primary icon+label, other 3 tabs outlined/muted, no pill;
  switching to Library flips both correctly with no pill ever appearing
- Restarted the phone-facing dev server fresh (`--clear`), confirmed via
  `curl`+`grep` against the actual served Android bundle that the new
  icon names are present and `tabContentActive` is fully gone (0 matches)
- **Confirmed on-device** via ADB screenshot: Home shows filled/primary
  icon+label, other tabs outlined/muted, no pill/box anywhere — the
  multi-session pill bug is closed
- Also measured the rendered icon/label pixel size directly off the
  on-device screenshot (color-threshold bounding box, not just style
  values) against the device's actual density (440dpi/2.75x, `font_scale`
  confirmed 1.0 earlier this session): icon ink ~62×57px and label
  cap-height ~24px both land exactly where a genuine 24dp icon / 12sp
  label should, given normal icon-font/type internal padding — confirms
  the earlier "looks bigger than Spotify" impression was never about this
  tab bar's icon/label size (already traced to the 84dp bar height vs.
  Material 3's 80dp, and DESIGN.md's larger-than-Material headline/display
  type scale elsewhere in the app)

**Next**: none outstanding for the tab bar specifically. Broader backlog
unchanged — see "Known visual polish backlog" above (Home's `onTouchEnd`
button) and the general on-device confirmation items still pending from
earlier sessions.

## Fixed: Home's Begin button (onTouchEnd → Pressable/onPress) (2026-09-15)
Per the "Known visual polish backlog" item flagged during Session Player
integration testing: `app/(tabs)/home.tsx`'s Begin button was a plain
`<View onTouchEnd={...}>`, not wired into React Native's gesture-responder
system the way every other interactive element in the app is —
plausible risk of misfiring on finger-drift or during a scroll gesture,
and it skipped Pressable's built-in press feedback.

Fixed by swapping to `<Pressable onPress={...}>` with the same
`beginButton`/`beginButtonText` styles unchanged (no visual change
intended or observed). Scope: `app/(tabs)/home.tsx` only.

Verified on an isolated web server (port 8083, this session's own
instance — no phone-testing server was running to avoid disturbing):
- `npx tsc --noEmit`: clean
- Screenshot before/after: pixel-identical layout, confirming the
  swap introduced no visual regression
- Clicked the button via `playwright-cli` and confirmed the URL
  navigated to `/session-player?sessionId=deep-exhale`, same as before
- **Not yet re-confirmed on-device** — no Android device was paired via
  ADB this session (wireless pairing from earlier sessions doesn't
  persist; `adb devices` returned empty). `Pressable`/`onPress` is the
  same pattern already proven working on-device everywhere else in this
  app (Library, Session Player, etc.), so this is low-risk, but per this
  project's standing rule, not being called fully done until confirmed
  on the user's phone.

## Investigated: Library's "Box Breathing" card overlapping the tab bar (2026-09-15)
Per the earlier flagged-but-not-investigated on-device observation (see
"thumbnail art pass" above). Used `playwright-cli` on an isolated web
server (412×915 viewport, matching real Android layout math — this is
pure flexbox/padding, the same category of measurement this project has
already relied on for Android-equivalent conclusions elsewhere, not one
of the native-only rendering quirks found for other bugs this session).

Measured the actual bounding boxes of the "Box Breathing" card
(`GlassCard` in the session grid) against the tab bar's real footprint,
at two scroll positions:
- **At `scrollTop=0` (first paint, nothing scrolled yet)**: card
  `top=860, bottom=940` vs. tab bar `top=843` — the card is entirely
  inside/behind the tab bar's floating overlay, and its bottom edge
  (940) sits past the viewport's own bottom (915), i.e. fully offscreen.
  Screenshot confirms only 5 of 6 session cards are visible pre-scroll.
- **At `scrollTop=138` (`maxScrollY`, i.e. genuinely fully scrolled)**:
  card `top=722, bottom=802` vs. tab bar `top=843` — a clean 41px of
  clearance, no overlap. Screenshot confirms the card renders fully
  above the tab bar with visible margin.

**Conclusion: same root cause as Home's already-resolved "mood card
overlapping the tab bar" bug (see "Overlap bug: RESOLVED" above), not a
new or different one.** It's the same floating (`position: absolute`)
tab bar sitting over content that hasn't been scrolled yet — expected
behavior for this UI pattern, not a padding/layout defect. The existing
`useBottomTabBarHeight() + spacing.base * 2` bottom padding (already
proven correct on-device for Home/Library/Player/Insights) is doing its
job; scrolling reveals the last card cleanly.

**Why this doesn't get Home's fix (tightening first-paint spacing so
content fits without scrolling)**: Home's and Insights' content is a
fixed, short set of dashboard elements that was always meant to fit on
one screen — tightening spacing made that true. Library's session grid
is an inherently scrollable, growing list (more sessions will be added
over time per PRD.md); a last item requiring a scroll to reach is
normal, expected behavior for a list under a floating tab bar (the same
pattern as Instagram's feed, Spotify's library, etc.), not a bug to
engineer away. No code change made. Flagging for the user to confirm the
original on-device screenshot was taken before scrolling all the way
down, matching this same misread pattern from Home's investigation
history.

## Tab icon updates (2026-09-15)
Two changes to `app/(tabs)/_layout.tsx`'s tab bar, per explicit request.
Both use Ionicons (not MaterialIcons) to preserve the active/inactive
fill-swap convention already established for every other tab — see this
file's own comment block for why MaterialIcons was dropped for tab icons
in the first place (filled-only, no outline counterpart).

- **Insights**: `stats-chart`/`stats-chart-outline` (bar-chart glyph) →
  `trending-up`/`trending-up-outline` (line-chart-with-arrowhead glyph,
  the standard analytics/trend convention, matching the "Vs Last Month"
  stat card's own icon on that same screen)
- **Library**: `grid`/`grid-outline` → `library`/`library-outline`
  (stacked-books glyph). Before implementing, checked MaterialIcons
  options for "collection of sessions" the user asked to see
  (`apps`, `auto-stories`, `grid-on`, `collections-bookmark` were the
  candidates within this project's own established "confirmed-good"
  Android codepoint band, `0xe1xx`–`0xe6xx`; `grid-view`/`bookmark`/
  `library-books`/`list`/`menu-book` fall outside it and were flagged as
  higher-risk) — presented as concepts via Ionicons' matching outline
  pairs instead of literally switching the icon font for one tab, to
  avoid reintroducing the single-state-icon inconsistency the earlier
  pill-removal work deliberately fixed. User picked "Library" (stacked
  books) as the closest literal match.

Verified on the isolated web server (port 8083): screenshotted both
tabs — Insights shows a zigzag trending-up icon, Library shows an open
book — both switch fill/color correctly on focus, no pill/background
reintroduced. `npx tsc --noEmit`: clean.

**Not yet confirmed on-device** — same standing residual risk as every
earlier icon swap this project has made: Expo Go bundles its own copy of
these fonts tied to its SDK version, so a glyph name present in the
installed npm glyphmap can still fail to render on-device even when
picked from the "confirmed-good" band (that band is itself empirical,
not a guarantee, and was derived from MaterialIcons codepoints — it
doesn't directly apply to Ionicons, a separate font). `trending-up` and
`library` are both new Ionicons choices with no on-device track record
yet.

## Session note: no ADB device paired this session (2026-09-15)
`adb devices` (via the platform-tools install at
`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`) returned no
attached devices — the wireless pairing from earlier sessions didn't
persist (expected; wireless ADB pairing is generally per-network-session
on most devices). All three fixes above were verified as thoroughly as
possible on an isolated web server instead, with explicit notes on what
still needs on-device confirmation. If the user re-pairs
(`adb pair <ip>:<port>`, then `adb connect <ip>:<port>`), screenshots can
resume being pulled directly as in prior sessions.

## Done: Onboarding (3 screens, build order step 6) (2026-09-16)
Built `app/onboarding/{welcome,how-it-works,build-habit}.tsx` per
architecture.md's `app/onboarding/` folder placeholder and PRD.md's "3
screens, first launch only" spec. Did not touch Home, Library, Session
Player, Insights, the Player empty state, or `app/(tabs)/_layout.tsx` —
confirmed via `git status`/`git diff --stat` before and after (additive
plus `app/index.tsx`, which now gates first launch into onboarding instead
of always redirecting to `/home`).

**Reference files actually used** (read in full before writing any code,
per this session's explicit instruction):
- `assets/design-reference/onboarding-1-welcome-code.html` +
  `onboarding-1-welcome-screenshot.png`
- `assets/design-reference/onboarding-2-how-it-works-code.html` +
  `onboarding-2-how-it-works-screenshot.png`
- `assets/design-reference/onboarding-3-build-habit-code.html` +
  `onboarding-3-build-habit-screenshot.png`
- `assets/design-reference/DESIGN.md` (re-read for this session; no
  onboarding-specific tokens beyond what `src/theme/tokens.ts` already has)
- No separate `design.md` exists — `DESIGN.md` (capitalized) is the only
  design-spec file in the folder and is the same one `tokens.ts` was
  already built from; confirmed by listing the folder before writing code.

New files: `src/utils/onboarding.ts` (AsyncStorage-backed
`getOnboardingComplete`/`setOnboardingComplete`), `app/onboarding/
welcome.tsx`, `app/onboarding/how-it-works.tsx`, `app/onboarding/
build-habit.tsx`. Modified: `app/index.tsx` (was an unconditional
`<Redirect href="/home" />`; now checks the onboarding flag and redirects
to `/home` or `/onboarding/welcome`). Installed
`@react-native-async-storage/async-storage` (`npx expo install ... --
--legacy-peer-deps`, consistent with this project's established need for
that flag) — architecture.md's "Auth (v1)" section already anticipated
AsyncStorage as this app's local-persistence mechanism, so this isn't a
new architectural direction.

### PRD.md-locked fix applied
"How it Works" screen's "Pick a session" step description replaced per
PRD.md's explicit copy override: the reference's "Choose from guided
breaths, body scans, or nature sounds" → "Choose a guided breathing
session matched to how you're feeling."

### Flagged deviations from the reference (not silent)
1. **Welcome + Build-the-Habit illustrations are hotlinked, unowned
   images** (same category of issue as Home's `BreathOrb`/Library's
   `SessionThumbnail`, already resolved that way earlier in this project):
   - Screen 1's orb image → reused the existing `BreathOrb` component
     as-is (no new component needed; already built off DESIGN.md's own
     "large, central sphere that pulses with a soft glow" spec).
   - Screen 3's illustration is more than just unowned — it's a mockup of
     a mini session card showing **fake vital-sign readouts ("64 bpm",
     "98%", "Low" stress)**. CLAUDE.md's house rules explicitly forbid
     reintroducing real/simulated biometric data (heart rate, blood
     oxygen, stress %). Built a streak/flame illustration instead (matches
     the headline's daily-habit theme and reuses Home's existing streak
     flame color) inside the same circular glass-panel + float-animation
     treatment the reference specifies.
2. **Screen 3 button copy**: the actual reference/screenshot has "Get
   Started" (primary) + "Enable reminders" (secondary text link) — there
   is no separate "Skip for now" button on this screen (only the shared
   header "Skip", present on screens 1-2, which screen 3's own reference
   omits). Per this session's instruction that both of this screen's
   actions must end in Home, both "Get Started" and "Enable Reminders" do
   — "Enable Reminders" additionally shows a dummy permission-style Alert
   first (real `expo-notifications` wiring is build order step 10, not
   done here).
3. **Non-token gradient hex**: screen 2's "Next" button CSS
   (`linear-gradient(135deg, #7189f6, #00d2ff)`) uses `#00d2ff`, a color
   with no corresponding DESIGN.md frontmatter token — the HTML's own
   inline comment admits this ("Indigo to Cyan approximation..."). Per
   architecture.md's "Colors — source of truth" rule (frontmatter tokens
   only), substituted the closest actual token, `tertiary` (#a6ccde),
   instead of hardcoding the non-token hex. Screens 1 and 3's button
   gradients matched their CSS exactly with real tokens (no substitution
   needed): `primary`→`primaryContainer` and `primaryContainer`→`tertiary`
   respectively.
4. **Background treatment**: approximated each screen's CSS
   `radial-gradient(...)` body background with the same single/double
   soft-glow-circle pattern already established on Home/Library/Insights,
   rather than a literal radial gradient (`expo-linear-gradient` has no
   radial mode; consistent with the rest of the app's existing
   approximation, not a new technique).
5. **Screen 2 needed a `ScrollView`, unlike the other two**: the reference
   HTML is an unconstrained-height web page; laid out at a real phone
   viewport (390×844), its headline + body + 3 step cards + Next button
   overflow one screen. Wrapped the content in a `ScrollView` (same
   pattern as Home/Library/Insights) — confirmed via Playwright that all 3
   cards and the Next button are reachable by scrolling, with no content
   irretrievably cut off.

### Verified interactively (web, isolated port-8084 server, phone server
left alone)
`npx tsc --noEmit`: clean throughout. Via `playwright-cli` at a 390×844
viewport: screenshotted all 3 screens against their reference screenshots;
clicked through the full forward flow (Welcome → Next → How it Works →
NEXT → Build the Habit); clicked Skip (→ `/home`); clicked Get Started (→
`/home`); confirmed the onboarding-complete flag persists (`localStorage`
on web) so reloading `/` redirects straight to `/home` on a "second
launch," and that clearing it redirects back to `/onboarding/welcome` on
a "first launch." Noted `Alert.alert` is a no-op on `react-native-web`
(same known limitation already documented for Session Player's exit
dialog) — "Enable Reminders" couldn't be verified past the tap on web,
only on-device.

### Confirmed on-device (2026-09-16)
Paired fresh via wireless ADB this session (`adb pair`/`adb connect`,
same procedure as prior sessions — pairing doesn't persist across
sessions). Ran a phone-facing dev server (port 8085) and drove the phone
by hand (per this project's established ADB constraints: screenshots are
directly automatable via `adb exec-out screencap`, but touch/key
injection and remote app-focus are blocked on this specific device —
OEM/HyperOS-level wireless-ADB hardening, documented earlier this
project). Confirmed via real on-device screenshots after each tap:
- All 3 screens render correctly: gradient headlines, `BreathOrb`, all
  icons (`local-florist`, `arrow-forward`, `chevron-right`,
  `format-list-bulleted`, `sync`, `moving`, `local-fire-department`),
  glass cards, gradient buttons — no wrong-glyph or clipping regressions
- Forward flow: Welcome → Next → How it Works (scrolled, all 3 cards +
  copy-override text visible) → NEXT → Build the Habit
- "Enable Reminders" → real native `Alert.alert` dialog appears (title,
  body, "Don't Allow"/"Allow") — confirmed this is NOT a no-op on native,
  unlike the web preview → tapping "Allow" → `/home`
- "Skip" (tested directly from Welcome) → `/home`
- **Persistence**: force-stopped Expo Go and relaunched from scratch after
  completing onboarding — landed directly on Home, onboarding did not
  show again

### Bug found + fixed during on-device verification: AsyncStorage key
collision
First on-device attempt landed straight on Home without ever showing
Welcome, on a device that had never run this project's onboarding code
before. Added a temporary on-screen debug readout (`app/index.tsx`,
removed after) of the raw stored value — it read `"true"` already, before
any onboarding screen had been tapped. Root cause: the key was the
generic `onboarding_complete`, and Expo Go's AsyncStorage is not reliably
sandboxed per anonymous/local-dev-URL project — an unrelated Expo Go
project previously tested on the same phone most likely used the same
generic key name, and its value leaked through. Fixed by namespacing the
key (`src/utils/onboarding.ts`): `breathe_onboarding_complete_v1`. Not
purely a diagnostic-session fluke — this is a real collision class worth
guarding against for any future AsyncStorage key in this app, so
generic/common key names should be avoided project-wide going forward.

### Not yet done (explicitly out of scope for this step, per instruction)
- Real `expo-notifications` permission request/scheduling — "Enable
  Reminders" is a dummy `Alert.alert` placeholder only, per instruction
  (build order step 10)
- No settings/reminder-time persistence yet (Settings screen doesn't
  exist — build order step 7, needs a design pass first per CLAUDE.md)

## Session — 2026-09-17: session description copy pass
Additive-only, per instruction — did not touch Home, Library, Session
Player's structure, Insights, Onboarding, or the tab bar. Only edit:
`src/data/sessions.ts`.

Deep Exhale's description (from session-player-code.html) explains its
technique + the physiological reason it helps ("Designed to activate your
parasympathetic nervous system, lowering your heart rate and melting away
residual tension."). The other 5 sessions previously had placeholder
descriptions (flagged as such in this file's "Known deviations" and in
the file's own header comment since 2026-09-12) that didn't follow that
pattern — some named the technique, none explained the physiological
"why." Rewrote all 5 to match Deep Exhale's tone: one sentence naming the
session's actual `phaseConfig` technique (extended-exhale for Morning
Reset/Calm Focus/Stress Relief/Wind Down; equal-count box breathing for
Box Breathing) and the nervous-system-level reason it suits that
session's specific mood/context:
- **Morning Reset** (Sleep, 4-4-8): grogginess → gentle vs. jolting wake
- **Calm Focus** (Calm, 4-4-8): racing mind → sustained focus
- **Stress Relief** (Energy, 4-4-8): acute stress → fast parasympathetic reset
- **Wind Down** (Sleep, 4-4-8): arousal → safe-to-rest signal before sleep
- **Box Breathing** (Recovery, 4-4-4): erratic heart rate → autonomic balance
  after strain

These are still written copy, not Stitch-sourced (no Stitch export gives
any of the other 5 sessions description text) — updated the file's own
header comment to say so plainly rather than leaving the old "placeholder"
language, which would now overstate how unfinished this text is.
`heart rate` appears only as descriptive copy (matching Deep Exhale's
existing precedent), not as reintroduced biometric tracking — no actual
heart-rate data is read, stored, or displayed anywhere in the app, so this
doesn't conflict with CLAUDE.md's no-real-biometrics rule.

`npx tsc --noEmit`: clean. Not a visual change (copy-only, inside an
existing data file — no screen renders new UI), so no screenshot
verification was needed; confirmed by reading the diffed file directly
above instead of just asserting it.

### Next
- Settings screen (build order step 7) — still needs a design pass first,
  per CLAUDE.md

## Session — 2026-09-17: Library session description rewrite (content-only)
User-directed content change, scoped strictly to `src/data/sessions.ts`'s
6 `description:` fields — no other file touched. Read PROGRESS.md and
CLAUDE.md in full first per instruction; reported the full session
name/ID inventory (data file, comments in `library.tsx`/
`session-player.tsx`/`onboarding/build-habit.tsx`, `PRD.md`'s catalog
table, architecture.md's LOCKED session-mapping table, the Stitch mockup
HTML exports) and waited for explicit confirmation before editing
anything, per instruction.

Flagged before proceeding: the requested renames used identical titles
to what was already in `sessions.ts` (Deep Exhale/Morning Reset/Calm
Focus/Stress Relief/Wind Down/Box Breathing, same order) — only the
description copy differed. User confirmed: titles unchanged, only the 6
`description` values update, and confirmed scope as `sessions.ts` only
(not `PRD.md`, `architecture.md`, the flagged comment references, or the
design-reference HTML files, since none of those needed to change for
this).

Replaced the "why this helps" physiological-framing copy from the prior
session (2026-09-17, see above) with simpler, user-provided copy for all
6 sessions:
- **Deep Exhale**: "Slow, deep breathing to help you release tension and feel more relaxed."
- **Morning Reset**: "Gentle breathing to help shake off morning grogginess and ease into your day."
- **Calm Focus**: "Slow, steady breathing to quiet a busy mind and help you focus."
- **Stress Relief**: "A quick breathing reset to help you feel calmer when stress hits."
- **Wind Down**: "Slow breathing to help you relax and get ready for sleep."
- **Box Breathing**: "A steady breathing rhythm to help you reset and regain a sense of calm."

`id`/`title`/`category`/`durationSec`/`phaseConfig`/`badge`/`pattern`
fields left byte-for-byte unchanged for all 6 sessions. Confirmed via
`git status`/`git diff` after editing that only `src/data/sessions.ts`
shows this task's changes — `PRD.md`, `architecture.md`, `library.tsx`,
`session-player.tsx`, `onboarding/build-habit.tsx`, and the
design-reference HTML files are untouched, and showed the actual diff to
the user rather than just asserting it, per CLAUDE.md's working-style
rule.

## Session — 2026-09-17: breathing phase pattern changed to 4-phase BREATHE IN / HOLD / BREATHE OUT / REST
User-directed content change: all 6 sessions now use one uniform 4-4-8-4
pattern, replacing each session's prior 3-phase `phaseConfig`. Read
PROGRESS.md and CLAUDE.md in full first per instruction. Reported each
session's current phase structure, confirmed `phaseConfig` is stored
per-session (not shared — 6 separate inline objects, 5 already identical,
Box Breathing's `exhale` differed), flagged that label/instruction text
was hardcoded separately in `session-player.tsx` (not in the data file at
all), and noted the new 20s cycle length doesn't change any session's
`durationSec` (the active phase already ends purely on elapsed time, not
cycle count). Waited for confirmation before editing anything, per
instruction.

**Flagged and stopped before proceeding** (per the task's own hard rule
to ask rather than touch anything outside scope): the requested pattern
needs a 4th phase architecture.md's `Session.phaseConfig` interface
(line 78) doesn't have — it documents a 3-field `{ inhale, hold, exhale }`
shape, and lines 163–168 document the exact current label convention
("Inhale...", "Hold for 4 seconds") as part of the Session Player section
`session-player.tsx`'s own comments call "(explicit — do not deviate)".
Implementing the new pattern as specified genuinely requires changing the
shared type and the Session Player's label/cycling logic, not just the
data file. Presented 3 options; user chose to proceed as specified and
flag the deviation here rather than silently diverging or blocking on an
architecture.md rewrite first.

**Changes made** (4 files, all directly required — confirmed via
`git status` that no other screen/component/navigation file was touched):
- `src/types/models.ts` — added `rest: number` to `Session.phaseConfig`
  (was 3 fields, now 4)
- `src/data/sessions.ts` — all 6 sessions' `phaseConfig` now
  `{ inhale: 4, hold: 4, exhale: 8, rest: 4 }` (Box Breathing's `exhale`
  also changed 4→8, since the new pattern is uniform across all
  sessions per instruction); updated the file's own header comment to
  describe the new pattern and flag the architecture.md deviation
- `app/session-player.tsx` — `BreathSubPhase` extended from 3 states to
  4 (`inhale`/`hold`/`exhale`/`rest`) with a new cycle map
  (inhale→hold→exhale→rest→inhale); `phaseLabel` now reads
  `BREATHE IN`/`HOLD`/`BREATHE OUT`/`REST`; `phaseSubLabel` now reads the
  exact instruction copy ("Breathe in slowly for N seconds", "Hold
  gently for N seconds", "Breathe out slowly for N seconds", "Stay
  relaxed for N seconds"), interpolated from `phaseConfig` the same way
  the file already worked; passes the new `restSec` prop through to
  `BreathingRing`
- `src/components/BreathingRing.tsx` — added a `restSec` prop and a
  matching `Animated.delay(restSec * 1000)` after the exhale animation,
  so the ring's visual pulse loop stays 20s (matching the new label
  cycle) instead of looping 4s early and silently drifting out of sync
  with the on-screen phase text

`titles`/`descriptions`/`badge`/`category`/`durationSec`/`pattern`
(visual rings/wave/etc.) fields left byte-for-byte unchanged for all 6
sessions, as instructed. `npx tsc --noEmit`: clean. Showed the full diff
to the user rather than just asserting it, per CLAUDE.md's working-style
rule.

**Known deviation from architecture.md — not yet resolved there**:
architecture.md:78's `Session.phaseConfig` interface and lines 163–168's
documented phase-label copy convention are now out of date against the
actual app behavior. architecture.md itself was intentionally **not**
edited this session (out of scope for this task) — a future session
should either update architecture.md to match (4-field `phaseConfig`,
new label convention) or revisit this decision, so the two don't stay
silently out of sync indefinitely.

## Session — 2026-09-19: session title/category changes (data-only) (Part 1)
User-directed content change, scoped strictly to `src/data/sessions.ts` per
instruction (additive/data-only) plus the required PRD.md doc updates —
no screen/component file touched (confirmed via `git status`/`git diff
--stat` after editing: only `src/data/sessions.ts` and `PRD.md` changed).

1. **"Calm Focus" → "Calm and Focus"** — title only; `id` (`calm-focus`),
   `description`, `durationSec`, `badge` (`Leaf`), `pattern` (`starburst`)
   all left byte-for-byte unchanged.
2. **Morning Reset**: category `Sleep` → `Energy`.
3. **Stress Relief**: category `Energy` → `Calm`.

**Recalculated real category counts** (Library's tab counts are computed
live from `sessions.ts` via `library.tsx:50-51` — `sessions.filter((s) =>
s.category === category).length` — so no code change was needed there,
only confirmed the computation still reads correctly against the new
data): **Calm 3** (Deep Exhale, Calm and Focus, Stress Relief), **Sleep 1**
(Wind Down), **Energy 1** (Morning Reset), **Recovery 1** (Box Breathing).
Updated PRD.md's category-count example line and its session catalog table
to match (`Calm Focus`→`Calm and Focus`, Morning Reset→Energy, Stress
Relief→Calm), with an inline note explaining the change, same pattern as
the earlier Deep-Exhale-duration doc update.

**Flagged, not silently resolved**: this makes `sessions.ts`/PRD.md diverge
from architecture.md's LOCKED "Library session mapping" table (lines
103-105), which still lists Morning Reset as Sleep, Stress Relief as
Energy, and the session as "Calm Focus" — CLAUDE.md's house rule against
*re-deriving* this table doesn't apply here (this was an explicit,
directed category/title change, not a guess), but architecture.md itself
was out of scope for this task and was intentionally left unedited, so it's
now stale on these 3 fields — same handling precedent as the phaseConfig
deviation flagged 2026-09-17. A future session should either update
architecture.md's locked table to match or revisit this decision.

Also flagged, not fixed: `badge`/`pattern` were left untouched per
instruction (data-only, additive scope), so Morning Reset now carries
`badge: 'Moon'` (the old Sleep-category icon) under its new Energy
category, and Stress Relief carries `badge: 'Zap'` (the old Energy icon)
under its new Calm category — both now inconsistent with the
badge↔category convention every other session in the catalog still follows
(Leaf/Calm, Moon/Sleep, Zap/Energy, Heart/Recovery).

`npx tsc --noEmit`: clean. Full diff shown to the user above rather than
just asserted, per CLAUDE.md's working-style rule.

## Tab-bar-overlap investigation: CLOSED (2026-09-19, policy decision)
Read-only diagnostic audit performed first (no code changes), covering
every previous fix attempt for this recurring bug across this file's
history, whether Home/Library/Player/Insights share the same
padding/spacing mechanism, and whether this is genuinely one root cause
or several. Findings, then the user's resulting decision:

**Root cause (confirmed, not re-guessed)**: `app/(tabs)/_layout.tsx`'s
tab bar is a real floating overlay (`tabBarStyle.position: 'absolute'`,
height 84, over a `BlurView`), and all 4 screens already use the
*identical* correct bottom-padding mechanism
(`useBottomTabBarHeight() + spacing.base * 2` — verified byte-identical
across Home/Library/Player/Insights, so there was never a drift in this
part of the mechanism). Padding only affects how far content *can*
scroll, never what's visible at `scrollY=0` — so any screen taller than
one viewport will always show its last element sitting partly behind the
bar before the user scrolls. Every "overlap" report in this file's
history (Home's mood/streak card, Insights' stat row, Library's Box
Breathing card) was this exact same mechanism, confirmed each time via
real bounding-box measurements, not guesswork. It only *looked* like
several different bugs because two different response policies were
used: Home/Insights were "fixed" by trimming spacing until *current*
content happened to fit above the fold pre-scroll (fragile — re-breaks
the instant content grows, which is why it kept resurfacing); Library was
investigated the same way but deliberately left as-is, treating
scroll-to-reveal-the-last-card as expected behavior for a growing list
(same pattern as Instagram/Spotify) rather than a defect. Unrelated bugs
(Android `flexWrap` collapsing the Insights stat grid/calendar, `BlurView`
corner-clipping at `radii.xl`, the tab-bar active-pill shape bug) got
tangled into the same investigation threads historically but are separate,
already-closed issues — not more instances of the overlap mechanism.

**Decision (user, after reviewing the findings): Option 1 — retire the
pre-scroll-fit expectation for Home and Insights**, formally aligning
them with Library's already-correct, already-verified policy: guarantee
clean clearance *after* full scroll (already true on all 4 screens, and
confirmed on-device for this exact padding mechanism earlier in this
file), and accept that content may sit partially behind the tab bar
before scrolling — same as Library, Instagram, and Spotify. **No code
change was needed for this part** — the existing `useBottomTabBarHeight()`
padding already satisfies the accepted policy on every screen; what
changes is that this project no longer treats "fits without scrolling" as
a requirement for Home/Insights, so their existing tightened first-paint
spacing is left as-is (harmless, not un-done) but won't be re-tuned
further if it stops fitting as content grows. This closes out the
recurring investigation for good — there is no longer a "bug" here to
re-open, only expected floating-tab-bar-over-scrollable-content behavior.

## Fixed (side effect of the "Calm and Focus" rename): Library title
wrapping to 2 lines (2026-09-19)
Flagged during the tab-bar-overlap audit above: "Calm and Focus" is 4
characters longer than the old "Calm Focus" title, and Library's
`sessionTitle` `Text` had no line clamp — risked wrapping to 2 lines on
narrower screens and disrupting the session grid's per-card layout
consistency (all 6 cards are otherwise uniform height). Fixed
(`app/(tabs)/library.tsx` only): added `numberOfLines={1}
ellipsizeMode="tail"` to that `Text`, so every session title (regardless
of length) stays on one line and ellipsizes rather than wraps.

Verified on an isolated web server (port 8090, `--clear`; torn down after,
including a direct `taskkill` on the underlying node PID — the same
recurring `TaskStop`-doesn't-kill-the-process gap noted repeatedly
elsewhere in this file) via `playwright-cli` at a real phone viewport
(393×852): screenshotted the Library grid — "Calm and Focus" renders on a
single line, all 6 card titles same treatment, no wrapping, category tab
counts show the new distribution (For You 6, Calm 3, Sleep 1 visible in
frame). `npx tsc --noEmit`: clean.

## Session — 2026-09-19: "Wind Down" renamed to "Sleep Wind Down" (data-only)
User-directed content change, scoped strictly to `src/data/sessions.ts`
per instruction (additive/data-only) — no other file touched (confirmed
via `git status`/`git diff --stat` after editing).

Title only: `id` (`wind-down`), `description`, `durationSec` (12 min),
`badge` (`Moon`), `pattern` (`spiral`), and `category` (`Sleep`) all left
byte-for-byte unchanged. Added a header-comment flag matching the pattern
used for the earlier "Calm and Focus" rename: architecture.md:103-105's
LOCKED table and PRD.md's catalog table both still say "Wind Down" —
known, intentional deviation, not silently re-derived; not updated in
those two files this round since this task's scope was `sessions.ts` only.

**Verified the requested one-line check**, per instruction: on an isolated
web server (port 8091, `--clear`; torn down after via a direct `taskkill`
on the underlying node PID — same recurring `TaskStop` gap noted elsewhere
in this file) + `playwright-cli` at a real phone viewport (393×852),
scrolled to the Wind Down card: "Sleep Wind Down" renders comfortably on
one line with the existing `numberOfLines={1}` fix — no ellipsis was even
triggered at this width, unlike the concern that prompted the earlier
"Calm and Focus" fix. All 6 card titles remain visually uniform.

`npx tsc --noEmit`: clean.

## Resolved: badge/category mismatch + architecture.md locked-table sync (2026-09-19)
Addressed the divergence flagged in the two rename entries above. Read
PROGRESS.md's full history first per instruction, then reviewed
`src/data/sessions.ts` and the original Stitch source
(`assets/design-reference/library-code.html`) before deciding, rather than
guessing.

**Finding**: `library-code.html` assigns each session's badge icon 1:1
with its (then) category, with zero exceptions — Calm→`eco`(Leaf),
Sleep→`bedtime`(Moon), Energy→`bolt`(Zap), Recovery→`favorite`(Heart).
This is decisive, not genuinely ambiguous: badge is a category indicator
by original design intent, not an independent per-session
technique/feel attribute. Presented this finding and the resulting
recommendation to the user before editing anything, per instruction.

**Change** (`src/data/sessions.ts`): updated the two mismatched badges to
follow the convention rather than leaving them flagged —
- **Morning Reset** (category now Energy): `badge` Moon → **Zap**
- **Stress Relief** (category now Calm): `badge` Zap → **Leaf**

`id`/`description`/`durationSec`/`phaseConfig`/`pattern` unchanged for
both. Rewrote the file's header comment block to fold the three
2026-09-19 rename/badge entries into one coherent note (title/category
renames, the badge-fix reasoning, and the architecture.md sync below),
replacing the earlier "flagged, not fixed" language now that it's
actually resolved.

**Change** (`architecture.md`): updated the LOCKED "Library session
mapping" table (lines 103-110) to match `sessions.ts` exactly — title
(Calm and Focus, Sleep Wind Down), category (Morning Reset→Energy,
Stress Relief→Calm), and badge (Morning Reset→Zap, Stress Relief→Leaf) —
with a dated note explaining this is an explicit, reasoned update to the
locked table, not a silent re-derivation (CLAUDE.md's house rule is about
not *guessing* this data, not about it being permanently frozen against
an explicit, documented product decision). PRD.md's catalog table was
**not** touched this round (still says "Wind Down," out of scope for this
task, already flagged separately) — left as-is rather than expanding
scope beyond what was asked.

`npx tsc --noEmit`: clean. Verified visually on an isolated web server
(port 8092, `--clear`; torn down after via direct `taskkill`, same
recurring `TaskStop` gap noted elsewhere in this file) + `playwright-cli`
at a real phone viewport (393×852): Morning Reset now shows the bolt
(Zap) icon, Stress Relief now shows the leaf (Leaf) icon, both consistent
with their new categories; no regression on the other 4 sessions' badges.

## Done: Settings screen (build order step 7) (2026-09-19)
Built `app/settings.tsx` — a top-level route (sibling to `session-player.tsx`,
per architecture.md's repo-structure listing at line 39, no bottom tab bar
while mounted, matching that screen's precedent). Read PROGRESS.md,
PRD.md, architecture.md, and CLAUDE.md first per instruction. Additive
only — confirmed via `git status` that no existing screen, component, or
theme file was touched; only the new file plus the two new reference
files the user supplied were added.

**Flagged before proceeding, not silently worked around**:
- Two files were referenced as being "at the project root" — `design.md`,
  `settings-code.html`, `settings-screenshot.png`. Neither is at the
  project root. `design.md` doesn't exist anywhere in the project (only
  `DESIGN.md`, uppercase, at `assets/design-reference/DESIGN.md` — the
  same file every other screen was already built from); the HTML/
  screenshot live in `assets/design-reference/` like every other screen's
  reference files, and the screenshot's actual filename is
  `settings-screenshort.png` (typo, not `-screenshot.png`). Used
  `DESIGN.md` and the files from their actual location rather than
  stopping — the established per-screen pattern made this unambiguous,
  not a genuine blocker.
- architecture.md has **no** "Settings screen implementation" section
  (confirmed by listing every `##`/`###` heading in the file) — unlike
  Session Player and Home, which do have explicit "(do not deviate)"
  content sections. It only mentions Settings in passing twice: the repo
  structure (`app/settings.tsx`'s file location) and the Notifications
  section ("user-configurable time in Settings"). Proceeded using
  `settings-code.html` + `DESIGN.md` as the definitive spec instead, per
  this task's own explicit instruction that those files are "ground
  truth alongside architecture.md" — architecture.md just confirms the
  file's location and top-level-route pattern, nothing structural was
  missing as a result.

**Built exactly two cards, nothing more**, per instruction and the Stitch
source: header (back arrow + "Settings" title, no trailing icon — this
screen doesn't need the gear glyph every other screen's header has, since
it *is* that destination), a background glow blob (flat-circle
approximation of `settings-code.html`'s `blur-3xl`, same established
technique as Home/Player's glow — RN has no backdrop-blur for a bare
shape), then:
1. **Daily Reminder** — title + large "8:00 PM" time text (dummy,
   matches the Stitch static value; real value awaits `expo-notifications`
   scheduling, build order step 10) + a toggle
2. **About** — title + "Version 1.0.0" plain text

No audio/haptics, health integrations, extra links, badges, presets,
day-of-week selector, or footer — confirmed against both
`settings-code.html` and the screenshot that neither shows anything past
these two cards.

**Toggle**: `settings-code.html`'s switch uses a *gradient* track when on
(`primary-container`→`secondary`), which RN's built-in `Switch` can't
render (it only supports flat `trackColor` per state). Built a local
`ReminderToggle` (Pressable + `LinearGradient`, using the same
`expo-linear-gradient` dependency already used by Library/Player's CTAs)
sized to the HTML's exact pixel values (48×28 track, 20×20 thumb, 4px
inset, 20px thumb travel) rather than approximating with a flat-color
`Switch`. Kept local to `settings.tsx` (not a new shared component) since
no other screen uses it.

**Typography/color check performed, not just eyeballed**: cross-referenced
every Tailwind class in `settings-code.html` against `src/theme/tokens.ts`
before writing styles (e.g. `font-display-lg text-headline-lg text-primary
font-bold` for the time → `typography.headlineLg` size/lineHeight with
`fontWeight: '700'` override, `color: colors.primary`) — all colors used
(`primary-container`, `secondary`, `on-primary`, `on-surface`,
`on-surface-variant`, `primary`, `surface-variant`) matched `tokens.ts`
hex-for-hex against the HTML's own inline Tailwind config. Reused
`GlassCard` (`radii.lg`, matching the HTML's `rounded-lg`→2rem/32px per
its own inline Tailwind config, i.e. `radii.lg`'s exact value) unchanged —
same shared glass-surface component as Home/Library/Player, per
instruction to match the already-established design system rather than
hand-roll a new card style for this screen.

`npx tsc --noEmit`: clean. Verified visually on an isolated web server
(port 8093, `--clear`; torn down after via direct `taskkill` on the
underlying node PID, same recurring `TaskStop` gap noted elsewhere in
this file) + `playwright-cli` at a real phone viewport (393×852):
screenshotted `/settings` directly and compared side-by-side against
`settings-screenshort.png` — header, both cards, spacing (content's
`paddingTop`/16px and inter-card `gap`/24px map exactly to the HTML's
`pt-4`/`space-y-6`), typography, and colors all match; toggle renders in
its gradient "on" state matching the reference.

**Not yet done / explicitly out of scope for this step**:
- Not wired up: no screen's header "settings" gear icon navigates here
  yet (Home/Library/Player/Insights' gear icons are still inert,
  pre-existing). This task was scoped to building `app/settings.tsx`
  itself, not wiring navigation into it — flagging as a natural next step
  rather than doing it unasked.
- No real persistence (`AsyncStorage`) or `expo-notifications` scheduling
  for the reminder toggle/time — matches CLAUDE.md's build order (step
  10 is Notifications); this screen is dummy-data only, like every other
  screen at this stage.
- Not yet confirmed on-device (ADB wireless pairing is still blocked by
  what looks like router-level Wi-Fi client isolation — see the
  standalone entry on that below; awaiting the user's decision between a
  USB cable or a router setting change).

## Done: wired up settings-icon navigation (2026-09-19)
Per explicit instruction, wired every existing "settings" gear icon in the
app to navigate to `/settings` (built in the previous entry), using the
same navigation pattern already established elsewhere (`router.push`, as
Home's Begin/Library's Quick Start/etc. already use). Did **not** modify
`app/settings.tsx` itself — purely the missing navigation link, confirmed
via `git status`/`git diff` that the settings screen file has zero
changes this round.

Found 5 gear-icon locations total (not just Home, since the icon exists
identically on every tab-bar screen plus Session Player):
- `app/(tabs)/home.tsx`, `library.tsx`, `player.tsx`, `insights.tsx` — all
  4 had a bare, non-interactive `<MaterialIcons name="settings" .../>`
  with no wrapper at all. Wrapped each in a `Pressable` (`onPress={() =>
  router.push('/settings')}`, `hitSlop={12}`, a small `padding:
  spacing.base` style) — the exact same padding-only wrapper pattern
  `session-player.tsx`'s settings icon already used. `insights.tsx`
  needed `router` and `Pressable` added to its imports (neither was
  imported there before, since nothing on that screen navigated
  anywhere).
- `app/session-player.tsx` — already had a `Pressable` wrapper with an
  explicit `// Settings screen doesn't exist yet ... no-op for now`
  comment (scaffolded in anticipation of this exact moment). Replaced the
  no-op body with `router.push('/settings')` and removed the now-false
  comment — no structural change, just completing what was already
  wired.

`npx tsc --noEmit`: clean. Verified interactively on an isolated web
server (port 8094, `--clear`; torn down after via direct `taskkill`, same
recurring `TaskStop` gap noted elsewhere in this file) + `playwright-cli`:
clicked Home's gear icon → navigated to `/settings`; clicked Library's
gear icon → navigated to `/settings`; clicked Settings' own in-app "Go
back" button (not the browser's back button — tested the screen's actual
`router.back()` call) → correctly returned to `/library`, matching
whichever screen it was opened from, not a hardcoded destination.
Player/Insights/Session Player weren't individually click-tested this
round (identical code pattern to Home/Library, already proven), but were
confirmed via the same visual/typecheck pass.

## Fixed: AUDIT.md High finding — Session Player's BackHandler not focus-aware (2026-09-19)
Per explicit instruction, fixed only this one finding from AUDIT.md — no
other screen, no other finding, no refactors beyond what this required.
Confirmed via `git diff`/`git status` that `app/session-player.tsx` is
the only file this task touched.

**Root cause recap** (see AUDIT.md's High finding for full detail):
`router.push('/settings')` from Session Player doesn't unmount it — it
just loses navigation focus while Settings sits on top. Its elapsed-time
timer, breath sub-phase cycle, and Android `BackHandler` listener all kept
running/intercepting as if Session Player were still the visible screen,
which didn't matter until this session's earlier work wired the settings
gear into `session-player.tsx` (previously a no-op).

**Fix** (`app/session-player.tsx` only):
- Imported `useIsFocused` from `expo-router`'s own top-level export
  (`expo-router/build/exports.js` re-exports it directly — a real,
  documented public API, not the fragile deep `bottom-tabs` import path
  this project already uses elsewhere for `useBottomTabBarHeight`;
  AUDIT.md's own suggested import path, `@react-navigation/native`, turned
  out not to be independently resolvable in this project's `node_modules`
  — checked before using it).
- Added `isFocused` to both the elapsed-time timer's and the breath
  sub-phase cycle's guard conditions and dependency arrays (alongside the
  existing `paused` check) — both now stop while this screen isn't
  focused, satisfying requirement 1 (can't silently auto-complete in the
  background while Settings is open).
- Added `if (!isFocused) return false;` at the top of the `BackHandler`
  callback, before it would otherwise call `handleExitPress()` — when
  Session Player isn't the focused screen (Settings is on top), Android's
  default back-navigation now runs instead, correctly popping back to
  Session Player rather than firing its exit dialog over Settings
  (requirement 2).
- Extracted the existing exit-confirmation `Alert.alert` into a shared
  `confirmIfActive(action)` helper (same title/message/buttons, just
  parameterized on what happens if confirmed) and routed the settings
  gear's `onPress` through it (`handleSettingsPress`), alongside the
  existing `handleExitPress`. During `active`, tapping the gear now shows
  the identical "Exit session?" confirmation the X button and hardware
  back already show, and only navigates to `/settings` if confirmed —
  outside `active`, it still navigates directly, unchanged (requirement
  3). Confirming does **not** call `exitSession()` — it's not a real exit,
  since the screen stays mounted-and-paused underneath, consistent with
  requirement 1.

`npx tsc --noEmit`: clean.

**Verified interactively** on an isolated web server (port 8095,
`--clear`; torn down after via direct `taskkill`, same recurring
`TaskStop` gap noted elsewhere in this file):
- Confirmed the gate itself: started a session, reached `active` phase
  (elapsed timer running, visible "REST" sub-phase), tapped the settings
  gear — URL stayed on `/session-player` (did **not** navigate to
  `/settings`), unlike the pre-fix behavior, which navigated
  unconditionally. `Alert.alert` is a confirmed no-op on
  `react-native-web` (same standing limitation already documented in this
  file for the original exit dialog), so the dialog itself isn't visible
  on web and neither button can be resolved this way — but the underlying
  gate (no more unconditional navigation during `active`) is directly
  demonstrated, which is the actual defect being fixed.
- Confirmed no regression outside `active`: tapped the gear during
  `pre-mood` — navigated to `/settings` directly as before; tapped
  Settings' own "Go back" button — correctly returned to
  `/session-player`, matching the already-verified round-trip pattern
  from every other screen's gear icon.
- Attempted to test the pause/resume + hardware-back mechanics end-to-end
  by simulating `router.push('/settings')` via raw
  `history.pushState`/`popstate` (to route around the no-op `Alert`
  blocking the real UI path) — this rendered the Settings screen
  correctly, but going back via raw `history.back()` caused Session
  Player to **remount** (reset to `pre-mood`) rather than reveal the
  still-mounted instance underneath, unlike the real `router.push`/
  `router.back()` API calls the app itself uses. This confirms the raw
  History API approach doesn't faithfully replicate expo-router's actual
  navigation-stack behavior (it bypasses expo-router's own Linking/history
  integration entirely), so it isn't a valid way to test this — abandoned
  rather than reported as a false result either way.

**Not verifiable on web — needs on-device confirmation**, for the same
reason the *original* exit-confirmation dialog needed it when Session
Player was first built: `Alert.alert` has no working implementation on
`react-native-web`, and `BackHandler` has zero web equivalent at all.
Specifically still needs a real device check:
- The "Exit session?" dialog actually appearing and being resolvable when
  tapping the gear mid-session, and landing on `/settings` with the timer
  genuinely paused there, then resuming correctly on return
- Android hardware back on Settings (reached from an active session)
  correctly performing default back navigation to Session Player, without
  firing its exit dialog over Settings

The `useIsFocused`-based fix is correct by construction (it's
`expo-router`'s own documented, non-deep-imported focus API, used exactly
per its intended purpose) and compiles clean under strict TypeScript, but
per this project's own standing rule, not being called fully verified
until confirmed on the user's phone — still blocked on the ADB/router-
isolation issue below, or a USB cable connection.

## Investigated: user report that the isFocused fix isn't working on-device (2026-09-19)
User tested the previous fix directly on their phone: started a session,
tapped the gear, watched Settings — the elapsed timer kept counting the
whole time and never paused, contradicting the fix. Investigated per
explicit instruction: re-read the actual shipped file (not just trusted
the earlier diff), added temporary `console.log` instrumentation, and
reproduced with a full reload rather than assuming the code was correct
because it typechecked.

**Re-read `app/session-player.tsx` first**: confirmed the `useIsFocused`
import, the hook call, and its use in both timer effects' guards and
dependency arrays are all genuinely present exactly as intended — not a
comment-only description, not lost in an edit.

**Instrumented and tested** (isolated web server, port 8097, `--clear`):
added a log on every render (`isFocused` value) and a log in each gated
effect stating whether it's starting or skipping. First reproduction
attempt used the same raw `history.pushState`/`popstate` trick from the
earlier fix's verification (since `Alert.alert` is a no-op on web and
blocks reaching Settings from the *active* phase through the real gear
tap) — **this showed `isFocused` permanently stuck at `true`, never
flipping, even after the URL changed to `/settings` and Settings'
content rendered.** Session Player's own render log kept firing every
second (driven by its own still-running interval), proving it stays
mounted — matching the user's report exactly.

**Root-caused before concluding anything was broken**: rather than accept
this as proof `useIsFocused()` itself is broken, tested whether the raw
`history.pushState`/`popstate` simulation is even a valid way to trigger
it, by comparing against a **genuine** `router.push('/settings')` call —
tapping the actual gear icon during the *pre-mood* phase (which bypasses
the `confirmIfActive` Alert legitimately, since it only gates the
`active` phase, calling the identical `router.push('/settings')` gear
tap during `active` would call anyway). Added a second debug log
(`usePathname()`) for cross-reference. Result: via the **real** gear tap,
`isFocused` correctly flips to `false` the moment `/settings` is pushed,
`usePathname()` also correctly updates to `/settings`, and both gated
effects correctly log `SKIPPING`. **This isolates the actual root cause:
the raw `history.pushState`/`popstate` technique used for testing never
registers as a real navigation with expo-router's own routing/focus
state at all — it's an invalid test method, not a defect in the shipped
fix.** The fix's actual code, exercised through its real code path, works
correctly; `isFocused` genuinely detects the loss of focus, independent
of `phase` (confirmed directly, not assumed, since `isFocused`'s
computation has no dependency on `phase` — the pre-mood test is a valid
proxy for the identical mechanism the active-phase gear tap relies on).

**Conclusion**: no code defect found in the fix itself. The most likely
explanation for the user's on-device failure is a **stale bundle** — this
project has repeatedly hit exactly this class of issue this session and
in prior sessions (new hooks/imports and new files not picked up by Fast
Refresh, requiring a full `--clear` restart and reconnect), and this
session in particular has had unusually disruptive dev-server churn
(router-isolation blocking wireless ADB, switching to tunnel mode,
multiple server restarts) that makes a stale connection plausible. Not
ruled out entirely: a genuine Android-native-vs-web difference in
`useIsFocused()`'s behavior for this specific screen structure — the web
test is the closest verification possible without device access, but
isn't literally the same runtime.

**Cleaned up**: removed all temporary `console.log` statements and the
diagnostic `usePathname` import/call added during this investigation —
confirmed via `git diff` that `app/session-player.tsx` is back to
byte-for-byte the same fix as before this investigation, nothing left
behind.

**Not committed, per explicit instruction** ("do not commit until this
is verified working end-to-end, not just typechecking") — this needs a
genuine on-device retest with a guaranteed fresh reload (force-stop Expo
Go, reconnect to a freshly `--clear`-restarted server) before it can be
called resolved. Still blocked on the ADB/router-isolation issue or a
USB cable connection for that on-device check.

## Investigating further: user confirmed NOT a stale bundle — native-specific behavior differs from web (2026-09-19)
User force-stopped Expo Go, reconnected to a freshly `--clear`-restarted
server, and retested from scratch on a real Android device — the timer
still doesn't pause on Settings. This rules out staleness definitively
and means the earlier web-based confirmation (that a genuine
`router.push('/settings')` correctly flips `isFocused` to `false`) does
**not** hold on native. Investigated the native-specific configuration
directly via code (no device access available yet — still blocked on the
ADB/router-isolation issue):

1. **Confirmed `expo-router`'s `<Stack>` uses a real native-stack
   implementation on native** (`NativeStackView.native.js`, rendering
   `react-native-screens`' `ScreenStackItem` — genuine Fragment-based
   navigation on Android), structurally different from the web renderer.
   This is expected/correct, not itself a bug.
2. **Ruled out screen freezing as the cause**: `react-native-screens`'
   `ENABLE_FREEZE` defaults to `false`, and `enableFreeze()` is never
   called anywhere in this project's code or in `expo-router`'s own
   runtime (confirmed via `grep` across both) — the freeze/lazy-unmount
   optimization the user asked about isn't active in this app at all.
3. **Ruled out modal presentation**: no screen anywhere sets a
   `presentation` option; Settings uses the default `'card'` push, not a
   modal (which would have different focus semantics).

None of these structural checks reveal an obvious cause on their own, so
rather than guess further, added instrumentation for the user to run on
their actual device (their explicit ask, since "we can't reproduce
Android-native-specific behavior in a web-only test environment") —
`app/session-player.tsx` currently has temporary debug logging:
- The existing `isFocused` value + `Platform.OS`, logged on every render
- Start/skip/cleanup logs on both the elapsed-timer and breath-cycle
  effects (now also logging on cleanup, not just start/skip, to see
  whether the interval/timeout is ever actually torn down at all)
- **New**: a raw `navigation.addListener('focus'/'blur', ...)` listener,
  completely bypassing `useIsFocused()`'s own hook machinery, logging
  independently whenever the underlying navigation events fire — this
  isolates whether the problem is in `useIsFocused()`'s wrapper or in the
  lower-level event system it depends on.

Started a fresh `--clear` dev server in tunnel mode (same
`exp://uyhf050-anonymous-8081.exp.direct` URL as before — this machine's
Wi-Fi is on a Public Windows network profile and the router appears to
have Wi-Fi client isolation enabled, so tunnel mode remains the working
connection method) and asked the user to fully disconnect/reconnect
Expo Go (not just reload) and retest: start a session, tap the gear,
watch Metro's console output while on Settings, then return to Session
Player — and report back exactly what's logged.

**Not concluding anything about the root cause until that device data
comes back**, per explicit instruction. Debug logging is temporary and
will be removed once a real fix is identified and confirmed working.

**Not committed** — waiting on the user's on-device log output before
deciding on a final approach (keep `useIsFocused()` if it turns out the
events do fire correctly and something else was wrong, or switch to the
raw `navigation.addListener` approach directly if that proves more
reliable on this native stack).

## RESOLVED on-device: Session Player focus-guard fix confirmed working (2026-09-19)
User retested on their physical Android device after a full Expo Go
disconnect/reconnect (fresh `--clear` tunnel server): started a session
at 23 seconds, navigated to Settings, waited, returned — the timer was
still at 23 and resumed normally. Pulled the actual device console
output from the tunnel server's own log (Metro forwards connected-device
`console.log` calls to the terminal running `expo start`) rather than
relying on the observed behavior alone, per this project's "verify, don't
just assert" standard. The log conclusively shows, on real Android
hardware:
- `render, isFocused = false` the moment Settings is pushed on top
- `elapsed-timer effect: CLEANUP (clearing interval)` and
  `breath-cycle effect: CLEANUP (clearing timeout)` firing immediately
  after
- Both effects then logging `SKIPPING` while unfocused
- The **raw** `navigation.addListener('blur', ...)` diagnostic (bypassing
  `useIsFocused()`'s own hook machinery entirely) firing independently,
  confirming the underlying focus-event system genuinely works on this
  native stack, not just the wrapper hook
- On return: `raw navigation "focus" event fired`, followed by both
  effects logging `STARTING` again

This directly contradicts the *previous* failed on-device test and
confirms `useIsFocused()` was never actually broken on native — the
second test's failure (after user already ruled out simple staleness)
remains unexplained in detail, but is no longer reproducible; the working
theory is a deeper connection/caching issue with that specific test round
(possibly the tunnel/CDN layer serving a cached bundle despite the local
server being fresh), not a defect in the fix's logic, which this device
log now proves correct end-to-end.

**Cleaned up**: removed all temporary `console.log` statements, the
`Platform` import, and the diagnostic `useNavigation`/raw
`addListener('focus'/'blur')` effect from `app/session-player.tsx`.
Confirmed via `git diff` the file is back to byte-for-byte the same
fix verified in the "Fixed: AUDIT.md High finding" entry above — nothing
left behind. `npx tsc --noEmit`: clean.

**This fix is now considered done** — on-device confirmed, code clean,
ready to commit whenever the user gives the go-ahead (bundled with
whatever else is ready at that point).

## Done: standardized CTA color per COLOR-AUDIT.md (2026-09-19)
Per explicit instruction and COLOR-AUDIT.md's finding (two legitimate but
unreconciled CTA treatments — Home/tab-bar's flat `colors.primary` vs.
Library/Player/Session-Player's `primaryContainer`→`inversePrimary`
gradient), standardized on the gradient treatment app-wide. Scoped to
exactly the two files that needed to change — confirmed via `git diff`
that Library, Player, Insights, and Session Player (already using the
target treatment) are untouched by this task.

- **`app/(tabs)/home.tsx`**: the "Begin" button's flat
  `backgroundColor: colors.primary` pill replaced with a `LinearGradient`
  (`[colors.primaryContainer, colors.inversePrimary]`,
  `start:{0,0} end:{1,1}`) — byte-identical color pair and direction to
  Library's Quick Start / Player's Start a Session. Button text color
  updated `onPrimary` → `onPrimaryContainer` to match the pairing those
  buttons already use (the correct text color for this background, not
  an unrelated change). Added the `LinearGradient` import
  (`expo-linear-gradient`, already a project dependency — no new
  package).
- **`app/(tabs)/_layout.tsx`**: the tab bar's active-tab color
  (`TabButton`'s `tintColor` ternary, and the now-likely-vestigial
  `tabBarActiveTintColor` in `screenOptions`) changed `colors.primary` →
  `colors.inversePrimary`. A literal 2-color gradient doesn't translate
  to a small icon+label indicator, so per the task's own pre-approved
  fallback, used the gradient's darker end as a flat color instead of
  rendering a literal gradient there — not treated as a separate
  decision needing its own confirmation round-trip, since the
  instruction already spelled out and authorized this exact fallback.

`npx tsc --noEmit`: clean. Verified visually on an isolated web server
(port 8099, `--clear`; torn down after via direct `taskkill`, same
recurring `TaskStop` gap noted elsewhere in this file) + `playwright-cli`
at a real phone viewport (393×852): screenshotted Home (Begin button now
shows the gradient; Home tab icon+label now the deeper blue) and Library
(Quick Start button and the now-active Library tab, both matching Home's
new treatment) side by side — all four now read as the same color
family, closing the inconsistency COLOR-AUDIT.md documented.

**Not committed** — per instruction, left for the user's confirmation.

## Done: closed out the remaining COLOR-AUDIT.md items (2026-09-19)
Per explicit instruction, standardized the two remaining candidates
COLOR-AUDIT.md's expanded inventory flagged, plus onboarding's CTA
buttons (a related finding from that same inventory). Scoped to exactly
4 files — confirmed via `git diff` that nothing else (no other screens,
no other colors, none of the items explicitly marked "not part of it" —
`GradientText` titles, settings gear icon, "NEW" badge, Insights stat
icons, consistency calendar) was touched.

- **`src/components/MoodTrendChart.tsx`**: the Mood Trend line's SVG
  `stroke` changed `colors.primary` → `colors.inversePrimary`, matching
  its own fill (already `primaryContainer`) and the app-wide gradient
  standard. Fill gradient, glow filter, and everything else in the
  component untouched.
- **`app/onboarding/welcome.tsx`**, **`how-it-works.tsx`**,
  **`build-habit.tsx`**: each screen's CTA button (`Next`/`NEXT`/
  `Get Started`) gradient changed to `[colors.primaryContainer,
  colors.inversePrimary]`, replacing welcome's `[primary,
  primaryContainer]` and the other two screens' `[primaryContainer,
  tertiary]` — all three now match Library/Player's exact recipe and
  direction. Text/icon colors (`onPrimaryFixed`) left unchanged per
  instruction's "no other colors" scope — verified visually they remain
  legible against the new gradient. The screens' own `GradientText`
  headlines (a separate, already-consistent branding pattern, explicitly
  marked "not part of it" in COLOR-AUDIT.md) were not touched.

**Flagged, not acted on**: the user's instruction described this as
"following the same standard established for Library's category tabs
(inversePrimary)" — worth noting for the record that Library's own
category-tab pills (For You/Calm/Sleep/etc., inside `library.tsx`) still
use flat `colors.primary` and were never changed; only the app-level
bottom tab bar was changed to `inversePrimary` in the earlier task. Since
this task's own instructions explicitly excluded touching Library or any
other screen, this didn't affect anything actually done here, but noting
the distinction so it isn't propagated as a mistaken assumption later.

`npx tsc --noEmit`: clean. Verified visually on an isolated web server
(port 8100, `--clear`; torn down after via direct `taskkill`, same
recurring `TaskStop` gap noted elsewhere in this file) + `playwright-cli`
at a real phone viewport (393×852): screenshotted Insights (Mood Trend
line now the deeper blue, clearly visible with its glow intact against
the dark background) and all 3 onboarding screens (Welcome, How It
Works — scrolled to reach its button, Build Habit) — all three buttons
render the new gradient with fully legible dark text, no contrast
regression.

**This closes every item COLOR-AUDIT.md's expanded inventory flagged as
a real candidate.** Not committed — per instruction, left for the user's
confirmation.

## Done: closed the last open COLOR-AUDIT.md item — Library's category tabs (2026-09-19)
Per explicit instruction, standardized Library's category-tab active state
(For You/Calm/Sleep/Energy/Recovery pills — border, label text, count
badge background, count text) from flat `colors.primary` to
`colors.inversePrimary`, matching the bottom tab bar, Home's Begin
button, the Mood Trend chart line, and onboarding's CTA buttons.

Scoped to exactly `app/(tabs)/library.tsx`'s 4 style properties
(`categoryTabActive.borderColor`, `categoryLabelActive.color`,
`categoryCountActive.backgroundColor`, `categoryCountTextActive.color`)
— confirmed via `git diff` that nothing else in the file (or anywhere
else) changed for this task; the other diff hunks visible in that file
are pre-existing, from earlier work this session.

`npx tsc --noEmit`: clean. Verified visually on an isolated web server
(port 8101, `--clear`; torn down after via direct `taskkill`, same
recurring `TaskStop` gap noted elsewhere in this file) + `playwright-cli`
at a real phone viewport (393×852): screenshotted the "For You" pill
(default active state) and switched to "Calm" — both render the deeper
`inversePrimary` border/text/count-badge clearly and legibly against the
dark background, correctly filtering sessions, no contrast regression.

**This closes the last open item from COLOR-AUDIT.md's expanded
inventory** — every candidate identified across both audit rounds is now
resolved. Not committed — per instruction, left for the user's
confirmation.

## Blockers
- Wireless ADB pairing to the user's phone is failing at the network
  level, not a pairing-code issue: three fresh pairing attempts all
  failed identically (protocol fault / timeout), and `Test-NetConnection`
  confirms this laptop can reach the Wi-Fi router itself instantly
  (`192.168.0.1`, 1ms) but cannot reach the phone
  (`192.168.0.116`) at all — TCP connect and ICMP ping both fail. Router
  reachable + peer device unreachable on the same subnet is the standard
  signature of router-level Wi-Fi client/AP isolation, not something
  fixable from either device alone. Blocked pending the user's choice:
  disable "AP Isolation"/"Wireless Isolation" in the router's admin panel
  (it identifies as a D-Link router, `dlinkrouter`), or switch to a USB
  cable connection instead. (Separately, LAN-mode Expo dev server access
  from the phone was already worked around via `expo start --tunnel` —
  see the `@expo/ngrok` dependency addition — since this machine's Wi-Fi
  network is also categorized as "Public" in Windows, which blocks direct
  inbound LAN connections independent of the router-isolation issue.)

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

## Real illustrations added: BreathOrb (Home) + SessionThumbnail (Library) (2026-09-18)
User added 7 real illustration PNGs to `assets/illustrations/`: `hero-orb.png`
(Home's Featured Session) and 6 per-session images —
`deepexhale.png`/`morningreset.png`/`calmfocus.png`/`stressrelief.png`/
`winddown.png`/`boxbreathing.png` — replacing the programmatic-SVG
placeholders both components used since the "thumbnail art pass" noted in
the visual-polish backlog above. Additive-only per instruction — only
`src/components/BreathOrb.tsx` and `src/components/SessionThumbnail.tsx`
were touched; no other component, screen, or theme token was modified.

- **`BreathOrb.tsx`**: swapped the `react-native-svg` gradient-sphere markup
  for an `Image` (`require('../../assets/illustrations/hero-orb.png')`,
  `resizeMode="contain"`) inside the same `Animated.View`/`scale` — the
  existing pulsing loop (`1 → 1.06 → 1`, 2s each way) is untouched and still
  drives the new Image the same way it drove the old Svg.
- **`SessionThumbnail.tsx`**: swapped the per-`pattern` SVG mark + gradient
  for a `PATTERN_IMAGES` lookup (`Record<Session['pattern'], ...>`) mapping
  each of the 6 locked `pattern` values to its matching image via `require`,
  rendered as an `Image` (`resizeMode="cover"`) inside the same outer `View`
  that still owns the rounded-corner/`overflow:hidden` container styling —
  unchanged from before. Keyed by `pattern` rather than session id since
  that's the prop this component already receives from Library
  (`library.tsx:190`); each of the 6 sessions has a distinct `pattern`
  value today (see `src/data/sessions.ts`'s locked mapping), so
  pattern→image is equivalent to session→image with no ambiguity.
  Mapping: rings→deepexhale, wave→morningreset, starburst→calmfocus,
  dot-grid→stressrelief, spiral→winddown, bloom→boxbreathing — chosen by
  matching each image's actual visual motif (concentric rings, a wavy
  sphere, a radiating starburst, a scattered dot/starfield sphere, a
  spiral swirl, a faceted grid sphere) to the pattern name, not just file
  order.

**Bundling/optimization check performed, no setup changes needed**: Expo's
default Metro config already treats `.png` as a bundled asset extension
(no custom `metro.config.js` exists in this repo, and none was needed).
Checked actual dimensions via PowerShell (`System.Drawing`) before
assuming: all 7 images are roughly square (274×267 to 433×429px,
99KB–257KB each) — reasonable source resolution for display at the sizes
these components actually use (`SessionThumbnail` 80×80, `BreathOrb`
160–220 depending on screen), no re-export/resize of the source files was
necessary. Did not add `@2x`/`@3x` variants — single-resolution source
files are common practice for React Native and Metro doesn't require
suffixed variants to bundle an image; flagging as a possible future
sharpness improvement on very-high-density screens, not a current defect.

**Known incidental effect (flagged, not silent)**: `BreathOrb` is also used
by `app/onboarding/welcome.tsx` (not mentioned in this task's scope), which
now automatically renders the same real `hero-orb.png` image too, since
there's only one shared `BreathOrb` component and no separate "Home-only"
variant. This seems like a net improvement (the onboarding screen's own
code comment already flagged its orb as a stand-in for a real illustration,
same as Home's), but noting it since the task named only Home.

**Known asset inconsistency (flagged, not asked about — cosmetic only)**:
opened each of the 7 images directly and found `deepexhale.png` and
`morningreset.png` have a small baked-in text caption at the bottom
("Deep Exhale / calm breathing session", "Morning Reset / Ethereal
Breath") baked into the artwork itself; the other 5 images (`calmfocus`,
`stressrelief`, `winddown`, `boxbreathing`, `hero-orb`) don't. At
Library's actual 80×80 thumbnail size the caption is tiny and barely
legible next to the card's own real title text, so it reads as a very
minor redundancy rather than a real bug — not fixed (would require
cropping/re-exporting images the user supplied), just flagged for
awareness.

**Verified interactively (not just asserted)**, on an isolated web server
(port 8082, `--clear`; the user's own phone-testing server on port 8081 was
never touched or restarted) via `playwright-cli`, screenshotted at a real
phone viewport (393×852):
- Home: the Featured Session hero now shows the real `hero-orb.png`
  artwork in place of the old gradient sphere, matching
  `home-screenshot.png`'s own square dark-backdrop framing around the orb
  closely (the reference's hotlinked mockup image has the same dark square
  behind the sphere, not a transparent cutout — confirmed this is the
  correct look, not a bug)
- Library: all visible session rows (Deep Exhale, Morning Reset, Calm
  Focus, Stress Relief) show their correct matching real illustration
  inside the existing rounded-corner container, per the mapping above
- `npx tsc --noEmit`: clean
- Browser console: 0 errors, only the pre-existing unrelated
  `shadow*`-deprecation warning already noted earlier in this file
- Isolated port-8082 server and its `.playwright-cli/` temp output were
  torn down after (including a `taskkill` on the underlying node PID —
  `TaskStop` alone left it listening, the same known gap noted earlier in
  this file under the Home gradient-text fix)
- Screenshots saved to the user's Desktop: `home-illustrations-verify.png`,
  `library-illustrations-verify.png`

**Not yet confirmed on-device** — per this task's explicit ask and this
project's repeated lesson that web verification has missed real
Android-specific differences before (tab bar icons/pill sizing, calendar
grid, glow clipping), this isn't done until the user confirms on their
phone against `home-screenshot.png`/`library-screenshot.png` directly.
One thing specifically worth checking on-device: these are *new* binary
asset files (not just edited existing files), and this session's earlier
"new file didn't trigger a Metro rescan" lesson was about new source
files specifically — if the phone's already-running dev server doesn't
pick up the new `require()`d images via Fast Refresh, a full restart with
`--clear` (same procedure used earlier this session for new files) should
resolve it.

## Home orb art investigation (2026-09-18/19): on-device animation check, then a cleaner asset
Two follow-ups in the same session, both read-only/asset-only — no
component or screen code was touched in either.

### On-device animation check (no bug found in the pulse itself)
User reported the Home hero orb "flickering/blinking" and described the
intended behavior as "smooth circular/orbiting motion." Investigated
directly on-device per explicit instruction not to just read the code:
- Paired and connected to the user's physical Android device via
  `adb pair`/`adb connect` (wireless debugging)
- Captured sequential `adb exec-out screencap` stills of the Home hero
  during live playback — showed smooth, monotonic scale change, no
  blinking/swapping/blank frames
- User then supplied a 23.5s screen recording. Analyzed it
  **quantitatively, not just by eye**: extracted every frame at the
  video's native 24fps via a local `ffmpeg` (installed through
  `pip install imageio-ffmpeg`, not a system install), computed
  frame-to-frame pixel diffs with `numpy` across all ~580 frames, and
  auto-flagged any abnormal jump
  - Result: the orb's own pulse animation never flickers — diff stays at
    noise level the entire clip
  - Found exactly 2 real anomalies, both explained by the **Home
    ScrollView briefly scrolling** ~25–30px (t≈13.0s and t≈16.0–16.5s) —
    confirmed by pulling full uncropped stills at both moments (the
    "Deep Exhale" title becomes/stops being visible below the hero card
    as content shifts). Not an animation bug.
  - User confirmed this scroll shift is what they'd perceived as
    flicker — **not yet root-caused or fixed**, next step if pursued
- Also confirmed via code reading (both `BreathOrb.tsx` and
  `BreathingRing.tsx`, in case "orbiting" meant the Session Player ring
  instead): **neither has ever implemented circular/orbiting motion** —
  both are, and always were, a scale-only pulse. Flagged this mismatch
  to the user rather than guessing at a feature addition.

### Reference asset swap: hero-orb.png replaced with a transparent version (2026-09-19)
User replaced `assets/illustrations/hero-orb.png` in place (same path
`BreathOrb.tsx` already `require()`s — 178,952 → 185,102 bytes, same
428×428 dimensions) with a cleaned-up version: genuinely transparent
background (confirmed via PIL: RGBA, ~68% fully-transparent pixels), no
more baked-in dark-navy square backdrop/shadow-frame artifact the
original illustration had.

**No code changes were needed or made** — `BreathOrb.tsx`'s container has
no `backgroundColor` set, so it was already transparent behind the
`Image`; swapping the file's bytes at the existing `require()` path is
sufficient on its own. Verified this is genuinely true (not just assumed)
via an isolated web server (port 8082, `--clear`; phone's port-8081
server untouched throughout) and `playwright-cli`, screenshotted at a
real phone viewport (393×852): the hero orb now renders directly on the
card background with no square/frame artifact, console 0 errors (2
pre-existing, unrelated, web-only warnings: `shadow*` deprecation,
`useNativeDriver` web fallback). Isolated server torn down after
(`TaskStop` again left the underlying node process listening on 8082 —
same known gap as before in this file — required a direct `taskkill` on
the PID). Screenshot saved to the user's Desktop:
`home-transparent-orb-verify.png`.

**Flagged, not fixed**: `BreathOrb` is shared with
`app/onboarding/welcome.tsx` (same incidental-effect situation as the
original illustration swap above) — the onboarding screen's orb will
also pick up this new transparent artwork automatically, for the same
reason (one shared component, no Home-only variant).

**Awaiting on-device confirmation** — flagged a real risk before this was
asked for: RN's `Image` can cache locally-bundled assets by their
require-path, so even though the file's bytes changed, the user's
already-running Expo Go session may show a stale cached copy of the old
opaque-square version under a normal Fast Refresh. User was told to do a
full reload (not Fast Refresh) on their phone to confirm.

## SessionThumbnail (Library): re-keyed from `pattern` to session id, new cleaned illustrations (2026-09-19)
User replaced all 6 per-session illustrations in `assets/illustrations/`
in place (`deepexhale.png`, `morningreset.png`, `calmfocus.png`,
`stressrelief.png`, `winddown.png`, `boxbreathing.png` — new byte sizes,
same filenames) with a cleaned-up set matching `hero-orb.png`'s new
treatment: genuinely transparent backgrounds (confirmed via PIL alpha
histograms: 40–76% fully-transparent pixels, soft glow falloff at the
edges — the "white" appearance when viewed outside the app is just how
transparency previews render, not an opaque white background), no more
baked-in text captions (`deepexhale`/`morningreset` had one before, see
the "Known asset inconsistency" note above — gone now).

Explicit instruction this time: key the thumbnail lookup by **session
id/title**, not the generic `pattern` field used in the previous pass —
these filenames correspond to specific sessions directly. Changed:
- **`SessionThumbnail.tsx`**: replaced `PATTERN_IMAGES` (keyed by
  `Session['pattern']`) with `SESSION_IMAGES` (keyed by `Session['id']`,
  `Record<string, ...>` since `id` is an open string type, not a closed
  union like `pattern` was). Prop renamed `pattern` → `sessionId` to
  match. Added a defensive `source &&` guard around the `Image` render
  (renders an empty rounded container instead of crashing) for an
  unrecognized id — `id` isn't a closed union so this isn't provably
  unreachable the way the old `pattern`-keyed `Record` was; no session in
  today's catalog hits this path.
- **`app/(tabs)/library.tsx`**: updated its one call site
  (`library.tsx:190`) from `<SessionThumbnail pattern={session.pattern} .../>`
  to `<SessionThumbnail sessionId={session.id} .../>` — the only other
  file touched, since the prop rename required it. No other part of
  `library.tsx` was changed.

**Bundling/optimization re-checked**: same conclusion as the original
illustration pass — Expo's default Metro config already covers `.png`,
no `metro.config.js` needed. Dimensions vary more this time
(`deepexhale`/`morningreset` are 230×230/200×200; the other four are
~430×430) — still comfortably above the 80×80 display size in both
cases, so no resizing was necessary, just noting the inconsistency
across the supplied set rather than silently treating them as uniform.

**Verified interactively**, isolated web server (port 8082, `--clear`;
phone's port-8081 server untouched throughout) + `playwright-cli` at a
real phone viewport (393×852), scrolled to see all 6 rows (RN Web scrolls
an inner container, not `document.body` — used mouse-wheel scroll, not
`window.scrollTo`, per this file's earlier-documented lesson on that):
all 6 sessions (Deep Exhale, Morning Reset, Calm Focus, Stress Relief,
Wind Down, Box Breathing) render their correct matching illustration via
the new id-keyed lookup, inside the existing rounded-corner container,
no leftover white/square artifacts. `npx tsc --noEmit`: clean. Console: 0
errors, 1 pre-existing unrelated `shadow*`-deprecation warning. Isolated
server torn down after (`TaskStop` again left the node process listening
on 8082 — same recurring gap noted twice already in this file — required
a direct `taskkill`). Screenshot saved to the user's Desktop:
`library-sessionid-verify.png`.

**Not yet confirmed on-device** — same reasoning as every prior asset/
visual change in this file: awaiting the user's on-phone check against
`library-screenshot.png`. Same caching risk flagged for the Home orb
swap likely applies here too (RN `Image` caching locally-bundled assets
by require-path) — a full reload rather than Fast Refresh is the safer
check.

## Fixed: SessionThumbnail centering + inconsistent sizing (2026-09-19)
User reported two visual bugs after the id-keyed illustration swap above:
Deep Exhale's artwork rendered off-center (shifted toward the bottom-
right), and Stress Relief rendered noticeably smaller than the other 5
thumbnails.

Root-caused with measured evidence before changing anything (PIL alpha-
channel bounding-box analysis on all 6 source PNGs — `Image.open(f)
.getchannel('A').point(lambda a: 255 if a>30 else 0).getbbox()`), since
the existing code already applied `resizeMode="cover"` + a fixed 80×80
container uniformly to all 6 (so a plain resizeMode/container bug was
already ruled out before investigating further):
- **deep-exhale.png**: visible content's bounding box is offset +6.7%/
  +7.0% from the canvas center (content touches the canvas's right/bottom
  edge exactly, with a real ~31–32px empty margin only on the top-left) —
  the artwork itself isn't centered within its own 230×230 canvas.
  `resizeMode="cover"` scales the whole canvas; it can't recenter content
  that's already off-center inside the source file.
- **stress-relief.png**: visible content fills only 63% of its own
  430×428 canvas — the smallest content-to-canvas ratio of all 6 (the
  other 5 range 71–100%, e.g. morning-reset fills 100%). `cover` scales
  the *entire* canvas including empty padding, so more padding directly
  means smaller-looking content at an identical container size.

**Fix** (`src/components/SessionThumbnail.tsx` only): replaced the flat
`SESSION_IMAGES: Record<string, source>` with `SESSION_IMAGES: Record<string,
{ source, w, h, contentBox }>`, where `contentBox` is each image's
measured content bounding box in source pixels (documented inline with
the exact PIL command used, and a note to re-measure if these source
files are ever replaced again). The component now computes, per image:
`scale = max(size/contentW, size/contentH)` (scales the *content box* to
cover the container, not the raw canvas), then renders the `Image` at
`meta.w*scale × meta.h*scale` absolutely positioned so the content box's
center lands on the container's center. This is a manual "cover-to-
content" implementation — plain `resizeMode` has no concept of a sub-
region within an image, so it couldn't have solved either bug on its
own. Applied uniformly to all 6 sessions, not just the 2 reported ones,
per instruction. No asset files were modified — this is purely a display-
time fix; `SESSION_IMAGES`'s `contentBox` constants are the only new
"data" involved, and they're derived measurements, not guesses.

**Verified interactively**, isolated web server (port 8082, `--clear`;
phone's port-8081 server untouched) + `playwright-cli`, phone viewport
(393×852), scrolled to see all 6: Deep Exhale's rings are now centered;
Stress Relief's dot cluster now fills its circle at the same visual scale
as the other 5; no regressions on the 4 that were already correct.
`npx tsc --noEmit`: clean. Console: 0 errors, 1 pre-existing unrelated
`shadow*` warning. Isolated server torn down after (`TaskStop` again left
the node process listening — same recurring gap noted repeatedly in this
file — required a direct `taskkill`). Screenshot saved to the user's
Desktop: `library-thumbnail-fix-verify.png`.

**On-device verification attempted but not completed this session**: the
user explicitly asked for on-device confirmation (comparing all 6 side by
side), and this file's own established lesson is that web verification
has missed real Android-specific rendering differences before. Attempted
to check directly via `adb` (same wireless-debugging device used for the
earlier orb-flicker investigation), but `adb devices` came back empty —
the prior pairing/connection had dropped since that session and needs to
be re-established (new pairing code, or a fresh IP:port if wireless
debugging is still on). Not yet re-paired as of this entry — still
pending either the user's on-phone check or a fresh adb reconnection.

## Frontend re-audit (`AUDIT-2.md`) + fix of its 2 Medium findings (2026-09-20)
Ran a fresh, read-only re-audit (`AUDIT-2.md`, following `AUDIT.md`'s
2026-09-19 precedent) covering everything built since then — Settings, the
gear-icon navigation wiring, the Session Player focus-guard fix, and the
2026-09-19 CTA color-standardization pass — plus a full screen-by-screen
re-sweep. Read every screen/component file directly rather than trusting
this file's own history, re-verified the tab-bar-overlap investigation is
still closed (no regression), and re-confirmed `AUDIT.md`'s High finding
(Session Player's `BackHandler` focus-awareness) is genuinely still fixed
and has no leftover debug logging. Found 13 items total (0 Critical/High,
3 Medium, 7 Low, 3 Info) — see `AUDIT-2.md` for the full breakdown. Then,
per explicit follow-up instruction, fixed the 2 Medium findings the user
asked for (the 3rd Medium, `BreathingRing`'s pause/resume desync, was
explicitly left open — out of scope for this pass).

### Fix 1: color-standardization contrast regression
`AUDIT-2.md` found that the 2026-09-19 COLOR-AUDIT.md pass (which this
file's own entries verified only by screenshot comparison, never measured)
had actually dropped several elements below WCAG AA contrast minimums.
Computed real WCAG relative-luminance contrast ratios (not re-asserted by
eye) before and after this fix:

**Standalone foreground text/icons on a dark background** — reverted
`app/(tabs)/_layout.tsx`'s active-tab tint, `app/(tabs)/library.tsx`'s
active category-tab border/label/count colors, and
`src/components/MoodTrendChart.tsx`'s line stroke from flat
`colors.inversePrimary` back to `colors.primary` (the token these used
before 2026-09-19):
| Element | Before | After |
|---|---|---|
| Tab bar active icon/label | 2.86:1 (fail) | 10.85:1 (pass) |
| Library active category-tab text | ~2.86:1 (fail) | ~10.85:1 (pass) |
| Mood Trend chart line | 2.86:1 (fail) | 10.85:1 (pass) |

**CTA button gradient text/icons** (Home's Begin, Library's Quick Start,
Player's Start a Session, and onboarding's 3 CTA buttons — 6 total): the
old `primaryContainer -> inversePrimary` gradient's two stops are
mathematically too close in luminance for any single flat text color to
clear 4.5:1 against both ends (dark text passes only the light end at
~4.5:1; white text passes only the dark end at ~6.5:1 and falls to ~3.2:1
at the light end). Fixed by narrowing the gradient to `inversePrimary ->
onPrimaryFixedVariant` (both existing tokens, both dark enough that white
text clears 4.5:1 everywhere) with white button text/icons throughout,
matching the approach Session Player's own "Begin Journey" button already
used (left untouched — it wasn't part of the flagged failure):
| Button group | Before, light end | Before, dark end | After, light end | After, dark end |
|---|---|---|---|---|
| Home/Library/Player (`onPrimaryContainer` text) | 4.54:1 (pass) | 2.23:1 (**fail**) | 6.47:1 (pass) | 9.40:1 (pass) |
| Onboarding x3 (`onPrimaryFixed` text) | 5.39:1 (pass) | 2.64:1 (**fail**) | 6.47:1 (pass) | 9.40:1 (pass) |

Since both new gradient stops move monotonically darker across all 3 RGB
channels, the 6.47:1 figure is the worst point anywhere along the
gradient — every intermediate pixel clears 4.5:1, not just the two
sampled ends. No other colors touched (Insights' stat icons, `GradientText`
titles, the settings gear icon, etc. left exactly as-is, per instruction).

Files changed: `app/(tabs)/_layout.tsx`, `app/(tabs)/library.tsx`,
`app/(tabs)/home.tsx`, `app/(tabs)/player.tsx`,
`app/onboarding/{welcome,how-it-works,build-habit}.tsx`,
`src/components/MoodTrendChart.tsx`.

### Fix 2: Android `BlurView` corner-clip bug on 2 more `radii.xl` cards
`AUDIT-2.md` found that Insights' `cardClip` defensive wrapper (added
earlier to fix a confirmed on-device Android bug where `BlurView` doesn't
reliably clip to a rounded rect at `radii.xl`/48px — see this file's
"stat card corners uneven" entry) was never applied to the two other
`GlassCard`s in the app using that same radius: `session-player.tsx`'s
*active*-phase card and `onboarding/how-it-works.tsx`'s 3 step cards.
Wrapped both in the identical technique (an extra `overflow:'hidden'` +
matching `borderRadius` `View` outside the `GlassCard`) — a new
`activeCardClip` style (`flex:1` to preserve the card's existing
fill-available-space sizing) in `session-player.tsx`, and a new
`stepCardClip` style in `how-it-works.tsx`. No other `GlassCard` usage
touched (Home/Library/Player/Settings/Session Player's non-active cards
all use `radii.lg`, never shown to trigger this bug).

### Verification
`npx tsc --noEmit`: clean throughout. Confirmed via `git diff`/`git
status` that only the 8 source files above plus `AUDIT-2.md` and this
file changed — no unrelated colors or components touched. Verified
visually on an isolated Expo web server (port 8110, `--clear`; torn down
after, including killing the underlying node PID) via `playwright-cli` at
a real phone viewport (iPhone 15 emulation): screenshotted all 3
onboarding CTA buttons, Home (tab bar + Begin button), Library (active
category pill + Quick Start button), and Session Player's active phase —
white text/icons are clearly legible end-to-end across every gradient
button (including the darkest portion), the light-blue accent text/line
is clearly legible against the dark background everywhere, and the
active-phase card and step cards render with correctly rounded corners
(web never reproduced the corner-clip bug in the first place, so this
confirms no regression, not the Android fix itself). No console errors.

**Not yet confirmed on-device**: no Android device was available this
session (no active ADB pairing — same standing connectivity blocker as
this file's "Blockers" section). The corner-clip fix is code-identical to
Insights' own already-on-device-confirmed fix for the same component at
the same radius, so it's expected to resolve the same way, but per this
project's standing rule, treat it as unconfirmed until checked on the
user's phone. The color-contrast fix doesn't carry the same native/web
divergence risk (`LinearGradient`/`Text` color rendering has never been a
source of web/native drift in this project, unlike `BlurView` clipping),
so it isn't flagged as needing separate on-device confirmation.

**Not committed** — per instruction, left for the user's confirmation.

## Done (continued): Phase 6, Library wired to the real backend (2026-09-24)
Per architecture.md's build order step 9 and the explicit instruction to
go one screen at a time (Library first, reads only), wired
`app/(tabs)/library.tsx` to the real `breathing-app-api` backend. Did
NOT touch Session Player or Home/Insights this session, per instruction.

**`src/api/client.ts` didn't exist yet** — checked before "updating" it
as instructed; only `src/data/sessions.ts` (dummy catalog) existed.
Created it fresh: one function, `fetchSessions(category?)`, calling
`GET {API_BASE_URL}/api/sessions` and throwing on a non-OK response.

**Base URL**: `API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ??
'http://localhost:3000'`. Flagged before building: architecture.md
doesn't actually pin "localhost" as a literal value (only "points at
the Next.js API base URL") — treated the user's "should be localhost
for dev" as their explicit call for the default, not something
architecture.md itself dictates. Also flagged a real practical
consequence: this repo's own history above shows testing has
extensively used a physical Android device over Expo Go, where
`localhost` resolves to the *phone*, not the dev machine — the env var
lets that be overridden to a LAN IP without a code change; not yet
needed this session since verification was web-only (see below).

**`app/(tabs)/library.tsx` changes**: replaced the direct `sessions`
import from `src/data/sessions.ts` with `fetchSessions()` called in a
`useEffect` on mount (and via a `load` callback re-triggerable by
Retry). `featuredSession` import kept as-is (still local dummy data) —
Quick Start only needs a session id to route to, and Session Player
(untouched this phase) still reads from that same file, so this stays
consistent until Session Player is wired too.

**Loading/error states** (explicit ask — shown live, not just
described):
- `sessions: Session[] | null` — `null` means "loading" (initial
  mount, or a retry in flight). While `null`, the screen renders just
  the top bar + a centered `ActivityIndicator`, nothing else.
- `error: string | null` — set from a caught fetch rejection. While
  set, renders the top bar + a centered error icon, "Couldn't load
  sessions.", the raw error message, and a Retry button (`onPress`
  re-runs `load()`).
- Only once `sessions` is a real array (and `error` is null) does the
  screen render its normal content (search/categories/Quick
  Start/grid), now sourced from `sessions` state instead of the old
  static import. `countFor()` and `visibleSessions` both guard on
  `sessions` being non-null, returning `0`/`[]` while loading/errored.

### CORS blocker found, flagged, fixed (breathing-app-api)
Real fetch attempt in Expo web failed with a genuine browser console
error (not a guess): `Access to fetch at 'http://localhost:3000/api/
sessions' from origin 'http://localhost:8090' has been blocked by CORS
policy: No 'Access-Control-Allow-Origin' header is present`. Native
iOS/Android builds aren't subject to CORS at all (browser-only
enforcement), so this had never surfaced before, and wouldn't block
on-device testing — but it did block this session's only available
verification method (Expo web via `playwright-cli`), and would block
any actual browser-based usage of the app too.

Flagged before touching the other repo for what was scoped as a
Library-only task. User chose: fix it now, wildcard/permissive rather
than scoped to specific origins (their instruction: scope it if
trivial, otherwise permissive is fine since native builds don't need
CORS anyway). Added `breathing-app-api/lib/cors.ts` + wired all 3
routes to send `Access-Control-Allow-Origin: *` and handle `OPTIONS`
preflight — full reasoning and verification in that repo's own
PROGRESS.md, not duplicated here.

### Verified live (not just asserted)
Ran both servers together: `breathing-app-api`'s `npm run dev`
(port 3000) + this repo's `npx expo start --web --port 8090` (isolated
port, matching this file's established convention of never touching a
phone-testing server — none was running this session). Drove it with
`playwright-cli` at an iPhone 15 viewport:

1. **Before the CORS fix**: loaded `/library` — network tab showed
   `GET http://localhost:3000/api/sessions => FAILED`, console showed
   the CORS error verbatim, page showed nothing beyond loading (no
   dummy-data fallback silently masking the failure).
2. **After the CORS fix**: reloaded — network tab showed the same
   request now `=> 200 OK`, and the page rendered all 6 real sessions
   with correct titles/durations (Deep Exhale 10 min, Morning Reset
   18 min, Calm and Focus 15 min, Stress Relief 10 min, Sleep Wind
   Down 12 min, Box Breathing 12 min) and correct category tab counts
   (For You 6, Calm 3, Sleep 1, Energy 1, Recovery 1). Durations happen
   to match the old dummy data exactly (the backend was seeded from
   this same file, per breathing-app-api/PROGRESS.md), so content
   alone can't prove it's live — the network-tab evidence (FAILED →
   200, nothing rendered → rendered) is what actually proves it.
3. **Error/Retry state, forced live**: stopped the API server mid-
   session (confirmed down via `curl`), reloaded `/library` — page
   correctly showed "Couldn't load sessions." + "Failed to fetch" +
   Retry button. Restarted the API server, clicked Retry — page
   recovered and rendered all 6 sessions again, confirming the retry
   path actually re-fetches rather than being cosmetic.

`npx tsc --noEmit`: clean. Browser and both dev servers closed/stopped
after verification (isolated port 8090 and the API's port 3000; no
phone-facing server was touched, since none was running). Temp
Playwright snapshot files deleted afterward.

**Stopping here per explicit instruction** — Session Player and
Home/Insights remain on dummy data, awaiting the user's go-ahead to
continue wiring them one at a time.

## Done (continued): Session Player wired to POST /api/checkin (2026-09-24)
Per architecture.md's build order step 9, wired `app/session-player.tsx`'s
Done button to the real backend. Did NOT touch Library or Home/Insights
this session, per instruction.

**Confirmed before changing anything (explicit ask)**: re-read
`session-player.tsx` against architecture.md's "Session Player
implementation (explicit — do not deviate)" section — already matches
exactly: one screen, `phase` as internal state (no separate routes),
mood data in component state (not nav params), fade/scale transitions,
back-button rules correct per phase (`confirmIfActive()` — Alert only
during `active`; direct exit during `pre-mood`/`post-mood`), content
per phase matches spec. No deviations found or fixed — only
`handleDone` (the literal `TODO: POST /api/checkin` stub) and new
save-state UI around it were touched.

**`userId` source — didn't exist yet**, checked before assuming
(explicit ask): searched the whole app for AsyncStorage/device-id
logic; only `src/utils/onboarding.ts`'s onboarding-complete flag
existed, nothing generating/persisting a user id. Built
`src/utils/deviceId.ts` from scratch: `getDeviceId()`, AsyncStorage-
backed + in-memory cached, generates a UUID v4 on first read via a
plain `Math.random()` implementation (flagged: chose this over adding
`expo-crypto` as a new dependency, since this is a local grouping
identifier, not a security credential — no crypto-quality randomness
needed). Falls back to an in-memory-only id if AsyncStorage itself
throws, rather than crashing.

**`src/api/client.ts`**: added `postCheckin({userId, sessionId,
preMood, postMood})`, POSTing to `{API_BASE_URL}/api/checkin` with a
JSON body, throwing on a non-OK response — same shape/pattern as
`fetchSessions`.

**Loading/error design around Done** (explicit ask — presented before
implementing, confirmed via question): new `saving`/`saveError` state.
While saving, the Done button shows a spinner (disabled). On failure,
the screen stays on `post-mood` (no navigation, `preMood`/`postMood`
untouched in state) and shows an error box ("Couldn't save your
session." + the raw error) with the same button now reading "Try
Again" instead of "Done" — pressing it re-runs the exact same save
with the same mood values, so nothing is silently lost. Explicitly
decided (confirmed with the user) to leave the top-bar X button's
existing exit behavior completely untouched even when a save error is
showing, rather than add a new confirmation there — that back-button
behavior is architecture.md's own "do not deviate" spec, so extending
it would be an unrequested scope expansion; the visible error+Retry on
Done is what satisfies "don't lose data silently" for the actual ask.

### Verified end-to-end (not just asserted)
Ran both servers (`breathing-app-api`'s `npm run dev` port 3000 + this
repo's `npx expo start --web --port 8091`, isolated, no phone-facing
server touched) and drove the real flow with `playwright-cli`.

**Test-duration workaround, reverted cleanly**: every real session is
10+ minutes long, and the `active` phase only auto-advances on real
elapsed time — not practical to wait out live. Used this file's own
established pattern (temporarily force a value, verify, revert
immediately, confirm via diff — see the 2026-09-12 post-mood
verification entry above for precedent) instead of inventing a new
one: temporarily set `deep-exhale`'s `durationSec` to `6` in
`src/data/sessions.ts`, ran the full test below, then reverted and
confirmed via `git diff src/data/sessions.ts` — **zero diff**, byte-
for-byte back to the committed value.

1. Opened `/session-player?sessionId=deep-exhale` directly — pre-mood
   phase rendered correctly (title, description, mood picker, Begin
   Journey).
2. Clicked Begin Journey → active phase. Waited 8s (> the 6s test
   duration) → auto-advanced to post-mood correctly ("0 Mindful
   Minutes" showing is expected fallout of the artificially short test
   duration, not a bug).
3. **Failure case, forced live**: stopped the API server (confirmed
   down via `curl`), clicked Done — screen correctly stayed on
   `post-mood` (URL unchanged) and showed "Couldn't save your
   session." + "Failed to fetch", button now reading "Try Again".
4. Restarted the API server, clicked Try Again — succeeded, navigated
   to `/home` (matching the real Done success path).
5. **Verified directly in Supabase** (`execute_sql`): a real `checkins`
   row landed (`user_id: d0b32e5b-6536-4bbe-98fd-6e3a14631d1a` — the
   freshly-generated device UUID, `session_id: deep-exhale`, moods 3/3
   matching the untouched default selector values, `created_at`
   matching the Try Again click time) and a correctly-computed
   `streaks` row (`current_streak: 1, longest_streak: 1` — correct
   first-ever-checkin behavior). Only **one** checkin row exists —
   confirms the earlier failed attempt (while the API was down) never
   partially wrote anything, no duplicate from the retry.
6. Deleted both test rows from Supabase afterward.

`npx tsc --noEmit`: clean. Browser and both dev servers closed/stopped
after verification. Temp Playwright snapshot files deleted.

**Stopping here per explicit instruction** — Home/Insights remain on
dummy data, awaiting the user's go-ahead to continue.

## Done (continued): Home + Insights wired to GET /api/insights — last
## piece of Phase 6 (2026-09-24)
Per architecture.md's build order step 9, wired `app/(tabs)/home.tsx`
and `app/(tabs)/insights.tsx` to the real backend. Did NOT touch
Library, Session Player, or the backend routes, per instruction.

**Pre-implementation analysis (explicit ask, confirmed before writing
mapping code)**:
- Surveyed both screens' dummy data and exactly what UI it fed (Home's
  3 Snapshot cards; Insights' 4 stat cards, `MoodTrendChart`, 28-cell
  consistency grid) before touching anything.
- Compared `MoodTrendChart`'s actual needs (any ordered `{date, mood}`
  list — it spaces points by array index, not real date gaps, per its
  own `moodToPoints` implementation) and the calendar's needs (one
  `boolean` per day, 28 days) against the real API shape (`checkins`:
  last 30 days, `{preMood, postMood, createdAt}`, no other fields).
- **Genuine gap found and NOT silently filled**: `GET /api/insights`
  has no "current mood" field at all — Home's Mood card needs one.
  Presented the gap and 2 real design forks to the user before writing
  any code, both confirmed:
  1. **Mood source**: `postMood` (not `preMood`) drives both Home's
     current-mood card and the Insights mood-trend chart — user chose
     postMood for "how they've been trending" consistency between the
     two screens.
  2. **Mood word labels**: no per-value word mapping existed anywhere
     (only the two endpoint words "Stressed"/"Calm" from
     `MoodSelector`) — user approved adding
     `MOOD_LABELS = ['Stressed','Uneasy','Neutral','Content','Calm']`
     (co-located with the existing `MOOD_EMOJIS` in
     `MoodSelector.tsx`, reusing rather than duplicating the emoji set).

**Exact transformation logic** (both in `app/(tabs)/insights.tsx`,
operating on the real `checkins` array — no interpolation, no invented
days/points):

```ts
// Each real checkin's postMood -> one real point, chronological
// (checkins arrives newest-first from the API, so reversed).
function buildMoodTrend(checkins: Checkin[]): MoodPoint[] {
  return [...checkins].reverse()
    .map((c) => ({ date: c.createdAt.slice(0, 10), mood: c.postMood }));
}

// One boolean per day for the last 28 days (oldest first, today last):
// true iff >=1 real checkin exists that calendar date.
function buildConsistencyCalendar(checkins: Checkin[]): boolean[] {
  const checkinDates = new Set(checkins.map((c) => c.createdAt.slice(0, 10)));
  const days: boolean[] = [];
  const today = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(checkinDates.has(d.toISOString().slice(0, 10)));
  }
  return days;
}
```
No bucketing/averaging for multiple same-day checkins — each becomes
its own real point in the trend; the calendar only cares whether >=1
exists per day. The 30-day `checkins` array already covers the 28-day
calendar window, so no extra API call was needed.

**Home's current-mood derivation**: `insights.checkins[0]?.postMood`
(newest-first, so index 0 is most recent) → `MOOD_EMOJIS`/`MOOD_LABELS`
lookup. `null` (no checkins yet) renders as `—` with no emoji, not a
fake default — matches the "don't invent data" rule for the zero-state.

**Real bug found and fixed while wiring** (in scope — it's the exact
field being wired, not an unrelated screen, same category as the CORS
fix in an earlier phase): `insights.tsx` hardcoded `+${monthOverMonthDelta}%`,
but the real value can be negative. Fixed to `${sign}${value}%` where
`sign` is `'+'` only when `>= 0`.

**Flagged, not touched**: the Consistency card's footer has always
mislabeled the (day-based) streak as `"${n} Week Streak"` — pre-existing
in the dummy version too, unrelated to this wiring task, left as-is.
`src/data/insights.ts`'s dummy value exports (`moodTrend`, `streak`,
`totalSessions`, `sessionsThisWeek`, `mindfulMinutes`,
`monthOverMonthDelta`, `consistencyCalendar`) are now dead/unused —
only its `MoodPoint` type is still imported. Left the file untouched
per the "don't touch other files" instruction; flagging for cleanup
later rather than silently deleting.

**Loading/error/retry**: reused Library's exact pattern (`null` =
loading spinner, `error` string = message + Retry button, same visual
treatment/copy). Insights gates its entire screen (everything on it
depends on this one fetch, matching Library's situation). Home gates
only the "Your Snapshot" section — its Featured Session section still
reads local dummy `featuredSession` data (unaffected by this fetch, out
of scope this phase), so it renders unconditionally rather than being
blocked behind the Snapshot section's loading state.

### Verified live with real seeded data (not just zero-state)
Ran both servers (isolated Expo web port 8092, no phone-facing server
touched) and seeded 6 real backdated checkins via SQL for a test user
(`test-user-home-insights-verify`) at known offsets/moods: 1/3/8/15/27
days ago (postMood 2/5/3/4/1 respectively, all within the 30-day API
window) plus one at 40 days ago (postMood 3, outside the window — to
confirm correct exclusion from `checkins`/calendar/trend while still
counting toward all-time `totalSessions`/`mindfulMinutes`), plus a
fixture `streaks` row (`current_streak: 4, longest_streak: 6`).
Pre-computed every expected value by hand before loading the app.

Since `getDeviceId()` normally generates a random UUID, pre-seeded the
browser's `localStorage` key `breathe_device_id_v1` (confirmed via
reading `@react-native-async-storage/async-storage`'s web
implementation source — it's a plain `window.localStorage` wrapper on
web) with the test user's id before loading, so the app used the exact
seeded user rather than a fresh random one.

- **Home**: Mood card showed `😟` / "Uneasy" (postMood 2, the most
  recent checkin) — exact match. "2 sessions THIS WEEK" (only the
  1-day-ago and 3-day-ago checkins fall in the rolling 7-day window) —
  exact match. "4 days CURRENT STREAK" — exact match (fixture
  passthrough).
- **Insights stat cards**: Current Streak "4", Total Sessions "6"
  (all-time, includes the 40-day-old one), Mindful Minutes "1h" (6 ×
  600s ÷ 60 = 60min), Vs Last Month "+400%" (current 30-day count 5 vs.
  prior 30-60-day count 1 → `(5-1)/1*100`) — all exact matches,
  including the sign-fix rendering correctly on a large positive value.
- **Consistency calendar — verified at the DOM level, not just
  visually**: used `playwright-cli eval` to read every cell's computed
  `backgroundColor`, sorted by screen position into reading order, and
  compared the resulting 28-value boolean array against the
  hand-computed expected indices (`index = 27 - daysAgo`: 0, 12, 19,
  24, 26). **Exact match** — filled cells at exactly those 5 indices,
  all 23 others correctly empty.
- **Mood trend chart — verified at the data level, not just
  rendered**: extracted the actual SVG `<path>` `d` attribute via
  `eval` and independently hand-computed the expected path from
  `MoodTrendChart.tsx`'s own `moodToPoints`/`buildSmoothPath` algorithm
  using the real mood sequence (1, 4, 3, 5, 2). **Byte-for-byte
  match**: `M 20,180 Q 160,60 230,80 Q 300,100 370,60 Q 440,20 510,80
  T 580,140`.
- **Zero-state** (fresh `test-user-home-insights-zero`, no checkins):
  0 console errors on both screens. Insights: all 4 stats show correct
  zeros (`0`, `0`, `0h`, `+0%` — sign-fix correctly shows no `-`),
  `MoodTrendChart` renders nothing (its own pre-existing `points.length
  === 0` guard, no crash), calendar confirmed via the same DOM-eval
  technique to have **0** filled cells. Home: mood card shows `—` with
  no emoji (not a fake default), streak card shows "0 days".
- Deleted both test users' `checkins`/`streaks` rows afterward.

`npx tsc --noEmit`: clean. Browser and both dev servers closed/stopped.
Temp Playwright snapshot files deleted.

**This closes Phase 6** — all 3 backend routes are wired into all 4
consuming screens (Library, Session Player, Home, Insights). Next per
architecture.md's build order: step 10, Notifications (daily reminder +
weekly recap) — not started, awaiting the user's go-ahead.

## Fixed: Mindful Minutes stat card showed "0h" for short sessions (2026-09-25)
`formatMindfulMinutes` (`app/(tabs)/insights.tsx`) always rounded to whole
hours (`Math.round(minutes / 60)` + `"h"`), so any real user with under 30
mindful minutes total saw "0h" — technically correct but reads as broken,
especially for a new user with only a few short sessions logged. Display-
only bug; `mindfulMinutes` itself (computed server-side in `GET /api/
insights`, see `breathing-app-api/app/api/insights/route.ts`) was untouched.

Fixed to a two-tier format: under 60 minutes shows `"Nm"`; 60+ shows `"Nh"`
if exact or `"Nh Mm"` if there's a remainder. Verified with 0→"0m",
20→"20m", 60→"1h", 90→"1h 30m", 125→"2h 5m" (all correct) via a standalone
script mirroring the function, plus `npx tsc --noEmit` clean.

**Re-verified against real production data (2026-09-25).** Queried
Supabase's `checkins` table directly for today's non-test rows and found
the user's real device UUID (`e3c7f66f-...`) with 2 genuine checkins
completed today (`morning-reset` 1080s + `deep-exhale` 600s = 1680s =
28min) — exactly the previously-broken sub-60-minute case, real data not
a fixture. Started the API dev server and called `GET /api/insights?
user_id=e3c7f66f-...` live: `mindfulMinutes: 28`, confirming the backend
number itself was always correct (this was purely a display bug, as
suspected).

Then started a *second*, isolated Expo web dev server (port 8082, the
phone's port-8081 server left untouched, same pattern as every prior
on-device-adjacent verification in this file), seeded `localStorage`
with the real device UUID (`breathe_device_id_v1`) and the onboarding-
complete flag, navigated straight to `/insights`, and confirmed via
`playwright-cli find` + a screenshot that the Mindful Minutes card
renders **"28m"** — not "0h". Both dev servers stopped and
`.playwright-cli/` temp files deleted afterward.

## Fixed: Insights' streak stat card didn't match Home's orange treatment (2026-09-25)
User flagged a color inconsistency: Home's streak card (`app/(tabs)/
home.tsx`) uses a distinct orange (`#fb923c`) for its flame icon plus a
matching orange tint on the card border and label text, to visually mark
it as the streak/fire indicator. Insights' "Current Streak" stat card
(`app/(tabs)/insights.tsx`) instead used the generic `colors.primary`
(blue) for its `whatshot` icon, with no card/label tint — same concept,
inconsistent treatment between the two screens.

Confirmed the exact existing values in both files before changing
anything: Home's `streakCard` style is `borderColor: 'rgba(251,146,60,0.2)'`
and `streakLabel` is `color: 'rgba(254,215,170,0.7)'`, both derived from
the same `#fb923c` orange as the icon. `GlassCard`'s wrapper already sets
`borderWidth: 1` with a default `borderColor`, and spreads the `style`
prop last — so Insights' stat card layout could support the identical
override mechanism Home already uses, no structural change needed.

Scoped the fix to just the streak stat (`stat.key === 'streak'`) inside
Insights' shared `statCards.map` render loop, so Total Sessions/Mindful
Minutes/Vs Last Month are untouched:
- Streak's `iconColor` changed from `colors.primary` to `'#fb923c'`
- Added `streakStatCard: { borderColor: 'rgba(251,146,60,0.2)' }` and
  `streakStatLabel: { color: 'rgba(254,215,170,0.7)' }` — same values as
  Home, byte-for-byte — applied conditionally only to the streak card's
  `GlassCard` style and label `Text` style

`npx tsc --noEmit`: clean. Verified visually via an isolated Expo web dev
server (`--port 8092`, phone's 8081 and backend's 3000 restarted fresh
after both were reaped for memory pressure earlier this session, left
running afterward) + `playwright-cli`, same pattern as this file's other
web-based visual checks: screenshotted Home's streak card (baseline,
unchanged) and Insights' Current Streak card side by side — both now show
the same orange flame icon, border tint, and label tint. Also verified at
the DOM level via `playwright-cli eval` (computed styles), not just a
screenshot: Insights' streak card icon `rgb(251, 146, 60)` (= `#fb923c`),
card `border-color: rgba(251, 146, 60, 0.2)`, label `color: rgba(254, 215,
170, 0.7)` — exact matches to Home's values. Total Sessions' card
(adjacent, untouched) confirmed still plain/blue in the same check.
Browser closed, isolated web server stopped, temp screenshot/snapshot
files deleted afterward.

## Fixed: FRONTEND-AUDIT-2.md's High finding — 4 screens now read live session data, not the local catalog (2026-09-26)
`FRONTEND-AUDIT-2.md` (a full diagnostic audit, see its own entry) flagged
that Home's Featured Session card, `app/session-player.tsx`, Library's
Quick Start target, and Player's Quick Suggestions all still read session
content from the local static `src/data/sessions.ts` catalog, never the
live `GET /api/sessions` backend — even though Library's grid and Insights
were already correctly wired. The concrete risk: if the backend catalog
ever diverged from the local file, `session-player.tsx`'s
`getSessionById(id) ?? featuredSession` fallback would silently substitute
Deep Exhale for an unrecognized id and silently misattribute the
resulting checkin to it.

Fixed all four, reusing `fetchSessions()` (`src/api/client.ts`) — the
same function Library's grid already used — rather than adding a new API
function, since no single-session-by-id backend endpoint exists and
adding one was out of scope (backend untouched):

- **Home**: Featured Session card now has its own independent
  `featuredSession`/`featuredError` fetch (parallel to, not merged into,
  the existing Snapshot section's `insights` fetch), looking up a new
  `FEATURED_SESSION_ID = 'deep-exhale'` constant in the live list rather
  than assuming array order. Own loading spinner + error/Retry, reusing
  the Snapshot section's existing style names. A genuinely empty live
  catalog is treated as the error branch (friendly message) instead of a
  permanently-stuck spinner.
- **Library**: Quick Start now looks up `FEATURED_SESSION_ID` from the
  `sessions` state this screen already fetches for its grid — no new
  fetch needed. Guarded to no-op, not crash, on an empty catalog.
- **Player**: Quick Suggestions now fetches live via its own effect,
  with real loading/error+Retry UI — explicitly not the silent-omission
  pattern the adjacent Calm Streak stat still uses (a separate, still-open
  Low finding from the same audit, left alone per instruction).
- **Session Player** — the significant one. Replaced the synchronous
  local lookup entirely with a `sessions`/`fetchError` fetch (same shape
  as Library's) and a derived `session`, gated behind **3 explicit
  states, checked in order, before any phase UI renders**: fetch failed
  (icon + real error text + Retry), still loading (spinner), or fetch
  succeeded but no session matches the id — a **dedicated "Session not
  found." state** (different icon/copy from the error state, a "Back to
  Library" action), not a silent substitution. Every hook reading
  `session.*` (`setActiveSessionId`, auto-advance-to-post-mood, the
  breath sub-phase cycle) is now guarded with `if (!session) return;`.
  Added a shared module-level `TopBar` component (mirroring
  `insights.tsx`'s own existing pattern) so the X/settings buttons stay
  functional across all 4 render states (loading/error/not-found/ready).

**`src/data/sessions.ts` is now fully unused app-wide** — confirmed via
`grep -rn "from '.*data/sessions'" app src`, zero matches. Not deleted,
per instruction — flagged for a future cleanup pass, same treatment
`src/data/insights.ts` already got.

`npx tsc --noEmit`: clean throughout. `git diff --stat` confirmed only
the 4 named screens changed, nothing else.

**Verified interactively** (isolated Expo web server, port 8094; phone's
8081 and the backend's own port 3000 left running/untouched throughout)
via `playwright-cli`:
- `playwright-cli requests` confirmed Home, Library, Player, and Session
  Player each independently issue their own real `GET /api/sessions`
  call and render the live response.
- Home's Begin and Library's Quick Start both correctly resolved to
  `sessionId=deep-exhale` from the live list and opened Session Player
  with the correct live content.
- **Simulated a full backend failure**
  (`playwright-cli route "**/api/sessions*" --status=500`) and reloaded
  all 4 screens: each showed a real error state (`GET /api/sessions
  failed: 500` + Retry); removing the simulated failure and tapping
  Retry correctly recovered real data on all 4 (screenshotted before/
  after for each).
- **Navigated directly to
  `/session-player?sessionId=this-session-does-not-exist`**: confirmed
  the dedicated "Session not found." state renders (distinct from the
  error state), the top bar's X/settings remain functional, and "Back to
  Library" correctly navigates there — no substitution of Deep Exhale or
  any other session occurred.
- Browser closed, isolated web server stopped, temp files deleted.

`FRONTEND-AUDIT-2.md` updated to mark this High finding RESOLVED with
the full before/after (its other findings, including the still-open
"no fetch timeout" High finding, are untouched — out of scope for this
fix). Not committed — left for the user's confirmation.

## Phase 7: Daily Reminder notifications — implemented; VERIFIED on-device 2026-09-29 (see "Phase 7 verified" at the end of this file) (2026-09-26)
Build order step 10, Daily Reminder half only (Weekly Recap is a separate,
later phase, explicitly out of scope here). Decision confirmed by the user
before starting: the reminder fires unconditionally regardless of whether a
session was already completed that day — no checkin-awareness, no backend
dependency, fully local via `expo-notifications`. Plan (time-picker UI +
AsyncStorage shape) was presented and approved before any code was written.

**New files:**
- `src/utils/reminders.ts` — `ReminderSettings {enabled, hour, minute}`
  (hour/minute nullable — literally enforces "never default to a fixed
  time," nothing schedulable until the user has actually picked one),
  persisted to AsyncStorage (`breathe_reminder_settings_v1`, same
  namespaced-key/fail-open pattern as `deviceId.ts`/`onboarding.ts`).
  `applyReminderSchedule()` is the single entry point both Settings and
  onboarding call after any change: always
  `cancelAllScheduledNotificationsAsync()` first, then schedules exactly
  one `DAILY`-trigger notification if enabled — this cancel-then-reschedule
  is the whole mechanism preventing a changed time from also leaving the
  old time still firing, no per-notification-id bookkeeping needed since
  this app only ever schedules this one thing.
- `src/components/TimePickerModal.tsx` — a custom picker (Hour 1-12 /
  Minute :00/:15/:30/:45 / AM-PM, 3 pill-rows), not
  `@react-native-community/datetimepicker` or a new dependency: reuses this
  app's own existing "row of selectable pills" idiom
  (`MoodSelector.tsx`'s selected-bubble treatment, Library's category-tab
  pill shape) built entirely from `colors`/`spacing`/`typography`/`radii`
  tokens, which matches the dark glassmorphic system more precisely than a
  native OS wheel widget would. 15-minute increments only — a deliberate,
  flagged simplification, not a hidden default.

**Wired (additive only, verified via `git diff --stat`):**
- `app/settings.tsx` — Daily Reminder card now reads/writes real state via
  `getReminderSettings()`/`saveReminderSettings()` instead of the old
  hardcoded "8:00 PM" + local-only toggle. Toggle on → requests permission
  → denied shows a real inline error message and the toggle stays honestly
  off (never flips to "on" without a real schedule behind it); granted →
  opens the time picker, nothing persists as enabled until a time is
  actually confirmed. Toggle off → cancels the schedule, keeps the last-
  picked time stored so re-enabling later pre-fills the picker with it
  (a UI convenience, not a re-introduced fixed default). Tapping the time
  text while enabled reopens the picker pre-filled with the current time to
  reschedule. About card untouched.
- `app/onboarding/build-habit.tsx` — `handleEnableReminders` replaced the
  dummy `Alert.alert` placeholder with the real permission request; denied
  shows a real (still simple) message then still finishes onboarding
  (both buttons must end in Home, unchanged); granted opens the same
  `TimePickerModal`, confirming schedules + persists then finishes
  onboarding; cancelling the picker still finishes onboarding without
  enabling anything. Screens 1-2, layout, copy, and Skip untouched.
- `app/_layout.tsx` — one additive `useEffect` calling
  `initNotificationChannel()` (Android-only, no-ops on iOS/web) once at
  startup, alongside the existing font-loading setup.
- `npx expo install expo-notifications` — no `app.json` plugin entry
  needed; plugins only apply to a native prebuild/EAS build and this
  project runs in Expo Go, which bundles its own copy. Flagged for later:
  add the plugin (icon/color/sound config) if this app ever moves to a
  standalone build.

**Real bug found and fixed during web verification** (not just asserted —
per this project's "show real diffs/state" convention): `expo-notifications`'
scheduling functions (`cancelAllScheduledNotificationsAsync`/
`scheduleNotificationAsync`) throw `UnavailabilityError` on web entirely
(confirmed via the actual thrown error and stack trace, not inferred) —
unlike the permission functions, which work fine there. `applyReminderSchedule`
now no-ops on web (`Platform.OS === 'web'`); the preference itself still
persists via AsyncStorage either way, only the OS-level scheduling call is
skipped on a platform with no such OS-level scheduler.

**Second real bug found and fixed**: `TimePickerModal` derived its picker
state from props via a plain `useState` initializer, which only runs once.
Since the modal component itself stays mounted across open/close cycles
(the parent just toggles `visible`, doesn't unmount it), reopening the
picker with a *different* `initialHour`/`initialMinute` (e.g. after
toggling off then back on with a previously-picked time) left the pills
showing the very first values forever. Found by checking each pill's
actual computed `background-color` via `playwright-cli eval` after
reopening — not just a screenshot glance. Fixed by re-deriving the
internal state in a `useEffect` keyed on `[visible, initialHour,
initialMinute]` instead of a one-time initializer; re-verified the same
way afterward (all 3 pills showed `rgb(113, 137, 246)` =
`colors.primaryContainer`, the selected color, on reopen).

`npx tsc --noEmit`: clean throughout.

**Verified interactively** on an isolated Expo web server (port 8095,
phone's 8081 and the backend's port 3000 left running/untouched, same
established pattern as every other web-based check in this file) via
`playwright-cli`, granting/denying the browser's own Notification
permission via `page.context().grantPermissions(...)` to exercise both
paths:
- Denied path: real inline error message rendered, toggle stayed off
  (checked via the gradient-fill's actual presence/absence in the DOM, not
  just a screenshot).
- Granted path: toggle → picker opens → picked 9:30 PM → confirmed →
  `localStorage` showed the exact correct persisted value
  (`{"enabled":true,"hour":21,"minute":30}`) → reloaded → state (both the
  toggle's visual on-state and the "9:30 PM" label) survived the reload
  correctly, proving the persistence round-trip.
- Toggle off → `{"enabled":false,"hour":21,"minute":30}` (time preserved,
  toggle visually off).
- Toggle back on → picker reopened correctly pre-filled at 9:30 PM (post
  bug-fix) → changed to 6:00 AM → confirmed → `localStorage` showed
  **only** `{"enabled":true,"hour":6,"minute":0}`, no trace of the old
  21:30 value — confirms the cancel-then-reschedule design leaves exactly
  one value, never two.
- Onboarding's Enable Reminders → picker opened → confirmed → correctly
  navigated to `/home` (`finishOnboarding()` ran), no console errors.
- Browser closed, isolated web server + its process fully stopped
  (`taskkill`, since `TaskStop` alone left the underlying node process
  running — same lesson noted earlier this session), `.playwright-cli/`
  temp files deleted.

**Explicitly NOT verifiable this way, per the user's own CRITICAL
instruction not to substitute a clean typecheck/web pass for real
confirmation**: whether a scheduled local notification actually *fires* on
a real device at the chosen time — `expo-notifications`' web scheduling
path is entirely stubbed out (see the bug above), so web can only prove the
state machine, persistence, and UI are correct, not the real OS-level
notification delivery. This feature has zero dependency on the backend or
LAN/tunnel connectivity (fully on-device), so it's unaffected by this
session's earlier AP-isolation issue — but that doesn't substitute for an
actual on-device test.

**Status: implemented, not yet verified on-device.** Needs, on the user's
physical phone:
1. Enable reminders, pick a time ~2 minutes out, background the app, confirm
   the notification actually fires at that time.
2. Toggle off — confirm nothing fires afterward.
3. Toggle back on with a different near-future time — confirm only the new
   time fires (proves cancel+reschedule under real conditions, not just the
   localStorage proxy check done on web).
4. Optionally: deny permission once, confirm the message + honest toggle
   state on-device too.

Not committed. Note: `git status` at the time of this work also showed two
unrelated, already-approved-but-uncommitted changes from earlier the same
session (`app/(tabs)/player.tsx`'s infinite-loop fix, `metro.config.js`'s
backend-proxy fix) — neither touched or included in this phase's diff.

## Bug: stale "Current Streak" on Home/Insights (found + fixed, 2026-09-28)
`current_streak` is only written by `record_checkin` (see the atomic RPC
above), so a user who stops practicing sees their last real streak number
forever — it never decays on its own. Reported as: streak showed 2 after
2 idle days, when it should read 0 once the gap exceeds one day.

**Read-only fix, scoped to `breathing-app-api/app/api/insights/route.ts`
only** — `record_checkin`/`POST /api/checkin` untouched, no writes to the
database from this route. After building the `streak` object (real row or
the existing no-row fallback), added:
```ts
if (streak.lastSessionDate !== "" && streak.lastSessionDate < yesterdayISODate()) {
  streak.currentStreak = 0;
}
```
`yesterdayISODate()` is a new helper returning UTC `YYYY-MM-DD` for
yesterday — matches `last_session_date`'s stored type (`date`, no time
component) and the same UTC day-boundary `record_checkin` already uses
(per BACKEND-AUDIT.md/this file's earlier streak-rule notes). String
comparison works correctly here since both sides are ISO `YYYY-MM-DD`.
`longestStreak` is left exactly as stored in every branch.

**Verified live** (not just asserted) against the real dev server + a
dedicated throwaway user (`test-user-stale-streak-verify`), backdating
`streaks.last_session_date` via a temporary Node script using the
service-role key (deleted after use, never committed) — all 4 required
cases, raw `GET /api/insights` output:
1. **Today** (`last_session_date` = today) →
   `"streak":{"currentStreak":5,"longestStreak":8,"lastSessionDate":"2026-09-28"}`
   — unchanged.
2. **Yesterday** →
   `"streak":{"currentStreak":5,"longestStreak":8,"lastSessionDate":"2026-09-27"}`
   — unchanged.
3. **2 days ago** →
   `"streak":{"currentStreak":0,"longestStreak":8,"lastSessionDate":"2026-09-26"}`
   — zeroed, `longestStreak` correctly preserved.
4. **No `streaks` row** (deleted the test row) →
   `"streak":{"currentStreak":0,"longestStreak":0,"lastSessionDate":""}`
   — zero via the pre-existing fallback path, new check is a no-op on `""`.

`npx tsc --noEmit` clean in both repos. Test row deleted and temp script
removed afterward — confirmed via `git status` that only the real
`route.ts` diff remains in the backend repo.

**Also fixed**: `app/(tabs)/insights.tsx`'s consistency-calendar footer
label read "N Week Streak" (a copy bug — the calendar is a daily grid, not
weekly) regardless of `N`. Changed to "N Day Streak" / "N Days Streak"
with correct singular for `currentStreak === 1`.

Not committed — left for the user's confirmation, per instruction.

## Bug: toggling Daily Reminder in Expo Go throws uncaught error (found + fixed, 2026-09-28)
The earlier Expo-Go-crash fix (`initNotificationChannel` skipping in Expo
Go — see the Phase 7 section above) only covered the one call site that
runs unconditionally at app startup. `requestNotificationPermission` —
called when the user actually taps the Daily Reminder toggle — still
called straight into `require('expo-notifications')` with no Expo Go
guard, so toggling it on in Expo Go on Android threw uncaught.

**Fix, scoped to `src/utils/reminders.ts` + its two call sites:**
- Added `notificationsUnavailable = isExpoGo && Platform.OS === 'android'`
  (iOS/web Expo Go are unaffected, per the SDK 53 Android-only breakage).
  Every exported function that touches `expo-notifications`
  (`requestNotificationPermission`, `initNotificationChannel`,
  `applyReminderSchedule`) now checks it first, and the `require()` calls
  inside each are wrapped in try/catch as a second layer of defense.
- `requestNotificationPermission`'s return type changed from `boolean` to
  a new `NotificationPermissionResult = 'granted' | 'denied' |
  'unavailable'` union, so callers can distinguish "the user said no" from
  "this environment can't do it at all" — the two need different messages
  and neither should read as the other.
- `app/settings.tsx`'s `handleToggleChange` and
  `app/onboarding/build-habit.tsx`'s `handleEnableReminders` both branch on
  the 3-way result: `'unavailable'` shows "Reminders need a development
  build and aren't available in Expo Go" (settings: inline error text,
  same as the existing permission-denied message's placement; onboarding:
  an `Alert`, matching its existing denied-path pattern) and returns before
  ever touching `enabled`/showing the time picker — the toggle/onboarding
  flow never appears to turn reminders on in an environment where they
  can't actually work. `'denied'` keeps the prior wording/behavior
  unchanged.

`npx tsc --noEmit` clean in `breathing-app`. Not committed.

**Phase 7 status unchanged: still "implemented, not yet verified
on-device."** This fix makes the feature fail *gracefully* in Expo Go
(the environment used for tunnel-mode testing all session); it doesn't
touch — and isn't a substitute for — the real on-device dev-client
confirmation that a scheduled notification actually fires, still pending
per the Phase 7 section above.

## TimePickerModal redesigned as a scrolling wheel picker (2026-09-28)
Replaced the pill-row time picker with a scrolling wheel picker matching
`assets/design-reference/time-picker-reference.png`: three columns (hour,
minute, AM/PM), a highlighted band across the middle row, rows above/below
fading and shrinking with distance from center. One intentional deviation
from the reference, per instruction: every minute is shown (not the
reference's 5-minute steps), via a single `MINUTE_STEP = 1` constant
controlling the step. Minute wheel runs 00-59 (not 1-59) so on-the-hour
times are selectable. JS-only — no new dependency, no native package (would
have forced another EAS build): `ScrollView` + `snapToInterval` +
`decelerationRate="fast"` + React Native's own `Animated` API (already used
elsewhere in this app, e.g. `BreathingRing`). Props interface unchanged
(`visible`, `initialHour`, `initialMinute`, `onConfirm`, `onCancel`).

**Colors are 100% this app's own tokens, not the reference's** (explicit
user clarification mid-task): the reference's green Confirm/Done button
color was never used. The highlight band uses `colors.primaryContainer` at
low opacity; Confirm reuses the exact `colors.inversePrimary` →
`colors.onPrimaryFixedVariant` gradient already used by Session Player's
Begin Journey / onboarding's Get Started button — only the reference's
*shape/style* (band + fade/shrink wheel) was kept, never its palette.

**Checked before touching anything outside this file**: grepped the whole
app for 15/30/45-minute-step assumptions. Only one hit —
`src/utils/reminders.ts`'s `ReminderSettings.minute` doc comment
(`/** 0 | 15 | 30 | 45. ... */`). **Flagging it rather than editing it
silently, per instruction**: that comment is now stale (minute can be any
0-59 value) and should be updated to `/** 0-59. ... */` — left for the
user's own pass since editing outside this task's scope wasn't asked for.
`app/settings.tsx`/`app/onboarding/build-habit.tsx` just consume the
component as-is; neither hardcodes a step assumption.

**Two real bugs found and fixed while verifying on an isolated Expo web
server (port 8097, phone/dev-client tunnel on 8081 untouched)** — the
wheel opened but sat on the wrong row (e.g. "1/00/AM" instead of the
intended "8/00/AM" default), a real functional bug, not a rendering
nitpick:
1. **Root cause**: the parent component declared `hourRef`/`minuteRef`/
   `periodRef` but never actually attached them via `ref={...}` to the
   `<WheelColumn>` elements — every imperative positioning call silently
   no-op'd on a permanently-`null` ref via optional chaining. Isolated by
   manually scrolling a wheel with the mouse first and confirming the
   underlying mechanism (snap-to-row, fade/scale interpolation, the
   highlight band) all worked perfectly — proved the bug was specifically
   in the *positioning call*, not the wheel itself.
2. Switching the fix to a declarative `contentOffset` prop (avoiding
   imperative refs for initial positioning entirely) *also* did nothing —
   reading `node_modules/react-native-web/dist/exports/ScrollView`'s
   source directly confirmed `contentOffset` isn't implemented there at
   all; it's silently dropped. **Final fix, both together**: `contentOffset`
   is kept for native (avoids an initial-frame flash there), plus an
   explicit `scrollRef.current.scrollTo({x:0, y, animated:false})` inside
   a mount-only `useLayoutEffect` in `WheelColumn` itself, which is what
   actually positions it on web. Each wheel remounts fresh on every modal
   open (parent `key` tied to an incrementing token), so this mount-only
   effect re-runs with the correct value every time — satisfying "on every
   open, scroll to the saved value with no animation" without relying on
   the broken imperative-from-parent approach at all.
   - Also fixed in passing: a `props.pointerEvents is deprecated` console
     warning the highlight band's `<View pointerEvents="none">` caused —
     moved into `style.pointerEvents` per RN's current API.

**"If Confirm is pressed while a wheel is still coasting, use the value it
settles on"**: each wheel's `onScroll` listener writes the live offset into
a plain ref (`offsetRef`, not React state) on every scroll event;
`getCurrentValue()` (called at Confirm) reads that ref directly and rounds
to the nearest `ITEM_HEIGHT` row — always resolves to whichever row
`snapToInterval` is currently carrying the wheel toward, independent of
whether `onMomentumScrollEnd` has actually fired yet. Not verified against
a real momentum fling (Playwright can't easily simulate native momentum
scrolling), but the mechanism doesn't depend on timing — reads the same
live ref regardless of scroll state.

**Verified interactively** (not just asserted) via `playwright-cli` at an
iPhone 15 viewport, after both bugs above were fixed:
- Opening with no saved time centers exactly on the 8:00 AM default, rows
  5/6/7 and 9/10/11 correctly fading/shrinking around it.
- Tapping a row (hour "6") animates the wheel to center it.
- Tapped hour 6, minute 45, PM, then Confirm — Settings' Daily Reminder
  row updated to exactly "6:45 PM" (proves `getCurrentValue()` reads all
  three wheels correctly).
- Reopening the picker after that centers on the *saved* 6/45/PM, not the
  8:00 AM default — the actual "on every open, scroll to saved value"
  requirement, not just the first-open case.
- Console: 0 errors, only the 2 pre-existing unrelated warnings
  (`shadow*` deprecation, expo-notifications' web push-token warning) —
  no new warnings after the pointerEvents fix.
- Isolated server (port 8097) and browser fully stopped afterward;
  screenshots and `.playwright-cli/` temp files deleted — confirmed via
  `git status` that only the real source file remains untracked.

`npx tsc --noEmit`: clean. **This is a JS-only change — no native
rebuild needed, just reload the app** (works in both Expo Go and the EAS
dev-client build once either picks up the new bundle). Not committed.

## Phase 7 verified on-device + tab-bar inset fix + picker backdrop (2026-09-29)
First real native build (EAS dev client "Breathe", Xiaomi/MIUI 22095RA98C,
Android 12), tested over tunnel-mode Metro + Metro's `/api/*` proxy.

**Phase 7 (Daily Reminder) — VERIFIED on-device**, via adb (USB), not
assumption:
- `dumpsys alarm`: `RTC_WAKEUP` alarm for `com.smarttech1.breathingapp`,
  tag `expo.modules.notifications.NOTIFICATION_EVENT`, next fire
  `2026-09-30 18:00:00` — the DAILY trigger re-armed itself after today's
  fire. App alarm stats: 3 wakeups, last ~5 min before the dump (18:00).
- `dumpsys notification`: "Time to breathe" posted on channel `default`
  ("Daily reminder", importance 3), created 2026-09-29 18:00:00.102,
  interruptive; `POST_NOTIFICATION` allowed; DND off.
- `logcat`: SystemUI logged the post for that key at 18:00:00.4 and played
  `WaterDropNotificationDay3.ogg`; no errors, no scheduling/permission
  failures.
- Conclusion: scheduling and delivery work; battery optimisation/autostart
  were not blocking delivery. **CORRECTED 2026-09-29 (later same day):**
  this entry originally attributed the earlier "no notification appeared"
  reports to a MIUI heads-up display issue. That was wrong. The real cause
  was **foreground suppression with no notification handler set**: the app
  had no `setNotificationHandler`, and `expo-notifications` does not present
  a notification that arrives while the app is open. The two early no-shows
  (~17:46, ~17:49) were very likely fired while the app was open during
  testing; the one that worked (18:00) fired after the app was backgrounded.
  Confirmed with a dedicated test at ~20:11: reminder set ~2 minutes out,
  app kept open on Settings, screen on — the alarm fired (app alarm wakeups
  5 -> 7 in `dumpsys alarm`) but no notification was posted (no app record
  in `dumpsys notification`, and the user saw none). Backgrounded/killed-app
  fires (18:00, and 19:42 with the app swiped away) posted normally. Fix:
  `initNotificationHandler()` in `src/utils/reminders.ts`, called at startup
  from `app/_layout.tsx` (JS-only). See "Foreground notification handler"
  below for the re-test result.
- **Known blind spot (documented, NOT fixed):** `applyReminderSchedule` in
  `src/utils/reminders.ts` has an empty-ish `catch {}` that swallows all
  errors silently; a failed schedule leaves no trace. Comment added at the
  catch site.

**Foreground notification handler (fixed + re-test confirmed on-device):**
`initNotificationHandler()` in `src/utils/reminders.ts` calls
`Notifications.setNotificationHandler` with `shouldShowBanner: true`,
`shouldShowList: true`, `shouldPlaySound: true`, `shouldSetBadge: false`,
wired once at startup in `app/_layout.tsx` (same web / Expo Go guards as the
other reminder functions). JS-only — reload, no EAS rebuild.
- Before (no handler): reminder set ~2 min out, app open on Settings, screen
  on -> alarm fired (app wakeups 5 -> 7) but nothing posted or shown.
- After (handler): reloaded, same procedure (reminder ~2 min out, stayed on
  Settings, app open, screen on) -> **the notification appeared**, per the
  user's on-device observation. Not backed by an adb capture: the phone had
  dropped off adb by the time this was recorded, so there is no
  `dumpsys notification` record for the post-fix fire, unlike the earlier
  18:00 / 19:42 / 20:11 entries above.
- Closes PRODUCTION-READINESS-AUDIT.md finding S2.

**Tab bar overlapped Android system nav buttons (fixed):**
`app/(tabs)/_layout.tsx` set a fixed `tabBarStyle.height: 84`. expo-router's
`getTabBarHeight()` returns a numeric custom height unchanged (skipping
`insets.bottom`), while `BottomTabBar` still applies `paddingBottom:
insets.bottom` inside it — so the bar never grew above the system bar.
Now `height = TAB_BAR_CONTENT_HEIGHT (84) + useSafeAreaInsets().bottom`.
Screens use `useBottomTabBarHeight()`, so scroll padding follows. JS-only.
Not yet confirmed visually on-device.

**Streak label:** Insights' stat card now reads "N Day(s) Streak" instead
of "N Week Streak" (`app/(tabs)/insights.tsx`).

**TimePickerModal backdrop:** the modal already had a 0.6 dim, but on
edge-to-edge Android the system-bar strips weren't covered and the
GlassCard (translucent tint, weak Android blur) let the Settings "About"
card show through. Added `statusBarTranslucent` + `navigationBarTranslucent`,
raised the dim to 0.75, and gave the card a solid
`colors.surfaceContainerHigh` base. JS-only — reload, no rebuild. Not yet
confirmed on-device.

**Verified (not changed):** the wheel's minute column has all 60 values
0-59 (Node replay of the real constants/logic: 60/60 round-trip, max scroll
= 59 x 40).
