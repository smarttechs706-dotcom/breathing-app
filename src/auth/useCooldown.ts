import { useCallback, useEffect, useState } from 'react';

import { cooldownSecondsLeft, startCooldown, type CooldownKey } from './cooldown';

export function useCooldown(key: CooldownKey) {
  const [secondsLeft, setSecondsLeft] = useState(() => cooldownSecondsLeft(key));

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setInterval(() => setSecondsLeft(cooldownSecondsLeft(key)), 1000);
    return () => clearInterval(timer);
  }, [key, secondsLeft === 0]);

  const start = useCallback(() => {
    startCooldown(key);
    setSecondsLeft(cooldownSecondsLeft(key));
  }, [key]);

  return { secondsLeft, start };
}
