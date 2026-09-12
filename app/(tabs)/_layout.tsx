import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '../../src/theme/tokens';

// architecture.md: bottom nav is ONE shared component (this file), not
// rebuilt per screen — Home/Insights' icon set (home, grid_view, air,
// monitoring, each with a text label) is the standard; ignore Library's
// Stitch export, which showed a different, label-less icon set.
//
// Icon substitutions (grid_view/air/monitoring, in order of vintage risk):
// on-device testing showed Library and Player rendering the wrong glyph
// entirely (a briefcase-like icon, a play-circle) despite the code using
// the documented names — `home` (one of Material Icons' original 2014
// glyphs, codepoint 0xe88a) rendered correctly while `grid-view` (0xe9b0),
// `air` (0xefd8), and `insights` (0xf092) didn't, and all three are
// comparatively recent additions to the icon set. That pattern points to
// Expo Go's bundled MaterialIcons font predating those codepoints' current
// assignment (Expo Go ships its own font copy tied to the SDK version,
// separate from this project's @expo/vector-icons install) rather than a
// bug in our code. Rather than depend on the user's Expo Go build being
// current, swapped to icons from Material Icons' original/early batch
// (low 0xe1xx-0xe6xx codepoints — safe across effectively every font
// revision ever shipped), picking the closest visual/semantic match to
// what architecture.md/the Stitch design intended for each:
// - Library: `grid-view` (0xe9b0) → `apps` (0xe5c3) — same "grid of
//   items" launcher-icon meaning as grid_view, just an older codepoint
// - Player: `air` (0xefd8) → `waves` (0xe176) — air/wind has no equally
//   old direct equivalent, but a wave/undulating-line glyph reads as
//   breathing rhythm just as well and is from the original 2014 batch
// - Insights: `insights` (0xf092) → `show-chart` (0xe6e1) — a trend-line
//   icon is arguably an even more literal fit for an analytics screen
//   than the abstract magnifying-glass-on-bars `insights` glyph, and is
//   from the same original batch as `waves`
type TabIconName = keyof typeof MaterialIcons.glyphMap;

