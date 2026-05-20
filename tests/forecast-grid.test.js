import { describe, expect, it } from 'vitest';
import {
  dominantWeatherCode,
  summariseWindow,
  SEVERITY_TIERS
} from '../renderer/src/lib/forecast-grid';

describe('dominantWeatherCode', () => {
  it('returns clear (0) for an all-clear window', () => {
    expect(dominantWeatherCode([0, 0, 0, 0, 0, 0], 6)).toBe(0);
  });

  it('returns the modal partly-cloudy code over an all-cloudy window', () => {
    // 2 (partly cloudy) appears more than 1 (mainly clear).
    expect(dominantWeatherCode([1, 2, 2, 1, 2, 1], 6)).toBe(2);
  });

  it('promotes a single thunderstorm hour above a window of clear sky', () => {
    // PRD example: "a thunderstorm in hour 4 of a 6h window matters more
    // than 5 hours of clear sky around it".
    expect(dominantWeatherCode([0, 0, 0, 95, 0, 0], 6)).toBe(95);
  });

  it('respects the active window — a thunderstorm outside the window does not win', () => {
    // 95 is at hour index 5; with a 3-hour window, only [0,0,2] is considered.
    expect(dominantWeatherCode([0, 0, 2, 0, 0, 95], 3)).toBe(2);
  });

  it('prefers heavy rain (tier 1) over moderate rain (tier 2) in the same window', () => {
    expect(dominantWeatherCode([63, 63, 65, 63], 6)).toBe(65);
  });

  it('prefers thunderstorms (tier 0) over heavy rain (tier 1)', () => {
    expect(dominantWeatherCode([65, 65, 99, 65, 65, 65], 6)).toBe(99);
  });

  it('returns the modal code within the winning tier on ties between tiers', () => {
    // tier 3 (light rain) has codes 51, 53, 55, 61, 80. In a 6h window with
    // two 51s and one 61, the modal pick is 51 — the higher-frequency code.
    expect(dominantWeatherCode([51, 0, 51, 0, 61, 0], 6)).toBe(51);
  });

  it('breaks tied counts within a tier by first occurrence', () => {
    // Two 51s and two 61s within the window — 51 appears first.
    expect(dominantWeatherCode([51, 0, 61, 51, 61, 0], 6)).toBe(51);
  });

  it('falls back to code 0 on empty input', () => {
    expect(dominantWeatherCode([], 6)).toBe(0);
  });

  it('returns the first code when nothing falls into any tier', () => {
    // 77 (snow grains) is not tiered for Cambodia; the function returns the
    // first untiered code so the icon-mapping fallback handles it.
    expect(dominantWeatherCode([77, 77], 6)).toBe(77);
  });

  it('handles windows larger than the input gracefully', () => {
    // window = 24h, only 3 hours of data; the function clamps internally.
    expect(dominantWeatherCode([0, 2, 2], 24)).toBe(2);
  });
});

describe('SEVERITY_TIERS', () => {
  it('lists eight tiers in PRD order with no duplicate codes', () => {
    expect(SEVERITY_TIERS).toHaveLength(8);
    const seen = new Set();
    for (const tier of SEVERITY_TIERS) {
      for (const code of tier) {
        expect(seen.has(code)).toBe(false);
        seen.add(code);
      }
    }
  });

  it('places thunderstorm codes at the top', () => {
    expect(SEVERITY_TIERS[0]).toEqual([95, 96, 99]);
  });

  it('places clear at the bottom', () => {
    expect(SEVERITY_TIERS[SEVERITY_TIERS.length - 1]).toEqual([0]);
  });
});

describe('summariseWindow', () => {
  // Build a minimal `GridHourly` block for these tests.
  const hourly = {
    time: [
      '2026-05-20T13:00',
      '2026-05-20T14:00',
      '2026-05-20T15:00',
      '2026-05-20T16:00',
      '2026-05-20T17:00',
      '2026-05-20T18:00'
    ],
    weather_code: [0, 0, 95, 0, 0, 0],
    precipitation: [0, 0, 5.2, 1.1, 0, 0],
    precipitation_probability: [10, 20, 90, 50, 5, 0]
  };

  it('picks the dominant code via the severity rule', () => {
    expect(summariseWindow(hourly, 3).dominantCode).toBe(95);
  });

  it('sums precipitation over the window and rounds to 2dp', () => {
    expect(summariseWindow(hourly, 3).totalPrecipitationMm).toBe(5.2);
    expect(summariseWindow(hourly, 6).totalPrecipitationMm).toBe(6.3);
  });

  it('picks the peak probability over the window', () => {
    expect(summariseWindow(hourly, 3).peakProbabilityPct).toBe(90);
    expect(summariseWindow(hourly, 6).peakProbabilityPct).toBe(90);
  });

  it('reports the window\'s start and end ISO times', () => {
    const summary = summariseWindow(hourly, 3);
    expect(summary.startIso).toBe('2026-05-20T13:00');
    expect(summary.endIso).toBe('2026-05-20T15:00');
  });
});
