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
import {
  addProvincialCapitalsLayer,
  PROVINCIAL_CAPITALS_LAYER_ID,
  PROVINCIAL_CAPITALS_SOURCE_ID,
  setProvincialCapitalsVisibility,
  updateProvincialCapitalsData
} from '../lib/maplibre-provincial-capitals';
import {
  addForecastGridLayer,
  FORECAST_GRID_LAYER_ID,
  FORECAST_GRID_SOURCE_ID,
  setForecastGridVisibility,
  updateForecastGridData
} from '../lib/maplibre-forecast-grid';
import { escapeHtml } from '../lib/html';
import { loadWeatherIcons, WMO_LABEL } from '../lib/weather-icons';
import type { Coordinate, DomainId, Frame, MapView } from '../lib/types';

const TERRAIN_PITCH = mapConfig.terrain.pitch;
/** Soft pitch used by hover orbits when the map starts flat. */
const HOVER_PITCH = 45;

// Observation-timestamp formatting. Open-Meteo's `current.time` is an
// ISO-local string in Asia/Phnom_Penh, e.g. "2026-05-20T13:00". We format
// it as "Wednesday, 20th of May at 13:00" — same shape as the old station
// popups so the UI tone stays consistent. Ordinal via Intl.PluralRules so
// 1st/2nd/3rd/4th derive from the rule set, not a hand-rolled switch.
const OBS_TS_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const OBS_TS_LOCALE = 'en';
const OBS_TS_ORDINAL = new Intl.PluralRules(OBS_TS_LOCALE, { type: 'ordinal' });
const OBS_TS_ORDINAL_SUFFIX: Record<Intl.LDMLPluralRule, string> = {
  zero: 'th',
  one: 'st',
  two: 'nd',
  few: 'rd',
  many: 'th',
  other: 'th'
};
const OBS_TS_WEEKDAY = new Intl.DateTimeFormat(OBS_TS_LOCALE, {
  weekday: 'long',
  timeZone: 'UTC'
});
const OBS_TS_MONTH = new Intl.DateTimeFormat(OBS_TS_LOCALE, {
  month: 'long',
  timeZone: 'UTC'
});

function formatObservationTimestamp(raw: string): string {
  const match = OBS_TS_PATTERN.exec(raw);
  if (!match) return raw;
  const [, yearStr, monthStr, dayStr, hour, minute] = match;
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);
  // Anchor in UTC purely as a vehicle for the Intl formatters — the upstream
  // is wall-clock (Asia/Phnom_Penh) and we want the rendered weekday/month
  // to match the source date regardless of the user's local timezone.
  const date = new Date(Date.UTC(year, monthIndex, day));
  const weekday = OBS_TS_WEEKDAY.format(date);
  const month = OBS_TS_MONTH.format(date);
  const ordinal = `${day}${OBS_TS_ORDINAL_SUFFIX[OBS_TS_ORDINAL.select(day)]}`;
  return `${weekday}, ${ordinal} of ${month} at ${hour}:${minute}`;
}

/** Compass label for a wind bearing in degrees (meteorological "from"). */
const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
function compassDirection(degrees: number): string {
  const idx = Math.round(((degrees % 360) + 360) % 360 / 45) % 8;
  return COMPASS_POINTS[idx];
}

/**
 * Pretty-prints two Open-Meteo ISO-local times as a window range. The
 * forecast end is the *start* of the last hour, so we add 1h to the end
 * stamp in the rendered range to convey "through end of hour".
 *  - Same day:  "13:00 → 19:00"
 *  - Crosses midnight: "23:00 → tomorrow 06:00"
 */
