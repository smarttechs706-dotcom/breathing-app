---
name: Ethereal Breath
colors:
  surface: '#111415'
  surface-dim: '#111415'
  surface-bright: '#373a3b'
  surface-container-lowest: '#0c0f10'
  surface-container-low: '#191c1d'
  surface-container: '#1d2021'
  surface-container-high: '#282a2b'
  surface-container-highest: '#323536'
  on-surface: '#e1e3e4'
  on-surface-variant: '#c5c5d5'
  inverse-surface: '#e1e3e4'
  inverse-on-surface: '#2e3132'
  outline: '#8f909e'
  outline-variant: '#444653'
  surface-tint: '#b9c3ff'
  primary: '#b9c3ff'
  on-primary: '#002388'
  primary-container: '#7189f6'
  on-primary-container: '#001e78'
  inverse-primary: '#3c55bf'
  secondary: '#a7c8ff'
  on-secondary: '#003060'
  secondary-container: '#214779'
  on-secondary-container: '#94b7ef'
  tertiary: '#a6ccde'
  on-tertiary: '#093543'
  tertiary-container: '#7196a7'
  on-tertiary-container: '#002e3c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b9c3ff'
  on-primary-fixed: '#001356'
  on-primary-fixed-variant: '#1f3ba6'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#a7c8ff'
  on-secondary-fixed: '#001c3b'
  on-secondary-fixed-variant: '#214779'
  tertiary-fixed: '#c1e8fa'
  tertiary-fixed-dim: '#a6ccde'
  on-tertiary-fixed: '#001f29'
  on-tertiary-fixed-variant: '#254c5a'
  background: '#111415'
  on-background: '#e1e3e4'
  surface-variant: '#323536'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  margin-mobile: 24px
  margin-desktop: 64px
  gutter: 16px
  section-gap: 40px
---

## Brand & Style

The design system is centered on the concept of "Digital Zen"—a premium, meditative experience designed to lower cortisol levels through visual tranquility. The target audience includes high-performance individuals seeking mental clarity and users managing anxiety through guided breathwork.

The aesthetic follows a **Glassmorphic** movement, emphasizing depth through translucency and blurred layers rather than harsh shadows. By utilizing a deep, nocturnal palette paired with ethereal glowing elements, the UI evokes a sense of being in a vast, calm observatory. Motion should be fluid and "weightless," mimicking the natural rhythm of breathing.

## Colors

This design system uses a deep dark mode foundation to minimize eye strain and promote relaxation. The background is never a flat black; it is a three-stop vertical linear gradient that creates an immersive, "infinite" space.

- **Primary & Accents:** A dual-gradient system. Use the Indigo-to-Purple (#667eea to #764ba2) for active states and primary buttons. Use the Cyan-to-Blue (#a1c4fd to #c2e9fb) for secondary highlights and success states.
- **Glass Surfaces:** UI containers are defined by low-opacity white fills with high backdrop-blur (40px+) and a subtle 1px inner stroke to catch light.
- **Typography Colors:** Primary text uses off-white (#F8F9FA) for high legibility, while secondary labels use a 60% opacity variant to maintain hierarchy.

## Typography

The typography utilizes **Plus Jakarta Sans** for its friendly, rounded terminals and contemporary geometric structure. 

- **Display Text:** Large headlines should use negative letter-spacing and heavy weights to anchor the page.
- **Body Text:** Maintains a generous line height (1.5x+) to ensure a breathable, "airy" reading experience.
- **Labels:** Use uppercase for small labels (like "STRESS LEVEL") with increased letter spacing to ensure clarity against blurred backgrounds.
- **Hierarchy:** Rely on weight and opacity (rather than just size) to differentiate information.

## Layout & Spacing

The layout philosophy is **fluid and spacious**, prioritizing negative space to reduce cognitive load. 

- **Grid Model:** A 12-column fluid grid for desktop and a 4-column grid for mobile.
- **Safe Areas:** A minimum 24px horizontal margin is required on all mobile screens to prevent content from feeling "trapped."
- **Rhythm:** All spacing must be a multiple of 8px. Use larger 40px+ gaps between logical sections to create a sense of calm and intentionality.
- **Content Flow:** On mobile, components like meditation cards should use horizontal carousels to maintain focus on one element at a time.

## Elevation & Depth

Depth is conveyed through **Z-axis layering** and backdrop filters rather than traditional drop shadows.

1.  **Base Layer:** The deep navy-to-purple background gradient.
2.  **Surface Layer:** Glassmorphic cards with a `backdrop-filter: blur(40px)`. These represent the primary interactive containers.
3.  **Glow Layer:** Soft, diffused radial gradients (20% opacity) positioned behind cards or illustrations to suggest a light source within the UI.
4.  **Interactive Layer:** Floating elements (like FABs or active play buttons) utilize the Indigo-to-Cyan accent gradient to "pop" forward from the muted background.

## Shapes

The shape language is organic and soft. There are no sharp corners in this design system.

- **Primary Cards:** Use a minimum radius of 24px (`rounded-xl` or `rounded-2xl`).
- **Secondary Elements:** Small buttons or tags should be fully pill-shaped (rounded-full).
- **Illustrations:** Any graphic elements (spheres, particles) should follow a circular or soft-edged geometry to reinforce the "Breathe" narrative.

## Components

- **Buttons:** Primary buttons use the Indigo-to-Cyan linear gradient with a slight inner glow. Secondary buttons use a glass surface with a white border.
- **Cards (Meditation/Health):** High-blur glass containers. The background of the card should feature subtle "ethereal particles" or blurred organic shapes that correlate to the content (e.g., green-tinted blur for "Nature" sounds).
- **Inputs:** Search bars and text fields use a darker glass variant (rgba(0,0,0,0.2)) to provide contrast against the primary glass cards.
- **Progress Bars:** Use a thick, rounded track with a glowing gradient indicator. The track should be semi-transparent.
- **Floating Breath Indicator:** A large, central sphere that pulses (scales up/down) with a soft glow to guide user inhalation/exhalation.
- **Chips:** Small, pill-shaped glass containers with 12px horizontal padding for categorizing sessions (e.g., "15 mins", "Deep Sleep").