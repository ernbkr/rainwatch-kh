export type Coordinate = [number, number];
export type QuadCoordinates = [Coordinate, Coordinate, Coordinate, Coordinate];
export type DomainId = 'PHN' | '240KM' | 'CAMBODIA';

export interface MapView {
  center: Coordinate;
  zoom: number;
  coordinates: QuadCoordinates;
}

export interface RawFrame {
  index: number;
  url: string;
  label: string;
}

export interface Frame extends RawFrame {
  overlayUrl: string;
}

export interface FetchFramesResult {
  domain: string;
  fetchedAt: string;
  frames: RawFrame[];
}

export interface RuntimeConfig {
  calibrationEnabled: boolean;
}

export interface RadarApi {
  fetchFrames(domain: string): Promise<FetchFramesResult>;
  fetchImageDataUrl(imageUrl: string): Promise<string>;
  getRuntimeConfig(): Promise<RuntimeConfig>;
  quit(): Promise<void>;
}
