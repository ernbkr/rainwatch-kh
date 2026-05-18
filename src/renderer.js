const BASE_FRAME_DELAY_MS = 250;
const DEFAULT_DOMAIN = 'PHN';
const MAP_CONFIG = window.RADAR_MAP_CONFIG;
const TERRAIN = MAP_CONFIG?.terrain || null;

const overflowButton = document.getElementById('overflowButton');
const overflowMenu = document.getElementById('overflowMenu');
const mapPanel = document.getElementById('mapPanel');
const emptyState = document.getElementById('emptyState');
const latestLabel = document.getElementById('latestLabel');
const currentLabel = document.getElementById('currentLabel');
const lastCheckedLabel = document.getElementById('lastCheckedLabel');
const nextCheckLabel = document.getElementById('nextCheckLabel');
const rangeStartLabel = document.getElementById('rangeStartLabel');
const rangeCurrentLabel = document.getElementById('rangeCurrentLabel');
const rangeEndLabel = document.getElementById('rangeEndLabel');
const sequenceProgressFill = document.getElementById('sequenceProgressFill');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const terrainControl = document.getElementById('terrainControl');
const terrainSlider = document.getElementById('terrainExaggeration');
const terrainValueLabel = document.getElementById('terrainExaggerationValue');
const errorLine = document.getElementById('errorLine');
const calibrationPanel = document.getElementById('calibrationPanel');
const calibrationAreaLabel = document.getElementById('calibrationAreaLabel');
const coordinateInputs = [
  [document.getElementById('topLeftLng'), document.getElementById('topLeftLat')],
  [document.getElementById('topRightLng'), document.getElementById('topRightLat')],
  [document.getElementById('bottomRightLng'), document.getElementById('bottomRightLat')],
  [document.getElementById('bottomLeftLng'), document.getElementById('bottomLeftLat')]
];
const overlayOpacity = document.getElementById('overlayOpacity');
const overlayOpacityValue = document.getElementById('overlayOpacityValue');
const calibrationOutput = document.getElementById('calibrationOutput');
const panNorthButton = document.getElementById('panNorthButton');
const panSouthButton = document.getElementById('panSouthButton');
const panWestButton = document.getElementById('panWestButton');
const panEastButton = document.getElementById('panEastButton');
const zoomInButton = document.getElementById('zoomInButton');
const zoomOutButton = document.getElementById('zoomOutButton');
const expandWidthButton = document.getElementById('expandWidthButton');
const shrinkWidthButton = document.getElementById('shrinkWidthButton');
const expandHeightButton = document.getElementById('expandHeightButton');
const shrinkHeightButton = document.getElementById('shrinkHeightButton');
const rotateClockwiseButton = document.getElementById('rotateClockwiseButton');
const rotateCounterClockwiseButton = document.getElementById('rotateCounterClockwiseButton');

const RADAR_SOURCE_ID = 'radar-overlay';
const RADAR_LAYER_ID = 'radar-overlay-layer';
const HILLSHADE_LAYER_ID = 'mapterhorn-hillshade';
const TRANSPARENT_IMAGE_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lmXbWQAAAABJRU5ErkJggg==';

let frames = [];
let currentFrameIndex = 0;
let playbackTimer = null;
let refreshTimer = null;
let selectedDomain = DEFAULT_DOMAIN;
let loadSerial = 0;
let latestFrameUrl = '';
let nextRefreshTime = null;
let playbackSpeed = Number(speedSlider.value);
let map = null;
let mapError = '';
let hasLoadedMapStyle = false;
let isSyncingCalibrationInputs = false;
let isCalibrationEnabled = false;
let areCalibrationControlsBound = false;
let lastErrorMessage = '';
let activeOverlayUrl = '';
let radarOpacity = MAP_CONFIG?.radarOpacity ?? 0.68;
let is3DEnabled = false;
let terrainExaggeration = TERRAIN?.exaggeration ?? 1.5;

const AREA_LABELS = Object.freeze({
  PHN: '80 KM',
  '240KM': '240 KM',
  CAMBODIA: '450 KM'
});

