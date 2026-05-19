import type { RadarApi } from './lib/types';

declare global {
  interface Window {
    radar: RadarApi;
  }
}

export {};
