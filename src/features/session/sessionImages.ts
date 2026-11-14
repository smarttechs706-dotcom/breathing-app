import type { ImageSourcePropType } from 'react-native';

// Full-screen portrait paintings for the session player's mood check-ins
// (before the session and Session Complete), keyed by session id. Must match
// SESSION_PORTRAIT_FILES in sessionModel.ts (tests/session/session.test.cjs
// checks both and that every file exists). Restored as they were before
// commit ce04e1e. While breathing, the background is the looping video
// instead (SessionBackdrop.tsx).
export const SESSION_PORTRAITS: Record<string, ImageSourcePropType> = {
  'deep-exhale': require('./images/session-deep-exhale-portrait.jpg'),
  'morning-reset': require('./images/session-morning-reset-portrait.jpg'),
  'calm-focus': require('./images/session-calm-focus-portrait.jpg'),
  'stress-relief': require('./images/session-stress-relief-portrait.jpg'),
  'wind-down': require('./images/session-wind-down-portrait.jpg'),
  'box-breathing': require('./images/session-box-breathing-portrait.jpg'),
};
