import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Weather icons used by the provincial-capitals and forecast-grid layers.
 *
 * Assets: Bas Milius's Meteocons (https://github.com/basmilius/weather-icons),
 * MIT-licensed. Files are committed under `renderer/public/icons/weather/` so
 * the app stays offline-capable. The static "fill" variant is used.
 *
 * Each WMO code maps to an `IconKey` with a day/night pair. Where Meteocons
 * doesn't distinguish day from night for a given condition (rain, drizzle,
 * thunderstorms with rain), both variants point at the same file.
 *
 * Snow/freezing codes (66, 67, 71, 73, 75, 77, 85, 86) are intentionally
 * omitted: they don't occur in Cambodia. If Open-Meteo ever returns one,
 * `iconIdForCode` falls back to the cloudy icon.
 */

export type WmoCode = number;
export type IconId = string; // The MapLibre image id (matches the SVG basename)

interface IconPair {
  readonly day: IconId;
  readonly night: IconId;
}

/** Friendly label per WMO code for popup display. */
export const WMO_LABEL: Readonly<Record<WmoCode, string>> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

const WMO_TO_ICON: Readonly<Record<WmoCode, IconPair>> = {
  0:  { day: 'clear-day',                       night: 'clear-night' },
  1:  { day: 'clear-day',                       night: 'clear-night' },
  2:  { day: 'partly-cloudy-day',               night: 'partly-cloudy-night' },
  3:  { day: 'overcast-day',                    night: 'overcast-night' },
  45: { day: 'fog-day',                         night: 'fog-night' },
  48: { day: 'fog-day',                         night: 'fog-night' },
  51: { day: 'partly-cloudy-day-drizzle',       night: 'partly-cloudy-night-drizzle' },
  53: { day: 'drizzle',                         night: 'drizzle' },
  55: { day: 'drizzle',                         night: 'drizzle' },
  61: { day: 'partly-cloudy-day-rain',          night: 'partly-cloudy-night-rain' },
  63: { day: 'rain',                            night: 'rain' },
  65: { day: 'rain',                            night: 'rain' },
  80: { day: 'partly-cloudy-day-rain',          night: 'partly-cloudy-night-rain' },
  81: { day: 'rain',                            night: 'rain' },
  82: { day: 'rain',                            night: 'rain' },
  95: { day: 'thunderstorms-day',               night: 'thunderstorms-night' },
  96: { day: 'thunderstorms-day-rain',          night: 'thunderstorms-night-rain' },
  99: { day: 'thunderstorms-day-rain',          night: 'thunderstorms-night-rain' }
};

/** Fallback icon shown for any WMO code missing from the table above. */
const UNKNOWN_ICON: IconPair = { day: 'cloudy', night: 'cloudy' };

/**
 * Returns the MapLibre icon id for the given WMO code + day/night flag.
 * Use this as the `icon-image` value in symbol layer paint.
 */
export function iconIdForCode(code: WmoCode, isDay: boolean): IconId {
  const pair = WMO_TO_ICON[code] ?? UNKNOWN_ICON;
  return isDay ? pair.day : pair.night;
}

/** All unique icon ids the layers can reference. Used by the loader. */
const ALL_ICON_IDS: readonly IconId[] = (() => {
  const ids = new Set<IconId>();
  for (const pair of Object.values(WMO_TO_ICON)) {
    ids.add(pair.day);
    ids.add(pair.night);
  }
  ids.add(UNKNOWN_ICON.day);
  ids.add(UNKNOWN_ICON.night);
  return Array.from(ids);
})();

/** Per-icon target size, in CSS pixels. Symbol layers scale down with `icon-size`. */
const ICON_RENDER_SIZE_PX = 64;

/**
 * Loads every weather icon into the map's image registry.
 *
 * Idempotent: skips any icon already present, so calling this from `style.load`
 * (which fires on each basemap switch and wipes registered images) is the
 * intended pattern.
 *
 * Implementation: fetches each SVG via `fetch` to obtain text → renders into
 * an HTMLImageElement with an explicit size → rasterises onto an offscreen
 * canvas → hands the ImageData to `map.addImage`. Going through canvas (rather
 * than passing the URL to `map.loadImage`) sidesteps MapLibre's intermittent
 * SVG-size detection issues by pinning the pixel dimensions ourselves.
 */
export async function loadWeatherIcons(map: MapLibreMap): Promise<void> {
  await Promise.all(
    ALL_ICON_IDS.map(async (id) => {
      if (map.hasImage(id)) return;
      try {
        const imageData = await rasteriseSvg(`/icons/weather/${id}.svg`, ICON_RENDER_SIZE_PX);
        // Re-check before addImage: a parallel call may have added it while
        // the fetch was in flight.
        if (!map.hasImage(id)) {
          map.addImage(id, imageData, { pixelRatio: 2 });
        }
      } catch (caught) {
        // A missing icon shouldn't take the whole map down — log and move on.
        // The layer will fall back to the MapLibre default missing-icon glyph
        // (a magenta square), which is visible enough to flag during testing.
        console.warn(`[weather-icons] failed to load ${id}.svg:`, caught);
      }
    })
  );
}

/** Rasterise an SVG URL to an ImageData of the given size (square). */
async function rasteriseSvg(url: string, sizePx: number): Promise<ImageData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const svgText = await response.text();
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.width = sizePx;
    image.height = sizePx;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('image decode failed'));
      image.src = objectUrl;
    });

    // 2x backing canvas for retina sharpness; MapLibre is told via
    // `pixelRatio: 2` so symbol sizing matches CSS-pixel intent.
    const canvas = document.createElement('canvas');
    canvas.width = sizePx * 2;
    canvas.height = sizePx * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D context unavailable');
    ctx.drawImage(image, 0, 0, sizePx * 2, sizePx * 2);
    return ctx.getImageData(0, 0, sizePx * 2, sizePx * 2);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
