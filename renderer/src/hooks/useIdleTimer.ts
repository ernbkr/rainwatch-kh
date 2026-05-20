import { useCallback, useEffect, useRef } from 'react';
import { IdleTimer } from '../lib/idle-timer';

export interface UseIdleTimerOptions {
  delayMs: number;
  /** When false, the timer is paused and `reset()` is a no-op. */
  enabled: boolean;
  onIdle: () => void;
}

/**
 * React adapter for {@link IdleTimer}. The timer is created once per
 * `delayMs` and the latest `onIdle` is invoked via a ref so callers can
 * pass inline arrow functions without tearing the timer down each render.
 */
export function useIdleTimer(options: UseIdleTimerOptions): { reset: () => void } {
  const onIdleRef = useRef(options.onIdle);
  onIdleRef.current = options.onIdle;

  const timerRef = useRef<IdleTimer | null>(null);

  useEffect(() => {
    const timer = new IdleTimer(options.delayMs, options.enabled, () => onIdleRef.current());
    timerRef.current = timer;
    return () => {
      timer.dispose();
      timerRef.current = null;
    };
    // `delayMs` is treated as immutable for the timer's lifetime; `enabled`
    // is forwarded into the constructor on first mount and then driven by
    // the sync-effect below. Including `enabled` here would tear the timer
    // down on every toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.delayMs]);

  useEffect(() => {
    timerRef.current?.setEnabled(options.enabled);
  }, [options.enabled]);

  const reset = useCallback(() => {
    timerRef.current?.reset();
  }, []);

  return { reset };
}
