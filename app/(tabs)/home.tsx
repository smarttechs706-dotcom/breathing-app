import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
// Deep import, not a documented public path: expo-router vendors its own
// react-navigation/bottom-tabs copy (there's no separate
// @react-navigation/bottom-tabs dependency), and this hook isn't
// re-exported from the top-level 'expo-router' package. It's still the
// library's own recommended fix for this problem (its own type comments
// say so), and is now CONFIRMED correct on-device via instrumented
// debugging (reported tabBarHeight=84.0, matching reality exactly) — the
// overlap some users see at scrollY=0 is inherent to a floating tab bar
// over content taller than one screen (nothing to scroll yet), not a
// calculation bug. Flagging the fragility: could break on an expo-router
// upgrade that reorganizes this internal path.
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BreathOrb } from '../../src/components/BreathOrb';
import { GlassCard } from '../../src/components/GlassCard';
import { GradientText } from '../../src/components/GradientText';
import { featuredSession } from '../../src/data/sessions';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';

// Dummy/placeholder data per CLAUDE.md's build order — real personalization,
// mood, and streak values arrive once the backend (architecture.md's API
// contract) exists. These mirror the Stitch home-code.html mockup's own
// placeholder numbers exactly (12 sessions, 5-day streak, "Calm" mood).
const snapshot = {
  mood: { label: 'Calm', emoji: '😊' },
  sessionsThisWeek: 12,
  currentStreak: 5,
};

function formatDuration(durationSec: number) {
  return `${Math.round(durationSec / 60)} min`;
}

export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <View style={styles.root}>
      {/* DESIGN.md: background is never flat black — a soft radial glow
          approximates the mockup's radial-gradient + blurred glow circle. */}
      <View style={styles.backgroundGlow} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={20} color={colors.onSurfaceVariant} />
            </View>
            <View>
              <Text style={styles.greetingLabel}>GOOD EVENING</Text>
              <GradientText
                colors={[colors.primary, colors.tertiary]}
                style={styles.greetingName}
              >
                Alex
              </GradientText>
            </View>
          </View>
          <MaterialIcons name="settings" size={24} color={colors.primary} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarHeight + spacing.base * 2 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Featured Session */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Featured Session</Text>
              <View style={styles.newPill}>
                <Text style={styles.newPillText}>NEW</Text>
              </View>
            </View>

            <GlassCard radius={radii.lg} style={styles.heroCard}>
              <View style={styles.heroContent}>
                <BreathOrb size={160} />
                <Text style={styles.heroTitle}>{featuredSession.title}</Text>
                <Text style={styles.heroDescription} numberOfLines={3}>
                  {featuredSession.description}
                </Text>
                <View style={styles.heroFooter}>
                  <View style={styles.durationPill}>
                    <MaterialIcons name="schedule" size={16} color={colors.onSurface} />
                    <Text style={styles.durationPillText}>
                      {formatDuration(featuredSession.durationSec)}
                    </Text>
                  </View>
                  <View
                    style={styles.beginButton}
                    onTouchEnd={() => {
                      // architecture.md: tapping Begin opens Session Player
                      // directly at the pre-mood phase for this session.
                      // Session Player doesn't exist yet (build order step 4).
                      router.push(`/session-player?sessionId=${featuredSession.id}`);
                    }}
                  >
                    <Text style={styles.beginButtonText}>Begin</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Your Snapshot */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Your Snapshot</Text>
              <MaterialIcons name="more-horiz" size={22} color={colors.onSurfaceVariant} />
            </View>

            <View style={styles.snapshotStack}>
              <GlassCard radius={radii.md} style={styles.snapshotCard}>
                <View style={styles.snapshotCardRow}>
                  <MaterialIcons name="mood" size={22} color={colors.secondary} />
                  <Text style={styles.snapshotEmoji}>{snapshot.mood.emoji}</Text>
                </View>
                <View>
                  <Text style={styles.snapshotValue}>{snapshot.mood.label}</Text>
                  <Text style={styles.snapshotLabel}>CURRENT MOOD</Text>
                </View>
              </GlassCard>

              <GlassCard radius={radii.md} style={styles.snapshotCard}>
                <View style={styles.snapshotCardRow}>
                  <MaterialIcons name="calendar-month" size={22} color={colors.tertiary} />
                </View>
                <View>
                  <Text style={styles.snapshotValue}>
                    {snapshot.sessionsThisWeek}{' '}
                    <Text style={styles.snapshotValueUnit}>sessions</Text>
                  </Text>
                  <Text style={styles.snapshotLabel}>THIS WEEK</Text>
                </View>
              </GlassCard>

              <GlassCard
                radius={radii.md}
                style={[styles.snapshotCard, styles.streakCard]}
              >
                <View style={styles.snapshotCardRow}>
                  <MaterialIcons name="local-fire-department" size={22} color="#fb923c" />
                </View>
                <View>
                  <Text style={styles.snapshotValue}>
                    {snapshot.currentStreak}{' '}
                    <Text style={styles.snapshotValueUnit}>days</Text>
                  </Text>
                  <Text style={[styles.snapshotLabel, styles.streakLabel]}>
                    CURRENT STREAK
                  </Text>
                </View>
              </GlassCard>
            </View>
          </View>
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
    // Trimmed slightly (was 64) so first-load content (before any
    // scrolling) clears the floating tab bar better — see PROGRESS.md's
    // "first impression" spacing pass.
    height: 56,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  greetingLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  greetingName: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
  },
  scrollContent: {
    paddingHorizontal: spacing.marginMobile,
    // paddingTop/gap trimmed from spacing.sectionGap (40) — see
    // PROGRESS.md's "first impression" spacing pass.
    paddingTop: spacing.base * 2.5,
    // paddingBottom is set dynamically at render time from
    // useBottomTabBarHeight() — see the ScrollView usage above.
    gap: spacing.base * 2.5,
  },
  section: {
    gap: spacing.base * 1.25,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    lineHeight: typography.headlineLgMobile.lineHeight,
    color: colors.onSurface,
  },
  newPill: {
    backgroundColor: `${colors.primary}1A`,
    paddingHorizontal: spacing.base * 1.5,
    paddingVertical: spacing.base * 0.5,
    borderRadius: radii.full,
  },
  newPillText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  heroCard: {
    padding: spacing.base * 2,
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.base * 1.25,
  },
  heroTitle: {
    fontFamily: typography.displayLg.fontFamily,
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  heroDescription: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 1.5,
    marginTop: spacing.base * 0.5,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.75,
    backgroundColor: `${colors.surfaceVariant}80`,
    paddingHorizontal: spacing.base * 2,
    paddingVertical: spacing.base,
    borderRadius: radii.full,
  },
  durationPillText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurface,
  },
  beginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base * 3,
    paddingVertical: spacing.base,
    borderRadius: radii.full,
  },
  beginButtonText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onPrimary,
  },
  snapshotStack: {
    gap: spacing.base * 1.5,
  },
  snapshotCard: {
    padding: spacing.base * 2.5,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  snapshotCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  snapshotEmoji: {
    fontSize: 22,
  },
  snapshotValue: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.headlineLgMobile.fontSize,
    fontWeight: typography.headlineLgMobile.fontWeight,
    color: '#ffffff',
  },
  snapshotValueUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
  },
  snapshotLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  streakCard: {
    borderColor: 'rgba(251,146,60,0.2)',
  },
  streakLabel: {
    color: 'rgba(254,215,170,0.7)',
  },
});
