import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../src/components/GlassCard';
import { GradientText } from '../../src/components/GradientText';
import { SessionThumbnail } from '../../src/components/SessionThumbnail';
import { featuredSession, sessions } from '../../src/data/sessions';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import type { Session } from '../../src/types/models';

// PRD.md names the tabs "For You/Calm/Recovery/Sleep" in its Core Screens
// list, but its own category-count example ("Calm 2, Sleep 2, Energy 1,
// Recovery 1") only makes sense with an Energy tab too — Stress Relief's
// real category is Energy. Using the full 4-category enum from
// src/types/models.ts (+ For You) resolves that inconsistency; flagged in
// PROGRESS.md rather than silently picking one.
type CategoryFilter = 'For You' | Session['category'];
const CATEGORIES: CategoryFilter[] = ['For You', 'Calm', 'Sleep', 'Energy', 'Recovery'];

const BADGE_ICON: Record<Session['badge'], keyof typeof MaterialIcons.glyphMap> = {
  Leaf: 'eco',
  Moon: 'bedtime',
  Zap: 'bolt',
  Heart: 'favorite',
};

function formatDuration(durationSec: number) {
  return `${Math.round(durationSec / 60)} min`;
}

// Real counts from the 6-session catalog (src/data/sessions.ts) — NOT
// library-code.html's placeholder mockup numbers ("For You 292", "Calm 45",
// "Recovery 38", "Sleep 24"), which PRD.md explicitly calls out as
// illustrative filler only.
function countFor(category: CategoryFilter): number {
  if (category === 'For You') return sessions.length;
  return sessions.filter((s) => s.category === category).length;
}

export default function LibraryScreen() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('For You');
  const [query, setQuery] = useState('');

  const visibleSessions = useMemo(() => {
    const byCategory =
      selectedCategory === 'For You'
        ? sessions
        : sessions.filter((s) => s.category === selectedCategory);
    const q = query.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter((s) => s.title.toLowerCase().includes(q));
  }, [selectedCategory, query]);

  const handleQuickStart = () => {
    // PRD.md: Quick Start immediately begins the current "For You"
    // recommended session — skips Library browsing entirely, opens Session
    // Player directly at the pre-mood phase. Same not-yet-built route
    // Home's "Begin" points to (build order step 4) — expected to 404 for
    // now.
    router.push(`/session-player?sessionId=${featuredSession.id}`);
  };

  return (
    <View style={styles.root}>
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search — DESIGN.md's "Inputs" spec calls for a darker glass
              variant (rgba(0,0,0,0.2)); the Stitch screenshot renders this
              search bar solid white, which reads as a Tailwind-forms-plugin
              rendering artifact rather than an intentional style (it
              contradicts both DESIGN.md's written spec and the HTML's own
              .glass-input CSS class) — built to the written spec instead. */}
          <View style={styles.searchWrapper}>
            <MaterialIcons
              name="search"
              size={20}
              color={colors.onSurfaceVariant}
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search sessions..."
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.searchInput}
            />
          </View>

          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {CATEGORIES.map((category) => {
              const active = category === selectedCategory;
              return (
                <Pressable
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[styles.categoryTab, active && styles.categoryTabActive]}
                >
                  <Text
                    style={[
                      styles.categoryLabel,
                      active && styles.categoryLabelActive,
                    ]}
                  >
                    {category}
                  </Text>
                  <View
                    style={[
                      styles.categoryCount,
                      active && styles.categoryCountActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryCountText,
                        active && styles.categoryCountTextActive,
                      ]}
                    >
                      {countFor(category)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Quick Start */}
          <Pressable onPress={handleQuickStart}>
            <LinearGradient
              colors={[colors.primaryContainer, colors.inversePrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickStart}
            >
              <MaterialIcons name="play-arrow" size={20} color={colors.onPrimaryContainer} />
              <Text style={styles.quickStartText}>Quick Start</Text>
            </LinearGradient>
          </Pressable>

          {/* Session grid */}
          <View style={styles.grid}>
            {visibleSessions.map((session) => (
              <Pressable
                key={session.id}
                onPress={() =>
                  router.push(`/session-player?sessionId=${session.id}`)
                }
              >
                <GlassCard radius={radii.DEFAULT} style={styles.sessionCard}>
                  <View style={styles.sessionCardRow}>
                    <SessionThumbnail pattern={session.pattern} size={80} />
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionTitle}>{session.title}</Text>
                      <View style={styles.sessionMetaRow}>
                        <MaterialIcons
                          name={BADGE_ICON[session.badge]}
                          size={16}
                          color={colors.onSurfaceVariant}
                        />
                        <Text style={styles.sessionMetaText}>
                          {formatDuration(session.durationSec)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
            {visibleSessions.length === 0 && (
              <Text style={styles.emptyText}>No sessions match your search.</Text>
            )}
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
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
    paddingBottom: 140,
    gap: spacing.base * 2,
  },
  searchWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: spacing.base * 2,
    zIndex: 1,
  },
  searchInput: {
    height: 56,
    paddingLeft: spacing.base * 6,
    paddingRight: spacing.base * 2,
    borderRadius: radii.DEFAULT,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: colors.onSurface,
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.base * 1.5,
    paddingRight: spacing.base,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.base * 2.5,
    paddingVertical: spacing.base * 1.25,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryTabActive: {
    borderColor: `${colors.primary}80`,
  },
  categoryLabel: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onSurfaceVariant,
  },
  categoryLabelActive: {
    color: colors.primary,
  },
  categoryCount: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.base * 0.75,
    borderRadius: 6,
  },
  categoryCountActive: {
    backgroundColor: `${colors.primary}33`,
  },
  categoryCountText: {
    fontSize: 11,
    fontFamily: typography.labelSm.fontFamily,
    color: colors.onSurfaceVariant,
  },
  categoryCountTextActive: {
    color: colors.primary,
  },
  quickStart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingVertical: spacing.base * 1.5,
    borderRadius: radii.DEFAULT,
  },
  quickStartText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    color: colors.onPrimaryContainer,
  },
  grid: {
    gap: spacing.base * 1.5,
  },
  sessionCard: {
    padding: spacing.base * 1.5,
  },
  sessionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 2,
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionTitle: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.75,
  },
  sessionMetaText: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.onSurfaceVariant,
  },
  emptyText: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: spacing.base * 4,
  },
});
