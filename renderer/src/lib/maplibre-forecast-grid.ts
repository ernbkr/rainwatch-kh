import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

export const FORECAST_GRID_SOURCE_ID = 'forecast-grid';
export const FORECAST_GRID_LAYER_ID = 'forecast-grid-layer';

/**
 * Adds the forecast-grid source + symbol layer.
 *
 * Idempotent: a no-op when the source already exists, so re-running after a
 * basemap switch is safe.
 *
 * The layer assumes weather icons have already been registered with the map
 * via `loadWeatherIcons` (see `lib/weather-icons.ts`); the symbol layer
 * falls back to MapLibre's magenta missing-icon glyph if an icon hasn't
 * resolved yet.
 *
 * `icon-allow-overlap: false` is intentional: at country zoom the 0.25°
 * grid has 289 points and MapLibre's symbol-collision pass thins them so
 * the map stays readable. Zooming in surfaces the hidden cells.
 */
export function addForecastGridLayer(
  map: MapLibreMap,
  data: GeoJSON.FeatureCollection,
  visible: boolean
): void {
  if (map.getSource(FORECAST_GRID_SOURCE_ID)) {
    return;
  }

  map.addSource(FORECAST_GRID_SOURCE_ID, {
    type: 'geojson',
    data,
    promoteId: 'id'
  });

  map.addLayer({
    id: FORECAST_GRID_LAYER_ID,
    type: 'symbol',
    source: FORECAST_GRID_SOURCE_ID,
    layout: {
      visibility: visible ? 'visible' : 'none',
      'icon-image': ['get', 'icon_id'],
      // Roughly matched to the capitals layer at country zoom — with ~70
      // points at 0.5° spacing, the icons can be large enough to read
      // without crowding.
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 9, 0.7, 13, 0.9],
      // Thinning at low zoom keeps the map readable; allow overlap at the
      // text level so a precip-probability annotation never disappears if
      // it's added in a follow-up.
      'icon-allow-overlap': false,
      'icon-anchor': 'center'
    }
  });
}

/** Pushes new GeoJSON into the source. No-op if the source isn't added yet. */
export function updateForecastGridData(
  map: MapLibreMap,
  data: GeoJSON.FeatureCollection
): void {
  const source = map.getSource(FORECAST_GRID_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(data);
}

/** Flips layer visibility without touching the source. */
export function setForecastGridVisibility(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(FORECAST_GRID_LAYER_ID)) {
    map.setLayoutProperty(
      FORECAST_GRID_LAYER_ID,
      'visibility',
      visible ? 'visible' : 'none'
    );
  }
}
