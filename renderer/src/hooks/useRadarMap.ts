import { useEffect, useRef, type RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import type { AttributionControl, Map as MapLibreMap, MapLibreEvent } from 'maplibre-gl';
import { resolveBasemap } from '../lib/basemaps';
import { getCoordinateBounds } from '../lib/calibration';
import { HoverControl } from '../lib/hover-control';
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
/** Soft pitch used by hover orbits when the map starts flat. */
const HOVER_PITCH = 45;
/** Degrees per rotation step — chained via `moveend` for a continuous orbit. */
const ROTATION_STEP_DEG = 60;
/** Duration of each step (ms). 60° per 5 s ≈ 30 s per full revolution. */
const ROTATION_DURATION_MS = 5000;
/** Below this pitch the hover effect first eases up before rotating. */
const HOVER_PITCH_THRESHOLD_DEG = 5;
/** Pixel margin around the radar footprint when fitting the camera to it. */
const RADAR_FIT_PADDING_PX = 24;

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
  /** Idle hover-mode toggle: when true, the camera orbits the current centre. */
  isHovering: boolean;
  /** Invoked when the HoverControl button is clicked. */
  onToggleHover: () => void;
  /** Invoked on any user-initiated map interaction (filtered via `originalEvent`). */
  onUserInteraction: () => void;
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
  const hoverControlRef = useRef<HoverControl | null>(null);
  // Synchronous teardown for the hover rotation chain. Exposed via a ref so
  // interaction handlers can detach the `moveend` chain *before* yielding to
  // React — otherwise a pending moveend can cascade
  // (step → rotateTo → _stop → moveend → step…) and saturate the event loop
  // while the `setIsHovering(false)` commit is still queued.
  const stopHoverRotationRef = useRef<(() => void) | null>(null);
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
      // Frame the radar's georeferenced footprint on first paint so subsequent
      // domain switches (which also use fitBounds) feel consistent.
      bounds: getCoordinateBounds(initial.view.coordinates),
      fitBoundsOptions: { padding: RADAR_FIT_PADDING_PX },
      bearing: 0,
      pitch: 0,
      attributionControl: false
    });
    mapRef.current = map;
    appliedBasemapRef.current = initial.basemapId;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    // Added after NavigationControl so MapLibre stacks it flush below.
    const hoverControl = new HoverControl({
      onToggle: () => optionsRef.current.onToggleHover()
    });
    map.addControl(hoverControl, 'top-right');
    hoverControlRef.current = hoverControl;
    attributionRef.current = applyAttributionControl(map, null, basemap);

    // User-interaction listeners. `movestart` fires for both user and
    // programmatic moves; the `originalEvent` filter keeps the rotation
    // loop from re-triggering itself. The DOM-bubbled events below are
    // always user-initiated and need no filter.
    //
    // Each handler synchronously tears down the hover rotation *before*
    // calling onUserInteraction (which only queues a React state change).
    // This breaks the moveend cascade that would otherwise form between
    // the user's gesture-driven `easeTo` and our still-attached chained
    // `moveend` → `step` → `rotateTo` loop.
    const handleUserInteraction = (): void => {
      stopHoverRotationRef.current?.();
      optionsRef.current.onUserInteraction();
    };
    const handleMoveStart = (event: MapLibreEvent): void => {
      if (!event.originalEvent) return;
      stopHoverRotationRef.current?.();
      optionsRef.current.onUserInteraction();
    };
    map.on('movestart', handleMoveStart);
    map.on('click', handleUserInteraction);
    map.on('wheel', handleUserInteraction);
    map.on('touchstart', handleUserInteraction);
    map.on('keydown', handleUserInteraction);

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
      hoverControlRef.current = null;
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

  // Reflect hover state on the HoverControl button.
  useEffect(() => {
    hoverControlRef.current?.setActive(options.isHovering);
  }, [options.isHovering]);

  // Hover-mode rotation loop. Pitches up smoothly if flat, then chains
  // `rotateTo` calls via `moveend` for a continuous orbit around the
  // current centre. Teardown is exposed via `stopHoverRotationRef` so the
  // interaction listeners can detach the chain synchronously, before any
  // gesture-driven `easeTo` has a chance to fire `_onEaseEnd` on our
  // in-flight `rotateTo` and cascade through `moveend`.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !options.isHovering) {
      return;
    }

    let cancelled = false;
    let pitchHandler: (() => void) | null = null;
    let rotateHandler: (() => void) | null = null;

    // Idempotent. `stopAnimation: false` when called from a user-gesture
    // handler — the gesture's own `easeTo` will supersede our in-flight
    // animation; calling `map.stop()` here can disturb the gesture's
    // handler state machine. The React cleanup uses `stopAnimation: true`
    // for the button/domain-change paths where no gesture is in progress.
    const teardown = (stopAnimation: boolean): void => {
      if (cancelled) return;
      cancelled = true;
      if (pitchHandler) {
        map.off('moveend', pitchHandler);
        pitchHandler = null;
      }
      if (rotateHandler) {
        map.off('moveend', rotateHandler);
        rotateHandler = null;
      }
      if (stopAnimation) {
        // Abort any in-flight ease/rotate; leaves bearing/pitch as-is.
        map.stop();
      }
    };

    const step = (): void => {
      if (cancelled) return;
      map.rotateTo(map.getBearing() - ROTATION_STEP_DEG, {
        duration: ROTATION_DURATION_MS,
        easing: (t) => t
      });
    };

    const startRotation = (): void => {
      if (cancelled) return;
      rotateHandler = (): void => {
        if (!cancelled) step();
      };
      map.on('moveend', rotateHandler);
      step();
    };

    if (map.getPitch() < HOVER_PITCH_THRESHOLD_DEG) {
      pitchHandler = (): void => {
        if (pitchHandler) {
          map.off('moveend', pitchHandler);
          pitchHandler = null;
        }
        if (!cancelled) startRotation();
      };
      map.on('moveend', pitchHandler);
      map.easeTo({ pitch: HOVER_PITCH, duration: 600 });
    } else {
      startRotation();
    }

    stopHoverRotationRef.current = () => teardown(false);

    return () => {
      stopHoverRotationRef.current = null;
      teardown(true);
    };
  }, [options.isHovering]);

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

  // Domain change: fit the camera to the new area's full radar footprint.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const { view, is3D } = optionsRef.current;
    map.fitBounds(getCoordinateBounds(view.coordinates), {
      padding: RADAR_FIT_PADDING_PX,
      bearing: 0,
      pitch: is3D ? TERRAIN_PITCH : 0,
      animate: false
    });
  }, [options.domain]);
}
