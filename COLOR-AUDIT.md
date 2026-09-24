# Color Audit — Button & Accent-Color Consistency

Diagnostic only. No code was modified. Verified via direct code reading (file/line
citations below) and live visual inspection (isolated Expo web server, port 8099,
`--clear`, torn down after; screenshots viewed and deleted, not retained in the repo).

## RESOLVED (2026-09-19): standardized on the gradient treatment
Per user decision, the app now standardizes on Library/Player's
`primaryContainer`→`inversePrimary` gradient as the single primary-CTA
treatment, closing the inconsistency this audit documents below:
- **Home's "Begin" button** (`app/(tabs)/home.tsx`): flat `colors.primary`
  fill → `LinearGradient([colors.primaryContainer, colors.inversePrimary])`,
  same direction/pair as Library's Quick Start. Text color updated
  `onPrimary` → `onPrimaryContainer` to match.
- **Tab bar active-tab color** (`app/(tabs)/_layout.tsx`): flat
  `colors.primary` → flat `colors.inversePrimary` (the gradient's darker
  end) — a literal gradient doesn't translate to a small icon+label
  indicator, so the darker flat color was used instead, per explicit
  instruction.
- **Left untouched, already correct**: Library, Player, Session Player,
  Insights — all already used the target gradient/token treatment.

## RESOLVED (2026-09-19, follow-up): the two remaining candidates + onboarding
Per user decision, both genuine candidates the expanded inventory below
identified are now closed, plus the related onboarding-buttons finding:
- **Mood Trend chart line** (`src/components/MoodTrendChart.tsx`): SVG
  `stroke` changed flat `colors.primary` → `colors.inversePrimary`,
  matching its own fill (`primaryContainer`) and the gradient standard.
- **Onboarding's 3 CTA buttons** (`welcome.tsx`, `how-it-works.tsx`,
  `build-habit.tsx`): all changed to `[colors.primaryContainer,
  colors.inversePrimary]`, replacing the two different recipes
  (`primary→primaryContainer` and `primaryContainer→tertiary`)
  identified below — now match Library's exact recipe.
- **Left untouched, per instruction**: `GradientText` titles, settings
  gear icon, "NEW" badge, Insights stat icons, consistency calendar —
  everything this file classified as "not part of it."

**Correction for the record**: this round's instruction described the
new standard as "established for Library's category tabs" — but at the
time, Library's own category-tab pills (For You/Calm/Sleep/etc.) still
used flat `colors.primary` and had not been changed; only the app-level
bottom tab bar had been changed to `inversePrimary`. See the next
section — this was closed in an immediate follow-up.

See `PROGRESS.md`'s "Done: closed out the remaining COLOR-AUDIT.md
items" entry for full change detail and visual verification.

## RESOLVED (2026-09-19, final): Library's category-tab active state
Per explicit follow-up instruction, closed the one item the previous
section's correction flagged as still open. `app/(tabs)/library.tsx`'s
category-tab active state (For You/Calm/Sleep/etc. pills — border,
label text, count-badge background, count text) changed flat
`colors.primary` → `colors.inversePrimary`, matching the bottom tab bar,
Home's Begin button, the Mood Trend chart line, and onboarding's CTA
buttons. Verified visually (isolated web server, `playwright-cli`,
393×852): both the default "For You" active pill and a manually
switched-to "Calm" pill render the deeper color clearly and legibly
against the dark background, no contrast regression.

**Every item this audit identified as a real candidate — across all
three resolution rounds — is now closed.** See `PROGRESS.md`'s "Done:
closed the last open COLOR-AUDIT.md item" entry for full change detail.

See `PROGRESS.md`'s "Done: standardized CTA color per COLOR-AUDIT.md"
entry for the full change detail and visual verification. The findings
below reflect the state of the app **before** either change — kept as
the historical record of the audit, not updated in place, so the "which
elements didn't match" analysis remains accurate as a diagnostic
artifact.

## DESIGN.md check: frontmatter vs. prose disagree (a pre-existing, already-known pattern)

