import { useCallback, useEffect, useRef, useState } from 'react';
import { PROVINCIAL_CAPITALS } from '../lib/cambodia-provinces';
import {
  provincialCapitalsApi,
  type CapitalCurrent,
  type CapitalForecastEntry
} from '../lib/provincial-capitals';
import { iconIdForCode } from '../lib/weather-icons';

export type ProvincialCapitalsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProvincialCapitalsState {
  /** GeoJSON ready to drop into a MapLibre `geojson` source. */
  data: GeoJSON.FeatureCollection | null;
  status: ProvincialCapitalsStatus;
  error: string;
  /** When the most recent successful fetch completed. */
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Loads current weather for the 25 Cambodian provincial capitals from
 * Open-Meteo (via the `get_provincial_capitals` Rust command). Mirrors the
 * lifecycle of the old `useWeatherStations` hook:
 *
 *  - Fetch once on mount; no background polling.
 *  - `refresh()` re-fetches manually.
 *  - In-flight overlap is suppressed via `inFlightRef`.
 *  - A failed refresh that follows a successful one keeps the existing data
 *    on the map (status reverts to 'ready'); the very first failure surfaces
 *    as 'error'.
 *  - Cancellation guard prevents setState after unmount.
 *
 * The Open-Meteo multi-point response returns an array indexed by request
 * order — we re-pair entries to `PROVINCIAL_CAPITALS` by position, so the
 * static list defines the order of all downstream UI.
 */
export function useProvincialCapitals(): ProvincialCapitalsState {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [status, setStatus] = useState<ProvincialCapitalsStatus>('loading');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);
  const dataRef = useRef<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const load = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('loading');

    try {
      const body = await provincialCapitalsApi.fetch();
      if (cancelledRef.current) return;

      const featureCollection = parseCapitalsResponse(body);
      setData(featureCollection);
      setStatus('ready');
      setError('');
      setLastUpdated(new Date());
    } catch (caught) {
      if (cancelledRef.current) return;
      const message =
        caught instanceof Error
          ? caught.message
          : 'Could not fetch provincial capital forecasts.';
      setError(message);
      setStatus(dataRef.current !== null ? 'ready' : 'error');
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

  return { data, status, error, lastUpdated, refresh };
}

/**
 * Parses the Open-Meteo multi-point response and pairs each entry with its
 * source capital, producing a `FeatureCollection` keyed off `PROVINCIAL_CAPITALS`
 * order. Throws if the entry count mismatches the request — that means the
 * Rust command is sending different coordinates than the renderer expects.
 */
function parseCapitalsResponse(body: string): GeoJSON.FeatureCollection {
  const parsed = JSON.parse(body) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Open-Meteo response was not an array of locations.');
  }
  const entries = parsed as CapitalForecastEntry[];
  if (entries.length !== PROVINCIAL_CAPITALS.length) {
    throw new Error(
      `Open-Meteo returned ${entries.length} locations; expected ${PROVINCIAL_CAPITALS.length}.`
    );
  }

  const features: GeoJSON.Feature[] = entries.map((entry, idx) => {
    const capital = PROVINCIAL_CAPITALS[idx];
    const current: CapitalCurrent = entry.current;
    return {
      type: 'Feature',
      id: capital.id,
      geometry: {
        type: 'Point',
        coordinates: [capital.lon, capital.lat] // requested coords, not the snapped cell
      },
      properties: {
        id: capital.id,
        name: capital.name,
        province: capital.province,
        // Flattened for fast access in MapLibre expressions and popup HTML.
        weather_code: current.weather_code,
        temperature_2m: current.temperature_2m,
        apparent_temperature: current.apparent_temperature,
        relative_humidity_2m: current.relative_humidity_2m,
        precipitation: current.precipitation,
        wind_speed_10m: current.wind_speed_10m,
        wind_direction_10m: current.wind_direction_10m,
        cloud_cover: current.cloud_cover,
        is_day: current.is_day,
        observed_at: current.time,
        // Pre-computed so the symbol layer is a single `['get', 'icon_id']`
        // instead of a chained match-expression across every WMO code.
        icon_id: iconIdForCode(current.weather_code, current.is_day === 1)
      }
    };
  });

  return { type: 'FeatureCollection', features };
}
