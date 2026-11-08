import { Ionicons } from '@expo/vector-icons';
// Deep imports, not documented public paths: expo-router vendors its own
// react-navigation/bottom-tabs copy (see app/(tabs)/home.tsx). The callback
// context is how a tab bar tells useBottomTabBarHeight() how much space it
// takes; the stock bar uses the same one. Could break on an expo-router
// upgrade that reorganizes these internal paths.
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from 'expo-router/build/react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from 'expo-router/build/react-navigation/bottom-tabs/utils/BottomTabBarHeightCallbackContext';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors, typography } from '../../theme/tokens';
import { highlightFrame, PILL_FLOAT, pillLayout, reservedHeight } from './tabBarLayout';

// Floating pill tab bar: a dark, nearly opaque pill, centred above the bottom
// safe area, with a soft rounded highlight that slides under the active tab.
// Sizes and spacing come from tabBarLayout.ts (closer to
// assets/design-reference/tabbar-reference.jpg). No blur on any platform
// (DEEP-AUDIT-3 F-01: Android's BlurView only tints).
//
// The highlight's rounded shape is drawn with SVG inside a plain Animated
// container that only moves sideways. It never relies on a view's own
// borderRadius inside an animated layer: that is what rendered the old
// active-tab pill as a square on Android (PROGRESS.md, pill-shape bug).

type IconName = keyof typeof Ionicons.glyphMap;

// Tabs shown in the pill, by route name: [active icon, inactive icon].
// A route without an entry here (e.g. the hidden Player tab) is not shown.
export const TAB_ICONS: Record<string, [IconName, IconName]> = {
  home: ['home', 'home-outline'],
  library: ['library', 'library-outline'],
  insights: ['trending-up', 'trending-up-outline'],
};

const ICON_SIZE = 20;
// Space between the icon box and the label; with the icon box's own padding
// this reads as about 5 dp.
const ICON_LABEL_GAP = 1;
const SLIDE_MS = 200;
const PRESS_MS = 160;
const PRESS_SCALE = 0.96;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const ACTIVE_TINT = colors.primary;
const INACTIVE_TINT = `${colors.onSurfaceVariant}A6`; // ~65%
// 95% so large text scrolling behind the pill does not show through.
const PILL_FILL = 'rgba(10,16,40,0.95)';
const PILL_BORDER_COLOR = 'rgba(255,255,255,0.1)';
const PILL_BORDER_WIDTH = 1;
const HIGHLIGHT_FILL = 'rgba(255,255,255,0.14)';

// True when the system "Remove animations" / "Reduce motion" setting is on;
// null until read. Unknown counts as reduced: things jump instead of moving.
function useReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

// Screen change between tabs: a short fade plus an 8 dp sideways shift,
// 200 ms ease-out. With reduced motion (or while unknown): no transition.
export function useTabTransitionOptions(): Pick<
  BottomTabNavigationOptions,
  'transitionSpec' | 'sceneStyleInterpolator'
> {
  const reduced = useReducedMotion();
  if (reduced !== false) return {};
  return {
    transitionSpec: { animation: 'timing', config: { duration: SLIDE_MS, easing: EASE_OUT } },
    sceneStyleInterpolator: ({ current }) => ({
      sceneStyle: {
        opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-8, 0, 8],
            }),
          },
        ],
      },
    }),
  };
}

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const reduced = useReducedMotion();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);

  const routes = state.routes.filter((route) => route.name in TAB_ICONS);
  const focusedKey = state.routes[state.index]?.key;
  const activeIndex = routes.findIndex((route) => route.key === focusedKey);

  const layout = pillLayout(screenWidth, routes.length);
  const footprint = reservedHeight(insets.bottom);

  // Tell useBottomTabBarHeight() how much space screens must keep free.
  useEffect(() => {
    reportHeight?.(footprint);
  }, [reportHeight, footprint]);

  // Highlight position: slides 200 ms ease-out; jumps with reduced motion
  // and on the first layout.
  const targetX = activeIndex >= 0 ? highlightFrame(layout, activeIndex).x : 0;
  const slide = useRef(new Animated.Value(targetX)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!placed.current || reduced !== false) {
      slide.setValue(targetX);
      placed.current = true;
      return;
    }
    const anim = Animated.timing(slide, {
      toValue: targetX,
      duration: SLIDE_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [slide, targetX, reduced]);

  const highlight = highlightFrame(layout, 0);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { height: footprint }]}
    >
      <View
        accessibilityRole="tablist"
        style={[
          styles.pill,
          {
            width: layout.width,
            height: layout.height,
            left: layout.left,
            bottom: PILL_FLOAT + insets.bottom,
            borderRadius: layout.height / 2,
          },
        ]}
      >
        {activeIndex >= 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.highlight,
              {
                // Absolute children start inside the border; the layout maths
                // measures from the pill's outer edge.
                left: -PILL_BORDER_WIDTH,
                top: highlight.y - PILL_BORDER_WIDTH,
                width: highlight.width,
                height: highlight.height,
                transform: [{ translateX: slide }],
              },
            ]}
          >
            <Svg width={highlight.width} height={highlight.height}>
              <Rect
                x={0}
                y={0}
                width={highlight.width}
                height={highlight.height}
                rx={highlight.height / 2}
                ry={highlight.height / 2}
                fill={HIGHLIGHT_FILL}
              />
            </Svg>
          </Animated.View>
        )}

        <View style={styles.row}>
          {routes.map((route, i) => {
            const options = descriptors[route.key].options;
            const label = typeof options.title === 'string' ? options.title : route.name;
            const focused = i === activeIndex;
            const [activeIcon, inactiveIcon] = TAB_ICONS[route.name];

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };
            const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

            return (
              <TabButton
                key={route.key}
                width={layout.tabWidth}
                height={layout.tabHeight}
                label={label}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                icon={focused ? activeIcon : inactiveIcon}
                focused={focused}
                reduced={reduced !== false}
                onPress={onPress}
                onLongPress={onLongPress}
                testID={options.tabBarButtonTestID}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

// One tab: icon over a short label, at least 48 x 48 dp. Dips to 0.96 while
// pressed (dims instead with reduced motion).
function TabButton({
  width,
  height,
  label,
  accessibilityLabel,
  icon,
  focused,
  reduced,
  onPress,
  onLongPress,
  testID,
}: {
  width: number;
  height: number;
  label: string;
  accessibilityLabel: string;
  icon: IconName;
  focused: boolean;
  reduced: boolean;
  onPress: () => void;
  onLongPress: () => void;
  testID?: string;
}) {
  const pressed = useRef(new Animated.Value(0)).current;
  const to = (value: number) =>
    Animated.timing(pressed, {
      toValue: value,
      duration: PRESS_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();

  const feedback = reduced
    ? { opacity: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }
    : {
        transform: [
          { scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, PRESS_SCALE] }) },
        ],
      };
  const tint = focused ? ACTIVE_TINT : INACTIVE_TINT;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={{ width, height }}
    >
      <Animated.View style={[styles.tab, feedback]}>
        <Ionicons name={icon} size={ICON_SIZE} color={tint} />
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  pill: {
    position: 'absolute',
    backgroundColor: PILL_FILL,
    borderWidth: PILL_BORDER_WIDTH,
    borderColor: PILL_BORDER_COLOR,
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: 10 },
      default: {
        shadowColor: '#000000',
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
    }),
  },
  highlight: {
    position: 'absolute',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ICON_LABEL_GAP,
  },
  label: {
    ...typography.labelSm,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
  },
});
