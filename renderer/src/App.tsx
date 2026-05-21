import { useCallback, useState } from 'react';
import { AppShell, Stack } from '@mantine/core';
import { CalibrationPanel } from './components/CalibrationPanel';
import { EmptyState } from './components/EmptyState';
import { MapView } from './components/MapView';
import { SliderControl } from './components/SliderControl';
import { StatusBar } from './components/StatusBar';
import { Timeline } from './components/Timeline';
import { useIdleTimer } from './hooks/useIdleTimer';
import { usePlayback } from './hooks/usePlayback';
import { useRadarFrames } from './hooks/useRadarFrames';
import { useRuntimeConfig } from './hooks/useRuntimeConfig';
import { useForecastGrid } from './hooks/useForecastGrid';
import { useProvincialCapitals } from './hooks/useProvincialCapitals';
import { DEFAULT_BASEMAP_ID } from './lib/basemaps';
import { DEFAULT_DOMAIN } from './lib/domains';
import { cloneViews, mapConfig } from './lib/map-config';
import { radar } from './lib/radar';
import type { Coordinate, DomainId, MapView as MapViewModel, QuadCoordinates } from './lib/types';

const HEADER_HEIGHT = 70;
const FOOTER_HEIGHT = 100;
/** Inactivity before the map auto-enters hover mode. */
const HOVER_IDLE_MS = 10_000;
const MAP_AREA_HEIGHT =
  `calc(100dvh - var(--app-shell-header-height, ${HEADER_HEIGHT}px)` +
  ` - var(--app-shell-footer-height, ${FOOTER_HEIGHT}px))`;

