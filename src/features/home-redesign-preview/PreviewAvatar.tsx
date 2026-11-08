import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { accountFirstName, accountInitial } from '../../auth/accountName';
import { useAuth } from '../../auth/AuthProvider';
import { accents, text } from './styles';

// Preview-only avatar: blue glass circle with a white initial, as in the
// reference. Same data and behaviour as the shared AccountAvatar (initial
// from the account name, person icon without one, opens Settings).
export function PreviewAvatar({ size }: { size: number }) {
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
        <Text style={styles.initial}>{initial}</Text>
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.5)} color="#ffffff" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: accents.avatarBorder,
    backgroundColor: accents.avatarFill,
  },
  initial: {
    ...text.initial,
    color: '#ffffff',
    textAlign: 'center',
  },
});
