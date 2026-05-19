import type { Coordinate, MapView, QuadCoordinates } from './types';

/** Centroid of the four overlay corner coordinates. */
export function getCoordinateCenter(coordinates: QuadCoordinates): Coordinate {
  const total = coordinates.reduce<Coordinate>(
    (sum, [lng, lat]) => [sum[0] + lng, sum[1] + lat],
    [0, 0]
  );
  return [total[0] / coordinates.length, total[1] / coordinates.length];
}

/** Translates every corner by (deltaLng, deltaLat). */
export function nudgeCoordinates(
  coordinates: QuadCoordinates,
  deltaLng: number,
  deltaLat: number
): QuadCoordinates {
  return coordinates.map(([lng, lat]) => [lng + deltaLng, lat + deltaLat]) as QuadCoordinates;
}

/** Scales the quad about its centroid. */
export function scaleCoordinates(
  coordinates: QuadCoordinates,
  scaleLng: number,
  scaleLat: number
): QuadCoordinates {
  const center = getCoordinateCenter(coordinates);
  return coordinates.map(([lng, lat]) => [
    center[0] + (lng - center[0]) * scaleLng,
    center[1] + (lat - center[1]) * scaleLat
  ]) as QuadCoordinates;
}

/** Rotates the quad about its centroid by `degrees`. */
export function rotateCoordinates(
  coordinates: QuadCoordinates,
  degrees: number
): QuadCoordinates {
  const center = getCoordinateCenter(coordinates);
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return coordinates.map(([lng, lat]) => {
    const deltaLng = lng - center[0];
    const deltaLat = lat - center[1];
    return [
      center[0] + deltaLng * cos - deltaLat * sin,
      center[1] + deltaLng * sin + deltaLat * cos
    ];
  }) as QuadCoordinates;
}

export function formatNumber(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatDomainKey(domain: string): string {
  return /^[A-Z_$][A-Z0-9_$]*$/i.test(domain) ? domain : `'${domain}'`;
}

/** Builds the copy-pasteable `map-config` snippet shown in calibration mode. */
export function buildCalibrationSnippet(
  radarOpacity: number,
  views: Record<string, MapView>
): string {
  const body = Object.entries(views)
    .map(
      ([domain, view]) => `${formatDomainKey(domain)}: Object.freeze({
  center: [${formatNumber(view.center[0], 6)}, ${formatNumber(view.center[1], 6)}],
  zoom: ${formatNumber(view.zoom, 2)},
  coordinates: Object.freeze([
    [${formatNumber(view.coordinates[0][0], 6)}, ${formatNumber(view.coordinates[0][1], 6)}],
    [${formatNumber(view.coordinates[1][0], 6)}, ${formatNumber(view.coordinates[1][1], 6)}],
    [${formatNumber(view.coordinates[2][0], 6)}, ${formatNumber(view.coordinates[2][1], 6)}],
    [${formatNumber(view.coordinates[3][0], 6)}, ${formatNumber(view.coordinates[3][1], 6)}]
  ])
})`
    )
    .join(',\n');

  return `radarOpacity: ${formatNumber(radarOpacity, 2)},
views: Object.freeze({
${body}
})`;
}
