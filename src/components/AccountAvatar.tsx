import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { accountFirstName, accountInitial } from '../auth/accountName';
import { useAuth } from '../auth/AuthProvider';
import { colors, fontFamilies } from '../theme/tokens';
import { GradientText } from './GradientText';

// The first letter of the account's first name, or a person icon with no name.
// There are no photos, and nothing here is stored.
export function AccountAvatar({ size }: { size: number }) {
  const { session } = useAuth();
  const initial = accountInitial(accountFirstName(session?.user));

  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Open Settings"
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {initial ? (
        <GradientText
          colors={[colors.primary, colors.tertiary]}
          style={[
            styles.initial,
            { fontSize: Math.round(size * 0.45), lineHeight: Math.round(size * 0.6) },
          ]}
        >
          {initial}
        </GradientText>
      ) : (
        <MaterialIcons name="person" size={Math.round(size * 0.5)} color={colors.onSurfaceVariant} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  initial: {
    fontFamily: fontFamilies.semiBold,
    textAlign: 'center',
  },
});
