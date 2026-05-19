import { useEffect, useRef, type RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import type { AttributionControl, Map as MapLibreMap } from 'maplibre-gl';
import { resolveBasemap } from '../lib/basemaps';
import { mapConfig } from '../lib/map-config';
import {
  addRadarOverlay,
  addTerrainAndHillshade,
  applyAttributionControl,
  applyTerrain,
  basemapStyleInput,
  registerTerrainProtocol,
  TRANSPARENT_IMAGE_URL,
  updateRadarCoordinates,
  updateRadarImage,
  updateRadarOpacity
} from '../lib/maplibre-radar';
import type { Coordinate, DomainId, Frame, MapView } from '../lib/types';

const TERRAIN_PITCH = mapConfig.terrain.pitch;

export interface UseRadarMapOptions {
  basemapId: string;
  domain: DomainId;
  view: MapView;
  is3D: boolean;
  exaggeration: number;
  opacity: number;
  frame: Frame | undefined;
  /** Called on map `moveend` — only wired in calibration mode. */
  onCameraChange?: (center: Coordinate, zoom: number) => void;
}

/**
 * Owns the MapLibre map instance and keeps it in sync with React props.
 * The map is created once; effects keyed on individual options drive
 * `setStyle` / `setTerrain` / overlay updates imperatively.
 */
export function useRadarMap(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UseRadarMapOptions
): void {
  const mapRef = useRef<MapLibreMap | null>(null);
  const attributionRef = useRef<AttributionControl | null>(null);
  const appliedBasemapRef = useRef(options.basemapId);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    registerTerrainProtocol();

    const initial = optionsRef.current;
    const basemap = resolveBasemap(initial.basemapId);
    const map = new maplibregl.Map({
      container,
      style: basemapStyleInput(basemap),
      center: initial.view.center,
      zoom: initial.view.zoom,
      bearing: 0,
      pitch: 0,
      attributionControl: false
    });
    mapRef.current = map;
    appliedBasemapRef.current = initial.basemapId;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    attributionRef.current = applyAttributionControl(map, null, basemap);

    // setStyle wipes custom layers — re-add them on every style (re)load.
    map.on('style.load', () => {
      const current = optionsRef.current;
      addTerrainAndHillshade(map);
      addRadarOverlay(
        map,
        current.view.coordinates,
        current.opacity,
        current.frame?.overlayUrl ?? TRANSPARENT_IMAGE_URL
      );
      applyTerrain(map, current.is3D, current.exaggeration);
    });

    map.on('moveend', () => {
      const current = optionsRef.current;
      if (current.onCameraChange) {
        const center = map.getCenter();
        current.onCameraChange([center.lng, center.lat], map.getZoom());
      }
    });

    map.on('error', (event) => {
      console.warn('MapLibre error', event?.error ?? event);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      attributionRef.current = null;
    };
  }, [containerRef]);

  // Basemap switch.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || options.basemapId === appliedBasemapRef.current) {
      return;
    }
    appliedBasemapRef.current = options.basemapId;
    const basemap = resolveBasemap(options.basemapId);
    map.setTerrain(null);
    map.setStyle(basemapStyleInput(basemap));
    attributionRef.current = applyAttributionControl(map, attributionRef.current, basemap);
  }, [options.basemapId]);

  // 3D terrain toggle + camera pitch.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    applyTerrain(map, options.is3D, options.exaggeration);
    map.easeTo({ pitch: options.is3D ? TERRAIN_PITCH : 0, bearing: 0, duration: 600 });
  }, [options.is3D, options.exaggeration]);

  // Radar overlay opacity.
  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      updateRadarOpacity(map, options.opacity);
    }
  }, [options.opacity]);

  // Current radar frame image.
  useEffect(() => {
    const map = mapRef.current;
    const overlayUrl = options.frame?.overlayUrl;
    if (map && overlayUrl) {
      updateRadarImage(map, overlayUrl, options.view.coordinates);
    }
  }, [options.frame]);

  // Overlay quad coordinates (calibration edits / domain change).
  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      updateRadarCoordinates(map, options.view.coordinates);
    }
  }, [options.view.coordinates]);

  // Domain change: recentre the camera on the new area.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const { view, is3D } = optionsRef.current;
    map.jumpTo({
      center: view.center,
      zoom: view.zoom,
      bearing: 0,
      pitch: is3D ? TERRAIN_PITCH : 0
    });
  }, [options.domain]);
}
