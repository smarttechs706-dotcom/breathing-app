import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';

import type { BreathPattern } from '../breathPattern';
import { getAudioSettings } from '../../../state/audioSettings';
import type { AudioSettings } from './schedule';
import { deleteBreathTrack, writeBreathTrack } from './trackFiles';
import { getVoiceClips } from './voiceClips';
import { planVoice, syncStep } from './voiceSync';

// Voice guidance in the session player (step 5: foreground only).
// - While the user picks a mood, the session's track is baked (trackFiles) if
//   Voice guidance is on and clips exist; otherwise nothing happens and the
//   session breathes silently with its existing timing.
// - The existing session clock stays in charge: the audio is lined up with it
//   on every start and resume, and moved back if it drifts (voiceSync). It
//   pauses whenever the clock stops (pause, Settings, background), so the
//   screen-off rule is unchanged for now (background playback is step 6).
// - Before the first sound, the audio mode is set to doNotMix (other apps
//   pause) without background playback. Home's ambient loop is already off:
//   it never plays while a session is open (useHomeAmbientSound).
// - The player is released when the session completes or the screen closes;
//   the track file is deleted by the screen (trackNameRef) on close.
// Nothing here throws into the screen: every failure means silent breathing.

export function useSessionVoice({
  pattern,
  lengthSec,
  ready,
  breathing,
  finished,
  clockMs,
  trackNameRef,
}: {
  pattern: BreathPattern | null;
  lengthSec: number;
  ready: boolean; // the session is resolved (pre-mood screen showing)
  breathing: boolean; // the session clock is running
  finished: boolean; // Session Complete
  clockMs: number;
  trackNameRef: MutableRefObject<string | null>;
}): void {
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const modeSet = useRef(false);
  const modeRequested = useRef(false);
  const latest = useRef({ breathing, clockMs });
  latest.current = { breathing, clockMs };

  useEffect(() => {
    let cancelled = false;
    getAudioSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Bake once, while the user picks a mood.
  useEffect(() => {
    if (!ready || !pattern || !settings || playerRef.current) return;
    const plan = planVoice(settings, getVoiceClips(), pattern, lengthSec);
    if (plan.kind !== 'voice') return;
    const track = writeBreathTrack(plan.schedule, plan.clips);
    if (!track.ok) return;
    trackNameRef.current = track.name;
    try {
      playerRef.current = createAudioPlayer({ uri: track.uri }, { updateInterval: 500 });
    } catch {
      deleteBreathTrack(track.name);
      trackNameRef.current = null;
    }
  }, [ready, pattern, settings, lengthSec, trackNameRef]);

  // Released when the screen closes (the file is deleted by the screen).
  useEffect(
    () => () => {
      release(playerRef);
    },
    []
  );

  // Session Complete: stop and release.
  useEffect(() => {
    if (finished) release(playerRef);
  }, [finished]);

  // Follow the clock on every update.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || finished) return;
    const sync = () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const step = syncStep({
          want: latest.current.breathing && modeSet.current && p.isLoaded,
          playing: p.playing,
          audioMs: p.currentTime * 1000,
          clockMs: latest.current.clockMs,
        });
        if (step.pause) p.pause();
        if (step.seekMs !== undefined) void p.seekTo(step.seekMs / 1000).catch(() => {});
        if (step.play) p.play();
      } catch {
        // Player gone or failing: the session keeps breathing silently.
      }
    };
    if (breathing && !modeSet.current) {
      if (!modeRequested.current) {
        modeRequested.current = true;
        setAudioModeAsync({ interruptionMode: 'doNotMix', shouldPlayInBackground: false, playsInSilentMode: true })
          .catch(() => {})
          .finally(() => {
            modeSet.current = true;
            sync();
          });
      }
      return;
    }
    sync();
  }, [breathing, clockMs, finished]);
}

function release(ref: MutableRefObject<AudioPlayer | null>) {
  const p = ref.current;
  ref.current = null;
  if (!p) return;
  try {
    p.pause();
    p.remove();
  } catch {
    // Already released.
  }
}