export function App() {
  const { calibrationEnabled } = useRuntimeConfig();

  const [domain, setDomain] = useState<DomainId>(DEFAULT_DOMAIN);
  const [basemapId, setBasemapId] = useState<string>(DEFAULT_BASEMAP_ID);
  const [is3D, setIs3D] = useState(false);
  const [exaggeration, setExaggeration] = useState(mapConfig.terrain.exaggeration);
  const [opacity, setOpacity] = useState(mapConfig.radarOpacity);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [views, setViews] = useState<Record<DomainId, MapViewModel>>(cloneViews);
  const [isHovering, setIsHovering] = useState(false);
  // Per PRD the new Open-Meteo capitals layer defaults off (the old
  // cambodiameteo stations layer defaulted on).
  const [provincialCapitalsVisible, setProvincialCapitalsVisible] = useState(false);
  // Per PRD the forecast-grid layer also defaults off.
  const [forecastGridVisible, setForecastGridVisible] = useState(false);
  // Gates only the *auto*-trigger: the on-map HoverControl button still
  // toggles hover mode manually regardless of this setting. Default off so
  // first-time users don't see the map suddenly spin after 10s of inactivity.
  const [autoHoverEnabled, setAutoHoverEnabled] = useState(false);

  // Idle timer pauses while hovering and reschedules whenever the user
  // interacts with the map (via `handleUserInteraction` below). When
  // `autoHoverEnabled` is false, the timer never fires.
  const { reset: resetIdleTimer } = useIdleTimer({
    delayMs: HOVER_IDLE_MS,
    enabled: autoHoverEnabled && !isHovering,
    onIdle: () => setIsHovering(true)
  });

  // Any user-initiated map event: stop hover (if active) and reset the timer.
  const handleUserInteraction = useCallback(() => {
    setIsHovering((current) => {
      if (current) return false;
      return current;
    });
    resetIdleTimer();
  }, [resetIdleTimer]);

  const handleToggleHover = useCallback(() => {
    setIsHovering((current) => !current);
    // Reset the timer either way: when starting hover the timer is paused
    // (no-op); when stopping it, this restarts the countdown from zero.
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Switching domains always exits hover so the new fit-to-bounds is shown
  // from a normal upright view; the rotation cleanup runs alongside the
  // domain effect on the same commit.
  const handleDomainChange = useCallback(
    (next: DomainId) => {
      setDomain(next);
      setIsHovering(false);
      resetIdleTimer();
    },
    [resetIdleTimer]
  );

  const { frames, status, error, lastChecked, nextRefresh, refreshNow } = useRadarFrames(domain);
  const {
    data: provincialCapitalsData,
    status: provincialCapitalsStatus,
    error: provincialCapitalsError,
    lastUpdated: provincialCapitalsUpdatedAt,
    refresh: refreshProvincialCapitals
  } = useProvincialCapitals();
  const {
    data: forecastGridData,
    status: forecastGridStatus,
    error: forecastGridError,
    lastUpdated: forecastGridUpdatedAt,
    window: forecastGridWindow,
    setWindow: setForecastGridWindow,
    refresh: refreshForecastGrid
  } = useForecastGrid();
  const [frameIndex, setFrameIndex] = usePlayback(frames, speed, isPlaying);
  const frame = frames[frameIndex];
  const view = views[domain];

  const handleCameraChange = useCallback(
    (center: Coordinate, zoom: number) => {
      // Preserve the coordinates array reference so the overlay-quad effect
      // does not re-fire on camera moves.
      setViews((prev) => ({ ...prev, [domain]: { ...prev[domain], center, zoom } }));
    },
    [domain]
  );

  const handleCoordinatesChange = useCallback(
    (coordinates: QuadCoordinates) => {
      setViews((prev) => ({ ...prev, [domain]: { ...prev[domain], coordinates } }));
    },
    [domain]
  );

  return (
    <AppShell header={{ height: HEADER_HEIGHT }} footer={{ height: FOOTER_HEIGHT }} padding={0}>
      <AppShell.Header>
        <StatusBar
          latestLabel={frames.at(-1)?.label ?? '-'}
          currentLabel={frame?.label ?? '-'}
          lastChecked={lastChecked}
          nextRefresh={nextRefresh}
          domain={domain}
          onDomainChange={handleDomainChange}
          basemapId={basemapId}
          onBasemapChange={setBasemapId}
          is3D={is3D}
          onToggle3D={() => setIs3D((value) => !value)}
          onRefresh={refreshNow}
          onQuit={() => void radar.quit()}
          provincialCapitalsVisible={provincialCapitalsVisible}
          onToggleProvincialCapitals={() => setProvincialCapitalsVisible((value) => !value)}
          onRefreshProvincialCapitals={refreshProvincialCapitals}
          provincialCapitalsRefreshing={provincialCapitalsStatus === 'loading'}
          provincialCapitalsError={provincialCapitalsError}
          provincialCapitalsUpdatedAt={provincialCapitalsUpdatedAt}
          forecastGridVisible={forecastGridVisible}
          onToggleForecastGrid={() => setForecastGridVisible((value) => !value)}
          onRefreshForecastGrid={refreshForecastGrid}
          forecastGridRefreshing={forecastGridStatus === 'loading'}
          forecastGridError={forecastGridError}
          forecastGridUpdatedAt={forecastGridUpdatedAt}
          forecastGridWindow={forecastGridWindow}
          onForecastGridWindowChange={setForecastGridWindow}
          autoHoverEnabled={autoHoverEnabled}
          onToggleAutoHover={() => setAutoHoverEnabled((value) => !value)}
        />
      </AppShell.Header>

      <AppShell.Main>
        <div style={{ position: 'relative', width: '100%', height: MAP_AREA_HEIGHT }}>
          <MapView
            basemapId={basemapId}
            domain={domain}
            view={view}
            is3D={is3D}
            exaggeration={exaggeration}
            opacity={opacity}
            frame={frame}
            onCameraChange={calibrationEnabled ? handleCameraChange : undefined}
            isHovering={isHovering}
            onToggleHover={handleToggleHover}
            onUserInteraction={handleUserInteraction}
            provincialCapitals={{
              data: provincialCapitalsData,
              visible: provincialCapitalsVisible
            }}
            forecastGrid={{
              data: forecastGridData,
              visible: forecastGridVisible
            }}
          />
          {!frame && <EmptyState message={error || status} loading={!error} />}
          <Stack
            gap="xs"
            style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, width: 240 }}
          >
            {is3D && (
              <SliderControl
                label="Terrain"
                min={mapConfig.terrain.minExaggeration}
                max={mapConfig.terrain.maxExaggeration}
                step={0.1}
                value={exaggeration}
                onChange={setExaggeration}
                formatLabel={(value) => `${value.toFixed(1)}×`}
              />
            )}
            <SliderControl
              label="Speed"
              min={0.25}
              max={4}
              step={0.25}
              value={speed}
              onChange={setSpeed}
              formatLabel={(value) => `${value}×`}
            />
            <SliderControl
              label="Opacity"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={setOpacity}
              formatLabel={(value) => value.toFixed(2)}
            />
          </Stack>
          {calibrationEnabled && (
            <CalibrationPanel
              domain={domain}
              view={view}
              views={views}
              opacity={opacity}
              onOpacityChange={setOpacity}
              onCoordinatesChange={handleCoordinatesChange}
            />
          )}
        </div>
      </AppShell.Main>

      <AppShell.Footer>
        <Timeline
          frames={frames}
          currentIndex={frameIndex}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((value) => !value)}
          onScrub={setFrameIndex}
          onScrubStart={() => setIsPlaying(false)}
          error={error}
        />
      </AppShell.Footer>
    </AppShell>
  );
}
