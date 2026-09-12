import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../src/theme/tokens';

// Placeholder stub — real Library screen is build order step 3.
export default function LibraryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Library — coming soon</Text>
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
