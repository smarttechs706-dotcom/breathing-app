import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '../../theme/tokens';
import { EASE_OUT, useReducedMotion } from '../home/motion';
import { accents, text } from '../home/styles';
import { photoSheetRows, type PhotoSheetAction } from './profilePhoto';
import { BACKDROP_TOP } from './ScreenBackdrop';

// The "Profile picture" bottom sheet, in the same shell as the app's other
// modals (TimePickerModal, EditNameModal): a transparent Modal over the
// system bars, a dimmed backdrop that closes it, and a glass surface (hairline
// edge on a solid navy base, radii.lg). It slides up with the app's EASE_OUT
// curve; with reduced motion it simply appears. The backdrop, the Cancel row
// and Android's back button all close it.

const ENTER_MS = 260;
const EXIT_MS = 180;
const OFFSCREEN = 400;

export function PhotoSheet({
  visible,
  hasPhoto,
  onAction,
  onClose,
}: {
  visible: boolean;
  hasPhoto: boolean;
  // Called after the sheet has closed, so the system photo picker never opens
  // on top of it.
  onAction: (action: Exclude<PhotoSheetAction, 'cancel'>) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const instant = reduced !== false;
  const slide = useRef(new Animated.Value(OFFSCREEN)).current;
  const fade = useRef(new Animated.Value(0)).current;
  // Kept mounted during the exit animation.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (!visible) return;
    setMounted(true);
    if (instant) {
      slide.setValue(0);
      fade.setValue(1);
      return;
    }
    slide.setValue(OFFSCREEN);
    fade.setValue(0);
    const anim = Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: ENTER_MS, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: ENTER_MS, easing: EASE_OUT, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [visible, instant, slide, fade]);

  // Closes the sheet, then runs `after` (if any).
  const close = (after?: () => void) => {
    const done = () => {
      setMounted(false);
      onClose();
      after?.();
    };
    if (instant) {
      done();
      return;
    }
    Animated.parallel([
      Animated.timing(slide, { toValue: OFFSCREEN, duration: EXIT_MS, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: EXIT_MS, easing: EASE_OUT, useNativeDriver: true }),
    ]).start(done);
  };

  const press = (action: PhotoSheetAction) => {
    if (action === 'cancel') close();
    else close(() => onAction(action));
  };

  if (!mounted && !visible) return null;

  return (
    <Modal
      visible={mounted || visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close()}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Pressable
          style={styles.backdrop}
          onPress={() => close()}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base, transform: [{ translateY: slide }] }]}
        role="dialog"
        accessibilityViewIsModal
        aria-modal
        accessibilityLabel="Profile picture"
      >
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          Profile picture
        </Text>
        {photoSheetRows(hasPhoto).map((row, i) => (
          <Pressable
            key={row.action}
            onPress={() => press(row.action)}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
          >
            <Ionicons name={row.icon} size={22} color={row.danger ? colors.error : colors.onSurfaceVariant} />
            <Text style={[styles.rowLabel, row.danger && styles.danger]}>{row.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Same dim as EditNameModal's backdrop.
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BACKDROP_TOP,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: accents.glassBorder,
    paddingTop: spacing.base,
    paddingHorizontal: spacing.base,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: spacing.base * 2,
  },
  title: {
    ...text.sectionTitle,
    color: '#ffffff',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  // Same row shape as Settings.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.base,
    gap: spacing.base * 1.5,
    borderRadius: radii.DEFAULT,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: accents.glassBorder,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowLabel: {
    ...typography.bodyMd,
    color: colors.onSurface,
    flex: 1,
  },
  danger: {
    color: colors.error,
  },
});
