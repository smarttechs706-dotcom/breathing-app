import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

// Which account a link screen is acting on, so the whole point is that the
// address stays readable: it gets its own line, and a long one keeps both ends.
// It comes from the current session and is only ever rendered.
export function AccountEmail({ prefix, email }: { prefix: string; email: string }) {
  return (
    <View style={styles.wrapper} accessible accessibilityLabel={`${prefix} ${email}`}>
      <Text style={styles.prefix}>{prefix}</Text>
      <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
        {email}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: spacing.base / 2,
  },
  prefix: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  email: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.onSurface,
    textAlign: 'center',
  },
});
