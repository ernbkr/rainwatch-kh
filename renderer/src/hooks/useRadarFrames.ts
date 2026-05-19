import { useCallback, useEffect, useRef, useState } from 'react';
import { preloadFrames, revokeFrameOverlayUrls } from '../lib/overlay';
import { radar } from '../lib/radar';
import { getNextRefreshDelayMs, getNextRefreshTime } from '../lib/scheduler';
import type { DomainId, Frame } from '../lib/types';

export interface RadarFramesState {
  frames: Frame[];
  status: string;
  error: string;
  lastChecked: Date | null;
  nextRefresh: Date | null;
  refreshNow: () => void;
}

/**
 * Loads radar frames for a domain, preloads/crops their images, and re-checks
 * the source on the scheduled cadence. Reloading on a domain change clears the
 * existing frames; scheduled and manual refreshes are incremental.
 */
export function useRadarFrames(domain: DomainId): RadarFramesState {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [status, setStatus] = useState('Loading radar frames…');
  const [error, setError] = useState('');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);

  const framesRef = useRef<Frame[]>([]);
  const latestUrlRef = useRef('');
  const loadRef = useRef<(clearExisting: boolean) => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | undefined;

    function commitFrames(next: Frame[]): void {
      setFrames((previous) => {
        revokeFrameOverlayUrls(previous);
        return next;
      });
      framesRef.current = next;
    }

    async function load(clearExisting: boolean): Promise<void> {
      if (clearExisting) {
        commitFrames([]);
        latestUrlRef.current = '';
        setStatus('Loading radar frames…');
        setError('');
      }

      try {
        const result = await radar.fetchFrames(domain);
        if (cancelled) {
          return;
        }

        setLastChecked(new Date(result.fetchedAt));

        if (!Array.isArray(result.frames) || result.frames.length === 0) {
          throw new Error('No radar frames found in the source page.');
        }

        const latestUrl = result.frames.at(-1)?.url ?? '';
        if (!clearExisting && latestUrlRef.current && latestUrl === latestUrlRef.current) {
          setStatus(`No newer frame found. ${framesRef.current.length} frames loaded.`);
          return;
        }

        setStatus('Preloading radar frames…');
        const playable = await preloadFrames(result.frames);
        if (cancelled) {
          revokeFrameOverlayUrls(playable);
          return;
        }
        if (playable.length === 0) {
          throw new Error('Radar images could not be loaded.');
        }

        latestUrlRef.current = latestUrl;
        commitFrames(playable);
        setStatus(`${playable.length} frames loaded.`);
        setError('');
      } catch (caught) {
        if (cancelled) {
          return;
        }
        const message =
          caught instanceof Error ? caught.message : 'Could not fetch radar source page.';
        if (framesRef.current.length > 0) {
          setError(`${message} Retrying at the next scheduled refresh.`);
        } else {
          setError(message);
          setStatus('Unable to load radar frames.');
        }
      }
    }

    loadRef.current = load;

    function scheduleRefresh(): void {
      setNextRefresh(getNextRefreshTime());
      refreshTimer = window.setTimeout(() => {
        void load(false).then(() => {
          if (!cancelled) {
            scheduleRefresh();
          }
        });
      }, getNextRefreshDelayMs());
    }

    void load(true);
    scheduleRefresh();

    return () => {
      cancelled = true;
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      revokeFrameOverlayUrls(framesRef.current);
    };
  }, [domain]);

  const refreshNow = useCallback(() => {
    void loadRef.current(false);
  }, []);

  return { frames, status, error, lastChecked, nextRefresh, refreshNow };
}