const calibrationViews = Object.fromEntries(
  Object.entries(MAP_CONFIG?.views || {}).map(([domain, view]) => [
    domain,
    {
      center: [...view.center],
      zoom: view.zoom,
      coordinates: view.coordinates.map((coordinate) => [...coordinate])
    }
  ])
);

function getNextRefreshTime(now = new Date()) {
  const refreshMinutes = [3, 18, 33, 48];
  const next = new Date(now);
  next.setSeconds(0, 0);

  const nextMinute = refreshMinutes.find((minute) => minute > now.getMinutes());
  if (nextMinute !== undefined) {
    next.setMinutes(nextMinute);
  } else {
    next.setHours(next.getHours() + 1);
    next.setMinutes(refreshMinutes[0]);
  }

  return next;
}

function formatClock(date) {
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function setBusy(isBusy) {
  overflowMenu.querySelectorAll('[data-domain], [data-action="refresh"]').forEach((item) => {
    item.disabled = isBusy;
  });
}

function setError(message) {
  lastErrorMessage = message || '';
  const messages = [lastErrorMessage, mapError].filter(Boolean);
  errorLine.textContent = messages.join(' ');
}

function updateStatus() {
  const latest = frames.at(-1);
  latestLabel.textContent = latest?.label || '-';
  currentLabel.textContent = frames[currentFrameIndex]?.label || '-';
  nextCheckLabel.textContent = formatClock(nextRefreshTime);
  updateTimeline();
}

function getProgressPercent() {
  if (frames.length === 0) {
    return 0;
  }

  if (frames.length === 1) {
    return 100;
  }

  return (currentFrameIndex / (frames.length - 1)) * 100;
}

function setProgress(percent, { instant = false } = {}) {
  sequenceProgressFill.classList.toggle('is-resetting', instant);
  sequenceProgressFill.style.width = `${percent}%`;
}

function updateTimeline({ resetProgress = false } = {}) {
  const first = frames[0];
  const current = frames[currentFrameIndex];
  const latest = frames.at(-1);

  rangeStartLabel.textContent = first?.label || '-';
  rangeCurrentLabel.textContent = current?.label || '-';
  rangeEndLabel.textContent = latest?.label || '-';
  setProgress(getProgressPercent(), { instant: resetProgress });
}

function getPlaybackDelayMs() {
  return Math.max(50, Math.round(BASE_FRAME_DELAY_MS / playbackSpeed));
}

function updateSpeedDisplay() {
  speedValue.textContent = `${playbackSpeed.toFixed(2).replace(/\.?0+$/, '')}x`;
}

function getSelectedMapView() {
  return calibrationViews[selectedDomain] || calibrationViews[DEFAULT_DOMAIN];
}

function setCalibrationEnabled(isEnabled) {
  isCalibrationEnabled = isEnabled;
  calibrationPanel.hidden = !isEnabled;

  if (isEnabled) {
    bindCalibrationControls();
    syncCalibrationPanel();
  }
}

async function initializeRuntimeConfig() {
  try {
    const config = await window.radar.getRuntimeConfig();
    setCalibrationEnabled(Boolean(config?.calibrationEnabled));
  } catch {
    setCalibrationEnabled(false);
  }
}

function setMapError(message) {
  mapError = message || '';
  const messages = [lastErrorMessage, mapError].filter(Boolean);
  errorLine.textContent = messages.join(' ');
}

function syncMapView() {
  if (!map) {
    return;
  }

  const view = getSelectedMapView();
  if (!view) {
    return;
  }

  map.jumpTo({
    center: view.center,
    zoom: view.zoom,
    bearing: 0,
    pitch: is3DEnabled && TERRAIN ? TERRAIN.pitch : 0
  });
}

function syncCameraFromMap() {
  if (!map) {
    return;
  }

  const view = getSelectedMapView();
  if (!view) {
    return;
  }

  const center = map.getCenter();
  calibrationViews[selectedDomain] = {
    ...view,
    center: [center.lng, center.lat],
    zoom: map.getZoom()
  };
  syncCalibrationPanel();
}

function getRadarSource() {
  return map?.getSource(RADAR_SOURCE_ID);
}

function addRadarOverlay() {
  if (!map || map.getSource(RADAR_SOURCE_ID)) {
    return;
  }

  const view = getSelectedMapView();
  map.addSource(RADAR_SOURCE_ID, {
    type: 'image',
    url: activeOverlayUrl || TRANSPARENT_IMAGE_URL,
    coordinates: view.coordinates
  });
  map.addLayer({
    id: RADAR_LAYER_ID,
    type: 'raster',
    source: RADAR_SOURCE_ID,
    paint: {
      'raster-opacity': radarOpacity,
      'raster-fade-duration': 0
    }
  });
}

function updateRadarOverlayCoordinates() {
  const source = getRadarSource();
  const view = getSelectedMapView();
  if (!source || !view) {
    return;
  }

  source.setCoordinates(view.coordinates);
}

function updateRadarOverlayOpacity() {
  if (!map || !map.getLayer(RADAR_LAYER_ID)) {
    return;
  }

  map.setPaintProperty(RADAR_LAYER_ID, 'raster-opacity', radarOpacity);
}

function updateRadarOverlayImage(frame) {
  if (!frame?.overlayUrl) {
    return;
  }

  activeOverlayUrl = frame.overlayUrl;
  const source = getRadarSource();
  const view = getSelectedMapView();
  if (!source || !view) {
    return;
  }

  source.updateImage({
    url: activeOverlayUrl,
    coordinates: view.coordinates
  });
}

function formatNumber(value, digits) {
  return Number(value).toFixed(digits);
}

function formatDomainKey(domain) {
  return /^[A-Z_$][A-Z0-9_$]*$/i.test(domain) ? domain : `'${domain}'`;
}

function getCalibrationSnippet() {
  const views = Object.entries(calibrationViews)
    .map(([domain, view]) => `${formatDomainKey(domain)}: Object.freeze({
  center: [${formatNumber(view.center[0], 6)}, ${formatNumber(view.center[1], 6)}],
  zoom: ${formatNumber(view.zoom, 2)},
  coordinates: Object.freeze([
    [${formatNumber(view.coordinates[0][0], 6)}, ${formatNumber(view.coordinates[0][1], 6)}],
    [${formatNumber(view.coordinates[1][0], 6)}, ${formatNumber(view.coordinates[1][1], 6)}],
    [${formatNumber(view.coordinates[2][0], 6)}, ${formatNumber(view.coordinates[2][1], 6)}],
    [${formatNumber(view.coordinates[3][0], 6)}, ${formatNumber(view.coordinates[3][1], 6)}]
  ])
})`)
    .join(',\n');
  return `radarOpacity: ${formatNumber(radarOpacity, 2)},
views: Object.freeze({
${views}
})`;
}

function syncCalibrationPanel() {
  if (!isCalibrationEnabled) {
    return;
  }

  const view = getSelectedMapView();
  if (!view) {
    return;
  }

  isSyncingCalibrationInputs = true;
  calibrationAreaLabel.textContent = AREA_LABELS[selectedDomain] || selectedDomain;
  coordinateInputs.forEach(([lngInput, latInput], index) => {
    lngInput.value = formatNumber(view.coordinates[index][0], 6);
    latInput.value = formatNumber(view.coordinates[index][1], 6);
  });
  overlayOpacity.value = String(radarOpacity);
  overlayOpacityValue.textContent = formatNumber(overlayOpacity.value, 2);
  calibrationOutput.value = getCalibrationSnippet();
  isSyncingCalibrationInputs = false;
}

function applyCalibrationView(nextView) {
  calibrationViews[selectedDomain] = {
    center: [...nextView.center],
    zoom: nextView.zoom,
    coordinates: nextView.coordinates.map((coordinate) => [...coordinate])
  };
  updateRadarOverlayCoordinates();
  syncCalibrationPanel();
}

function applyCalibrationInputs() {
  if (isSyncingCalibrationInputs) {
    return;
  }

  const coordinates = coordinateInputs.map(([lngInput, latInput]) => [
    Number(lngInput.value),
    Number(latInput.value)
  ]);

  if (coordinates.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat))) {
    return;
  }

  const view = getSelectedMapView();
  applyCalibrationView({
    ...view,
    coordinates
  });
}

