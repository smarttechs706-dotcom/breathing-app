import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { friendlyError } from '../../api/apiErrors';
import { fetchSessions } from '../../api/client';
import { getCachedSessions, setCachedSessions } from '../../state/sessionsCache';
import { colors, spacing, typography } from '../../theme/tokens';
import type { Session } from '../../types/models';
import { FadeIn, PressableScale, STAGGER_MS, useReducedMotion } from '../home/motion';
import { PreviewAvatar } from '../home/PreviewAvatar';
import { accents, text } from '../home/styles';
import { MIST_BACKGROUND, ScreenBackdrop } from '../profile/ScreenBackdrop';
import {
  BADGE_ICON,
  CATEGORIES,
  countFor,
  filterSessions,
  formatDuration,
  quickStartTarget,
  type CategoryFilter,
} from './libraryModel';
import { CARD_IMAGES } from './libraryImages';

// Library tab: search, category chips, Quick Start and one painted 5:2 image
// card per session. Same behaviour as the previous screen (cache-first
// loading, error + Retry, real counts, Quick Start = Deep Exhale); the look
// follows the new Home, tab bar and Profile (deep navy, light glass, tokens).
//
// A ScrollView is enough for the 6-session catalog; switch to a FlatList if
// the catalog grows past a few dozen sessions.

const BACKGROUND_TOP = '#0a1028';
const BACKGROUND_BOTTOM = '#00051a';
const CARD_HEIGHT = 160;
const CARD_RADIUS = 16;
const CARD_GAP = 12;
// Shown behind each image until it is drawn, so nothing flashes or jumps.
const CARD_PLACEHOLDER = '#0a1028';
// Entrance stagger applies to the first few cards only; later ones are
// below the fold.
const STAGGERED_CARDS = 4;
// Card meta row (duration, category). Pure white: onSurface measured below
// 4.5:1 over the brightest skies (Deep Exhale, Morning Reset).
const META_COLOR = '#ffffff';

