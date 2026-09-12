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

## Next
- Build Library screen, using the locked session mapping (dummy/placeholder data)

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