function nudgeCoordinates(deltaLng, deltaLat) {
  const view = getSelectedMapView();
  if (!view) {
    return;
  }

  applyCalibrationView({
    ...view,
    coordinates: view.coordinates.map(([lng, lat]) => [lng + deltaLng, lat + deltaLat])
  });
}

function getCoordinateCenter(coordinates) {
  const totals = coordinates.reduce(
    (sum, [lng, lat]) => [sum[0] + lng, sum[1] + lat],
    [0, 0]
  );
  return [totals[0] / coordinates.length, totals[1] / coordinates.length];
}

function scaleCoordinates(scaleLng, scaleLat) {
  const view = getSelectedMapView();
  if (!view) {
    return;
  }

  const center = getCoordinateCenter(view.coordinates);
  applyCalibrationView({
    ...view,
    coordinates: view.coordinates.map(([lng, lat]) => [
      center[0] + (lng - center[0]) * scaleLng,
      center[1] + (lat - center[1]) * scaleLat
    ])
  });
}

function rotateCoordinates(degrees) {
  const view = getSelectedMapView();
  if (!view) {
    return;
  }

  const center = getCoordinateCenter(view.coordinates);
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  applyCalibrationView({
    ...view,
    coordinates: view.coordinates.map(([lng, lat]) => {
      const deltaLng = lng - center[0];
      const deltaLat = lat - center[1];
      return [
        center[0] + deltaLng * cos - deltaLat * sin,
        center[1] + deltaLng * sin + deltaLat * cos
      ];
    })
  });
}

