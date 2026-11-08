// Deep import, not a documented public path: see app/(tabs)/home.tsx.
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';

import { ProfileScreen } from '../../src/features/profile/ProfileScreen';

// Profile tab. The screen lives in src/features/profile/. The floating tab
// bar's footprint is passed in so the last card stays clear of it.
export default function ProfileTab() {
  const tabBarHeight = useBottomTabBarHeight();
  return <ProfileScreen tabBarHeight={tabBarHeight} />;
}
