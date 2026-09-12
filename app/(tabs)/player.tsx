import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
// See app/(tabs)/home.tsx for why this is a deep import — CONFIRMED
// correct on-device via instrumented debugging (see PROGRESS.md).
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../src/components/GlassCard';
import { GradientText } from '../../src/components/GradientText';
import { useActiveSession } from '../../src/state/ActiveSessionContext';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';

// architecture.md's "Bottom navigation — Player tab behavior": tapping
// Player never silently redirects — it always shows this tab's own
// content. With no session in progress, that's this dedicated empty
// state; with one in progress (tracked via ActiveSessionContext, set by
// app/session-player.tsx while it's mounted), it shows the actual Session
// Player UI by navigating to that real screen.
//
// Note: session-player.tsx is a top-level route (sibling to this (tabs)
// group, matching the Stitch mockup's no-bottom-nav "focused transactional
// view"), so the tab bar isn't visible while it's on screen — the only
// ways back to the tabs are exiting (which explicitly discards progress)
// or completing. In today's navigation flow this means the "active"
// branch below is wired correctly but rarely reachable in practice, not a
// commonly-hit path — flagging this rather than silently building
// something that looks functional but rarely triggers.
//
// Visual treatment: this empty state has no Stitch export of its own (it
// wasn't part of the original design handoff), so it's built to match the
// app's established visual language instead — same top bar as
// Home/Library (avatar + gradient "Breathe" title + settings), the same
// soft background glow as Home, and the message/CTA inside a GlassCard
// like every other content block in the app, per DESIGN.md's glassmorphic
// component spec — not a bare, disconnected placeholder.
export default function PlayerScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { activeSessionId } = useActiveSession();

  useEffect(() => {
    if (activeSessionId) {
      router.replace(`/session-player?sessionId=${activeSessionId}`);
    }
  }, [activeSessionId]);

  return (
    <View style={styles.root}>
      <View style={styles.backgroundGlow} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={18} color={colors.onSurfaceVariant} />
          </View>
          <GradientText
            colors={[colors.primary, colors.tertiary]}
            style={styles.headline}
          >
            Breathe
          </GradientText>
          <MaterialIcons name="settings" size={24} color={colors.primary} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarHeight + spacing.base * 2 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {activeSessionId ? (
            // Brief placeholder while the redirect above takes effect.
            <View style={styles.redirectPlaceholder} />
          ) : (
            <GlassCard radius={radii.lg} style={styles.card}>
              <View style={styles.iconBadge}>
                <MaterialIcons name="waves" size={32} color={colors.onSurfaceVariant} />
              </View>
              <Text style={styles.title}>No session in progress</Text>
              <Text style={styles.subtitle}>
                Start a guided breathing session from the Library to see it
                here.
              </Text>
              <Pressable onPress={() => router.push('/library')}>
                <LinearGradient
                  colors={[colors.primaryContainer, colors.inversePrimary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.startButton}
                >
                  <Text style={styles.startButtonText}>Start a Session</Text>
                </LinearGradient>
              </Pressable>
            </GlassCard>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Matches Home's background glow treatment exactly (same values) — the
  // app's background is never flat black per DESIGN.md.
  backgroundGlow: {
    pointerEvents: 'none',
    position: 'absolute',
    top: -200,
    left: '50%',
    marginLeft: -300,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: colors.primary,
    opacity: 0.06,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    height: 64,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  headline: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.marginMobile,
    // paddingBottom is set dynamically at render time from
    // useBottomTabBarHeight() — see the ScrollView usage above.
    justifyContent: 'center',
  },
  redirectPlaceholder: {
    height: 1,
  },
  card: {
    padding: spacing.base * 4,
    alignItems: 'center',
    gap: spacing.base * 1.5,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.surfaceVariant}80`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  title: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: 22,
    fontWeight: '600',
    color: colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
  },
  startButton: {
    marginTop: spacing.base,
    paddingHorizontal: spacing.base * 4,
    paddingVertical: spacing.base * 1.75,
    borderRadius: radii.full,
  },
  startButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onPrimaryContainer,
  },
});