`assets/design-reference/DESIGN.md`'s frontmatter YAML defines the actual token hex
values (`primary: '#b9c3ff'`, `primary-container: '#7189f6'`, `secondary: '#a7c8ff'`,
`tertiary: '#a6ccde'`, `inverse-primary: '#3c55bf'`, etc. — lines 3–50). Its **prose**
"Colors" and "Components" sections separately say: *"Use the Indigo-to-Purple
(#667eea to #764ba2) for active states and primary buttons"* and *"Primary buttons
use the Indigo-to-Cyan linear gradient"* (lines 109, 150) — hex values that don't
match **any** frontmatter token. `architecture.md`'s "Colors — source of truth"
section already resolved this exact discrepancy project-wide: frontmatter wins,
prose is descriptive/atmospheric only. This audit follows that same precedent — the
question below is not "does it match the prose gradient" (nothing in the app does,
and nothing is supposed to), but "which frontmatter token, and is it used the way
the rest of the app already established."

DESIGN.md's prose does **not** specify which specific frontmatter token maps to
"primary button" vs. "secondary/active" beyond the disqualified literal hex pair
above — there is no explicit rule saying "primary CTAs must use token X, never
token Y." In the absence of that rule, the only available baseline for "intended"
usage is what earlier, already-shipped screens established and what PROGRESS.md
documents as deliberate decisions. That is the standard applied in the findings
below.

## Summary table

| Screen | Element | Token(s) in code | Rendered hex/gradient | Classification | Matches an established pattern? |
|---|---|---|---|---|---|
| Home | "Begin" button | `colors.primary` (flat) | `#b9c3ff` | (a) correct token, flat fill | Matches tab bar; does **not** match Library/Player's gradient pattern |
| Home | "10 min" duration pill | `colors.surfaceVariant` @ 50% alpha | `#323536` @ 50% (neutral gray, not blue) | (a) correct token for a neutral chip | N/A — not an accent-color element at all |
| Tab bar | Active tab icon/label | `colors.primary` (flat) | `#b9c3ff` | (a) correct token, flat fill | Matches Home's Begin button exactly (same token) |
| Library | "Quick Start" button | `LinearGradient([colors.primaryContainer, colors.inversePrimary])` | `#7189f6` → `#3c55bf` | (a) correct tokens, used correctly per their own established pattern | Matches Player/Session Player's gradient CTAs; does **not** match Home/tab bar's flat `primary` |
| Player | "Start a Session" button | `LinearGradient([colors.primaryContainer, colors.inversePrimary])` | `#7189f6` → `#3c55bf` | (a) correct tokens, used correctly | Identical to Library's Quick Start (intentionally copied — see PROGRESS.md) |
| Insights | Stat icons (streak/sessions/minutes/trend) | `colors.primary`, `colors.secondary`, `colors.tertiary` | `#b9c3ff`, `#a7c8ff`, `#a6ccde` | (a) correct tokens | Matches Home/tab bar's light tones |
| Insights | Consistency calendar filled cells | `colors.primaryContainer` (flat) | `#7189f6` | (a) correct token, flat fill | Matches Library/Player's gradient *start* color, not their full gradient |
| Insights | Mood Trend chart line/glow | `colors.primary` (SVG stroke) | `#b9c3ff` | (a) correct token | Matches Home/tab bar |
| Insights | Mood Trend chart fill gradient | `colors.primaryContainer` → `colors.background`, 50%→0% opacity | `#7189f6` fading to transparent | (b) correct token, rendered differently via opacity fade | Intentional glow effect, not a clash — fades under the lighter line |

No hardcoded hex values (classification **(d)**) were found in any of the 5
investigated items, including `MoodTrendChart.tsx`, which was specifically
suspected per this project's history of literal SVG color values elsewhere — this
component uses `colors.primary`/`colors.primaryContainer`/`colors.background`
throughout, no literal hex.

## Detailed findings

### 1. Home screen — "Begin" button and "10 min" pill

`app/(tabs)/home.tsx:319-320`:
```ts
beginButton: {
  backgroundColor: colors.primary,
  ...
},
```
Flat fill, `colors.primary` = `#b9c3ff` (light periwinkle blue). **(a)** — a real
token, used as a flat background exactly as written.

`app/(tabs)/home.tsx:304-312`, the "10 min" pill (`durationPill`):
```ts
durationPill: {
  backgroundColor: `${colors.surfaceVariant}80`,
  ...
},
```
`colors.surfaceVariant` = `#323536` at ~50% alpha (`80` hex suffix) — a neutral dark
glass chip, not a blue accent at all. Its icon (`schedule`) uses `colors.onSurface`
(off-white), also neutral. **This element is not part of the reported color
inconsistency** — it was never intended to carry an accent color; it's the same
neutral treatment as Library's category-count badges and other secondary chips
throughout the app.

Visually confirmed (screenshot, `/home`, 393×852): "Begin" renders as a light
solid periwinkle pill; "10 min" renders as a dark neutral gray pill with white
text/icon — exactly matching the code.

### 2. Library screen — "Quick Start" button

`app/(tabs)/library.tsx:172-182`:
```tsx
<LinearGradient
  colors={[colors.primaryContainer, colors.inversePrimary]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.quickStart}
>
```
`colors.primaryContainer` = `#7189f6` (medium blue) → `colors.inversePrimary` =
`#3c55bf` (a distinctly darker navy blue). **(a)** — both are real, defined tokens,
and the gradient is applied exactly as coded; this is not a rendering artifact.
This is a **fundamentally different token pair** than Home's Begin button
(`primary`, flat, light) — not the same token rendered differently, an actually
different pair of tokens chosen for this button.

Visually confirmed: renders as a lighter blue-purple in the gradient's top-left
corner deepening to a distinctly darker navy toward the bottom-right — clearly
"deeper/darker" than Home's flat light periwinkle, matching the user's report
exactly.

### 3. Tab bar — active tab color, Home vs. Library

`app/(tabs)/_layout.tsx:78`:
```ts
const tintColor = focused ? colors.primary : `${colors.onSurfaceVariant}B3`;
```
and `app/(tabs)/_layout.tsx:104`: `tabBarActiveTintColor: colors.primary`.

Both the icon/label tint (`TabButton`'s own logic) and the navigator-level active
tint use **the same single token**, `colors.primary` (`#b9c3ff`), applied
identically regardless of which screen/tab is active. **(a)** — correct token,
used correctly and consistently.

Visually confirmed on all four screens (Home, Library, Player, Insights): the
active tab's icon and label render as the same light periwinkle blue in every
case — there is no variation in the tab bar's own color between screens. The
user's observation that "the tab bar's active color looks light blue, matching
Home's button" is accurate and expected: it's literally the same token, and it
does not change when Library (whose own button is darker) is the active tab. The
tab bar itself is internally consistent; it is Library/Player's *buttons* that
differ from it, not the tab bar varying by screen.

### 4. Player screen — "Start a Session" button

`app/(tabs)/player.tsx:88-101`:
```tsx
<LinearGradient
  colors={[colors.primaryContainer, colors.inversePrimary]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.startButton}
>
```
Identical token pair and direction to Library's Quick Start button. **(a)** —
correct tokens, and per PROGRESS.md's own build history ("'Start a Session'
upgraded from a flat-color button to the same gradient-pill treatment used by
Library's Quick Start ... for visual consistency across primary CTAs"), this was
an **intentional, explicit copy** of Library's exact gradient, not an accident.
Session Player's own "Begin Journey" button (`app/session-player.tsx:328`) uses
the same two tokens again, just reversed (`[inversePrimary, primaryContainer]`) —
three separate CTAs across the app deliberately sharing this darker gradient
pattern.

Visually confirmed: renders with the same lighter-top-left-to-darker-navy gradient
as Library's Quick Start, matching the user's "also looks deep blue" report.

### 5. Insights screen — accent colors and Mood Trend chart

Stat card icons (`app/(tabs)/insights.tsx:68,75,87,102`): `colors.primary` (streak,
trend), `colors.secondary` (sessions), `colors.tertiary` (minutes) — three distinct
but all light-toned tokens (`#b9c3ff`, `#a7c8ff`, `#a6ccde` respectively). **(a)**
for all three — real tokens, used as flat icon tints, all in the same light
family, consistent with Home/tab bar.

Consistency calendar filled cells (`app/(tabs)/insights.tsx:317`):
```ts
calendarCellFilled: {
  backgroundColor: colors.primaryContainer,
},
```
Flat `colors.primaryContainer` (`#7189f6`) — the same medium-blue token that
starts Library/Player's gradient buttons, but used here as a flat fill with no
gradient to `inversePrimary`. **(a)** — correct token, used correctly, but it is
a real, distinct hue-family step from the surrounding "light blue" icons on the
same screen (visually a noticeably richer blue than the stat icons directly below
it, though not as dark as Library/Player's full gradient since it never blends
down to `inversePrimary`).

Mood Trend chart (`src/components/MoodTrendChart.tsx`): line/glow stroke uses
`colors.primary` (line 109, `#b9c3ff`) — matches the "light blue" family exactly.
The area-fill gradient underneath (lines 93-96) uses `colors.primaryContainer` at
50% opacity fading to `colors.background` at 0% opacity — **(b)**, a correct token
rendered differently via an intentional opacity fade (a soft glow effect under the
line), not a competing solid color. No hardcoded hex values anywhere in this file.

Visually confirmed: the chart's visible curve reads as light blue (matching
Home/tab bar), and the calendar's filled cells read as a moderately richer
blue-purple — present but not clashing, sitting between Home's light `primary`
and Library/Player's darker gradient in perceived saturation.

## Root cause(s)

There is **one clear, single mechanical cause**, not several unrelated bugs: this
app currently has **two different, both-intentional token choices for "primary
action button,"** applied inconsistently across screens because they were built in
different sessions without a single documented rule for which one to use:

1. **Home's "Begin" button and the tab bar** use a flat fill of `colors.primary`
   (`#b9c3ff`) — the lightest of the blue-family tokens.
2. **Library's "Quick Start," Player's "Start a Session," and Session Player's
   "Begin Journey"** all use a `primaryContainer → inversePrimary` gradient
   (`#7189f6` → `#3c55bf`) — deliberately copied from one to the next (documented
   in PROGRESS.md as an explicit "for visual consistency across primary CTAs"
   decision at the time Player was built), but that consistency effort only ever
   compared those buttons to *each other*, never back to Home's original flat
   `primary` treatment.

Insights sits in between and doesn't add a third distinct cause: its icons and
chart line use the same light `primary`/`secondary`/`tertiary` family as Home, while
its calendar fill reuses `primaryContainer` — the same token that *starts*
Library/Player's gradient, just without the darker second stop. This is why
Insights reads as "light blue" overall (per the user's report) while still
containing one moderately richer accent (the calendar), rather than being a
separate inconsistency.

No hardcoded hex values, opacity miscalculations, or token-resolution bugs were
found anywhere in the 5 items audited — every color traced back cleanly to a real,
correctly-applied `tokens.ts` value. The inconsistency is a **design/decision-level
divergence** (two different valid-looking CTA treatments both in active use),
not a code defect.

---

## Expanded inventory (2026-09-19): every `colors.primary` usage app-wide

Follow-up to the CTA-button standardization above. The user noticed the flat
light-blue (`#b9c3ff`) look persists on *many* other elements beyond buttons —
greeting text, icons, badges, the calendar, the mood chart. Diagnostic only,
same as above: read-only, no code changed. Found via `grep 'colors\.primary\b'`
across `app/` and `src/`, then read in context (file/line below) to confirm what
each one actually renders as (text / icon / fill / border / gradient stop).

37 usages found across 12 files. Grouped by role, since most repeat the exact
same pattern across multiple screens rather than being 37 distinct decisions:

| Role | Where (file:line) | Value | Classification | Same inconsistency as the buttons? |
|---|---|---|---|---|
| "Alex" greeting / every screen's "Breathe" title (`GradientText`) | `home.tsx:57`, `library.tsx:86`, `player.tsx:59`, `insights.tsx:116`, `session-player.tsx:270` | gradient `[primary, tertiary]` | (a) correct, and identical everywhere it's used | **No** — a typographic branding accent, already 100% consistent with itself across all 5 screens; not a button |
| Settings gear icon | `home.tsx:69`, `library.tsx:96`, `player.tsx:69`, `insights.tsx:126`, `session-player.tsx:280` | flat `primary` | (a) correct, identical everywhere | **No** — a plain icon color, same on every screen; not a CTA |
| Home "NEW" badge (pill + text) | `home.tsx:276` (bg `${primary}1A`, ~10%), `home.tsx:286` (text) | flat `primary` at two opacities | (a) correct token | **Borderline** — it's a static status label, not interactive, but it is the same bright tone the old Begin button used. Cosmetic only if changed. |
| Library category-tab active state (border + label + count badge) | `library.tsx:316` (`${primary}80` border), `:325` (text), `:333` (`${primary}33` bg), `:341` (text) | flat `primary` at various opacities | (a) correct token | **Yes, most directly** — this is Library's own "currently-selected" indicator, the same *semantic role* the tab bar's active-tab color just changed away from. If the goal is one consistent "selected/active" accent app-wide, this is the closest analog to the tab bar case already fixed. |
| Insights stat-card icons | `insights.tsx:68` (streak, `primary`), `:102` (trend, `primary`) — for comparison, sessions uses `secondary` (`#a7c8ff`) and minutes uses `tertiary` (`#a6ccde`), **not** `primary` | flat `primary`/`secondary`/`tertiary` | (a) correct tokens | **No** — only 2 of the 4 stat icons are literally `colors.primary`; the other 2 are different (but visually similar pastel-blue) tokens. This is a deliberately varied per-card palette, not one repeated color. Worth knowing before "fixing" it, since changing only the literal `primary` ones would leave 2 of 4 icons unchanged and could look *more* inconsistent, not less. |
| Insights "Keep going" footer text | `insights.tsx:333` | flat `primary` | (a) correct token | **No** — small accent text under the calendar, not an interactive element. |
| Insights Consistency-calendar filled cells | `insights.tsx:316-318` | flat `colors.primaryContainer` (**not** `colors.primary` — a different, already-deeper token) | (a) correct token | **N/A / clarification** — the user's report grouped this with the "light blue" set, but it's actually already using `primaryContainer`, the same token that *starts* the new gradient standard. Visually it can still read as "blue" at a glance, but it's not part of this `colors.primary` inventory at all. |
| Insights Mood Trend chart — line stroke | `src/components/MoodTrendChart.tsx:109` | flat `primary` (SVG `stroke`, plus a glow filter) | (a) correct token | **Yes, plausibly** — this is the one chart element genuinely using the bright light-blue tone as its most visually dominant color (the line + its glow). Distinct from the fill (see next row). If full consistency is wanted, this is a real candidate — though note it's a data-viz line, not a clickable control, so "consistency with buttons" is a stylistic choice here, not a UI-affordance one. |
| Insights Mood Trend chart — fill gradient | `MoodTrendChart.tsx:94` | `primaryContainer` @ 50% → `background` @ 0% | (b) correct token, opacity-faded | **No** — already uses the deeper `primaryContainer` token, fading to transparent; this is the one chart element that already matches the gradient standard's starting color. |
| Session Player active-phase progress bar fill | `session-player.tsx:363` | gradient `[primary, tertiary]` | (a) correct tokens | **No** — a progress indicator (elapsed/total time), not a button; changing it to a button-style gradient wouldn't fit its role. |
| Session Player breathing ring (outer ring) | `src/components/BreathingRing.tsx:82` | `${primary}33` border (~20%) | (a) correct token | **No** — an ambient animated ring, very low opacity, not interactive. |
| Mood picker slider track fill | `src/components/MoodSelector.tsx:29` | gradient `[primary, tertiary]` | (a) correct token | **No** — a progress/position indicator (pre/post mood slider), same role as the session progress bar above. |
| Mood picker selected-bubble border | `MoodSelector.tsx:96` | `primary` border (paired with `primaryContainer` fill) | (a) correct token | **No** — already a two-tone treatment (fill from `primaryContainer`, border from `primary`), a selection-state indicator, not a CTA. |
| Home / Player ambient background glow | `home.tsx:200`, `player.tsx:127` | flat `primary` @ 6% opacity | (a) correct token | **No** — a barely-visible ambient tint behind all content, unrelated to any interactive element. |
| Settings "8:00 PM" reminder time text | `settings.tsx:169` | flat `primary` | (a) correct token | **No** — display text (the current reminder time), not a button; matches Library/Player's own use of `primary`-family tones for prominent numeric display text elsewhere (e.g. session durations). |
| Onboarding icons/links (leaf logo, Skip chevron+text, one step icon) | `welcome.tsx:34`, `build-habit.tsx:83`, `how-it-works.tsx:28,56,155`, `build-habit.tsx:253` | flat `primary` | (a) correct token | **No** — icons and plain text links, not buttons. |
| Onboarding headline gradients | `welcome.tsx:47`, `how-it-works.tsx:65` | gradients starting from `primary` | (a) correct token | **No** — same branding-headline role as the `GradientText` row above, just per-screen custom gradients rather than the shared component. |
| Onboarding illustration ring | `build-habit.tsx:184` | `${primary}33` border | (a) correct token | **No** — decorative ring around the flame illustration. |

### A related finding outside `colors.primary`'s scope, but relevant to "full visual consistency": onboarding's own CTA buttons use a *third* and *fourth* gradient recipe

Not part of this `colors.primary` inventory (these don't use it as their dominant
color), but directly relevant if the goal is one single CTA standard everywhere:
- **Welcome screen "Next"** (`welcome.tsx:63`): gradient `[colors.primary,
  colors.primaryContainer]` — `#b9c3ff` → `#7189f6`.
- **How It Works "NEXT"** (`how-it-works.tsx:92`) and **Build Habit "Get
  Started"** (`build-habit.tsx:112`): gradient `[colors.primaryContainer,
  colors.tertiary]` — `#7189f6` → `#a6ccde`.

Neither matches Library/Player's `[primaryContainer, inversePrimary]` standard.
These were flagged as their own known deviations when onboarding was originally
built (see PROGRESS.md's 2026-09-16 entry — each screen's button gradient was
matched to its own Stitch mockup CSS independently, never cross-checked against
Library/Player). If the user wants the gradient standard applied app-wide rather
than just to Home/tab-bar, these 3 onboarding buttons would need the same
treatment — flagging for a scope decision, not assuming it's wanted.

### Bottom line for scoping a follow-up change

If the goal is strictly "nothing calls back to the old flat-button look," the
**Library category-tab active state** and the **Mood Trend chart's line stroke**
are the two genuine candidates from this inventory — both use `colors.primary`
as a bright, dominant, foreground color in a way that's at least loosely
analogous to what the old Begin button did. Everything else above is either
already a different token (`primaryContainer`), already part of an established
and internally-consistent pattern (`GradientText` titles, settings icons,
ambient glows), or serves a genuinely different UI role (progress bars, sliders,
selection rings) where matching a *button* gradient wouldn't make semantic
sense. Onboarding's 3 CTA buttons are a separate, broader scope question (a
third/fourth gradient recipe, not `colors.primary` itself) worth deciding on
explicitly rather than folding in silently.

**Update (2026-09-19): all three items above have since been resolved** — the
Mood Trend chart line, all 3 onboarding buttons, and Library's category-tab
active state. See the "RESOLVED" sections near the top of this file. Every
candidate this audit identified is now closed.

No code has been changed for this expanded inventory — awaiting the user's
decision on scope before touching anything.
