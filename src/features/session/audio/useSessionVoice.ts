import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

import type { BreathPattern } from '../breathPattern';
import { getAudioSettings } from '../../../state/audioSettings';
import type { AudioSettings } from './schedule';
import { deleteBreathTrack, writeBreathTrack } from './trackFiles';
import { loadVoiceClips } from './voiceClips';
import {
  externalChange,
  LOCK_SCREEN_OPTIONS,
  lockScreenMetadata,
  playerCommand,
  trackFinished,
  VOICE_AUDIO_MODE,
  voiceElapsedMs,
} from './voiceClock';
import { planVoice } from './voiceSync';

// Voice guidance in the session player (voice step 6: background playback).
// - While the user picks a mood, the session's track is baked (trackFiles) if
//   Voice guidance is on and clips exist.
// - At Begin, if the track is ready: the audio mode is set (doNotMix, playing
//   in the background and on silent), the notification and lock screen
//   controls appear (session title, "Breathease", no artwork, no seeking), the
//   track starts at the session clock's position, and from then on the
//   player's position is the session's one clock (`driving`). Screen-off and
//   background time count, because they are observed through the player.
// - Otherwise (Voice guidance off, no clips, not ready, or setup failing) the
//   session breathes silently on the existing clock, exactly as before.
// - A play or pause from outside the app (notification, lock screen, a call,
//   another app) is passed to the screen, so its pause state, the circle and
//   the voice agree. A player error hands the clock back to the screen.
// - At Session Complete, on X and when the screen closes, the controls are
//   removed and the player released; the screen deletes the track file.
// Home's ambient loop never plays while a session is open (useHomeAmbientSound).
// Nothing here throws into the screen.

