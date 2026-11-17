import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useActiveSession } from '../../state/ActiveSessionContext';
import { FADE_IN_MS, FADE_TICK_MS, fadeInVolume } from './ambientSound';

// Home's ambient sound: the looping waves-and-breeze track plays by itself
// while Home is focused and the app is in the foreground, fading in from
// silence to AMBIENT_TARGET_VOLUME over 2 s. There is deliberately no button,
// icon, toggle or stored setting; the phone's volume is the control.
//
// It stops (and the player is released) when Home loses focus (another tab,
// Settings, the session player) or the app goes to the background. It never
// takes audio focus from other apps (mixWithOthers), does not play in the
// background, and stays silent when the phone is on silent or vibrate. If
// anything fails, Home carries on silently.
//
// It never plays while a session is open (any session, voice or silent), so it
// can never sound behind the voice: the loop is already stopped when the
// session player opens, and cannot restart (also not on returning to the
// foreground) until the session closes. While a session is open Home also never
// sets the global audio mode, so the session's doNotMix stays in place.

const SOURCE = require('../../../assets/audio/home-ambient-loop.m4a');

function useFocusedAndForeground(): boolean {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  return focused && foreground;
}

export function useHomeAmbientSound(): void {
  const { activeSessionId } = useActiveSession();
  const active = useFocusedAndForeground() && activeSessionId === null;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let player: AudioPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        await setAudioModeAsync({
          interruptionMode: 'mixWithOthers',
          shouldPlayInBackground: false,
          playsInSilentMode: false,
        });
        if (cancelled) return;
        player = createAudioPlayer(SOURCE);
        player.loop = true;
        player.volume = 0;
        player.play();
        const start = Date.now();
        timer = setInterval(() => {
          const elapsed = Date.now() - start;
          try {
            if (player) player.volume = fadeInVolume(elapsed);
          } catch {
            // Player already released: nothing to do.
          }
          if (elapsed >= FADE_IN_MS && timer) clearInterval(timer);
        }, FADE_TICK_MS);
      } catch {
        // The file failed to load or the audio mode was refused: Home stays silent.
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        player?.pause();
        player?.remove();
      } catch {
        // Already released.
      }
    };
  }, [active]);
}
