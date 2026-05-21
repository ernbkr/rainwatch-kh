/**
 * A resettable single-shot timer that fires `onIdle` after `delayMs` of
 * inactivity. Call `reset()` to restart the countdown, `setEnabled(false)`
 * to pause (re-enabling reschedules from zero), `dispose()` when finished.
 */
export class IdleTimer {
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private isEnabled: boolean;

  constructor(
    private readonly delayMs: number,
    enabled: boolean,
    private readonly onIdle: () => void
  ) {
    this.isEnabled = enabled;
    if (enabled) {
      this.schedule();
    }
  }

  /** Reset the countdown. No-op while disabled or disposed. */
  reset(): void {
    if (!this.isEnabled) return;
    this.clear();
    this.schedule();
  }

  /** Enable or pause the timer. Re-enabling reschedules from zero. */
  setEnabled(enabled: boolean): void {
    if (this.isEnabled === enabled) return;
    this.isEnabled = enabled;
    if (enabled) {
      this.schedule();
    } else {
      this.clear();
    }
  }

  /** Cancel any pending fire and ignore future resets. Idempotent. */
  dispose(): void {
    this.clear();
    this.isEnabled = false;
  }

  private schedule(): void {
    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.onIdle();
    }, this.delayMs);
  }

  private clear(): void {
    if (this.timerId != null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
