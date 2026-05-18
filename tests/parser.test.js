import { describe, expect, it } from 'vitest';
import parser from '../src/parser';

const { normalizeRadarUrl, parseRadarFrames } = parser;

describe('parseRadarFrames', () => {
  it('extracts frames, labels, and sorts indexes numerically', () => {
    const html = `
      theImagesComplete[0] = "/data/animation/radar/frame-0.jpg";
      ImagesText[0] = "18/05/2026 - 07:01:05";
      theImagesComplete[10] = "/data/animation/radar/frame-10.jpg";
      ImagesText[10] = "18/05/2026 - 09:31:05";
      theImagesComplete[2] = "/data/animation/radar/frame-2.jpg";
      ImagesText[2] = "18/05/2026 - 07:31:05";
      theImagesComplete[11] = "/data/animation/radar/frame-11.jpg";
      ImagesText[11] = "18/05/2026 - 09:46:05";
      theImagesComplete[1] = "/data/animation/radar/frame-1.jpg";
      ImagesText[1] = "18/05/2026 - 07:16:05";
    `;

    const frames = parseRadarFrames(html);

    expect(frames.map((frame) => frame.index)).toEqual([0, 1, 2, 10, 11]);
    expect(frames[0]).toEqual({
      index: 0,
      url: 'http://cambodiameteo.com/data/animation/radar/frame-0.jpg',
      label: '18/05/2026 - 07:01:05'
    });
  });

  it('allows missing labels', () => {
    const frames = parseRadarFrames(`
      theImagesComplete[0] = "/data/animation/radar/frame-0.jpg";
    `);

    expect(frames).toEqual([
      {
        index: 0,
        url: 'http://cambodiameteo.com/data/animation/radar/frame-0.jpg',
        label: ''
      }
    ]);
  });

  it('ignores malformed or disallowed image paths', () => {
    const frames = parseRadarFrames(`
      theImagesComplete[0] = "/data/animation/radar/frame-0.jpg";
      theImagesComplete[1] = "/layouts/cambodia/images/logo.png";
      theImagesComplete[2] = "https://example.com/frame.jpg";
      theImagesComplete[3] = "../data/animation/radar/frame-3.jpg";
    `);

    expect(frames.map((frame) => frame.index)).toEqual([0]);
  });

  it('returns an empty array for empty or irrelevant html', () => {
    expect(parseRadarFrames('')).toEqual([]);
    expect(parseRadarFrames('<html></html>')).toEqual([]);
  });
});

describe('normalizeRadarUrl', () => {
  it('normalizes only Cambodia Meteo radar paths', () => {
    expect(normalizeRadarUrl('/data/animation/radar/example.jpg')).toBe(
      'http://cambodiameteo.com/data/animation/radar/example.jpg'
    );
    expect(normalizeRadarUrl('/data/animation/satellite/example.jpg')).toBeNull();
    expect(normalizeRadarUrl('http://example.com/data/animation/radar/example.jpg')).toBeNull();
  });
});