function registerTerrainProtocol() {
  if (
    typeof maplibregl === 'undefined' ||
    typeof pmtiles === 'undefined' ||
    !window.RadarTerrain ||
    !TERRAIN
  ) {
    return;
  }

  const protocol = new pmtiles.Protocol({ metadata: true });
  const prefix = `${TERRAIN.protocol}://`;

  maplibregl.addProtocol(TERRAIN.protocol, async (params, abortController) => {
    const [z, x, y] = params.url.replace(prefix, '').split('/').map(Number);
    const response = await protocol.tile(
      { ...params, url: window.RadarTerrain.mapterhornTileUrl(z, x, y) },
      abortController
    );
    if (response.data === null) {
      throw new Error(`Terrain tile z=${z} x=${x} y=${y} not found.`);
    }
    return response;
  });
}

function firstSymbolLayerId() {
  const layers = map?.getStyle()?.layers || [];
  return layers.find((layer) => layer.type === 'symbol')?.id;
}

function addTerrainSourceAndHillshade() {
  if (!map || !TERRAIN || map.getSource(TERRAIN.sourceId)) {
    return;
  }

  map.addSource(TERRAIN.sourceId, {
    type: 'raster-dem',
    tiles: [...TERRAIN.tiles],
    encoding: TERRAIN.encoding,
    tileSize: TERRAIN.tileSize,
    attribution: TERRAIN.attribution
  });
  map.addLayer(
    {
      id: HILLSHADE_LAYER_ID,
      type: 'hillshade',
      source: TERRAIN.sourceId,
      layout: { visibility: 'none' }
    },
    firstSymbolLayerId()
  );
}

function applyTerrainState() {
  if (!map || !TERRAIN || !map.getSource(TERRAIN.sourceId)) {
    return;
  }

  map.setTerrain(
    is3DEnabled ? { source: TERRAIN.sourceId, exaggeration: terrainExaggeration } : null
  );
  if (map.getLayer(HILLSHADE_LAYER_ID)) {
    map.setLayoutProperty(HILLSHADE_LAYER_ID, 'visibility', is3DEnabled ? 'visible' : 'none');
  }
}

function updateTerrainValueLabel() {
  if (terrainValueLabel) {
    terrainValueLabel.textContent = `${terrainExaggeration.toFixed(1)}×`;
  }
}

function syncTerrainControls() {
  const toggle = overflowMenu.querySelector('[data-action="toggle-3d"]');
  if (toggle) {
    toggle.setAttribute('aria-checked', String(is3DEnabled));
  }
  if (terrainControl) {
    terrainControl.hidden = !is3DEnabled;
  }
}

