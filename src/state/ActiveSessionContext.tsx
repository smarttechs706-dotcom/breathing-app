import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// Minimal shared state so the Player tab (app/(tabs)/player.tsx) can know
// whether a session is genuinely in progress in app/session-player.tsx — a
// separate top-level route, not nested under (tabs). session-player.tsx
// sets this when it mounts and clears it on exit/completion; the Player
// tab reads it to decide between its own empty state and redirecting to
// the real screen, per architecture.md's "Bottom navigation — Player tab
// behavior" section.
interface ActiveSessionContextValue {
  activeSessionId: string | null;
  // The player link to return to. A custom session needs its pattern and
  // length in the link (customPattern.customPlayerHref), not only its id.
  activeSessionHref: string | null;
  setActiveSessionId: (id: string | null, href?: string) => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue | undefined>(
  undefined
);

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<{ id: string; href: string } | null>(null);
  const setActiveSessionId = useCallback((id: string | null, href?: string) => {
    setActive(id ? { id, href: href ?? `/session-player?sessionId=${id}` } : null);
  }, []);
  const value = useMemo(
    () => ({
      activeSessionId: active?.id ?? null,
      activeSessionHref: active?.href ?? null,
      setActiveSessionId,
    }),
    [active, setActiveSessionId]
  );
  return (
    <ActiveSessionContext.Provider value={value}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) {
    throw new Error('useActiveSession must be used within ActiveSessionProvider');
  }
  return ctx;
}
