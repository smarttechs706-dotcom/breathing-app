import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../theme/tokens';
import type { EmptyDayFill } from './backgrounds';
import { PreviewAvatar } from './PreviewAvatar';
import { accents, text } from './styles';
import { greetingForHour } from './timeOfDay';
import { dayName, streakLabel, type ActivityDay } from './weekActivity';

// Reference: avatar 52 px -> 40 pt; day circles 22 px -> 18 pt on 32 pt columns.
const AVATAR = 40;
const DAY_COLUMN = 32;
const DAY_DOT = 18;

// `onLongPressGreeting` is a hidden dev control (see HomeRedesignPreview):
// nothing is drawn for it and nothing moves when it fires.
export function GreetingRow({
  hour,
  displayName,
  onLongPressGreeting,
}: {
  hour: number;
  displayName: string;
  onLongPressGreeting?: () => void;
}) {
  const evening = hour < 5 || hour >= 17;
  return (
    <View style={styles.greetingRow}>
      <View style={styles.greetingLeft}>
        <PreviewAvatar size={AVATAR} />
        <Pressable
          style={styles.greetingText}
          onLongPress={onLongPressGreeting}
          disabled={!onLongPressGreeting}
          delayLongPress={600}
          accessible={false}
        >
          <Text style={styles.greeting}>{greetingForHour(hour)}</Text>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Ionicons
              name={evening ? 'moon' : 'sunny'}
              size={18}
              color={evening ? colors.primaryFixed : accents.sun}
            />
          </View>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push('/settings')}
        hitSlop={12}
        style={styles.settings}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Ionicons name="settings-sharp" size={22} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

type WeekState =
  | { kind: 'loading' }
  | { kind: 'error'; onRetry: () => void }
  | { kind: 'ready'; days: ActivityDay[]; streak: number };

export function WeekRow({
  state,
  emptyFill = 'default',
}: {
  state: WeekState;
  emptyFill?: EmptyDayFill;
}) {
  if (state.kind === 'error') {
    return (
      <View style={styles.weekRow}>
        <Text style={styles.weekError}>Couldn&apos;t load your week.</Text>
        <Pressable onPress={state.onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const days = state.kind === 'ready' ? state.days : null;
  const summary = days
    ? `This week: ${days.map((d, i) => `${dayName(i)} ${d.done ? 'done' : 'no session'}`).join(', ')}`
    : 'Loading this week';

  return (
    <View style={styles.weekRow}>
      <View
        style={[styles.days, !days && styles.loading]}
        accessible
        accessibilityLabel={summary}
      >
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((letter, i) => {
          const day = days?.[i];
          return (
            <View key={i} style={styles.dayColumn}>
              <Text style={styles.dayLetter}>{letter}</Text>
              <View
                style={[
                  styles.dot,
                  day?.done ? styles.dotDone : styles.dotEmpty,
                  !day?.done && emptyFill === 'solid' && styles.dotEmptySolid,
                  !day?.done && emptyFill === 'faint' && styles.dotEmptyFaint,
                ]}
              >
                {day?.done && <Ionicons name="checkmark" size={12} color="#ffffff" />}
              </View>
            </View>
          );
        })}
      </View>

      {state.kind === 'ready' && (
        <View
          style={styles.streakPill}
          accessible
          accessibilityLabel={`Current streak ${streakLabel(state.streak)}`}
        >
          <Ionicons name="flame" size={16} color={accents.flame} />
          <Text style={styles.streakText}>{streakLabel(state.streak)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
  },
  greetingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 1.5,
    flexShrink: 1,
  },
  greetingText: {
    flexShrink: 1,
  },
  greeting: {
    ...text.greeting,
    color: colors.onSurfaceVariant,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  name: {
    ...text.name,
    color: '#ffffff',
    flexShrink: 1,
  },
  settings: {
    padding: spacing.base,
    marginRight: -spacing.base,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    marginTop: spacing.base * 2,
    minHeight: 44,
    gap: spacing.base,
  },
  days: {
    flexDirection: 'row',
  },
  loading: {
    opacity: 0.4,
  },
  dayColumn: {
    width: DAY_COLUMN,
    alignItems: 'center',
    gap: spacing.base * 0.75,
  },
  dayLetter: {
    ...text.dayLetter,
    color: colors.onSurfaceVariant,
  },
  dot: {
    width: DAY_DOT,
    height: DAY_DOT,
    borderRadius: DAY_DOT / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: accents.dayDone,
    borderColor: accents.dayDoneBorder,
  },
  dotEmpty: {
    backgroundColor: accents.dayEmpty,
    borderColor: accents.dayEmptyBorder,
  },
  dotEmptySolid: {
    backgroundColor: accents.dayEmptySolid,
  },
  dotEmptyFaint: {
    backgroundColor: accents.dayEmptyFaint,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base * 0.5,
    height: 32,
    paddingHorizontal: spacing.base * 1.5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: accents.glassBorder,
    backgroundColor: accents.glassFill,
  },
  streakText: {
    ...text.streak,
    color: accents.streakText,
  },
  weekError: {
    ...text.body,
    color: colors.onSurfaceVariant,
    flexShrink: 1,
  },
  retry: {
    ...text.link,
    color: colors.primary,
  },
});
