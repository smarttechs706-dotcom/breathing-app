import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../theme/tokens';
import type { Session } from '../../types/models';
import { openSession } from './FeaturedSessionCard';
import { FadeIn, PressableScale, STAGGER_MS } from './motion';
import { PreviewGlass as GlassCard } from './PreviewGlass';
import { text } from './styles';
import { formatMinutes } from './weekActivity';

// One outline icon per approved session, all Ionicons, one color. Ionicons has
// no lotus; flower-outline is the closest.
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'morning-reset': 'sunny-outline',
  'calm-focus': 'flower-outline',
  'stress-relief': 'heart-outline',
};

// Reference: cards 144x124 px with 13 px gaps (x0.774 -> 111x96, 12 gap).
// Cards grow to fit the fixed two-line title row (about 108).
const CARD_MIN_HEIGHT = 96;
const ICON_ROW = 28;

type NowState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; sessions: Session[] };

export function NowForYou({ state, enterDelay }: { state: NowState; enterDelay: number }) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Now for you
        </Text>
        <Pressable
          onPress={() => router.push('/library')}
          hitSlop={12}
          style={styles.seeAll}
          accessibilityRole="link"
          accessibilityLabel="See all sessions in Library"
        >
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.onSurface} />
        </Pressable>
      </View>

      {state.kind === 'ready' && state.sessions.length > 0 ? (
        <View style={styles.cards}>
          {state.sessions.map((session, i) => (
            <FadeIn key={session.id} delay={enterDelay + i * STAGGER_MS} style={styles.cardSlot}>
              <PressableScale
                onPress={() => openSession(session.id)}
                accessibilityRole="button"
                accessibilityLabel={`${session.title}, ${formatMinutes(session.durationSec)}. Start`}
                outerStyle={styles.cardSlotInner}
                style={styles.cardSlotInner}
              >
                <GlassCard radius={radii.DEFAULT} style={styles.card}>
                  {/* Fixed rows, so icons, titles and durations line up across
                      cards even when one title wraps to two lines. */}
                  <View style={styles.cardBody}>
                    <View style={styles.iconRow}>
                      <Ionicons
                        name={ICONS[session.id] ?? 'ellipse-outline'}
                        size={24}
                        color={colors.secondary}
                      />
                    </View>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {session.title}
                      </Text>
                    </View>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {formatMinutes(session.durationSec)}
                    </Text>
                  </View>
                </GlassCard>
              </PressableScale>
            </FadeIn>
          ))}
        </View>
      ) : (
        <View style={styles.placeholder}>
          {state.kind === 'loading' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.placeholderText}>
              {state.kind === 'error'
                ? "Couldn't load suggestions."
                : 'No suggestions right now. See all sessions in Library.'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base * 0.5,
    marginBottom: spacing.base * 1.5,
  },
  title: {
    ...text.sectionTitle,
    color: '#ffffff',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.5,
  },
  seeAllText: {
    ...text.link,
    color: colors.onSurface,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.base * 1.5,
  },
  cardSlot: {
    flex: 1,
  },
  cardSlotInner: {
    flex: 1,
  },
  card: {
    flex: 1,
    minHeight: CARD_MIN_HEIGHT,
  },
  cardBody: {
    alignItems: 'center',
    paddingVertical: spacing.base * 1.5,
    paddingHorizontal: spacing.base,
  },
  iconRow: {
    height: ICON_ROW,
    justifyContent: 'center',
  },
  // Always two lines tall; a one-line title sits centred in it.
  titleRow: {
    height: text.cardTitle.lineHeight * 2,
    marginTop: spacing.base,
    justifyContent: 'center',
  },
  cardTitle: {
    ...text.cardTitle,
    color: '#ffffff',
    textAlign: 'center',
  },
  cardMeta: {
    ...text.cardMeta,
    color: colors.onSurfaceVariant,
  },
  placeholder: {
    minHeight: CARD_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...text.body,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
