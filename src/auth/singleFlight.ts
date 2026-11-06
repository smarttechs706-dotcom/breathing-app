// One action at a time. The lock is taken before the first await, because a
// second tap can land before React re-renders a disabled button: on a real
// phone one signUp button sent 11 requests in under 5 seconds. Never retries.

export function createSingleFlight(onChange: (running: boolean) => void) {
  let locked = false;

  return {
    async run<T>(action: () => Promise<T>): Promise<T | undefined> {
      if (locked) return undefined;
      locked = true;
      onChange(true);
      try {
        return await action();
      } finally {
        locked = false;
        onChange(false);
      }
    },
  };
}
