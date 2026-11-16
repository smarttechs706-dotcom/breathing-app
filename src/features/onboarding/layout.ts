import { StyleSheet } from 'react-native';

import { spacing } from '../../theme/tokens';

// One layout for the three onboarding screens, so the headline block starts at
// the same place and the primary button sits at the same height on each:
//   top bar | body (top-aligned, base*7 below the bar) | footer (pinned)
// The footer always keeps a slot the height of build-habit's secondary action
// ("Enable reminders") under the primary button; welcome and how-it-works leave
// it empty. 8-point spacing tokens only.

// The secondary action's row height (build-habit), and the empty slot that
// stands in for it on the other two screens.
export const SECONDARY_ACTION_HEIGHT = spacing.base * 6;

export const onboardingLayout = StyleSheet.create({
  body: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base * 7,
    paddingBottom: spacing.base * 2,
    gap: spacing.base * 5,
  },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base * 2,
    paddingBottom: spacing.base * 4,
    gap: spacing.base * 2,
  },
  secondarySlot: {
    minHeight: SECONDARY_ACTION_HEIGHT,
  },
});
