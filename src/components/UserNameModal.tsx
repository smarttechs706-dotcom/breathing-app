import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing, typography } from '../theme/tokens';
import { MAX_USER_NAME_LENGTH, normalizeUserName, setUserName } from '../utils/userName';
import { GlassCard } from './GlassCard';

// TEMPORARY, like src/utils/userName.ts: a small "enter your name" dialog
// shared by Home (first-time prompt) and Settings (edit). Same shell as
// TimePickerModal — transparent fade Modal, dimmed backdrop, GlassCard on a
// solid base, Cancel + gradient confirm button — so it matches the rest of
// the app instead of introducing a new dialog style.
interface UserNameModalProps {
  visible: boolean;
  /** Name currently saved, used to pre-fill the field when editing. */
  initialName: string | null;
  /** Called with the saved (trimmed, length-capped) name after a successful save. */
  onSaved: (name: string) => void;
  onCancel: () => void;
}

export function UserNameModal({ visible, initialName, onSaved, onCancel }: UserNameModalProps) {
  const [text, setText] = useState(initialName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // The Modal's children stay mounted across open/close (parent only toggles
  // `visible`), so reset the field each time it opens or the previous
  // attempt's text and error would still be showing.
  useEffect(() => {
    if (visible) {
      setText(initialName ?? '');
      setError(null);
      setSaving(false);
    }
  }, [visible, initialName]);

  async function handleSave() {
    if (saving) return;
    // Validate before touching storage: an empty / whitespace-only name is
    // rejected here, nothing is saved, and the dialog stays open.
    if (normalizeUserName(text) === null) {
      setError('Please enter a name.');
      return;
    }
    setSaving(true);
    const saved = await setUserName(text);
    setSaving(false);
    if (saved === null) {
      setError("Couldn't save your name. Please try again.");
      return;
    }
    onSaved(saved);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Same reasoning as TimePickerModal: a transparent Modal otherwise
      // leaves the Android system-bar strips undimmed.
      statusBarTranslucent
      onRequestClose={onCancel}
      onShow={() => inputRef.current?.focus()}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onCancel}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardWrapper}>
            <GlassCard radius={radii.lg} style={styles.card}>
              <Text style={styles.title}>What should we call you?</Text>

              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={(next) => {
                  setText(next);
                  if (error) setError(null);
                }}
                placeholder="Your name"
                placeholderTextColor={colors.onSurfaceVariant}
                maxLength={MAX_USER_NAME_LENGTH}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                accessibilityLabel="Your name"
                style={styles.input}
              />

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : (
                <Text style={styles.hintText}>
                  Shown on Home. Stored on this device only.
                </Text>
              )}

              <View style={styles.actions}>
                <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSave} accessibilityRole="button" accessibilityLabel="Save name">
                  <LinearGradient
                    colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveButton}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </GlassCard>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.marginMobile,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    // Solid base under GlassCard's translucent tint + blur — same reason as
    // TimePickerModal: Android's blur is weak and the screen behind would
    // otherwise show through.
    backgroundColor: colors.surfaceContainerHigh,
    width: '100%',
    padding: spacing.base * 3,
    gap: spacing.base * 1.5,
  },
  title: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
    textAlign: 'center',
  },
  // Same look as Library's search field.
  input: {
    height: 52,
    paddingHorizontal: spacing.base * 2,
    borderRadius: radii.DEFAULT,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: colors.onSurface,
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
  },
  hintText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.error,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.base * 2,
    marginTop: spacing.base,
  },
  cancelButton: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
  },
  cancelButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.onSurfaceVariant,
  },
  saveButton: {
    paddingHorizontal: spacing.base * 3,
    paddingVertical: spacing.base * 1.25,
    borderRadius: radii.full,
  },
  saveButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: '#ffffff',
  },
});
