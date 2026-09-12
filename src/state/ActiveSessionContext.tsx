import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// Minimal shared state so the Player tab (app/(tabs)/player.tsx) can know
// whether a session is genuinely in progress in app/session-player.tsx — a
// separate top-level route, not nested under (tabs). session-player.tsx
// sets this when it mounts and clears it on exit/completion; the Player
// tab reads it to decide between its own empty state and redirecting to
// the real screen, per architecture.md's "Bottom navigation — Player tab
// behavior" section.
interface ActiveSessionContextValue {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue | undefined>(
  undefined
);

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ activeSessionId, setActiveSessionId }),
    [activeSessionId]
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
