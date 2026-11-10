// The Insights tab's colours, in one place. White for emphasis (numbers, the
// ring, the After line), a muted slate for the Before line, the button indigo
// for accents. The light periwinkle accent is not used on this screen.
export const INSIGHT_COLORS = {
  emphasis: '#ffffff',
  before: '#8f99bd', // muted slate, about 6:1 on the navy cards
  track: 'rgba(255,255,255,0.12)',
  grid: 'rgba(255,255,255,0.08)',
  indigoStart: '#3c55bf', // colors.inversePrimary
  indigoEnd: '#1f3ba6', // colors.onPrimaryFixedVariant
} as const;
