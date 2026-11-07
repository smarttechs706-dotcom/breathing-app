import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AUTH_MESSAGES, authErrorMessage } from '../auth/authErrors';
import { getAuth } from '../auth/supabase';
import { useSingleFlight } from '../auth/useSingleFlight';
import { MAX_FIRST_NAME_LENGTH, normalizeFirstName } from '../auth/validation';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from './GlassCard';

// Same shell as TimePickerModal: transparent fade Modal, dimmed backdrop,
// GlassCard on a solid base, Cancel + gradient confirm button. The saved name
// reaches Home and Settings through the session that updateUser refreshes.
interface EditNameModalProps {
  visible: boolean;
  initialName: string | null;
  onClose: () => void;
}

export function EditNameModal({ visible, initialName, onClose }: EditNameModalProps) {
  const { running, run } = useSingleFlight();
  const [text, setText] = useState(initialName ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // The Modal's children stay mounted across open/close, so reset each time it
  // opens or the previous attempt's text and error would still be showing.
  useEffect(() => {
    if (visible) {
      setText(initialName ?? '');
      setError(null);
    }
  }, [visible, initialName]);

  const save = () =>
    run(async () => {
      const name = normalizeFirstName(text);
      if (!name) {
        setError(AUTH_MESSAGES.enterFirstName);
        return;
      }

      try {
        const { error: saveError } = await getAuth().updateUser({
          data: { display_name: name },
        });
        if (saveError) {
          setError(authErrorMessage(saveError));
          return;
        }
        onClose();
      } catch (failure) {
        setError(authErrorMessage(failure));
      }
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Same reasoning as TimePickerModal: a transparent Modal otherwise
      // leaves the Android system-bar strips undimmed.
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={() => inputRef.current?.focus()}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardWrapper}>
            <GlassCard radius={radii.lg} style={styles.card}>
              <Text style={styles.title}>Your first name</Text>

              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={(next) => {
                  setText(next);
                  if (error) setError(null);
                }}
                placeholder="First name"
                placeholderTextColor={colors.onSurfaceVariant}
                maxLength={MAX_FIRST_NAME_LENGTH}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                returnKeyType="done"
                onSubmitEditing={save}
                accessibilityLabel="First name"
                style={styles.input}
              />

              {error ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : (
                <Text style={styles.hintText}>Shown on Home.</Text>
              )}

              <View style={styles.actions}>
                <Pressable onPress={onClose} hitSlop={8} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={save}
                  disabled={running}
                  accessibilityRole="button"
                  accessibilityLabel="Save name"
                  accessibilityState={{ disabled: running, busy: running }}
                >
                  <LinearGradient
                    colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveButton}
                  >
                    {running ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
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
    minWidth: 76,
    alignItems: 'center',
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
