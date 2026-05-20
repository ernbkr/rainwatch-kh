import { invoke } from '@tauri-apps/api/core';
import type { WmoCode } from './weather-icons';

/**
 * Façade for the `get_forecast_grid` Rust command (see
 * `src-tauri/src/forecast_grid.rs`).
 */
function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

export const forecastGridApi = {
  async fetch(): Promise<string> {
    try {
      return await invoke<string>('get_forecast_grid');
    } catch (caught) {
      throw toError(caught);
    }
  }
};

/**
 * The user-selectable forecast window. The hook keeps all 24h of data in
 * memory; switching windows is a pure client-side recompute, no refetch.
 */
export type ForecastWindowHours = 3 | 6 | 12 | 24;

export const FORECAST_WINDOWS: readonly ForecastWindowHours[] = [3, 6, 12, 24] as const;

/**
 * The single-location `hourly` block Open-Meteo returns. Each array has 24
 * entries indexed by hour-from-now (entry 0 is the current hour).
 */
export interface GridHourly {
  readonly time: readonly string[]; // ISO-local, e.g. "2026-05-20T13:00"
  readonly weather_code: readonly number[];
  readonly precipitation: readonly number[];
  readonly precipitation_probability: readonly number[];
}

export interface GridForecastEntry {
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly hourly: GridHourly;
}

/**
 * WMO weather-code severity tiers, highest first. The grid layer picks the
 * **highest-severity tier present** in the active window, then the modal
 * code within that tier. The rule prioritises showing severe weather over
 * the average condition — a thunderstorm in hour 4 of a 6h window matters
 * more than 5 hours of clear sky around it.
 */
export const SEVERITY_TIERS: readonly (readonly WmoCode[])[] = [
  [95, 96, 99], // thunderstorm (+ hail)
  [65, 82], // heavy rain / violent showers
  [63, 81], // moderate rain / showers
  [51, 53, 55, 61, 80], // drizzle, light rain, slight showers
  [45, 48], // fog
  [3], // overcast
  [1, 2], // mainly clear / partly cloudy
  [0] // clear
];

/** Tier index per WMO code, pre-computed for O(1) lookup. */
const TIER_INDEX_BY_CODE: ReadonlyMap<WmoCode, number> = (() => {
  const m = new Map<WmoCode, number>();
  SEVERITY_TIERS.forEach((tier, idx) => {
    for (const code of tier) m.set(code, idx);
  });
  return m;
})();

/**
 * Returns the dominant WMO code over the first `windowHours` of `codes`,
 * applying the severity rule above.
 *
 *  - Codes not in any tier (rare/unsupported, e.g. snow in Cambodia) are
 *    treated as the lowest tier; they only win when nothing tiered is
 *    present, in which case the first such code is returned.
 *  - An empty or undersized input falls back to code `0` (clear).
 */
export function dominantWeatherCode(
  codes: readonly WmoCode[],
  windowHours: ForecastWindowHours
): WmoCode {
  if (codes.length === 0) return 0;
  const slice = codes.slice(0, Math.min(windowHours, codes.length));

  // Find the highest-severity tier (lowest tier-index) any hour falls into.
  let bestTier = SEVERITY_TIERS.length; // "no tier" sentinel
  for (const code of slice) {
    const tier = TIER_INDEX_BY_CODE.get(code);
    if (tier !== undefined && tier < bestTier) {
      bestTier = tier;
      if (bestTier === 0) break; // can't do better than the top tier
    }
  }

  if (bestTier === SEVERITY_TIERS.length) {
    // Nothing in any tier — return whatever code appears first.
    return slice[0];
  }

  // Modal code within the winning tier. Ties broken by first occurrence
  // in the window (most-recent-wins would be defensible too, but this
  // keeps results stable when codes alternate evenly).
  const counts = new Map<WmoCode, number>();
  let modal: WmoCode = -1;
  let modalCount = 0;
  for (const code of slice) {
    if (TIER_INDEX_BY_CODE.get(code) !== bestTier) continue;
    const next = (counts.get(code) ?? 0) + 1;
    counts.set(code, next);
    if (next > modalCount) {
      modalCount = next;
      modal = code;
    }
  }
  return modal;
}

/**
 * Window summary derived from a single grid point's hourly data. The hook
 * caches these per-point and rebuilds the GeoJSON whenever the user changes
 * the window — no network roundtrip.
 */
export interface GridWindowSummary {
  readonly dominantCode: WmoCode;
  /** Sum of `precipitation` (mm) over the window. */
  readonly totalPrecipitationMm: number;
  /** Max of `precipitation_probability` (%) over the window. */
  readonly peakProbabilityPct: number;
  /** Start of the window as Open-Meteo's local ISO string. */
  readonly startIso: string;
  /** Last hour of the window as Open-Meteo's local ISO string. */
  readonly endIso: string;
}

/** Computes `GridWindowSummary` for one point. */
export function summariseWindow(
  hourly: GridHourly,
  windowHours: ForecastWindowHours
): GridWindowSummary {
  const N = Math.min(windowHours, hourly.weather_code.length);
  let totalPrecip = 0;
  let peakProb = 0;
  for (let i = 0; i < N; i++) {
    totalPrecip += hourly.precipitation[i] ?? 0;
    const prob = hourly.precipitation_probability[i] ?? 0;
    if (prob > peakProb) peakProb = prob;
  }
  return {
    dominantCode: dominantWeatherCode(hourly.weather_code, windowHours),
    // Two-decimal round to suppress IEEE-754 accumulation drift in popup output.
    totalPrecipitationMm: Math.round(totalPrecip * 100) / 100,
    peakProbabilityPct: peakProb,
    startIso: hourly.time[0] ?? '',
    endIso: hourly.time[N - 1] ?? hourly.time[0] ?? ''
  };
}
