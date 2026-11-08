// Deep import, not a documented public path: expo-router vendors its own
// react-navigation/bottom-tabs copy (there's no separate
// @react-navigation/bottom-tabs dependency), and this hook isn't
// re-exported from the top-level 'expo-router' package. It's still the
// library's own recommended fix for this problem (its own type comments
// say so), and is CONFIRMED correct on-device via instrumented debugging
// (reported tabBarHeight=84.0, matching reality exactly). Flagging the
// fragility: could break on an expo-router upgrade that reorganizes this
// internal path.
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';

import { HomeScreen } from '../../src/features/home/HomeScreen';

// Home tab. The screen lives in src/features/home/ (the redesign: greeting,
// week row, orb, Featured card, "Now for you" on time-of-day paintings). The
// tab bar floats over the screen, so its real height is passed in to keep the
// cards clear of it. The hook only works inside the tab navigator, which is
// why it is read here and not in the shared screen.
export default function HomeTab() {
  const tabBarHeight = useBottomTabBarHeight();
  return <HomeScreen tabBarHeight={tabBarHeight} />;
}
