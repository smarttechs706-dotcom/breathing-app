import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../src/theme/tokens';

// Pill-shape bug (multi-session investigation, see PROGRESS.md for the full
// history): the active tab's background pill rendered as a rectangle instead
// of a pill after any tab switch on Android, never self-correcting. Two
// hypotheses (detachInactiveScreens, tabBarBackground's BlurView) were
// disproven via on-device ADB testing; the leading theory pinned it on
// Android hardware-layer promotion inside expo-router's vendored
// Animated.View tab-bar internals — not fixable without patching
// third-party code. Resolved by removing the pill entirely (LinkedIn-style:
// no background shape on any tab) rather than continuing to chase it — there
// is no longer a shape for that bug to render incorrectly.
//
// All 3 Stitch HTML references (home-code.html, library-code.html,
// insights-code.html) already encode an icon-fill convention independent of
// the pill: active tabs use Material Symbols' `FILL 1` (solid) variant,
// inactive tabs use the default `FILL 0` (outlined) variant. That's the
// convention this file now expresses directly via icon swap + color, with
// the pill dropped.
//
// `@expo/vector-icons`'s bundled `MaterialIcons` is a static, filled-only
// font — it has no outline counterpart and can't do the FILL axis toggle.
// Swapped to `Ionicons`, which ships true outline/filled name pairs
// (`home`/`home-outline`, etc.) and is already bundled in this project's
// `@expo/vector-icons` install, no new dependency. Icon choices per tab:
// - Home: `home` / `home-outline` — direct match, no change in meaning
// - Library: `library` / `library-outline` — stacked-books glyph, the most
//   literal "library of sessions" match (swapped from `grid`/`grid-outline`
//   per explicit user request, after reviewing MaterialIcons options and
//   choosing to keep the Ionicons fill/outline pair for consistency with
//   the rest of the tab bar rather than a filled-only MaterialIcons glyph)
// - Player: `play-circle` / `play-circle-outline` — Ionicons has no
//   wind/air/waves icon; a media-style play button reads clearly as
//   "start/resume a session" and, unlike a pulse/heartbeat-style icon,
//   doesn't visually suggest real biometric data (CLAUDE.md: no real
//   biometrics in this app). Also avoids reusing `leaf`/`moon`/`zap`/`heart`,
//   which are the locked per-session badge icons elsewhere in the app.
// - Insights: `trending-up` / `trending-up-outline` — a line-chart-with-
//   arrowhead glyph, the standard "analytics/trend" convention (swapped
//   from `stats-chart`'s bar-chart glyph per explicit user request for a
//   more standard analytics icon)
//
// Same residual risk as the earlier MaterialIcons codepoint bug: Expo Go
// bundles its own copy of these icon fonts tied to its SDK version, separate
// from this project's npm-installed copy, so a name that exists in the
// installed glyphmap can still fail to render on-device. Needs on-device
// confirmation, not just a web check.
type TabIconName = keyof typeof Ionicons.glyphMap;

// tabBarButton (not tabBarIcon/tabBarLabel) replaces the whole tab button
// before expo-router's fixed-size 24x24 icon-slot + overflow:hidden logic
// runs (see node_modules/expo-router/.../BottomTabItem.js /
// TabBarIcon.js) — required for anything that doesn't fit that fixed box,
// still true even with the pill removed since the label lives here too.
// `focused` arrives as the button's `aria-selected` prop.
function TabButton({
  activeIcon,
  inactiveIcon,
  label,
  focused,
  onPress,
  style,
  testID,
}: {
  activeIcon: TabIconName;
  inactiveIcon: TabIconName;
  label: string;
  focused: boolean;
  onPress?: React.ComponentProps<typeof Pressable>['onPress'];
  style?: React.ComponentProps<typeof Pressable>['style'];
  testID?: string;
}) {
  // CONTRAST FIX (2026-09-20, AUDIT-2.md Medium finding): the 2026-09-19
  // COLOR-AUDIT.md pass put colors.inversePrimary (#3c55bf) here as a flat
  // foreground color — computed WCAG contrast against this screen's
  // near-black background (#111415) is only ~2.86:1, below the 3:1 (icon)
  // / 4.5:1 (label text) AA minimums. Reverted to colors.primary (#b9c3ff),
  // which computes to ~10.85:1 against the same background — the CTA
  // *buttons* still use the darker gradient family (fixed separately, see
  // home.tsx/library.tsx/player.tsx), but a small icon+label indicator on a
  // dark background needs a genuinely light foreground color, not the
  // gradient's dark end.
  const tintColor = focused ? colors.primary : `${colors.onSurfaceVariant}B3`;
  const libraryFlex = StyleSheet.flatten(
    typeof style === 'function' ? undefined : style
  )?.flex;

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: libraryFlex, alignItems: 'center', justifyContent: 'center' }}
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
    >
      <View style={styles.tabContent}>
        <Ionicons name={focused ? activeIcon : inactiveIcon} size={24} color={tintColor} />
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
              activeIcon="home"
              inactiveIcon="home-outline"
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
              activeIcon="library"
              inactiveIcon="library-outline"
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
          // Tapping Player always navigates to its own route; that screen
          // (app/(tabs)/player.tsx) decides whether to show its empty state
          // or redirect to a genuinely in-progress session, via
          // ActiveSessionContext.
          tabBarButton: (props) => (
            <TabButton
              activeIcon="play-circle"
              inactiveIcon="play-circle-outline"
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
              activeIcon="trending-up"
              inactiveIcon="trending-up-outline"
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
  // No background/pill by design (LinkedIn-style) — active vs. inactive is
  // conveyed entirely by icon fill variant + color, set in TabButton.
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    marginTop: 2,
  },
});
