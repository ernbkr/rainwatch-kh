/** Minutes past each hour at which Cambodia Meteo publishes new radar frames. */
export const REFRESH_MINUTES = [3, 18, 33, 48] as const;

/** Returns the next scheduled refresh time at or after `now`. */
export function getNextRefreshTime(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setSeconds(0, 0);

  const currentMinute = now.getMinutes();
  const nextMinute = REFRESH_MINUTES.find((minute) => minute > currentMinute);

  if (nextMinute !== undefined) {
    next.setMinutes(nextMinute);
  } else {
    next.setHours(next.getHours() + 1);
    next.setMinutes(REFRESH_MINUTES[0]);
  }

  return next;
}

/** Milliseconds from `now` until the next scheduled refresh. */
export function getNextRefreshDelayMs(now: Date = new Date()): number {
  return Math.max(0, getNextRefreshTime(now).getTime() - now.getTime());
}
