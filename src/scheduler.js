const REFRESH_MINUTES = Object.freeze([3, 18, 33, 48]);

function getNextRefreshTime(now = new Date()) {
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

function getNextRefreshDelayMs(now = new Date()) {
  return Math.max(0, getNextRefreshTime(now).getTime() - now.getTime());
}

module.exports = {
  REFRESH_MINUTES,
  getNextRefreshTime,
  getNextRefreshDelayMs
};
