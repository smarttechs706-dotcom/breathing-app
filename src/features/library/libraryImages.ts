import type { ImageSourcePropType } from 'react-native';

// Bundled card images, keyed by session id. Must match CARD_IMAGE_FILES in
// libraryModel.ts (tests/library/library.test.cjs checks both and that every
// file exists). 1000 x 400 JPGs converted from assets/design-reference/.
export const CARD_IMAGES: Record<string, ImageSourcePropType> = {
  'deep-exhale': require('./images/library-deep-exhale.jpg'),
  'morning-reset': require('./images/library-morning-reset.jpg'),
  'calm-focus': require('./images/library-calm-focus.jpg'),
  'stress-relief': require('./images/library-stress-relief.jpg'),
  'wind-down': require('./images/library-wind-down.jpg'),
  'box-breathing': require('./images/library-box-breathing.jpg'),
};
