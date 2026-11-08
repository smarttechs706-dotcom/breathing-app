import { Redirect } from 'expo-router';

import { HomeRedesignPreview } from '../src/features/home-redesign-preview/HomeRedesignPreview';

// Dev builds only. Reached from the __DEV__ row at the bottom of Settings.
// In any other build this route sends the user back to the root.
export default function HomeRedesignPreviewRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <HomeRedesignPreview />;
}