function set3DEnabled(isEnabled) {
  if (!TERRAIN) {
    return;
  }

  is3DEnabled = isEnabled;
  syncTerrainControls();
  applyTerrainState();

  if (map) {
    map.easeTo({ pitch: isEnabled ? TERRAIN.pitch : 0, bearing: 0, duration: 600 });
  }
}

function initializeTerrainControls() {
  if (!TERRAIN || !terrainSlider) {
    return;
  }

  terrainSlider.min = String(TERRAIN.minExaggeration);
  terrainSlider.max = String(TERRAIN.maxExaggeration);
  terrainSlider.value = String(terrainExaggeration);
  updateTerrainValueLabel();
  syncTerrainControls();
}

function initializeMap() {
  if (!MAP_CONFIG?.styleUrl || typeof maplibregl === 'undefined') {
    setMapError('Map context unavailable.');
    return;
  }

  try {
    const view = getSelectedMapView();
    map = new maplibregl.Map({
      container: mapPanel,
      style: MAP_CONFIG.styleUrl,
      center: view.center,
      zoom: view.zoom,
      bearing: 0,
      pitch: 0,
      interactive: true,
      attributionControl: false
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      hasLoadedMapStyle = true;
      setMapError('');
      addTerrainSourceAndHillshade();
      addRadarOverlay();
      applyTerrainState();
      syncMapView();
      updateRadarOverlayImage(frames[currentFrameIndex]);
      syncCalibrationPanel();
      requestAnimationFrame(() => map.resize());
    });

    map.on('moveend', syncCameraFromMap);

    map.on('error', (event) => {
      if (hasLoadedMapStyle) {
        console.warn('MapLibre resource error', event?.error || event);
        return;
      }

      setMapError('Map context failed to load.');
    });
  } catch {
    setMapError('Map context failed to initialize.');
  }
}

function syncAreaMenu() {
  overflowMenu.querySelectorAll('[data-domain]').forEach((item) => {
    item.setAttribute('aria-checked', String(item.dataset.domain === selectedDomain));
  });
}

function openOverflowMenu() {
  overflowMenu.hidden = false;
  overflowButton.setAttribute('aria-expanded', 'true');
  syncAreaMenu();
}

function closeOverflowMenu() {
  overflowMenu.hidden = true;
  overflowButton.setAttribute('aria-expanded', 'false');
}

function toggleOverflowMenu() {
  if (overflowMenu.hidden) {
    openOverflowMenu();
  } else {
    closeOverflowMenu();
  }
}

function updateFrameView() {
  const frame = frames[currentFrameIndex];

  if (!frame) {
    emptyState.classList.remove('is-hidden');
    currentLabel.textContent = '-';
    updateTimeline({ resetProgress: true });
    return;
  }

  updateRadarOverlayImage(frame);
  emptyState.classList.add('is-hidden');
  currentLabel.textContent = frame.label || '-';
  updateTimeline();
}

function stopPlayback() {
  if (playbackTimer) {
    clearInterval(playbackTimer);
    playbackTimer = null;
  }
}

function startPlayback() {
  stopPlayback();

  if (frames.length === 0) {
    updateFrameView();
    return;
  }

  updateFrameView();
  playbackTimer = setInterval(() => {
    if (frames.length === 0) {
      return;
    }

    const isLoopReset = currentFrameIndex === frames.length - 1;
    currentFrameIndex = (currentFrameIndex + 1) % frames.length;
    if (isLoopReset) {
      setProgress(0, { instant: true });
      requestAnimationFrame(() => {
        sequenceProgressFill.classList.remove('is-resetting');
        updateFrameView();
      });
      return;
    }

    updateFrameView();
  }, getPlaybackDelayMs());
}

function restartPlaybackTimer() {
  if (frames.length === 0) {
    return;
  }

  startPlayback();
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Radar image could not be loaded.'));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Radar crop could not be encoded.'));
      }
    }, 'image/png');
  });
}

