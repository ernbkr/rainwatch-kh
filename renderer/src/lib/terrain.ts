/**
 * Mapterhorn terrain tile routing.
 *
 * Mapterhorn serves elevation data as PMTiles archives:
 *   - planet.pmtiles       covers the whole world for zoom <= 12
 *   - 6-{x6}-{y6}.pmtiles  regional archives keyed by their zoom-6 ancestor
 *                          tile, used for zoom > 12
 */
export const MAPTERHORN_BASE_URL = 'https://download.mapterhorn.com';

/** Returns the name of the PMTiles archive that holds tile z/x/y. */
export function mapterhornTileName(z: number, x: number, y: number): string {
  if (z <= 12) {
    return 'planet';
  }

  const shift = z - 6;
  return `6-${x >> shift}-${y >> shift}`;
}

/** Builds the pmtiles:// URL the pmtiles protocol resolves to a WebP tile. */
export function mapterhornTileUrl(z: number, x: number, y: number): string {
  const name = mapterhornTileName(z, x, y);
  return `pmtiles://${MAPTERHORN_BASE_URL}/${name}.pmtiles/${z}/${x}/${y}.webp`;
}
