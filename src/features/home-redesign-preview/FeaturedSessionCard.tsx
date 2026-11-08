import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../theme/tokens';
import type { Session } from '../../types/models';
import { PressableScale } from './motion';
import { PreviewGlass as GlassCard } from './PreviewGlass';
import { accents, text } from './styles';
import { formatMinutes } from './weekActivity';

// The app's own session illustrations, keyed by real session id. A session
// without one gets a plain tile rather than someone else's picture.
const IMAGES: Record<string, number> = {
  'deep-exhale': require('../../../assets/illustrations/deepexhale.png'),
  'morning-reset': require('../../../assets/illustrations/morningreset.png'),
  'calm-focus': require('../../../assets/illustrations/calmfocus.png'),
  'stress-relief': require('../../../assets/illustrations/stressrelief.png'),
  'wind-down': require('../../../assets/illustrations/winddown.png'),
  'box-breathing': require('../../../assets/illustrations/boxbreathing.png'),
};

// Reference: card 456x110 px, thumbnail 112x98 px, play button 50 px (x0.774).
const THUMB_W = 88;
const THUMB_H = 76;
const PLAY = 40;
const CARD_PAD = 6;
const CARD_MIN_HEIGHT = THUMB_H + CARD_PAD * 2;

export function openSession(id: string) {
  router.push(`/session-player?sessionId=${encodeURIComponent(id)}`);
}

type FeaturedState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; onRetry: () => void }
  | { kind: 'ready'; session: Session };

export function FeaturedSessionCard({ state }: { state: FeaturedState }) {
  if (state.kind !== 'ready') {
    return (
      <GlassCard radius={radii.DEFAULT} style={styles.card}>
        <View style={styles.stateBody}>
          {state.kind === 'loading' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={styles.stateText} numberOfLines={2}>
                {state.message}
              </Text>
              <Pressable onPress={state.onRetry} hitSlop={8} accessibilityRole="button">
                <Text style={styles.retry}>Retry</Text>
              </Pressable>
            </>
          )}
        </View>
      </GlassCard>
    );
  }

  const { session } = state;
  const meta = `${formatMinutes(session.durationSec)} · ${session.category}`;
  const image = IMAGES[session.id];

  return (
    <PressableScale
      onPress={() => openSession(session.id)}
      accessibilityRole="button"
      accessibilityLabel={`Featured session, ${session.title}, ${meta}. Start`}
    >
      <GlassCard radius={radii.DEFAULT} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.thumb}>
            {image !== undefined && (
              <Image source={image} style={styles.thumbImage} resizeMode="cover" />
            )}
          </View>
          <View style={styles.textColumn}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              Featured session
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {session.title}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={colors.onSurfaceVariant} />
              <Text style={styles.meta} numberOfLines={1}>
                {meta}
              </Text>
            </View>
          </View>
          <View style={styles.play}>
            <Ionicons name="play" size={18} color="#ffffff" style={styles.playIcon} />
          </View>
        </View>
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: CARD_PAD,
    minHeight: CARD_MIN_HEIGHT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.onSecondaryFixed,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  textColumn: {
    flex: 1,
    marginLeft: spacing.base * 2,
    marginRight: spacing.base * 1.5,
    gap: 2,
  },
  eyebrow: {
    ...text.eyebrow,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  title: {
    ...text.featuredTitle,
    color: '#ffffff',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.75,
  },
  meta: {
    ...text.meta,
    color: colors.onSurfaceVariant,
    flexShrink: 1,
  },
  play: {
    width: PLAY,
    height: PLAY,
    borderRadius: PLAY / 2,
    marginRight: spacing.base * 1.5,
    backgroundColor: accents.playButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The play glyph's visual centre sits left of its box; nudge it.
  playIcon: {
    marginLeft: 2,
  },
  stateBody: {
    minHeight: CARD_MIN_HEIGHT - CARD_PAD * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base * 2,
    paddingHorizontal: spacing.base * 2,
  },
  stateText: {
    ...text.body,
    color: colors.onSurfaceVariant,
    flexShrink: 1,
  },
  retry: {
    ...text.link,
    color: colors.primary,
  },
});