async function createOverlayUrl(frame) {
  const dataUrl = await window.radar.fetchImageDataUrl(frame.url);
  const image = await loadImage(dataUrl);
  const { crop } = MAP_CONFIG.imageLayout;
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;

  const context = canvas.getContext('2d');
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  const blob = await canvasToBlob(canvas);
  return URL.createObjectURL(blob);
}

async function preloadOverlayFrame(frame) {
  try {
    return {
      ...frame,
      overlayUrl: await createOverlayUrl(frame)
    };
  } catch {
    return null;
  }
}

async function preloadFrames(candidateFrames) {
  if (candidateFrames.length === 0) {
    return [];
  }

  const firstFrame = await preloadOverlayFrame(candidateFrames[0]);
  const remaining = await Promise.all(candidateFrames.slice(1).map(preloadOverlayFrame));
  return [firstFrame, ...remaining].filter(Boolean);
}

function revokeFrameOverlayUrls(frameList) {
  frameList.forEach((frame) => {
    if (frame.overlayUrl) {
      URL.revokeObjectURL(frame.overlayUrl);
    }
  });
}

function replaceFrames(nextFrames) {
  const previousFrames = frames;
  frames = nextFrames;
  currentFrameIndex = 0;
  latestFrameUrl = frames.at(-1)?.url || '';
  latestLabel.textContent = frames.at(-1)?.label || '-';
  updateTimeline({ resetProgress: true });
  startPlayback();
  revokeFrameOverlayUrls(previousFrames);
}

function clearForDomainLoad() {
  stopPlayback();
  const previousFrames = frames;
  frames = [];
  currentFrameIndex = 0;
  latestFrameUrl = '';
  activeOverlayUrl = '';
  const source = getRadarSource();
  const view = getSelectedMapView();
  if (source && view) {
    source.updateImage({
      url: TRANSPARENT_IMAGE_URL,
      coordinates: view.coordinates
    });
  }
  revokeFrameOverlayUrls(previousFrames);
  emptyState.classList.remove('is-hidden');
  emptyState.textContent = 'Loading radar frames...';
  latestLabel.textContent = '-';
  currentLabel.textContent = '-';
  updateTimeline({ resetProgress: true });
}

function scheduleNextRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  nextRefreshTime = getNextRefreshTime();
  nextCheckLabel.textContent = formatClock(nextRefreshTime);

  const delay = Math.max(0, nextRefreshTime.getTime() - Date.now());
  refreshTimer = setTimeout(async () => {
    await loadFrames({ reason: 'scheduled', clearExisting: false });
    scheduleNextRefresh();
  }, delay);
}

