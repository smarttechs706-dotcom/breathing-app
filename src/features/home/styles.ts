import { colors, typography } from '../../theme/tokens';

// Sizes measured from assets/design-reference/home-redesign-reference.png (504 px wide), scaled to a
// 390 pt phone (x0.774) and rounded. Font family and weight always come from a
// tokens.ts role; only size, line height and tracking are set here.
export const text = {
  greeting: { ...typography.bodyMd, fontSize: 14, lineHeight: 20 },
  name: { ...typography.displayTitle, fontSize: 24, lineHeight: 36, letterSpacing: -0.24 },
  // Page titles in a screen header (Library, Insights). One place to change.
  pageTitle: { ...typography.displayTitle, fontSize: 24, lineHeight: 36 },
  dayLetter: { ...typography.labelSm, letterSpacing: 0 },
  streak: { ...typography.labelSm, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  eyebrow: { ...typography.labelSm },
  featuredTitle: { ...typography.headlineLgMobile, fontSize: 20, lineHeight: 28 },
  meta: { ...typography.bodyMd, fontSize: 14, lineHeight: 20 },
  sectionTitle: { ...typography.headlineLgMobile, fontSize: 18, lineHeight: 24 },
  link: { ...typography.labelSm, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  // Text links (Retry, Enable reminders): bold, true white set by the caller.
  linkBold: { ...typography.displayLg, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  cardTitle: { ...typography.labelSm, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  cardMeta: { ...typography.bodyMd, fontSize: 12, lineHeight: 16 },
  body: { ...typography.bodyMd, fontSize: 14, lineHeight: 20 },
} as const;

// Colors the reference uses that tokens.ts has no role for. Kept in one place
// so they are easy to review. Flame is the same orange the current Home uses.
export const accents = {
  sun: '#fbbf24',
  flame: '#fb923c',
  streakText: '#fcd34d',
  playButton: colors.inversePrimary,
  dayDone: `${colors.primaryContainer}B3`,
  dayDoneBorder: 'rgba(255,255,255,0.35)',
  // Empty days: a thin white ring, no fill.
  dayEmpty: 'transparent',
  dayEmptyBorder: 'rgba(255,255,255,0.6)',
  // Home's streak flame over the hero's sunset: a deep orange-red (the sky
  // behind it is light peach, so orange and amber wash out). The "0 days"
  // text is plain white.
  streakFlame: '#dc2626',
  // Light glass (cards, streak pill) and the blue glass avatar.
  glassFill: 'rgba(150,170,235,0.13)',
  glassBorder: 'rgba(255,255,255,0.16)',
  avatarFill: 'rgba(80,110,220,0.45)',
  avatarBorder: 'rgba(255,255,255,0.28)',
} as const;
