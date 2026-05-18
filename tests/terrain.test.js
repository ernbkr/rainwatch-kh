import { describe, expect, it } from 'vitest';
import terrain from '../src/terrain';

const { MAPTERHORN_BASE_URL, mapterhornTileName, mapterhornTileUrl } = terrain;

describe('mapterhornTileName', () => {
  it('routes zoom 12 and below to the planet archive', () => {
    expect(mapterhornTileName(0, 0, 0)).toBe('planet');
    expect(mapterhornTileName(6, 32, 40)).toBe('planet');
    expect(mapterhornTileName(12, 3000, 1800)).toBe('planet');
  });

  it('routes zoom above 12 to the zoom-6 ancestor archive', () => {
    expect(mapterhornTileName(13, 200, 300)).toBe(`6-${200 >> 7}-${300 >> 7}`);
    expect(mapterhornTileName(13, 200, 300)).toBe('6-1-2');
    expect(mapterhornTileName(14, 8000, 5000)).toBe(`6-${8000 >> 8}-${5000 >> 8}`);
    expect(mapterhornTileName(14, 8000, 5000)).toBe('6-31-19');
  });
});

describe('mapterhornTileUrl', () => {
  it('builds a pmtiles URL against the planet archive', () => {
    expect(mapterhornTileUrl(10, 5, 6)).toBe(
      'pmtiles://https://download.mapterhorn.com/planet.pmtiles/10/5/6.webp'
    );
  });

  it('builds a pmtiles URL against a regional archive above zoom 12', () => {
    expect(mapterhornTileUrl(14, 8000, 5000)).toBe(
      'pmtiles://https://download.mapterhorn.com/6-31-19.pmtiles/14/8000/5000.webp'
    );
  });

  it('uses the exported base URL', () => {
    expect(MAPTERHORN_BASE_URL).toBe('https://download.mapterhorn.com');
    expect(mapterhornTileUrl(3, 1, 1).startsWith(`pmtiles://${MAPTERHORN_BASE_URL}/`)).toBe(true);
  });
});
