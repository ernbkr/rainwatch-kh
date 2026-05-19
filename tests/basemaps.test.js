import { describe, expect, it } from 'vitest';
import basemaps from '../src/basemaps';

const { BASEMAPS, DEFAULT_BASEMAP_ID, resolveBasemap } = basemaps;

describe('BASEMAPS', () => {
  it('lists the four basemaps with unique ids, labels, and styles', () => {
    expect(BASEMAPS).toHaveLength(4);
    const ids = BASEMAPS.map((basemap) => basemap.id);
    expect(new Set(ids).size).toBe(4);
    for (const basemap of BASEMAPS) {
      expect(typeof basemap.label).toBe('string');
      expect(basemap.label.length).toBeGreaterThan(0);
      expect(basemap.style).toBeTruthy();
    }
  });

  it('defines hosted styles as URL strings and Satellite as an inline style', () => {
    const byId = Object.fromEntries(BASEMAPS.map((basemap) => [basemap.id, basemap]));
    expect(typeof byId.colorful.style).toBe('string');
    expect(typeof byId.liberty.style).toBe('string');
    expect(typeof byId.fiord.style).toBe('string');
    expect(byId.satellite.style).toMatchObject({ version: 8 });
  });
});

describe('DEFAULT_BASEMAP_ID', () => {
  it('is colorful and exists in BASEMAPS', () => {
    expect(DEFAULT_BASEMAP_ID).toBe('colorful');
    expect(BASEMAPS.some((basemap) => basemap.id === DEFAULT_BASEMAP_ID)).toBe(true);
  });
});

describe('resolveBasemap', () => {
  it('returns the matching basemap by id', () => {
    expect(resolveBasemap('liberty').id).toBe('liberty');
    expect(resolveBasemap('satellite').id).toBe('satellite');
  });

  it('falls back to the default basemap for missing or unknown ids', () => {
    expect(resolveBasemap('bogus').id).toBe(DEFAULT_BASEMAP_ID);
    expect(resolveBasemap(undefined).id).toBe(DEFAULT_BASEMAP_ID);
  });
});
