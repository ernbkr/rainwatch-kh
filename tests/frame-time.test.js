import { describe, expect, it } from 'vitest';
import { parseFrameTime } from '../renderer/src/lib/frame-time';

describe('parseFrameTime', () => {
  it('parses a DD/MM/YYYY - HH:MM:SS label', () => {
    const date = parseFrameTime('19/05/2026 - 08:31:05');
    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(4); // May (0-indexed)
    expect(date?.getDate()).toBe(19);
    expect(date?.getHours()).toBe(8);
    expect(date?.getMinutes()).toBe(31);
    expect(date?.getSeconds()).toBe(5);
  });

  it('parses a label without seconds', () => {
    const date = parseFrameTime('1/1/2026 - 0:05');
    expect(date?.getHours()).toBe(0);
    expect(date?.getMinutes()).toBe(5);
    expect(date?.getSeconds()).toBe(0);
  });

  it('returns null for an empty label', () => {
    expect(parseFrameTime('')).toBeNull();
    expect(parseFrameTime('   ')).toBeNull();
  });

  it('returns null for a malformed label', () => {
    expect(parseFrameTime('not a date')).toBeNull();
    expect(parseFrameTime('2026-05-19 08:31')).toBeNull();
  });
});
