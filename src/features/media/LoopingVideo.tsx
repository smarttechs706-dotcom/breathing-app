import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { EASE_OUT, useAmbientMotion } from '../home/motion';

// A muted, looping background video with no controls, filling its parent.
//
// The player exists only while the screen is focused, the app is in the
// foreground and reduced motion is known to be off (useAmbientMotion's
// `running`). Otherwise nothing is mounted: the decoder is released and the
// screen's own backdrop shows through. So two videos are never decoding at
// once: opening the session player blurs Home, which unmounts Home's video.
//
// It never takes audio focus (muted, 'mixWithOthers'), lets the screen sleep,
// fades in on its first real frame, and if the file fails to load it removes
// itself and the backdrop shows.

const FADE_IN_MS = 400;

export function LoopingVideo({
  source,
  surfaceType = 'surfaceView',
}: {
  source: VideoSource;
  // 'textureView' for a video inside a ScrollView or under an animated
  // opacity; 'surfaceView' (cheaper) for a fixed full-screen video.
  surfaceType?: 'surfaceView' | 'textureView';
}) {
  const { running } = useAmbientMotion();
  if (!running) return null;
  return <ActiveVideo source={source} surfaceType={surfaceType} />;
}

function ActiveVideo({
  source,
  surfaceType,
}: {
  source: VideoSource;
  surfaceType: 'surfaceView' | 'textureView';
}) {
  const [failed, setFailed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.keepScreenOnWhilePlaying = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') setFailed(true);
    });
    return () => sub.remove();
  }, [player]);

  if (failed) return null;

  const fadeIn = () => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        surfaceType={surfaceType}
        onFirstFrameRender={fadeIn}
      />
    </Animated.View>
  );
}
