import { invoke } from '@tauri-apps/api/core';

/**
 * Façade for the `get_provincial_capitals` Rust command (see
 * `src-tauri/src/provincial_capitals.rs`). Returns the raw Open-Meteo JSON
 * body unparsed — the hook validates and shapes it.
 */
function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

export const provincialCapitalsApi = {
  async fetch(): Promise<string> {
    try {
      return await invoke<string>('get_provincial_capitals');
    } catch (caught) {
      throw toError(caught);
    }
  }
};

/**
 * The single-point `current=...` block Open-Meteo returns for each location.
 * Field names match the API request in `provincial_capitals.rs`.
 */
export interface CapitalCurrent {
  readonly time: string; // ISO local time, e.g. "2026-05-20T13:00"
  readonly temperature_2m: number;
  readonly relative_humidity_2m: number;
  readonly apparent_temperature: number;
  readonly precipitation: number;
  readonly weather_code: number;
  readonly wind_speed_10m: number;
  readonly wind_direction_10m: number;
  readonly cloud_cover: number;
  readonly is_day: 0 | 1;
}

/**
 * One entry of the Open-Meteo multi-point response. The `current` block is
 * the only one we request; `latitude`/`longitude` are the snapped grid-cell
 * coordinates and are ignored for display.
 */
export interface CapitalForecastEntry {
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly current: CapitalCurrent;
}
