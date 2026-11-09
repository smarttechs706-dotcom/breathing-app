import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

// Shared background for Library, Profile, Settings, Reminder and Change
// password: the deep navy used across the redesign (the tab pill's navy at the
// top to the navy at the bottom of Home's paintings).
//
// `painting`, when given, fills the screen behind a navy tint (MIST_TINT) and a
// fade to solid BACKDROP_BOTTOM at the bottom, so the glass cards stay readable.
// Without it, only the navy gradient is drawn.

export const BACKDROP_TOP = '#0a1028';
export const BACKDROP_BOTTOM = '#00051a';

// The dark navy mist painting (853 x 1844, from assets/design-reference/).
export const MIST_BACKGROUND: ImageSourcePropType = require('./images/mist-background.jpg');

// Strength of the #0a1028 tint over the painting, 0 to 1. Tune here.
export const MIST_TINT = 0.45;

export function ScreenBackdrop({ painting }: { painting?: ImageSourcePropType }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[BACKDROP_TOP, BACKDROP_BOTTOM]} style={StyleSheet.absoluteFill} />
      {painting && (
        <>
          <Image source={painting} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(10,16,40,${MIST_TINT})` }]} />
          <LinearGradient
            colors={['rgba(0,5,26,0)', BACKDROP_BOTTOM]}
            locations={[0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
    </View>
  );
}
