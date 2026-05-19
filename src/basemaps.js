/**
 * Basemap definitions — shared by the renderer (browser global
 * `window.RadarBasemaps`) and vitest (CommonJS export).
 *
 * `style` is either a hosted MapLibre style.json URL or an inline style
 * object. `attribution` supplements the MapLibre AttributionControl for
 * basemaps whose style does not carry its own attribution.
 */
(function (factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.RadarBasemaps = api;
  }
})(function () {
  const OSM_ATTRIBUTION =
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Google has no hosted style.json — describe it as an inline raster style.
  const GOOGLE_SATELLITE_STYLE = {
    version: 8,
    sources: {
      'google-satellite': {
        type: 'raster',
        tiles: [
          'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
        ],
        tileSize: 256,
        attribution: '© Google'
      }
    },
    layers: [{ id: 'google-satellite', type: 'raster', source: 'google-satellite' }]
  };

  const BASEMAPS = Object.freeze([
    Object.freeze({
      id: 'colorful',
      label: 'Colorful',
      style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json'
    }),
    Object.freeze({
      id: 'liberty',
      label: 'Liberty',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      attribution: OSM_ATTRIBUTION
    }),
    Object.freeze({
      id: 'fiord',
      label: 'Fiord',
      style: 'https://tiles.openfreemap.org/styles/fiord',
      attribution: OSM_ATTRIBUTION
    }),
    Object.freeze({
      id: 'satellite',
      label: 'Satellite',
      style: GOOGLE_SATELLITE_STYLE
    })
  ]);

  const DEFAULT_BASEMAP_ID = 'colorful';

  // Returns the basemap for `id`, falling back to the default when missing.
  function resolveBasemap(id) {
    return (
      BASEMAPS.find((basemap) => basemap.id === id) ||
      BASEMAPS.find((basemap) => basemap.id === DEFAULT_BASEMAP_ID)
    );
  }

  return { BASEMAPS, DEFAULT_BASEMAP_ID, resolveBasemap };
});
