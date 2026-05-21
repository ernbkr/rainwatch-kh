import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdleTimer } from '../renderer/src/lib/idle-timer';

describe('IdleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onIdle after delayMs', () => {
    const onIdle = vi.fn();
    new IdleTimer(1000, true, onIdle);

    vi.advanceTimersByTime(999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('reset() cancels and reschedules', () => {
    const onIdle = vi.fn();
    const timer = new IdleTimer(1000, true, onIdle);

    vi.advanceTimersByTime(500);
    timer.reset();
    vi.advanceTimersByTime(999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('does not schedule when constructed disabled', () => {
    const onIdle = vi.fn();
    new IdleTimer(1000, false, onIdle);

    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('setEnabled(false) cancels a pending fire', () => {
    const onIdle = vi.fn();
    const timer = new IdleTimer(1000, true, onIdle);

    vi.advanceTimersByTime(500);
    timer.setEnabled(false);
    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('setEnabled(true) reschedules from zero', () => {
    const onIdle = vi.fn();
    const timer = new IdleTimer(1000, false, onIdle);

    timer.setEnabled(true);
    vi.advanceTimersByTime(999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('reset() is a no-op while disabled', () => {
    const onIdle = vi.fn();
    const timer = new IdleTimer(1000, false, onIdle);

    timer.reset();
    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('setEnabled is idempotent', () => {
    const onIdle = vi.fn();
    const timer = new IdleTimer(1000, true, onIdle);

    // Calling setEnabled(true) again must not stack a second timer.
    timer.setEnabled(true);
    vi.advanceTimersByTime(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('dispose() cancels pending and ignores further resets', () => {
    const onIdle = vi.fn();
    const timer = new IdleTimer(1000, true, onIdle);

    timer.dispose();
    timer.reset();
    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
