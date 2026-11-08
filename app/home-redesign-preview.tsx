import { Redirect } from 'expo-router';

import { HomeScreen } from '../src/features/home/HomeScreen';

// Dev builds only. Reached from the __DEV__ row at the bottom of Settings.
// Shows the same Home screen outside the tabs (no tab bar; the same space is
// kept free). In any other build this route sends the user back to the root.
export default function HomeRedesignPreviewRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <HomeScreen />;
}
