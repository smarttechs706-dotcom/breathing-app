// Time-of-day greeting for Home. Pure, so it can be tested without React
// Native. Hours are the phone's local hour, 0-23.
//
// Greeting: morning 05-12, afternoon 12-17, evening 17-24, night 00-05.

// Wraps anything out of range (24, -1) back into 0-23 instead of falling
// through to a wrong branch.
function normalizeHour(hour: number): number {
  const whole = Math.floor(hour);
  return ((whole % 24) + 24) % 24;
}

export function greetingForHour(hour: number): string {
  const h = normalizeHour(hour);
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
