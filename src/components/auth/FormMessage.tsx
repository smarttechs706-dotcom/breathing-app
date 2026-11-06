import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '../../theme/tokens';

// Only ever shows text from AUTH_MESSAGES, never a raw server message.
export function FormMessage({ message, tone = 'error' }: { message: string | null; tone?: 'error' | 'info' }) {
  if (!message) return null;

  return (
    <Text
      style={[styles.text, tone === 'error' ? styles.error : styles.info]}
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    textAlign: 'center',
  },
  error: {
    color: colors.error,
  },
  info: {
    color: colors.onSurfaceVariant,
  },
});
