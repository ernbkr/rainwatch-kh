/**
 * Mapterhorn terrain tile routing — pure logic shared by the renderer
 * (browser global `window.RadarTerrain`) and vitest (CommonJS export).
 *
 * Mapterhorn serves elevation data as PMTiles archives:
 *   - planet.pmtiles       covers the whole world for zoom <= 12
 *   - 6-{x6}-{y6}.pmtiles  regional archives keyed by their zoom-6 ancestor
 *                          tile, used for zoom > 12
 */
(function (factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.RadarTerrain = api;
  }
})(function () {
  const MAPTERHORN_BASE_URL = 'https://download.mapterhorn.com';

  // Returns the name of the PMTiles archive that holds tile z/x/y.
  function mapterhornTileName(z, x, y) {
    if (z <= 12) {
      return 'planet';
    }

    const shift = z - 6;
    return `6-${x >> shift}-${y >> shift}`;
  }

  // Builds the pmtiles:// URL the pmtiles protocol resolves to a WebP tile.
  function mapterhornTileUrl(z, x, y) {
    const name = mapterhornTileName(z, x, y);
    return `pmtiles://${MAPTERHORN_BASE_URL}/${name}.pmtiles/${z}/${x}/${y}.webp`;
  }

  return { MAPTERHORN_BASE_URL, mapterhornTileName, mapterhornTileUrl };
});
