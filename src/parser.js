const SOURCE_ORIGIN = 'http://cambodiameteo.com';
const RADAR_PATH_PREFIX = '/data/animation/radar/';

function decodeJsString(value) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
}

function normalizeRadarUrl(path) {
  if (typeof path !== 'string') {
    return null;
  }

  if (!path.startsWith(RADAR_PATH_PREFIX)) {
    return null;
  }

  try {
    const url = new URL(path, SOURCE_ORIGIN);
    if (url.origin !== SOURCE_ORIGIN || !url.pathname.startsWith(RADAR_PATH_PREFIX)) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function parseRadarFrames(html) {
  if (typeof html !== 'string' || html.length === 0) {
    return [];
  }

  const imageByIndex = new Map();
  const labelByIndex = new Map();
  const imagePattern = /theImagesComplete\[(\d+)\]\s*=\s*(['"])((?:\\.|(?!\2).)*)\2\s*;/g;
  const labelPattern = /ImagesText\[(\d+)\]\s*=\s*(['"])((?:\\.|(?!\2).)*)\2\s*;/g;

  for (const match of html.matchAll(imagePattern)) {
    const index = Number(match[1]);
    const rawPath = decodeJsString(match[3]);
    const url = normalizeRadarUrl(rawPath);

    if (Number.isSafeInteger(index) && url) {
      imageByIndex.set(index, url);
    }
  }

  for (const match of html.matchAll(labelPattern)) {
    const index = Number(match[1]);
    const label = decodeJsString(match[3]).trim();

    if (Number.isSafeInteger(index)) {
      labelByIndex.set(index, label);
    }
  }

  return Array.from(imageByIndex.entries())
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([index, url]) => ({
      index,
      url,
      label: labelByIndex.get(index) || ''
    }));
}

module.exports = {
  SOURCE_ORIGIN,
  RADAR_PATH_PREFIX,
  normalizeRadarUrl,
  parseRadarFrames
};
