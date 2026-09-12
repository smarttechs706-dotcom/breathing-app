import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../src/theme/tokens';

// Placeholder stub — real Insights screen is build order step 5.
export default function InsightsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Insights — coming soon</Text>
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
