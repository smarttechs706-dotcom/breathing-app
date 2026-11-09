import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

// Shared background for Profile, Settings and the Reminder screen: the deep
// navy used across the redesign (the tab pill's navy at the top to the navy at
// the bottom of Home's paintings).
//
// `painting` is a slot for later and is not used by any screen yet: when
// given, the image fills the screen behind a dark fade so the glass cards stay
// readable. Screens only need to pass the prop; nothing else changes.

export const BACKDROP_TOP = '#0a1028';
export const BACKDROP_BOTTOM = '#00051a';

export function ScreenBackdrop({ painting }: { painting?: ImageSourcePropType }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[BACKDROP_TOP, BACKDROP_BOTTOM]} style={StyleSheet.absoluteFill} />
      {painting && (
        <>
          <Image source={painting} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
          <LinearGradient
            colors={['rgba(10,16,40,0.55)', 'rgba(10,16,40,0.75)', 'rgba(0,5,26,0.92)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
    </View>
  );
}
