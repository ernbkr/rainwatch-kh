import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CAMBODIA_GRID } from '../lib/cambodia-grid';
import {
  forecastGridApi,
  summariseWindow,
  type ForecastWindowHours,
  type GridForecastEntry,
  type GridHourly
} from '../lib/forecast-grid';
import { iconIdForCode, WMO_LABEL } from '../lib/weather-icons';

export type ForecastGridStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ForecastGridState {
  /** GeoJSON ready to drop into a MapLibre `geojson` source. */
  data: GeoJSON.FeatureCollection | null;
  status: ForecastGridStatus;
  error: string;
  /** When the last successful Open-Meteo fetch completed. */
  lastUpdated: Date | null;
  /** The active window — drives feature properties (dominant code + summary). */
  window: ForecastWindowHours;
  setWindow: (next: ForecastWindowHours) => void;
  refresh: () => void;
}

/**
 * Loads 24h of hourly forecast for every Cambodia grid point and exposes a
 * MapLibre-ready FeatureCollection summarised over the user-selected window.
 *
 * Lifecycle: identical shape to `useProvincialCapitals` — fetch once on
 * mount, manual refresh, in-flight + cancellation guards, refresh-failure
 * preserves prior data.
 *
 * Window switching: the raw `hourly` arrays are stored in a ref, and the
 * `FeatureCollection` is recomputed via `useMemo` whenever `window` (or the
 * raw data) changes. Open-Meteo is **not** re-hit on a window change.
 */
export function useForecastGrid(): ForecastGridState {
  const [rawEntries, setRawEntries] = useState<GridForecastEntry[] | null>(null);
  const [status, setStatus] = useState<ForecastGridStatus>('loading');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [window, setWindowState] = useState<ForecastWindowHours>(6);

  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);
  const rawRef = useRef<GridForecastEntry[] | null>(null);

  useEffect(() => {
    rawRef.current = rawEntries;
  }, [rawEntries]);

  const load = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('loading');

    try {
      const body = await forecastGridApi.fetch();
      if (cancelledRef.current) return;

      const entries = parseGridResponse(body);
      setRawEntries(entries);
      setStatus('ready');
      setError('');
      setLastUpdated(new Date());
    } catch (caught) {
      if (cancelledRef.current) return;
      const message =
        caught instanceof Error ? caught.message : 'Could not fetch forecast grid.';
      setError(message);
      setStatus(rawRef.current !== null ? 'ready' : 'error');
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  const setWindow = useCallback((next: ForecastWindowHours) => {
    setWindowState(next);
  }, []);

  // Build the FeatureCollection from the raw entries + active window. The
  // memo keys ensure a refetch or window change rebuilds; otherwise it stays
  // referentially stable (useful for the MapLibre effect dependency array).
  const data = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!rawEntries) return null;
    return buildFeatureCollection(rawEntries, window);
  }, [rawEntries, window]);

  return { data, status, error, lastUpdated, window, setWindow, refresh };
}

/** Parses Open-Meteo's multi-point response into a per-grid-point array. */
function parseGridResponse(body: string): GridForecastEntry[] {
  const parsed = JSON.parse(body) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Open-Meteo response was not an array of locations.');
  }
  const entries = parsed as GridForecastEntry[];
  if (entries.length !== CAMBODIA_GRID.length) {
    throw new Error(
      `Open-Meteo returned ${entries.length} forecast points; expected ${CAMBODIA_GRID.length}. ` +
        `Rerun the build-grid script if the grid was regenerated.`
    );
  }
  for (const entry of entries) {
    if (!entry?.hourly?.weather_code || !Array.isArray(entry.hourly.weather_code)) {
      throw new Error('Open-Meteo entry missing hourly.weather_code array.');
    }
  }
  return entries;
}

/** Builds the `FeatureCollection` for the active window. */
function buildFeatureCollection(
  entries: GridForecastEntry[],
  window: ForecastWindowHours
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = entries.map((entry, idx) => {
    const { lat, lon } = CAMBODIA_GRID[idx];
    const summary = summariseWindow(entry.hourly as GridHourly, window);
    return {
      type: 'Feature',
      // Stable id so MapLibre can diff features on setData calls.
      id: `g-${idx}`,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        // The grid layer has no per-hour `is_day` (the PRD defers that
        // refinement) — use the day variant universally.
        icon_id: iconIdForCode(summary.dominantCode, true),
        dominant_code: summary.dominantCode,
        dominant_label: WMO_LABEL[summary.dominantCode] ?? `Weather code ${summary.dominantCode}`,
        total_precip_mm: summary.totalPrecipitationMm,
        peak_probability_pct: summary.peakProbabilityPct,
        start_iso: summary.startIso,
        end_iso: summary.endIso,
        window_hours: window
      }
    };
  });
  return { type: 'FeatureCollection', features };
}
