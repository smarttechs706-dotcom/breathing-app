import { MaterialIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '../../theme/tokens';
import { GradientText } from '../GradientText';

// Same top bar and headline treatment as Onboarding, so the auth screens read
// as the next step of that flow. Two differences on purpose, from the phone:
// content starts at a fixed height so the title stays put between screens, and
// the glow sits in the corner like Settings, since a large one cuts across
// form fields with a visible edge.
interface AuthScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  // Shows the back arrow. Used when there is no history to return to, since
  // these screens replace each other and onboarding replaces itself.
  backTo?: Href;
}

export function AuthScreen({ title, subtitle, footer, backTo, children }: AuthScreenProps) {
  const logo = <MaterialIcons name="local-florist" size={22} color={colors.primary} />;

  function goBack() {
    if (!backTo) return;
    if (router.canGoBack()) router.back();
    else router.replace(backTo);
  }

  return (
    <View style={styles.root}>
      <View style={styles.backgroundGlow} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.keyboard} behavior="padding">
          <View style={styles.topBar}>
            {backTo ? (
              <>
                <Pressable
                  onPress={goBack}
                  hitSlop={8}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
                </Pressable>
                {logo}
              </>
            ) : (
              logo
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <GradientText
                colors={[colors.primary, colors.primaryContainer]}
                style={styles.title}
              >
                {title}
              </GradientText>
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
    backgroundColor: colors.background,
  },
  backgroundGlow: {
    pointerEvents: 'none',
    position: 'absolute',
    top: -128,
    left: -128,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: colors.primaryContainer,
    opacity: 0.1,
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    height: 56,
  },
  backButton: {
    width: 48,
    height: 48,
    marginLeft: -spacing.base,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sectionGap,
    paddingBottom: spacing.sectionGap,
    gap: spacing.sectionGap,
  },
  header: {
    alignItems: 'center',
    gap: spacing.gutter,
  },
  title: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
  },
  body: {
    gap: spacing.gutter,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.base,
  },
});
