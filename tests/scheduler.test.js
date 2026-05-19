import { describe, expect, it } from 'vitest';
import { getNextRefreshDelayMs, getNextRefreshTime } from '../renderer/src/lib/scheduler';

function localDate(hour, minute, second = 0) {
  return new Date(2026, 4, 18, hour, minute, second, 0);
}

function hm(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

describe('getNextRefreshTime', () => {
  it.each([
    [localDate(14, 2, 59), '14:03'],
    [localDate(14, 3, 0), '14:18'],
    [localDate(14, 22, 0), '14:33'],
    [localDate(14, 48, 0), '15:03'],
    [localDate(14, 59, 0), '15:03']
  ])('aligns %s to %s', (now, expected) => {
    expect(hm(getNextRefreshTime(now))).toBe(expected);
  });

  it('returns a non-negative delay', () => {
    expect(getNextRefreshDelayMs(localDate(14, 2, 59))).toBe(1000);
  });
});
