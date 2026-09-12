// Generated from assets/design-reference/DESIGN.md's frontmatter YAML.
// Per architecture.md's "Colors — source of truth" note: the frontmatter
// values below are authoritative. DESIGN.md's prose "## Colors" section
// (Indigo-to-Purple/Cyan-to-Blue gradients) is descriptive only and must
// NOT be used as a source of hex values — where the two disagree, this
// file must match the frontmatter, not the prose.

export const colors = {
  surface: '#111415',
  surfaceDim: '#111415',
  surfaceBright: '#373a3b',
  surfaceContainerLowest: '#0c0f10',
  surfaceContainerLow: '#191c1d',
  surfaceContainer: '#1d2021',
  surfaceContainerHigh: '#282a2b',
  surfaceContainerHighest: '#323536',
  onSurface: '#e1e3e4',
  onSurfaceVariant: '#c5c5d5',
  inverseSurface: '#e1e3e4',
  inverseOnSurface: '#2e3132',
  outline: '#8f909e',
  outlineVariant: '#444653',
  surfaceTint: '#b9c3ff',
  primary: '#b9c3ff',
  onPrimary: '#002388',
  primaryContainer: '#7189f6',
  onPrimaryContainer: '#001e78',
  inversePrimary: '#3c55bf',
  secondary: '#a7c8ff',
  onSecondary: '#003060',
  secondaryContainer: '#214779',
  onSecondaryContainer: '#94b7ef',
  tertiary: '#a6ccde',
  onTertiary: '#093543',
  tertiaryContainer: '#7196a7',
  onTertiaryContainer: '#002e3c',
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
  primaryFixed: '#dde1ff',
  primaryFixedDim: '#b9c3ff',
  onPrimaryFixed: '#001356',
  onPrimaryFixedVariant: '#1f3ba6',
  secondaryFixed: '#d5e3ff',
  secondaryFixedDim: '#a7c8ff',
  onSecondaryFixed: '#001c3b',
  onSecondaryFixedVariant: '#214779',
  tertiaryFixed: '#c1e8fa',
  tertiaryFixedDim: '#a6ccde',
  onTertiaryFixed: '#001f29',
  onTertiaryFixedVariant: '#254c5a',
  background: '#111415',
  onBackground: '#e1e3e4',
  surfaceVariant: '#323536',
} as const;

export type ColorToken = keyof typeof colors;

interface TypographyStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
  letterSpacing?: number;
}

// Loaded in app/_layout.tsx via @expo-google-fonts/plus-jakarta-sans's
// useFonts hook. React Native applies a custom font's own weight rather
// than synthesizing one, so each style below points at the TTF matching
// its DESIGN.md fontWeight, not a single generic "Plus Jakarta Sans" family.
export const fontFamilies = {
  regular: 'PlusJakartaSans_400Regular',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

// fontSize/lineHeight converted from DESIGN.md's px values to RN's unitless
// numbers. letterSpacing converted from DESIGN.md's em values to px
// (em * fontSize), since React Native's letterSpacing is a px number, not em.
export const typography = {
  displayLg: {
    fontFamily: fontFamilies.bold,
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
    letterSpacing: -0.02 * 48,
  },
  headlineLg: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 40,
  },
  headlineLgMobile: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 36,
  },
  bodyLg: {
    fontFamily: fontFamilies.regular,
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28,
  },
  bodyMd: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  labelSm: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.05 * 12,
  },
} satisfies Record<string, TypographyStyle>;

export type TypographyToken = keyof typeof typography;

// DESIGN.md's `rounded` values are in rem; converted to px at the standard
// 1rem = 16px (React Native has no rem unit, so radii must be plain numbers).
const REM = 16;

export const radii = {
  sm: 0.5 * REM,
  DEFAULT: 1 * REM,
  md: 1.5 * REM,
  lg: 2 * REM,
  xl: 3 * REM,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radii;

export const spacing = {
  base: 8,
  marginMobile: 24,
  marginDesktop: 64,
  gutter: 16,
  sectionGap: 40,
} as const;

export type SpacingToken = keyof typeof spacing;

export const tokens = { colors, typography, radii, spacing } as const;

export default tokens;
