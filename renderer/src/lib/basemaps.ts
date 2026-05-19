import type { StyleSpecification } from 'maplibre-gl';

export interface Basemap {
  id: string;
  label: string;
  /** A hosted style.json URL or an inline MapLibre style object. */
  style: string | StyleSpecification;
  /** Supplements the AttributionControl when the style carries no attribution. */
  attribution?: string;
}

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Google has no hosted style.json — describe it as an inline raster style.
const GOOGLE_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'google-satellite': {
      type: 'raster',
      tiles: [
        'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
      ],
      tileSize: 256,
      attribution: '© Google'
    }
  },
  layers: [{ id: 'google-satellite', type: 'raster', source: 'google-satellite' }]
};

export const BASEMAPS: Basemap[] = [
  {
    id: 'colorful',
    label: 'Colorful',
    style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json'
  },
  {
    id: 'liberty',
    label: 'Liberty',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: OSM_ATTRIBUTION
  },
  {
    id: 'fiord',
    label: 'Fiord',
    style: 'https://tiles.openfreemap.org/styles/fiord',
    attribution: OSM_ATTRIBUTION
  },
  {
    id: 'satellite',
    label: 'Satellite',
    style: GOOGLE_SATELLITE_STYLE
  }
];

export const DEFAULT_BASEMAP_ID = 'colorful';

/** Returns the basemap for `id`, falling back to the default when missing. */
export function resolveBasemap(id: string | undefined): Basemap {
  return (
    BASEMAPS.find((basemap) => basemap.id === id) ??
    BASEMAPS.find((basemap) => basemap.id === DEFAULT_BASEMAP_ID) ??
    BASEMAPS[0]
  );
}