function formatLocalHourRange(startIso: string, endIso: string): string {
  const start = OBS_TS_PATTERN.exec(startIso);
  const end = OBS_TS_PATTERN.exec(endIso);
  if (!start || !end) return '';

  const startHour = start[4];
  const startMinute = start[5];
  let endHour = Number(end[4]) + 1;
  const endMinute = end[5];

  const startDate = `${start[1]}-${start[2]}-${start[3]}`;
  let endDate = `${end[1]}-${end[2]}-${end[3]}`;
  // Roll past midnight when the +1 spills past 23.
  let dayDelta = 0;
  if (endHour >= 24) {
    endHour -= 24;
    dayDelta = 1;
  }
  if (dayDelta > 0 || startDate !== endDate) {
    return `${startHour}:${startMinute} → tomorrow ${String(endHour).padStart(2, '0')}:${endMinute}`;
  }
  return `${startHour}:${startMinute} → ${String(endHour).padStart(2, '0')}:${endMinute}`;
}
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
  /** Provincial-capital current-weather layer state. `data` is null while
   * loading or after a failed initial fetch; `visible` is the user's toggle. */
  provincialCapitals: {
    data: GeoJSON.FeatureCollection | null;
    visible: boolean;
  };
  /** Forecast-grid layer state. The hook re-derives `data` per window change;
   * we just consume the latest snapshot. */
  forecastGrid: {
    data: GeoJSON.FeatureCollection | null;
    visible: boolean;
  };
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
  // Two-popup model for provincial capitals: a singleton hover popup that
  // follows the cursor (no close button) and an optional pinned popup
  // created on click (with close button). The pinned popup suppresses the
  // hover popup so they don't compete; the hover popup resumes after the
  // pinned one is closed.
  const capitalsHoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const capitalsPinnedPopupRef = useRef<maplibregl.Popup | null>(null);
  // Single click-only popup for the forecast grid. The grid is dense enough
  // that a hover popup would flicker across cells as the cursor moves, so
  // we only show a popup on explicit click.
  const gridPinnedPopupRef = useRef<maplibregl.Popup | null>(null);
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

    // Provincial-capital interaction. Bound once to the layer *id* (not the
    // layer instance), so the registrations survive `setStyle` and data
    // refreshes. The unscoped `click` handler above also fires (MapLibre
    // delivers layer-scoped handlers first), tearing down hover-mode — the
    // intended behaviour when the user picks a capital.
    capitalsHoverPopupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '320px',
      offset: 12
    });

    // Pulls the capital's properties off the layer event and renders a popup
    // HTML body. Returns null on schema drift (missing required fields) so
    // we degrade to no-popup rather than rendering "NaN°".
    const readCapital = (
      event: maplibregl.MapLayerMouseEvent
    ): { coords: [number, number]; html: string } | null => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return null;
      const props = feature.properties ?? {};
      const name = props.name;
      const code = Number(props.weather_code);
      const temp = Number(props.temperature_2m);
      if (typeof name !== 'string' || Number.isNaN(code) || Number.isNaN(temp)) {
        return null;
      }

      const apparent = Number(props.apparent_temperature);
      const humidity = Number(props.relative_humidity_2m);
      const windSpeed = Number(props.wind_speed_10m);
      const windDir = Number(props.wind_direction_10m);
      const cloud = Number(props.cloud_cover);
      const observedAt = typeof props.observed_at === 'string' ? props.observed_at : '';
      const province = typeof props.province === 'string' ? props.province : '';
      const iconId = typeof props.icon_id === 'string' ? props.icon_id : '';
      const condition = WMO_LABEL[code] ?? `Weather code ${code}`;

      const iconHtml = iconId
        ? `<img class="capitalIcon" src="/icons/weather/${escapeHtml(iconId)}.svg" alt="" width="48" height="48">`
        : '';
      const provinceLine = province
        ? `<div class="capitalProvince">${escapeHtml(province)} Province</div>`
        : '';
      const observedLine = observedAt
        ? `<div class="capitalObserved">${escapeHtml(formatObservationTimestamp(observedAt))}</div>`
        : '';

      const html = `
        <div class="capitalName">${escapeHtml(name)}</div>
        ${provinceLine}
        <div class="capitalCurrent">
          ${iconHtml}
          <div class="capitalTemp">
            <div class="capitalTempValue">${Math.round(temp)}°C</div>
            <div class="capitalCondition">${escapeHtml(condition)}</div>
          </div>
        </div>
        <dl class="capitalReadings">
          <dt>Feels like</dt><dd>${Math.round(apparent)}°C</dd>
          <dt>Humidity</dt><dd>${Math.round(humidity)}%</dd>
          <dt>Wind</dt><dd>${Math.round(windSpeed)} km/h ${compassDirection(windDir)}</dd>
          <dt>Cloud cover</dt><dd>${Math.round(cloud)}%</dd>
        </dl>
        ${observedLine}
      `.trim();

      const [lng, lat] = feature.geometry.coordinates;
      return { coords: [lng, lat], html };
    };

    const showHoverPopup = (event: maplibregl.MapLayerMouseEvent): void => {
      // Pinned popup wins — don't stack two overlays for the same capital.
      if (capitalsPinnedPopupRef.current) return;
      const capital = readCapital(event);
      const popup = capitalsHoverPopupRef.current;
      if (!capital || !popup) return;
      popup.setLngLat(capital.coords).setHTML(capital.html).addTo(map);
    };

    map.on('mouseenter', PROVINCIAL_CAPITALS_LAYER_ID, (event) => {
      map.getCanvas().style.cursor = 'pointer';
      showHoverPopup(event);
    });
    // `mousemove` keeps the hover popup attached to the capital under the
    // cursor when several capitals sit close together — without it, moving
    // from one marker directly to another only fires mouseleave/mouseenter
    // on the layer boundary, not on the feature transition.
    map.on('mousemove', PROVINCIAL_CAPITALS_LAYER_ID, showHoverPopup);
    map.on('mouseleave', PROVINCIAL_CAPITALS_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
      capitalsHoverPopupRef.current?.remove();
    });

    map.on('click', PROVINCIAL_CAPITALS_LAYER_ID, (event) => {
      const capital = readCapital(event);
      if (!capital) return;

      // Take down the hover popup and any previously-pinned one before
      // pinning the freshly-clicked capital.
      capitalsHoverPopupRef.current?.remove();
      capitalsPinnedPopupRef.current?.remove();

      const pinned = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '320px',
        offset: 12
      })
        .setLngLat(capital.coords)
        .setHTML(capital.html)
        .addTo(map);

      // Clearing the ref on close lets hover popups resume; the identity
      // check guards against a stale handler firing after a newer pin.
      pinned.on('close', () => {
        if (capitalsPinnedPopupRef.current === pinned) {
          capitalsPinnedPopupRef.current = null;
        }
      });
      capitalsPinnedPopupRef.current = pinned;
    });

    // Forecast-grid interaction. Click-only (no hover popup) — the grid is
    // dense and a hover popup would chatter as the cursor crosses cells.
    // Pulls the per-window summary out of feature.properties (which the
    // hook recomputes whenever the window changes).
    const readGridCell = (
      event: maplibregl.MapLayerMouseEvent
    ): { coords: [number, number]; html: string } | null => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return null;
      const props = feature.properties ?? {};
      const code = Number(props.dominant_code);
      if (Number.isNaN(code)) return null;

      const iconId = typeof props.icon_id === 'string' ? props.icon_id : '';
      const condition =
        typeof props.dominant_label === 'string'
          ? props.dominant_label
          : (WMO_LABEL[code] ?? `Weather code ${code}`);
      const totalPrecip = Number(props.total_precip_mm);
      const peakProb = Number(props.peak_probability_pct);
      const startIso = typeof props.start_iso === 'string' ? props.start_iso : '';
      const endIso = typeof props.end_iso === 'string' ? props.end_iso : '';
      const windowHours = Number(props.window_hours);

      const iconHtml = iconId
        ? `<img class="gridIcon" src="/icons/weather/${escapeHtml(iconId)}.svg" alt="" width="48" height="48">`
        : '';
      const range = formatLocalHourRange(startIso, endIso);
      const rangeHtml = range
        ? `<div class="gridRange">${escapeHtml(range)}</div>`
        : '';

      const html = `
        <div class="gridTitle">Next ${Number.isFinite(windowHours) ? windowHours : '—'}h</div>
        ${rangeHtml}
        <div class="gridCurrent">
          ${iconHtml}
          <div class="gridCondition">${escapeHtml(condition)}</div>
        </div>
        <dl class="gridReadings">
          <dt>Total precipitation</dt><dd>${totalPrecip.toFixed(totalPrecip < 10 ? 1 : 0)} mm</dd>
          <dt>Peak probability</dt><dd>${Math.round(peakProb)}%</dd>
        </dl>
      `.trim();

      const [lng, lat] = feature.geometry.coordinates;
      return { coords: [lng, lat], html };
    };

    map.on('mouseenter', FORECAST_GRID_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', FORECAST_GRID_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('click', FORECAST_GRID_LAYER_ID, (event) => {
      const cell = readGridCell(event);
      if (!cell) return;

      gridPinnedPopupRef.current?.remove();
      const pinned = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '260px',
        offset: 12
      })
        .setLngLat(cell.coords)
        .setHTML(cell.html)
        .addTo(map);
      pinned.on('close', () => {
        if (gridPinnedPopupRef.current === pinned) {
          gridPinnedPopupRef.current = null;
        }
      });
      gridPinnedPopupRef.current = pinned;
    });

    // setStyle wipes custom layers AND registered images — re-add both on
    // every style (re)load. Icon loading is async; the symbol layers are
    // added immediately and render the missing-icon glyph until the
    // images resolve, which is acceptable for a sub-second flicker.
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
      void loadWeatherIcons(map);
      // Grid is added first so the capitals layer (added second) draws on
      // top — capitals are higher-information and shouldn't be occluded.
      if (current.forecastGrid.data) {
        addForecastGridLayer(
          map,
          current.forecastGrid.data,
          current.forecastGrid.visible
        );
      }
      if (current.provincialCapitals.data) {
        addProvincialCapitalsLayer(
          map,
          current.provincialCapitals.data,
          current.provincialCapitals.visible
        );
      }
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
      // map.remove() tears down the popups along with everything else, but
      // null out the refs so a re-mount starts clean.
      capitalsHoverPopupRef.current = null;
      capitalsPinnedPopupRef.current = null;
      gridPinnedPopupRef.current = null;
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

  // Provincial-capitals data: pushed into the existing source when it's
  // there, otherwise added (covers the first-load case where data arrives
  // after `style.load` has already fired without it).
  useEffect(() => {
    const map = mapRef.current;
    const data = options.provincialCapitals.data;
    if (!map || !data) {
      return;
    }
    if (map.getSource(PROVINCIAL_CAPITALS_SOURCE_ID)) {
      updateProvincialCapitalsData(map, data);
    } else {
      addProvincialCapitalsLayer(map, data, options.provincialCapitals.visible);
    }
  }, [options.provincialCapitals.data, options.provincialCapitals.visible]);

  // Provincial-capitals visibility toggle. No-op if the layer hasn't been
  // added yet (the user can toggle before data arrives — the layer-add path
  // above will pick the right initial visibility).
  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      setProvincialCapitalsVisibility(map, options.provincialCapitals.visible);
    }
  }, [options.provincialCapitals.visible]);

  // Forecast-grid data: the hook rebuilds the FeatureCollection on every
  // window change, so this effect fires on both refetch *and* window
  // switch. `setData` pushes the new icons through without rebuilding the
  // layer.
  useEffect(() => {
    const map = mapRef.current;
    const data = options.forecastGrid.data;
    if (!map || !data) {
      return;
    }
    if (map.getSource(FORECAST_GRID_SOURCE_ID)) {
      updateForecastGridData(map, data);
    } else {
      addForecastGridLayer(map, data, options.forecastGrid.visible);
    }
  }, [options.forecastGrid.data, options.forecastGrid.visible]);

  // Forecast-grid visibility toggle. Same pattern as capitals.
  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      setForecastGridVisibility(map, options.forecastGrid.visible);
    }
  }, [options.forecastGrid.visible]);
}
