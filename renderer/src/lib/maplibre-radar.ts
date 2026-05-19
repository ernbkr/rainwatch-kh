import maplibregl from 'maplibre-gl';
import type {
  AttributionControl,
  ImageSource,
  Map as MapLibreMap,
  StyleSpecification
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import type { Basemap } from './basemaps';
import { mapConfig } from './map-config';
import { mapterhornTileUrl } from './terrain';
import type { QuadCoordinates } from './types';

export const RADAR_SOURCE_ID = 'radar-overlay';
export const RADAR_LAYER_ID = 'radar-overlay-layer';
export const HILLSHADE_LAYER_ID = 'mapterhorn-hillshade';
export const TRANSPARENT_IMAGE_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lmXbWQAAAABJRU5ErkJggg==';

const terrain = mapConfig.terrain;
let protocolRegistered = false;

/** Registers the `mapterhorn://` PMTiles protocol with MapLibre (once). */
export function registerTerrainProtocol(): void {
  if (protocolRegistered) {
    return;
  }
  protocolRegistered = true;

  const protocol = new Protocol({ metadata: true });
  const prefix = `${terrain.protocol}://`;

  maplibregl.addProtocol(terrain.protocol, async (params, abortController) => {
    const [z, x, y] = params.url.replace(prefix, '').split('/').map(Number);
    const response = await protocol.tile(
      { ...params, url: mapterhornTileUrl(z, x, y) },
      abortController
    );
    if (response.data === null) {
      throw new Error(`Terrain tile z=${z} x=${x} y=${y} not found.`);
    }
    return response;
  });
}

/** A URL string passes through; an inline style is cloned so MapLibre may mutate it. */
export function basemapStyleInput(basemap: Basemap): string | StyleSpecification {
  return typeof basemap.style === 'string' ? basemap.style : structuredClone(basemap.style);
}

function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((layer) => layer.type === 'symbol')?.id;
}

/** Adds the Mapterhorn DEM source and a (hidden) hillshade layer. */
export function addTerrainAndHillshade(map: MapLibreMap): void {
  if (map.getSource(terrain.sourceId)) {
    return;
  }

  map.addSource(terrain.sourceId, {
    type: 'raster-dem',
    tiles: [...terrain.tiles],
    encoding: terrain.encoding,
    tileSize: terrain.tileSize,
    attribution: terrain.attribution
  });
  map.addLayer(
    {
      id: HILLSHADE_LAYER_ID,
      type: 'hillshade',
      source: terrain.sourceId,
      layout: { visibility: 'none' }
    },
    firstSymbolLayerId(map)
  );
}

/** Enables or disables 3D terrain + hillshade. */
export function applyTerrain(map: MapLibreMap, is3D: boolean, exaggeration: number): void {
  if (!map.getSource(terrain.sourceId)) {
    return;
  }

  map.setTerrain(is3D ? { source: terrain.sourceId, exaggeration } : null);
  if (map.getLayer(HILLSHADE_LAYER_ID)) {
    map.setLayoutProperty(HILLSHADE_LAYER_ID, 'visibility', is3D ? 'visible' : 'none');
  }
}

/** Adds the radar image source + raster layer (kept on top of the basemap). */
export function addRadarOverlay(
  map: MapLibreMap,
  coordinates: QuadCoordinates,
  opacity: number,
  imageUrl: string
): void {
  if (map.getSource(RADAR_SOURCE_ID)) {
    return;
  }

  map.addSource(RADAR_SOURCE_ID, {
    type: 'image',
    url: imageUrl || TRANSPARENT_IMAGE_URL,
    coordinates
  });
  map.addLayer({
    id: RADAR_LAYER_ID,
    type: 'raster',
    source: RADAR_SOURCE_ID,
    paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 }
  });
}

export function updateRadarImage(
  map: MapLibreMap,
  imageUrl: string,
  coordinates: QuadCoordinates
): void {
  const source = map.getSource(RADAR_SOURCE_ID) as ImageSource | undefined;
  source?.updateImage({ url: imageUrl, coordinates });
}

export function updateRadarCoordinates(map: MapLibreMap, coordinates: QuadCoordinates): void {
  const source = map.getSource(RADAR_SOURCE_ID) as ImageSource | undefined;
  source?.setCoordinates(coordinates);
}

export function updateRadarOpacity(map: MapLibreMap, opacity: number): void {
  if (map.getLayer(RADAR_LAYER_ID)) {
    map.setPaintProperty(RADAR_LAYER_ID, 'raster-opacity', opacity);
  }
}

/**
 * Swaps the bottom-right AttributionControl so its `customAttribution` matches
 * the active basemap. Returns the new control to track for the next swap.
 */
export function applyAttributionControl(
  map: MapLibreMap,
  previous: AttributionControl | null,
  basemap: Basemap
): AttributionControl {
  if (previous) {
    map.removeControl(previous);
  }
  const control = new maplibregl.AttributionControl({
    compact: true,
    customAttribution: basemap.attribution
  });
  map.addControl(control, 'bottom-right');
  return control;
}
