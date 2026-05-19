import { describe, expect, it } from 'vitest';
import {
  buildCalibrationSnippet,
  getCoordinateCenter,
  nudgeCoordinates,
  rotateCoordinates,
  scaleCoordinates
} from '../renderer/src/lib/calibration';

const SQUARE = [
  [0, 2],
  [2, 2],
  [2, 0],
  [0, 0]
];

describe('getCoordinateCenter', () => {
  it('returns the centroid of the quad', () => {
    expect(getCoordinateCenter(SQUARE)).toEqual([1, 1]);
  });
});

describe('nudgeCoordinates', () => {
  it('translates every corner', () => {
    expect(nudgeCoordinates(SQUARE, 1, -1)).toEqual([
      [1, 1],
      [3, 1],
      [3, -1],
      [1, -1]
    ]);
  });
});

describe('scaleCoordinates', () => {
  it('scales about the centroid', () => {
    expect(scaleCoordinates(SQUARE, 2, 2)).toEqual([
      [-1, 3],
      [3, 3],
      [3, -1],
      [-1, -1]
    ]);
  });

  it('leaves the quad unchanged at scale 1', () => {
    expect(scaleCoordinates(SQUARE, 1, 1)).toEqual(SQUARE);
  });
});

describe('rotateCoordinates', () => {
  it('rotates the quad 90° about its centroid', () => {
    const rotated = rotateCoordinates(SQUARE, 90);
    const expected = [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0]
    ];
    rotated.forEach(([lng, lat], index) => {
      expect(lng).toBeCloseTo(expected[index][0], 6);
      expect(lat).toBeCloseTo(expected[index][1], 6);
    });
  });
});

describe('buildCalibrationSnippet', () => {
  it('renders opacity and views as a config snippet', () => {
    const snippet = buildCalibrationSnippet(0.65, {
      PHN: { center: [1, 2], zoom: 9, coordinates: SQUARE }
    });
    expect(snippet).toContain('radarOpacity: 0.65');
    expect(snippet).toContain('PHN: Object.freeze({');
    expect(snippet).toContain('zoom: 9.00');
  });

  it('quotes domain keys that are not valid identifiers', () => {
    const snippet = buildCalibrationSnippet(0.5, {
      '240KM': { center: [0, 0], zoom: 7, coordinates: SQUARE }
    });
    expect(snippet).toContain("'240KM': Object.freeze({");
  });
});
