import { Tabs } from 'expo-router';

import { FloatingTabBar, useTabTransitionOptions } from '../../src/features/tab-bar/FloatingTabBar';

// Tab bar: a floating pill (src/features/tab-bar/FloatingTabBar.tsx) with
// Home, Library, Insights and Profile. Decided 2026-11-08 (see PROGRESS.md),
// replacing the full-width bar from the Stitch exports.
//
// History kept here because it shaped the new bar:
// - The 2026-09-14 removal of the active-tab pill: on Android the stock bar's
//   pill rendered as a square (hardware-layer promotion inside the vendored
//   Animated.View). The new bar is our own component, and its highlight is
//   drawn with SVG inside a plain animated container, never with an animated
//   view's own borderRadius.
// - DEEP-AUDIT-3 F-01: Android's BlurView only tints, so the bar has no blur;
//   the pill is a near-opaque navy fill instead.
// - Icons stay Ionicons outline/filled pairs (active = filled).
//
// Player is hidden from the bar (href: null) but kept as a route; nothing
// links to it, and sessions open the Session Player directly.
//
// The pill reports its full footprint (pill + float gap + bottom inset) to
// useBottomTabBarHeight(), so every tab keeps clear of it with its existing
// padding.
export default function TabsLayout() {
  const transition = useTabTransitionOptions();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, ...transition }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="player" options={{ title: 'Player', href: null }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
