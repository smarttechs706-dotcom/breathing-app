import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

// D-02: finishing a session now pops back to the tabs that were already
// mounted (router.dismissTo) instead of replace()-ing onto a fresh copy, so
// screens that fetch insights once on mount (Home, Insights) would otherwise
// keep showing pre-session numbers. The Session Player bumps this after a
// successful check-in save; those screens refresh when they next gain focus.
let checkinVersion = 0;

export function markCheckinSaved() {
  checkinVersion += 1;
}

// `refresh` must be referentially stable (wrap in useCallback). Skips the
// initial focus (the screen's own mount fetch covers it) and only fires when
// a check-in has been saved since this screen last looked.
export function useRefreshOnNewCheckin(refresh: () => void) {
  const seenVersion = useRef(checkinVersion);
  useFocusEffect(
    useCallback(() => {
      if (seenVersion.current === checkinVersion) return;
      seenVersion.current = checkinVersion;
      refresh();
    }, [refresh])
  );
}
