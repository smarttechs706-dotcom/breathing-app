import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AUTH_MESSAGES } from '../src/auth/authErrors';
import { useAuth } from '../src/auth/AuthProvider';
import {
  changePassword,
  validatePasswordChange,
  type PasswordChangeErrors,
} from '../src/auth/changePassword';
import { getAuth } from '../src/auth/supabase';
import { useCooldown } from '../src/auth/useCooldown';
import { useSingleFlight } from '../src/auth/useSingleFlight';
import { FormMessage } from '../src/components/auth/FormMessage';
import { GradientButton } from '../src/components/auth/GradientButton';
import { PasswordField } from '../src/components/auth/PasswordField';
import { PreviewGlass } from '../src/features/home/PreviewGlass';
import { text } from '../src/features/home/styles';
import { BACKDROP_BOTTOM, MIST_BACKGROUND, ScreenBackdrop } from '../src/features/profile/ScreenBackdrop';
import { spacing, colors } from '../src/theme/tokens';

// Change password, styled like Settings (mist backdrop, back arrow and white
// title, a glass card around the fields). The form, its validation and the
// API call are unchanged; the shared auth components are used as before.

// Same as AuthScreen's back button with backTo="/settings".
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/settings');
}

export default function ChangePasswordScreen() {
  const { session } = useAuth();
  const { running, run } = useSingleFlight();
  const { secondsLeft, start } = useCooldown('changePassword');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const submit = () =>
    run(async () => {
      setFormError(null);
      setChanged(false);
      const next = validatePasswordChange({ currentPassword, newPassword, confirmPassword });
      setErrors(next);
      if (Object.keys(next).length > 0) return;

      const email = session?.user.email;
      if (!email) {
        setFormError(AUTH_MESSAGES.generic);
        return;
      }

      const failure = await changePassword(getAuth(), email, { currentPassword, newPassword });
      if (failure) {
        setFormError(failure);
        // A typo can be fixed straight away. Only a rate limit makes people wait.
        if (failure === AUTH_MESSAGES.rateLimited) start();
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChanged(true);
    });

  const submitUnlessWaiting = () => {
    if (secondsLeft === 0) void submit();
  };

  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.safeArea} behavior="padding">
          <View style={styles.header}>
            <Pressable
              onPress={goBack}
              hitSlop={8}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Change password
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <PreviewGlass radius={16} style={styles.card}>
      <PasswordField
        label="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        error={errors.currentPassword}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => newRef.current?.focus()}
      />
      <PasswordField
        ref={newRef}
        label="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        error={errors.newPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <PasswordField
        ref={confirmRef}
        label="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submitUnlessWaiting}
      />
      {changed ? <FormMessage message={AUTH_MESSAGES.passwordChanged} tone="info" /> : null}
      <FormMessage message={formError} />
      <GradientButton
        label={secondsLeft > 0 ? `Try again in ${secondsLeft}s` : 'Change password'}
        onPress={submit}
        running={running}
        disabled={secondsLeft > 0}
      />
            </PreviewGlass>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// Header matches app/settings.tsx.
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKDROP_BOTTOM,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.gutter,
    height: 64,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...text.name,
    color: '#ffffff',
  },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.base * 2,
    paddingBottom: spacing.base * 4,
  },
  card: {
    padding: spacing.base * 2.5,
    gap: spacing.gutter,
  },
});
