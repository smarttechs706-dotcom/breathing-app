import type { ImageSourcePropType } from 'react-native';

// Bundled session paintings, keyed by session id. Must match
// SESSION_IMAGE_FILES in sessionModel.ts (tests/session/session.test.cjs checks
// both and that every file exists). 1080 x 600 centre crops of the PNGs in
// assets/design-reference/.
export const SESSION_IMAGES: Record<string, ImageSourcePropType> = {
  'deep-exhale': require('./images/session-deep-exhale.jpg'),
  'morning-reset': require('./images/session-morning-reset.jpg'),
  'calm-focus': require('./images/session-calm-focus.jpg'),
  'stress-relief': require('./images/session-stress-relief.jpg'),
  'wind-down': require('./images/session-wind-down.jpg'),
  'box-breathing': require('./images/session-box-breathing.jpg'),
};

// Full-screen portrait paintings for the breathing screen, keyed by session id.
// Must match SESSION_PORTRAIT_FILES in sessionModel.ts (checked by the tests).
export const SESSION_PORTRAITS: Record<string, ImageSourcePropType> = {
  'deep-exhale': require('./images/session-deep-exhale-portrait.jpg'),
  'morning-reset': require('./images/session-morning-reset-portrait.jpg'),
  'calm-focus': require('./images/session-calm-focus-portrait.jpg'),
  'stress-relief': require('./images/session-stress-relief-portrait.jpg'),
  'wind-down': require('./images/session-wind-down-portrait.jpg'),
  'box-breathing': require('./images/session-box-breathing-portrait.jpg'),
};
