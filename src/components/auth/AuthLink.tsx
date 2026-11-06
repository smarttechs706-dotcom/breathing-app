import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

interface AuthLinkProps {
  label: string;
  onPress: () => void;
  // Plain text before the link, as in "Already have an account? Log in".
  prompt?: string;
  running?: boolean;
  disabled?: boolean;
}

export function AuthLink({ label, onPress, prompt, running = false, disabled = false }: AuthLinkProps) {
  const blocked = running || disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={prompt ? `${prompt} ${label}` : label}
      accessibilityState={{ disabled: blocked, busy: running }}
      style={styles.link}
    >
      {running ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text style={styles.text}>
          {prompt ? <Text style={styles.prompt}>{prompt} </Text> : null}
          <Text style={[styles.label, blocked && styles.blocked]}>{label}</Text>
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  text: {
    textAlign: 'center',
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
  },
  prompt: {
    color: colors.onSurfaceVariant,
  },
  label: {
    fontFamily: typography.headlineLgMobile.fontFamily,
    color: colors.primary,
  },
  blocked: {
    color: colors.onSurfaceVariant,
  },
});