export function useSessionVoice({
  pattern,
  lengthSec,
  sessionTitle,
  ready,
  started,
  want,
  finished,
  clockMs,
  endMs,
  trackNameRef,
  onExternalPause,
  onExternalResume,
  onFallback,
}: {
  pattern: BreathPattern | null;
  lengthSec: number;
  sessionTitle: string | null;
  ready: boolean; // the session is resolved (pre-mood screen showing)
  started: boolean; // Begin was tapped (breathing phase)
  want: boolean; // breathing, not paused, not covered by Settings
  finished: boolean; // Session Complete
  clockMs: number; // the session clock (used once, at the hand-over)
  endMs: number;
  trackNameRef: MutableRefObject<string | null>;
  onExternalPause: () => void;
  onExternalResume: () => void;
  onFallback: (elapsedMs: number) => void; // the voice stopped driving mid-session
}): { driving: boolean; readElapsedMs: () => number | null } {
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const [driving, setDriving] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const handover = useRef<'idle' | 'starting' | 'done' | 'skipped'>('idle');
  const finishedFlag = useRef(false);
  const trackEnded = useRef(false);
  const commanded = useRef({ want: false, at: 0 });
  const latest = useRef({ want, clockMs, endMs, onExternalPause, onExternalResume, onFallback });
  latest.current = { want, clockMs, endMs, onExternalPause, onExternalResume, onFallback };

  useEffect(() => {
    let cancelled = false;
    getAudioSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Bake once, while the user picks a mood: load the clips, plan, write the
  // track, make the player. If the screen closes while the clips load, nothing
  // is written.
  useEffect(() => {
    if (!ready || !pattern || !settings || playerRef.current) return;
    let cancelled = false;
    (async () => {
      const clips = settings.voice ? await loadVoiceClips() : null;
      if (cancelled || playerRef.current) return;
      const plan = planVoice(settings, clips, pattern, lengthSec);
      if (plan.kind !== 'voice') return;
      const track = writeBreathTrack(plan.schedule, plan.clips);
      if (!track.ok) return;
      trackNameRef.current = track.name;
      try {
        playerRef.current = createAudioPlayer({ uri: track.uri }, { updateInterval: 250 });
      } catch {
        deleteBreathTrack(track.name);
        trackNameRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, pattern, settings, lengthSec, trackNameRef]);

  // At Begin: hand the clock to the voice if the track is ready, else carry on
  // silently on the existing clock for the whole session.
  useEffect(() => {
    if (!started || handover.current !== 'idle') return;
    const p = playerRef.current;
    if (!p || !p.isLoaded) {
      handover.current = 'skipped';
      return;
    }
    handover.current = 'starting';
    (async () => {
      try {
        await setAudioModeAsync(VOICE_AUDIO_MODE);
        p.setActiveForLockScreen(true, lockScreenMetadata(sessionTitle), LOCK_SCREEN_OPTIONS);
        await p.seekTo(Math.max(0, latest.current.clockMs) / 1000);
        if (playerRef.current !== p || finishedFlag.current) return;
        handover.current = 'done';
        setDriving(true);
      } catch {
        // Setup failed: no voice this session, the existing clock keeps going.
        handover.current = 'skipped';
        release(playerRef);
      }
    })();
  }, [started, sessionTitle]);

  // While driving: play or pause for what the session wants.
  useEffect(() => {
    const p = playerRef.current;
    if (!driving || !p) return;
    try {
      const cmd = playerCommand(want, p.playing);
      commanded.current = { want, at: Date.now() };
      if (cmd === 'play') p.play();
      if (cmd === 'pause') p.pause();
    } catch {
      // Handled by the status listener (error) below.
    }
  }, [driving, want]);

  // While driving: notice plays and pauses from outside the app, the end of
  // the track, and errors.
  useEffect(() => {
    const p = playerRef.current;
    if (!driving || !p) return;
    const sub = p.addListener('playbackStatusUpdate', (status) => {
      const end = latest.current.endMs;
      const positionMs = (status.currentTime ?? 0) * 1000;
      if (trackFinished(positionMs, end, !!status.didJustFinish)) trackEnded.current = true;
      if (status.error) {
        // The voice failed mid-session: give the clock back to the screen at
        // the voice's position and carry on silently.
        const at = voiceElapsedMs(positionMs, end);
        setDriving(false);
        release(playerRef);
        latest.current.onFallback(at);
        return;
      }
      const change = externalChange({
        wanted: commanded.current.want,
        playing: !!status.playing,
        loaded: !!status.isLoaded,
        finished: trackEnded.current,
        msSinceCommand: Date.now() - commanded.current.at,
      });
      if (change === 'paused') {
        commanded.current = { want: false, at: Date.now() };
        latest.current.onExternalPause();
      } else if (change === 'resumed') {
        commanded.current = { want: true, at: Date.now() };
        latest.current.onExternalResume();
      }
    });
    return () => sub.remove();
  }, [driving]);

  // Session Complete: controls removed, player released.
  useEffect(() => {
    if (!finished) return;
    finishedFlag.current = true;
    setDriving(false);
    release(playerRef);
  }, [finished]);

  // The screen closes (Done, X, Back): the same; the file is deleted by the screen.
  useEffect(
    () => () => {
      finishedFlag.current = true;
      release(playerRef);
    },
    []
  );

  // The session's breathed time while driving: the player's live position,
  // or exactly the end once the track has finished (also when it finished
  // while the app was away: Session Complete shows on return).
  const readElapsedMs = useCallback((): number | null => {
    const end = latest.current.endMs;
    if (trackEnded.current) return end;
    const p = playerRef.current;
    if (!p) return null;
    try {
      const positionMs = p.currentTime * 1000;
      if (trackFinished(positionMs, end, false)) {
        trackEnded.current = true;
        return end;
      }
      return voiceElapsedMs(positionMs, end);
    } catch {
      return null;
    }
  }, []);

  return { driving, readElapsedMs };
}

// Stop, remove the notification and lock screen controls, release.
function release(ref: MutableRefObject<AudioPlayer | null>) {
  const p = ref.current;
  ref.current = null;
  if (!p) return;
  try {
    p.pause();
  } catch {
    // Already stopped.
  }
  try {
    p.setActiveForLockScreen(false);
  } catch {
    // No controls.
  }
  try {
    p.remove();
  } catch {
    // Already released.
  }
}
