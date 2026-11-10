import { MaterialIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { text } from '../../features/home/styles';
import { BACKDROP_BOTTOM, MIST_BACKGROUND, ScreenBackdrop } from '../../features/profile/ScreenBackdrop';
import { colors, spacing, typography } from '../../theme/tokens';

// Shared layout for the sign-in screens and Change password: the mist backdrop
// (same as Profile and Settings), with the title, fields, button and links
// sitting directly on it, centred under the top bar. No card or panel. KeyboardAvoidingView and the ScrollView keep the focused
// field and the button reachable when the keyboard is open.
interface AuthScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  // Shows the back arrow. Used when there is no history to return to, since
  // these screens replace each other and onboarding replaces itself.
  backTo?: Href;
}

export function AuthScreen({ title, subtitle, footer, backTo, children }: AuthScreenProps) {
  function goBack() {
    if (!backTo) return;
    if (router.canGoBack()) router.back();
    else router.replace(backTo);
  }

  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.keyboard} behavior="padding">
          <View style={styles.topBar}>
            {backTo ? (
              <Pressable
                onPress={goBack}
                hitSlop={8}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
              </Pressable>
            ) : (
              // Screens without a back arrow (Log in) show the app's name instead.
              <Text style={styles.wordmark} accessibilityRole="header">
                Breathease
              </Text>
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>

            <View style={styles.body}>{children}</View>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKDROP_BOTTOM,
  },
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
    height: 56,
  },
  // Left-aligned in the centred top bar.
  backButton: {
    marginRight: 'auto',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    ...typography.headlineLgMobile,
    fontSize: 18,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.8)',
  },
  // Centred in the space under the top bar; scrolls when the keyboard is open.
  // Tight enough that the main button clears the keyboard on taller forms.
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
    paddingBottom: spacing.base * 2,
    gap: spacing.base * 3,
  },
  header: {
    alignItems: 'center',
    gap: spacing.base,
  },
  title: {
    ...text.name,
    fontSize: 28,
    lineHeight: 36,
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    ...text.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
  },
  body: {
    gap: spacing.base * 3,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.base,
  },
});
