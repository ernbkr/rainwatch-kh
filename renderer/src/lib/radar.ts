import type { RadarApi } from './types';

/** The preload-exposed IPC bridge to the Electron main process. */
export const radar: RadarApi = window.radar;