async function loadFrames({ reason, clearExisting }) {
  const serial = ++loadSerial;
  const domain = selectedDomain;

  if (clearExisting) {
    clearForDomainLoad();
  }

  setBusy(true);
  setError('');
  updateStatus(reason === 'scheduled' ? 'Checking for new radar frames...' : 'Loading radar frames...');

  try {
    const result = await window.radar.fetchFrames(domain);
    if (serial !== loadSerial || domain !== selectedDomain) {
      return;
    }

    lastCheckedLabel.textContent = formatClock(new Date(result.fetchedAt));

    if (!Array.isArray(result.frames) || result.frames.length === 0) {
      throw new Error('No radar frames found in the source page.');
    }

    const parsedLatestUrl = result.frames.at(-1)?.url || '';
    if (!clearExisting && latestFrameUrl && parsedLatestUrl === latestFrameUrl) {
      updateStatus(`No newer frame found. ${frames.length} frames loaded.`);
      return;
    }

    emptyState.textContent = 'Preloading radar frames...';
    const playableFrames = await preloadFrames(result.frames);
    if (serial !== loadSerial || domain !== selectedDomain) {
      return;
    }

    if (playableFrames.length === 0) {
      throw new Error('Radar images could not be loaded.');
    }

    replaceFrames(playableFrames);
    updateStatus(`${playableFrames.length} frames loaded.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not fetch radar source page.';

    if (frames.length > 0) {
      setError(`${message} Retrying at the next scheduled refresh.`);
      updateStatus(`${frames.length} frames loaded.`);
      startPlayback();
    } else {
      emptyState.textContent = message;
      setError(message);
      updateStatus('Unable to load radar frames.');
    }
  } finally {
    if (serial === loadSerial) {
      setBusy(false);
    }
  }
}

async function refreshNow() {
  await loadFrames({ reason: 'manual', clearExisting: false });
  scheduleNextRefresh();
}

async function switchArea(domain) {
  if (domain === selectedDomain) {
    return;
  }

  selectedDomain = domain;
  syncAreaMenu();
  syncMapView();
  syncCalibrationPanel();
  await loadFrames({ reason: 'area', clearExisting: true });
  scheduleNextRefresh();
}

overflowButton.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleOverflowMenu();
});

overflowMenu.addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) {
    return;
  }

  closeOverflowMenu();

  if (target.dataset.action === 'refresh') {
    await refreshNow();
    return;
  }

  if (target.dataset.action === 'quit') {
    await window.radar.quit();
    return;
  }

  if (target.dataset.action === 'toggle-3d') {
    set3DEnabled(!is3DEnabled);
    return;
  }

  if (target.dataset.domain) {
    await switchArea(target.dataset.domain);
  }
});

document.addEventListener('click', (event) => {
  if (!overflowMenu.hidden && !event.target.closest('.overflow')) {
    closeOverflowMenu();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeOverflowMenu();
    overflowButton.focus();
  }
});

window.addEventListener('resize', () => {
  if (map) {
    map.resize();
  }
});

speedSlider.addEventListener('input', () => {
  playbackSpeed = Number(speedSlider.value);
  updateSpeedDisplay();
  restartPlaybackTimer();
});

if (terrainSlider) {
  terrainSlider.addEventListener('input', () => {
    terrainExaggeration = Number(terrainSlider.value);
    updateTerrainValueLabel();
    if (is3DEnabled) {
      applyTerrainState();
    }
  });
}

function bindCalibrationControls() {
  if (areCalibrationControlsBound) {
    return;
  }

  coordinateInputs.forEach(([lngInput, latInput]) => {
    lngInput.addEventListener('input', applyCalibrationInputs);
    latInput.addEventListener('input', applyCalibrationInputs);
  });

  overlayOpacity.addEventListener('input', () => {
    radarOpacity = Number(overlayOpacity.value);
    overlayOpacityValue.textContent = formatNumber(radarOpacity, 2);
    updateRadarOverlayOpacity();
    calibrationOutput.value = getCalibrationSnippet();
  });

  panNorthButton.addEventListener('click', () => nudgeCoordinates(0, 0.01));
  panSouthButton.addEventListener('click', () => nudgeCoordinates(0, -0.01));
  panWestButton.addEventListener('click', () => nudgeCoordinates(-0.01, 0));
  panEastButton.addEventListener('click', () => nudgeCoordinates(0.01, 0));
  zoomInButton.addEventListener('click', () => scaleCoordinates(0.99, 0.99));
  zoomOutButton.addEventListener('click', () => scaleCoordinates(1.01, 1.01));
  expandWidthButton.addEventListener('click', () => scaleCoordinates(1.01, 1));
  shrinkWidthButton.addEventListener('click', () => scaleCoordinates(0.99, 1));
  expandHeightButton.addEventListener('click', () => scaleCoordinates(1, 1.01));
  shrinkHeightButton.addEventListener('click', () => scaleCoordinates(1, 0.99));
  rotateClockwiseButton.addEventListener('click', () => rotateCoordinates(0.5));
  rotateCounterClockwiseButton.addEventListener('click', () => rotateCoordinates(-0.5));

  calibrationOutput.addEventListener('focus', () => {
    calibrationOutput.select();
  });

  calibrationOutput.addEventListener('click', () => {
    calibrationOutput.select();
  });

  areCalibrationControlsBound = true;
}

window.addEventListener('beforeunload', () => {
  stopPlayback();
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  revokeFrameOverlayUrls(frames);
  if (map) {
    map.remove();
  }
});

registerTerrainProtocol();
initializeMap();
scheduleNextRefresh();
syncAreaMenu();
initializeRuntimeConfig();
initializeTerrainControls();
updateSpeedDisplay();
updateTimeline({ resetProgress: true });
loadFrames({ reason: 'initial', clearExisting: true });
