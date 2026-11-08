// Pure layout maths for the floating pill tab bar (FloatingTabBar.tsx). No
// React Native imports, so it is tested directly in Node
// (tests/tab-bar/tabBarLayout.test.cjs). Works for any number of tabs: each
// tab is one fixed slot, so a fourth tab simply adds a slot.
//
// Sizes follow assets/design-reference/tabbar-reference.jpg measured on a
// 392 dp phone (pill ~228 x 56 dp, tab spacing ~74 dp), kept to 48 dp tap
// targets.

export const PILL_HEIGHT = 56; // dp
export const PILL_FLOAT = 16; // dp above the bottom safe area
export const PILL_PADDING = 4; // dp inside the pill, around the tab row
export const TAB_SLOT = 74; // dp, width of one tab
export const MIN_TAB = 48; // dp, smallest tap target in either direction
export const SCREEN_MARGIN = 12; // dp, the pill never comes closer to the screen edge
export const HIGHLIGHT_INSET = 2; // dp between a tab slot's sides and its highlight

export interface PillLayout {
  width: number;
  left: number;
  height: number;
  tabWidth: number;
  tabHeight: number;
}

// Width = tabs x 74 + 8 (230 dp for 3, 304 dp for 4). On a screen too narrow
// for that, the slots shrink to fit, but never below MIN_TAB.
export function pillLayout(screenWidth: number, tabCount: number): PillLayout {
  const count = Math.max(1, Math.floor(tabCount));
  const natural = count * TAB_SLOT + 2 * PILL_PADDING;
  const maxWidth = screenWidth - 2 * SCREEN_MARGIN;
  const minWidth = count * MIN_TAB + 2 * PILL_PADDING;
  const width = Math.max(minWidth, Math.min(natural, maxWidth));
  return {
    width,
    left: (screenWidth - width) / 2,
    height: PILL_HEIGHT,
    tabWidth: (width - 2 * PILL_PADDING) / count,
    tabHeight: PILL_HEIGHT - 2 * PILL_PADDING,
  };
}

// The soft highlight behind the active tab, in pill coordinates: the full
// slot height, 2 dp in from each side (70 x 48 dp with standard slots).
export function highlightFrame(layout: PillLayout, index: number) {
  return {
    x: PILL_PADDING + index * layout.tabWidth + HIGHLIGHT_INSET,
    y: PILL_PADDING,
    width: layout.tabWidth - 2 * HIGHLIGHT_INSET,
    height: layout.tabHeight,
  };
}

// What screens must keep free at the bottom: the pill, its float gap and
// the safe-area inset under it. Reported to useBottomTabBarHeight().
export function reservedHeight(bottomInset: number): number {
  return PILL_HEIGHT + PILL_FLOAT + Math.max(0, bottomInset);
}
