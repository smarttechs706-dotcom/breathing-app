import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '../../src/theme/tokens';

// architecture.md: bottom nav is ONE shared component (this file), not
// rebuilt per screen — Home/Insights' icon set (home, grid_view, air,
// monitoring, each with a text label) is the standard; ignore Library's
// Stitch export, which showed a different, label-less icon set.
type TabIconName = keyof typeof MaterialIcons.glyphMap;

// home-code.html's active tab wraps icon+label together in one
// `bg-primary-container/20 rounded-xl` pill — not just a tinted icon/label.
// tabBarIcon/tabBarLabel render as separate slots by default, so this
// renders both inside the icon slot and tabBarShowLabel is turned off below.
function TabButtonContent({
  name,
  label,
  focused,
}: {
  name: TabIconName;
  label: string;
  focused: boolean;
}) {
  const tintColor = focused ? colors.primary : `${colors.onSurfaceVariant}B3`;
  return (
    <View style={[styles.tabContent, focused && styles.tabContentActive]}>
      <MaterialIcons name={name} size={24} color={tintColor} />
      <Text style={[styles.label, { color: tintColor }]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: `${colors.onSurfaceVariant}B3`,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView
            intensity={40}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabButtonContent name="home" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ focused }) => (
            <TabButtonContent name="grid-view" label="Library" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: 'Player',
          tabBarIcon: ({ focused }) => (
            <TabButtonContent name="air" label="Player" focused={focused} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // architecture.md: tapping Player with no session in progress
            // redirects to Library rather than showing a dead/empty tab.
            // TODO: once Session Player exists, only redirect when there is
            // no active session; navigate to it directly otherwise.
            e.preventDefault();
            router.replace('/library');
          },
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ focused }) => (
            <TabButtonContent name="insights" label="Insights" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    height: 84,
    paddingTop: 8,
  },
  tabItem: {
    paddingTop: 4,
  },
  // home-code.html: `bg-primary-container/20 rounded-xl px-4 py-1` on the
  // active tab only.
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  tabContentActive: {
    backgroundColor: `${colors.primaryContainer}33`,
  },
  label: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    marginTop: 2,
  },
});