export function LibraryScreen({ tabBarHeight }: { tabBarHeight: number }) {
  const reduced = useReducedMotion();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('For You');
  const [query, setQuery] = useState('');
  // null = still loading (first fetch, or a retry in flight). Starts from the
  // shared cache when it holds a non-empty list, so the cards render at once.
  const [sessions, setSessions] = useState<Session[] | null>(() => {
    const cached = getCachedSessions();
    return cached && cached.length > 0 ? cached : null;
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setSessions(null);
    fetchSessions()
      .then((fresh) => {
        setCachedSessions(fresh);
        setSessions(fresh);
      })
      .catch((err) => setError(friendlyError(err)));
  }, []);

  useEffect(() => {
    if (sessions) {
      // Cache hit: already showing data. Refresh in the background; a failed
      // refresh is silent and keeps the cached cards. Only the blocking path
      // (load) shows the error + Retry state.
      fetchSessions()
        .then((fresh) => {
          setCachedSessions(fresh);
          setSessions(fresh);
        })
        .catch(() => {});
      return;
    }
    load();
    // Mount-only: `sessions` here is the initial (cache-derived) value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const visibleSessions = useMemo(
    () => filterSessions(sessions, selectedCategory, query),
    [sessions, selectedCategory, query]
  );

  const openSession = (id: string) => router.push(`/session-player?sessionId=${id}`);
  const handleQuickStart = () => {
    const target = quickStartTarget(sessions);
    if (target) openSession(target.id);
  };

  return (
    <View style={styles.root}>
      <ScreenBackdrop painting={MIST_BACKGROUND} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <PreviewAvatar size={40} />
          <Text style={styles.title} accessibilityRole="header">
            Library
          </Text>
        </View>

        {error ? (
          <View style={styles.centerState}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.onSurfaceVariant} />
            <Text style={styles.centerStateText}>Couldn&apos;t load sessions.</Text>
            <Text style={styles.centerStateSubtext}>{error}</Text>
            <Pressable onPress={load} style={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : sessions === null ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.base * 3 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.search}>
              <Ionicons name="search" size={20} color={colors.onSurfaceVariant} style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search sessions..."
                placeholderTextColor={colors.onSurfaceVariant}
                style={styles.searchInput}
                accessibilityLabel="Search sessions"
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {CATEGORIES.map((category) => {
                const active = category === selectedCategory;
                const count = countFor(sessions, category);
                return (
                  <Pressable
                    key={category}
                    onPress={() => setSelectedCategory(category)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${category}, ${count} sessions`}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{category}</Text>
                    <View style={[styles.chipCount, active && styles.chipCountActive]}>
                      <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Same contrast-fixed blue as before (AUDIT-2.md): white text
                stays >= 6.47:1 across the whole gradient. */}
            <Pressable onPress={handleQuickStart} accessibilityRole="button" accessibilityLabel="Quick Start">
              <LinearGradient
                colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickStart}
              >
                <Ionicons name="play" size={18} color="#ffffff" />
                <Text style={styles.quickStartText}>Quick Start</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.cards}>
              {visibleSessions.map((session, i) => (
                <FadeIn key={session.id} delay={Math.min(i, STAGGERED_CARDS) * STAGGER_MS}>
                  <SessionCard
                    session={session}
                    reduced={reduced !== false}
                    onPress={() => openSession(session.id)}
                  />
                </FadeIn>
              ))}
              {visibleSessions.length === 0 && (
                <Text style={styles.emptyText}>No sessions match your search.</Text>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

// One painted card: the session's 5:2 image (centre kept, sides trimmed to
// fill 160 dp), a left-to-right navy gradient for the text, and the title,
// duration and category. The whole card is the button. A session without an
// image gets a plain navy gradient instead of another session's picture.
function SessionCard({
  session,
  reduced,
  onPress,
}: {
  session: Session;
  reduced: boolean;
  onPress: () => void;
}) {
  const image = CARD_IMAGES[session.id];
  const duration = formatDuration(session.durationSec);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${session.title}, ${duration}, ${session.category}. Start`}
    >
      <View style={styles.card}>
        {image ? (
          <Image
            source={image}
            style={styles.cardImage}
            resizeMode="cover"
            fadeDuration={reduced ? 0 : 150}
          />
        ) : (
          <LinearGradient
            colors={['#1b2a5c', BACKGROUND_TOP]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['rgba(5,10,30,0.85)', 'rgba(5,10,30,0.6)', 'rgba(5,10,30,0)']}
          locations={[0, 0.5, 0.85]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(5,10,30,0)', 'rgba(5,10,30,0.4)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {session.title}
          </Text>
          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={16} color={META_COLOR} />
            <Text style={styles.cardMetaText}>{duration}</Text>
            <View style={styles.cardMetaDivider} />
            <Ionicons
              name={BADGE_ICON[session.badge] as keyof typeof Ionicons.glyphMap}
              size={16}
              color={META_COLOR}
            />
            <Text style={styles.cardMetaText}>{session.category}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND_BOTTOM,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 1.5,
    paddingHorizontal: spacing.gutter,
    height: 64,
  },
  title: {
    ...typography.headlineLgMobile,
    color: '#ffffff',
  },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.base,
    gap: spacing.base * 2,
  },
  search: {
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: spacing.base * 2,
    zIndex: 1,
  },
  searchInput: {
    ...typography.bodyMd,
    height: 56,
    paddingLeft: spacing.base * 6,
    paddingRight: spacing.base * 2,
    borderRadius: CARD_RADIUS,
    backgroundColor: accents.glassFill,
    borderWidth: 1,
    borderColor: accents.glassBorder,
    color: colors.onSurface,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.base,
    paddingRight: spacing.base,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    height: 40,
    paddingHorizontal: spacing.base * 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: accents.glassBorder,
    backgroundColor: accents.glassFill,
  },
  // Solid blue, no glow; white text stays above 6:1 on inversePrimary.
  chipActive: {
    backgroundColor: colors.inversePrimary,
    borderColor: colors.inversePrimary,
  },
  chipLabel: {
    ...text.link,
    color: colors.onSurfaceVariant,
  },
  chipLabelActive: {
    color: '#ffffff',
  },
  chipCount: {
    minWidth: 20,
    paddingHorizontal: spacing.base * 0.75,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  chipCountText: {
    ...text.cardMeta,
    color: colors.onSurfaceVariant,
  },
  chipCountTextActive: {
    color: '#ffffff',
  },
  quickStart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    height: 48,
    borderRadius: CARD_RADIUS,
  },
  quickStartText: {
    ...text.link,
    color: '#ffffff',
  },
  cards: {
    gap: CARD_GAP,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: accents.glassBorder,
    backgroundColor: CARD_PLACEHOLDER,
    justifyContent: 'center',
  },
  cardImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  cardText: {
    paddingHorizontal: spacing.base * 2.5,
    gap: spacing.base,
    maxWidth: '75%',
  },
  cardTitle: {
    ...text.featuredTitle,
    color: '#ffffff',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.75,
  },
  cardMetaText: {
    ...text.meta,
    color: META_COLOR,
  },
  cardMetaDivider: {
    width: 1,
    height: 14,
    marginHorizontal: spacing.base * 0.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  emptyText: {
    ...text.body,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: spacing.base * 4,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.marginMobile,
  },
  centerStateText: {
    ...typography.bodyLg,
    color: colors.onSurface,
  },
  centerStateSubtext: {
    ...text.body,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.base,
    paddingHorizontal: spacing.base * 3,
    paddingVertical: spacing.base * 1.25,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    ...text.link,
    color: colors.onPrimary,
  },
});
