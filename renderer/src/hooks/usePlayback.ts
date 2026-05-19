import { useEffect, useState } from 'react';
import type { Frame } from '../lib/types';

const BASE_FRAME_DELAY_MS = 250;

/**
 * Drives the radar animation. While `isPlaying`, a speed-scaled interval cycles
 * the frame index; the returned setter lets the timeline scrub when paused.
 * The index resets to the first frame whenever the frame set is replaced.
 */
export function usePlayback(
  frames: Frame[],
  speed: number,
  isPlaying: boolean
): [number, (index: number) => void] {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [frames]);

  useEffect(() => {
    if (!isPlaying || frames.length <= 1) {
      return;
    }
    const delay = Math.max(50, Math.round(BASE_FRAME_DELAY_MS / speed));
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % frames.length);
    }, delay);
    return () => window.clearInterval(timer);
  }, [frames, speed, isPlaying]);

  const safeIndex = frames.length > 0 ? Math.min(index, frames.length - 1) : 0;
  return [safeIndex, setIndex];
}
