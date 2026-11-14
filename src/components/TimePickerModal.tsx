import { LinearGradient } from 'expo-linear-gradient';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ElementRef, ReactElement, Ref } from 'react';
import {
  Animated,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { text } from '../features/home/styles';
import { loopCopies, middleRow, recenterRow, wrapIndex } from './wheelLoop';
import { MIST_BACKGROUND, ScreenBackdrop } from '../features/profile/ScreenBackdrop';
import { colors, radii, spacing, typography } from '../theme/tokens';

const PERIODS = ['AM', 'PM'] as const;
type Period = (typeof PERIODS)[number];

// The ONE intentional deviation from time-picker-reference.png: it shows
// 5-minute steps (45, 50, 55, 00, 05...); this app shows every minute so
// on-the-hour and other non-round times stay selectable. A single constant
// controlling the step keeps this easy to change later if that changes.
const MINUTE_STEP = 1;

const HOURS_12 = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => {
  const value = i * MINUTE_STEP;
  return { value, label: value.toString().padStart(2, '0') };
});
const PERIOD_ITEMS = PERIODS.map((p) => ({ value: p, label: p }));

// 24h hour/minute <-> the 12h/minute/period wheels this picker shows.
function to12Hour(hour: number): { hour12: number; period: Period } {
  const period: Period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return { hour12, period };
}

