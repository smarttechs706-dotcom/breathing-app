import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../src/theme/tokens';

// Route exists only so the "Player" tab has somewhere to register — the
// tab's tabPress listener (see _layout.tsx) always intercepts and redirects
// to Library before this ever renders. Real Session Player is a separate
// top-level route (app/session-player.tsx, build order step 4), reached
// from Home/Library "Begin" actions, not from this tab directly.
export default function PlayerTabPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>No session in progress</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
  },
});
