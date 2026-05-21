import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

export const PROVINCIAL_CAPITALS_SOURCE_ID = 'provincial-capitals';
export const PROVINCIAL_CAPITALS_LAYER_ID = 'provincial-capitals-layer';

/**
 * Adds the provincial-capitals source + symbol layer.
 *
 * Idempotent: a no-op if the source already exists, so re-running after a
 * basemap switch (which wipes layers) is safe.
 *
 * `data` is passed as a parsed GeoJSON object — never as a URL — so the
 * webview never makes the HTTP request itself. (All egress is via the Rust
 * `get_provincial_capitals` command.)
 *
 * The layer assumes the weather icons have already been registered with the
 * map via `loadWeatherIcons` (see `lib/weather-icons.ts`). If an icon is
 * missing the symbol falls back to MapLibre's magenta missing-icon glyph.
 */
export function addProvincialCapitalsLayer(
  map: MapLibreMap,
  data: GeoJSON.FeatureCollection,
  visible: boolean
): void {
  if (map.getSource(PROVINCIAL_CAPITALS_SOURCE_ID)) {
    return;
  }

  map.addSource(PROVINCIAL_CAPITALS_SOURCE_ID, {
    type: 'geojson',
    data,
    // Keeps the requested point coords stable when we round-trip through
    // setData — Open-Meteo cell snapping is already discarded in the hook.
    promoteId: 'id'
  });

  map.addLayer({
    id: PROVINCIAL_CAPITALS_LAYER_ID,
    type: 'symbol',
    source: PROVINCIAL_CAPITALS_SOURCE_ID,
    layout: {
      visibility: visible ? 'visible' : 'none',
      'icon-image': ['get', 'icon_id'],
      // Symbols render around 32 CSS px at zoom 10; smaller at country zoom so
      // they don't crowd, larger when zoomed in.
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.35, 10, 0.5, 14, 0.75],
      // Both icons and the temperature label should always show — provincial
      // capitals don't overlap at any zoom we care about.
      'icon-allow-overlap': true,
      'text-allow-overlap': true,
      'icon-anchor': 'bottom',
      'text-field': [
        'concat',
        ['get', 'name'],
        ' ',
        ['number-format', ['get', 'temperature_2m'], { 'max-fraction-digits': 0 }],
        '°'
      ],
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 12, 14, 14],
      'text-anchor': 'top',
      'text-offset': [0, 0.6],
      'text-optional': true
    },
    paint: {
      'text-color': '#0b1f33',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5
    }
  });
}

/** Pushes new GeoJSON into the source. No-op if the source isn't added yet. */
export function updateProvincialCapitalsData(
  map: MapLibreMap,
  data: GeoJSON.FeatureCollection
): void {
  const source = map.getSource(PROVINCIAL_CAPITALS_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(data);
}

/** Flips layer visibility without touching the source. */
export function setProvincialCapitalsVisibility(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(PROVINCIAL_CAPITALS_LAYER_ID)) {
    map.setLayoutProperty(
      PROVINCIAL_CAPITALS_LAYER_ID,
      'visibility',
      visible ? 'visible' : 'none'
    );
  }
}
