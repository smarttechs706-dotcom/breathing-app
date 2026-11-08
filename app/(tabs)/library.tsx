// Deep import, not a documented public path: see app/(tabs)/home.tsx.
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';

import { LibraryScreen } from '../../src/features/library/LibraryScreen';

// Library tab. The screen lives in src/features/library/ (search, category
// chips, Quick Start and one painted image card per session). The floating
// tab bar's footprint is passed in so the last card stays clear of it.
export default function LibraryTab() {
  const tabBarHeight = useBottomTabBarHeight();
  return <LibraryScreen tabBarHeight={tabBarHeight} />;
}
