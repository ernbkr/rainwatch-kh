import type { DomainId, MapView } from './types';

export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageLayout {
  width: number;
  height: number;
  crop: ImageCrop;
}

export interface TerrainConfig {
  sourceId: string;
  protocol: string;
  tiles: string[];
  encoding: 'terrarium';
  tileSize: number;
  attribution: string;
  exaggeration: number;
  minExaggeration: number;
  maxExaggeration: number;
  pitch: number;
}

export interface RadarMapConfig {
  radarOpacity: number;
  terrain: TerrainConfig;
  imageLayout: ImageLayout;
  views: Record<DomainId, MapView>;
}

export const mapConfig: RadarMapConfig = {
  radarOpacity: 0.65,
  terrain: {
    sourceId: 'mapterhorn-terrain',
    protocol: 'mapterhorn',
    tiles: ['mapterhorn://{z}/{x}/{y}'],
    encoding: 'terrarium',
    tileSize: 512,
    attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
    exaggeration: 1.5,
    minExaggeration: 0,
    maxExaggeration: 3,
    pitch: 60
  },
  imageLayout: {
    width: 1069,
    height: 800,
    crop: { x: 0, y: 0, width: 800, height: 800 }
  },
  views: {
    PHN: {
      center: [104.9282, 11.5564],
      zoom: 9.44,
      coordinates: [
        [104.188, 12.248],
        [105.657, 12.249],
        [105.656, 10.811],
        [104.193, 10.811]
      ]
    },
    '240KM': {
      center: [105.642707, 11.540633],
      zoom: 7.88,
      coordinates: [
        [102.69901, 13.676],
        [107.14099, 13.676],
        [107.14099, 9.364],
        [102.69901, 9.364]
      ]
    },
    CAMBODIA: {
      center: [105.486617, 12.349317],
      zoom: 6.47,
      coordinates: [
        [100.75, 15.559],
        [109.11, 15.561],
        [109.017, 7.465],
        [100.778, 7.406978]
      ]
    }
  }
};

/** Deep-clones a view so calibration edits never mutate the shared config. */
export function cloneView(view: MapView): MapView {
  return {
    center: [...view.center],
    zoom: view.zoom,
    coordinates: view.coordinates.map((point) => [...point]) as MapView['coordinates']
  };
}

/** A fresh, independently-mutable copy of every domain's view. */
export function cloneViews(): Record<DomainId, MapView> {
  const entries = Object.entries(mapConfig.views) as [DomainId, MapView][];
  return Object.fromEntries(entries.map(([domain, view]) => [domain, cloneView(view)])) as Record<
    DomainId,
    MapView
  >;
}