// Root-caused why the earlier version (icon+label combined in tabBarIcon,
// tabBarShowLabel:false) was invisible on physical Android only: whatever
// tabBarIcon returns gets forced into a hard-coded 24x24 box
// (TabBarIcon.js's `wrapperMaterial`), and the tab item's outer View sets
// `overflow: variant === 'material' ? 'hidden' : 'visible'` — Android's
// bottom-tab variant is "material", so anything bigger than 24x24 (our
// pill+label) was silently clipped to nothing there specifically, while
// iOS/web use `overflow: 'visible'` and never clip it
// (node_modules/expo-router/build/react-navigation/bottom-tabs/views/
// BottomTabItem.js + TabBarIcon.js — this isn't @react-navigation/bottom-tabs,
// Expo Router vendors its own copy).
//
// Fix: use tabBarButton instead of tabBarIcon/tabBarLabel. It replaces the
// whole tab button before any of that fixed-size icon-slot logic runs, so
// the pill renders at the tab's real size on every platform. `focused`
// arrives as the button's `aria-selected` prop, not a dedicated field.
function TabButton({
  name,
  label,
  focused,
  onPress,
  style,
  testID,
}: {
  name: TabIconName;
  label: string;
  focused: boolean;
  onPress?: React.ComponentProps<typeof Pressable>['onPress'];
  style?: React.ComponentProps<typeof Pressable>['style'];
  testID?: string;
}) {
  const tintColor = focused ? colors.primary : `${colors.onSurfaceVariant}B3`;

  // Bug fix, round 2: overriding just `backgroundColor` (previous attempt)
  // stopped the box from showing on every tab, but the active tab still
  // rendered a hard-edged rectangle instead of a pill — the library's own
  // per-tab `style` also carries `borderRadius: 16` (BottomTabItem.js,
  // Android's "material" variant), which we were still inheriting and
  // never overrode. Rather than keep cancelling out individual properties
  // one at a time (background, then radius, then whatever's next), stop
  // inheriting the library's decorative styling altogether: pull out only
  // `flex` (needed so all 4 tabs share the row equally) and discard
  // everything else. Only our own `tabContent`/`tabContentActive` (with
  // `radii.full`) can paint a background now, on any platform.
  const libraryFlex = StyleSheet.flatten(
    typeof style === 'function' ? undefined : style
  )?.flex;

  return (
    <Pressable
      onPress={onPress}
      // Bug fix, round 3: padding values (16/4, matching home-code.html's
      // `px-4 py-1` exactly) were already correct — the pill still looked
      // oversized because this Pressable had no explicit `alignItems`, so
      // RN's default `alignItems: 'stretch'` stretched `tabContent` to
      // fill this Pressable's full flex-width (a quarter of the tab bar),
      // instead of hugging just the icon+label like the reference image.
      // `alignItems: 'center'` lets it size to its own intrinsic content
      // width instead.
      style={{ flex: libraryFlex, alignItems: 'center' }}
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
    >
      <View style={[styles.tabContent, focused && styles.tabContentActive]}>
        <MaterialIcons name={name} size={24} color={tintColor} />
        <Text style={[styles.label, { color: tintColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: `${colors.onSurfaceVariant}B3`,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        // BlurView confirmed NOT the earlier bug (a plain View fallback was
        // just as invisible) — restored, since expo-blur's own README
        // already documents its Android behavior (falls back to a plain
        // translucent View there, real blur on iOS only).
        tabBarBackground: () => (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarButton: (props) => (
            <TabButton
              name="home"
              label="Home"
              focused={!!props['aria-selected']}
              onPress={props.onPress}
              style={props.style}
              testID={props.testID}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarButton: (props) => (
            <TabButton
              name="apps"
              label="Library"
              focused={!!props['aria-selected']}
              onPress={props.onPress}
              style={props.style}
              testID={props.testID}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: 'Player',
          // No more special-cased onPress here — tapping Player now always
          // navigates to its own route like every other tab. That screen
          // (app/(tabs)/player.tsx) decides what to show: its own
          // dedicated empty state, or a redirect to the real Session
          // Player when one is genuinely in progress (tracked via
          // ActiveSessionContext). See that file for the full rationale.
          tabBarButton: (props) => (
            <TabButton
              name="waves"
              label="Player"
              focused={!!props['aria-selected']}
              onPress={props.onPress}
              style={props.style}
              testID={props.testID}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarButton: (props) => (
            <TabButton
              name="show-chart"
              label="Insights"
              focused={!!props['aria-selected']}
              onPress={props.onPress}
              style={props.style}
              testID={props.testID}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    height: 84,
    paddingTop: 8,
  },
  tabItem: {
    paddingTop: 4,
  },
  // home-code.html: `bg-primary-container/20 rounded-xl px-4 py-1` on the
  // active tab only.
  tabContent: {
    // Bug fix, round 4: `alignItems: 'center'` on the parent Pressable
    // (round 3) fixed this on web but NOT on-device — confirmed via a
    // full force-stop/clear-cache/reconnect that this was a genuine
    // Android layout difference, not staleness. Forcing the constraint
    // directly on this element instead of relying on the parent:
    // `alignSelf: 'center'` overrides whatever the parent's alignItems
    // does for this specific child, and flexGrow/flexShrink: 0 stop it
    // from being stretched/resized by the parent's flex layout at all —
    // it can only ever be as wide as its own icon+label content plus
    // padding, regardless of platform-specific parent-stretch behavior.
    alignSelf: 'center',
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  tabContentActive: {
    backgroundColor: `${colors.primaryContainer}33`,
  },
  label: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    marginTop: 2,
  },
});