function to24Hour(hour12: number, period: Period): number {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

const ITEM_HEIGHT = 40;
// Five rows: the selected one plus two fading rows above and below.
const VISIBLE_ROWS = 5;
const PADDING_ROWS = Math.floor(VISIBLE_ROWS / 2);
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

// Per-item opacity/scale as a function of distance from the centered row —
// this is what makes rows "fade and shrink with distance from center"
// continuously while dragging, not just in discrete visible-row steps.
const FADE_DISTANCES = [0, 1, 2, 3];
const OPACITY_STEPS = [1, 0.5, 0.3, 0.15];
const SCALE_STEPS = [1, 0.86, 0.75, 0.68];

interface WheelColumnHandle<T> {
  /** Reads the live scroll offset (not React state) — correct even if the
   * wheel is still coasting from a fling when this is called, since it
   * always resolves to whichever row that offset is nearest to (the row
   * snapToInterval is carrying it toward). */
  getCurrentValue: () => T;
}

interface WheelColumnProps<T> {
  data: { value: T; label: string }[];
  /** Only read once, at mount — positioning happens via a forced remount
   * (see the parent's `key`) plus this value, not a later imperative call.
   * Two real bugs found positioning this, in order: (1) the parent never
   * actually attached its refs to these components (`ref={hourRef}` etc.
   * were missing), so the original imperative `scrollTo` calls silently
   * no-op'd on a permanently-null ref — found by manually scrolling and
   * seeing the wheel mechanism itself (snap, fade, band) work perfectly,
   * which isolated the bug away from that mechanism. (2) Switching to a
   * declarative `contentOffset` prop *also* did nothing on web — reading
   * react-native-web's ScrollView source confirmed it doesn't implement
   * `contentOffset` at all (silently dropped). Fixed for real with both:
   * `contentOffset` for native (avoids an initial-frame flash there) plus
   * an explicit `scrollTo(..., false)` in a mount-only useLayoutEffect
   * below, which is what actually positions it on web. */
  initialValue: T;
  onChange: (value: T) => void;
  /** Hour and minute wheels loop (after 12 comes 1, after 59 comes 00, with
   * no empty end); AM/PM does not. See wheelLoop.ts. */
  loop?: boolean;
}

function WheelColumnInner<T>(
  { data, initialValue, onChange, loop = false }: WheelColumnProps<T>,
  ref: Ref<WheelColumnHandle<T>>
) {
  const scrollRef = useRef<ElementRef<typeof ScrollView>>(null);

  const indexOf = useCallback((value: T) => Math.max(0, data.findIndex((d) => d.value === value)), [data]);
  // A looping wheel shows its list several times over and opens on the middle
  // copy; a plain one shows it once.
  const copies = loop ? loopCopies(data.length) : 1;
  const rows = loop ? Array.from({ length: copies }, () => data).flat() : data;
  // Row index -> the value shown on that row.
  const valueAt = useCallback(
    (row: number) =>
      loop
        ? data[wrapIndex(row, data.length)].value
        : data[Math.min(Math.max(row, 0), data.length - 1)].value,
    [data, loop]
  );
  const initialIndex = loop ? middleRow(indexOf(initialValue), data.length, copies) : indexOf(initialValue);
  const initialOffset = initialIndex * ITEM_HEIGHT;

  // Updated synchronously on every scroll event (via the Animated.event
  // listener below) — this is the source of truth for getCurrentValue(),
  // independent of the Animated.Value used only for the visual fade/scale.
  const offsetRef = useRef(initialOffset);
  const scrollY = useRef(new Animated.Value(initialOffset)).current;

  // Web-safe fallback for `contentOffset` (see the prop comment above) —
  // mount-only (empty deps), since the parent forces a fresh mount of this
  // whole component on every open via `key`, which re-runs this with the
  // new initialOffset already baked in.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ x: 0, y: initialOffset, animated: false });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getCurrentValue: () => valueAt(Math.round(offsetRef.current / ITEM_HEIGHT)),
    }),
    [valueAt]
  );

  const handleScroll = Animated.event<NativeScrollEvent>(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      // The fade and scale of every row run on the UI thread; the listener
      // below still tracks the offset in JS for getCurrentValue().
      useNativeDriver: true,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetRef.current = e.nativeEvent.contentOffset.y;
      },
    }
  );

  function handleMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (loop) {
      // Jump (no animation) to the same value in the middle copy, so there is
      // always room to keep scrolling either way. The rows look identical.
      const centred = recenterRow(index, data.length, copies);
      if (centred !== index) {
        const y = centred * ITEM_HEIGHT;
        scrollRef.current?.scrollTo({ y, animated: false });
        offsetRef.current = y;
      }
    }
    onChange(valueAt(index));
  }

  function handleItemPress(row: number) {
    const y = row * ITEM_HEIGHT;
    scrollRef.current?.scrollTo({ y, animated: true });
    offsetRef.current = y;
    onChange(valueAt(row));
  }

  return (
    <View style={styles.wheelColumn}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: initialOffset }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * PADDING_ROWS }}
      >
        {rows.map((item, index) => {
          const center = index * ITEM_HEIGHT;
          const inputRange = [
            center - ITEM_HEIGHT * 3,
            center - ITEM_HEIGHT * 2,
            center - ITEM_HEIGHT * 1,
            center,
            center + ITEM_HEIGHT * 1,
            center + ITEM_HEIGHT * 2,
            center + ITEM_HEIGHT * 3,
          ];
          const opacityRange = [...OPACITY_STEPS].reverse().concat(OPACITY_STEPS.slice(1));
          const scaleRange = [...SCALE_STEPS].reverse().concat(SCALE_STEPS.slice(1));
          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: opacityRange,
            extrapolate: 'clamp',
          });
          const scale = scrollY.interpolate({
            inputRange,
            outputRange: scaleRange,
            extrapolate: 'clamp',
          });
          return (
            <Pressable key={`${index}-${String(item.value)}`} onPress={() => handleItemPress(index)}>
              <Animated.View style={[styles.wheelItem, { opacity, transform: [{ scale }] }]}>
                <Text style={styles.wheelItemText}>{item.label}</Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

// Generic forwardRef — plain `forwardRef(WheelColumnInner)` would erase T to
// `unknown` across all three wheels (hour/minute are numbers, period is a
// 'AM' | 'PM' string), losing type safety at every call site.
const WheelColumn = forwardRef(WheelColumnInner) as <T>(
  props: WheelColumnProps<T> & { ref?: Ref<WheelColumnHandle<T>> }
) => ReactElement;

// Scrolling wheel picker: three columns (hour / minute / AM-PM) on the mist
// backdrop, full screen, with no card, overlay or highlight shape. The middle
// row is pure white and largest; rows above/below fade and shrink with
// distance from center (opacity and scale only). Built from
// ScrollView + snapToInterval + Animated (no new dependency, no native
// package — see PROGRESS.md for why that matters this session). Replaces
// the earlier pill-row picker.
export function TimePickerModal({
  visible,
  initialHour,
  initialMinute,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  initialHour: number | null;
  initialMinute: number | null;
  onConfirm: (hour: number, minute: number) => void;
  onCancel: () => void;
}) {
  const hourRef = useRef<WheelColumnHandle<number>>(null);
  const minuteRef = useRef<WheelColumnHandle<number>>(null);
  const periodRef = useRef<WheelColumnHandle<Period>>(null);

  const initial12 =
    initialHour !== null ? to12Hour(initialHour) : { hour12: 8, period: 'AM' as Period };
  const initialMin = initialMinute ?? 0;

  // Modal's children stay mounted across open/close (parent just toggles
  // `visible`), so the wheels need to be repositioned on every open, not
  // just first mount — same lesson as the previous pill picker's identical
  // useEffect (see PROGRESS.md). Positioning itself is handled by each
  // WheelColumn's `contentOffset` (read once at mount, see its comment) —
  // this token just forces a fresh mount every time the modal opens (or
  // the saved time changes while open), so that initial read happens
  // again with the current value instead of a stale first-ever one.
  // useLayoutEffect so the remount + no-animation jump happens before
  // paint, avoiding a one-frame flash at the wheels' previous position.
  const [openToken, setOpenToken] = useState(0);
  useLayoutEffect(() => {
    if (!visible) return;
    setOpenToken((t) => t + 1);
  }, [visible, initialHour, initialMinute]);

  function handleConfirm() {
    const hour12 = hourRef.current?.getCurrentValue() ?? 8;
    const minute = minuteRef.current?.getCurrentValue() ?? 0;
    const period = periodRef.current?.getCurrentValue() ?? 'AM';
    onConfirm(to24Hour(hour12, period), minute);
  }

  return (
    // statusBarTranslucent + navigationBarTranslucent: on edge-to-edge Android
    // a transparent Modal otherwise leaves the system bar strips undimmed, so
    // the backdrop doesn't read as covering the whole screen.
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <ScreenBackdrop painting={MIST_BACKGROUND} />
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.content}>
            <Text style={styles.title} accessibilityRole="header">
              Choose a reminder time
            </Text>

            <View style={styles.wheelRow}>
              <WheelColumn
                key={`hour-${openToken}`}
                ref={hourRef}
                data={HOURS_12}
                initialValue={initial12.hour12}
                onChange={() => {}}
                loop
              />
              <WheelColumn
                key={`minute-${openToken}`}
                ref={minuteRef}
                data={MINUTES}
                initialValue={initialMin}
                onChange={() => {}}
                loop
              />
              <WheelColumn
                key={`period-${openToken}`}
                ref={periodRef}
                data={PERIOD_ITEMS}
                initialValue={initial12.period}
                onChange={() => {}}
              />
            </View>

            <View style={styles.actions}>
              <Pressable onPress={handleConfirm} style={styles.confirmPress}>
                <LinearGradient
                  colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmButton}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Full screen over the mist backdrop; tapping outside the content cancels,
  // as before. No dim overlay.
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.marginMobile,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'stretch',
  },
  title: {
    ...text.pageTitle,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: spacing.base * 5,
  },
  wheelRow: {
    flexDirection: 'row',
    height: WHEEL_HEIGHT,
    gap: spacing.base * 2,
  },
  wheelColumn: {
    flex: 1,
    height: WHEEL_HEIGHT,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 15 sp (68% of the previous 22 sp). The selected row is full white at full
  // scale; the rows around it are the same white at lower opacity and scale.
  wheelItemText: {
    ...typography.headlineLgMobile,
    fontSize: 15,
    lineHeight: 20,
    color: '#ffffff',
  },
  actions: {
    marginTop: spacing.base * 5,
    gap: spacing.base * 2,
  },
  confirmPress: {
    width: '100%',
    borderRadius: radii.full,
  },
  confirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: spacing.base * 2,
    borderRadius: radii.full,
  },
  confirmButtonText: {
    ...typography.headlineLgMobile,
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
  },
  cancelButton: {
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.base * 2,
  },
  cancelButtonText: {
    ...text.link,
    color: '#ffffff',
  },
});
