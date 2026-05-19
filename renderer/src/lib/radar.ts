import { invoke, isTauri } from '@tauri-apps/api/core';
import type { FetchFramesResult, RadarApi, RuntimeConfig } from './types';

/**
 * Tauri rejects a failed command with a plain string. The renderer's error
 * handling branches on `instanceof Error`, so wrap rejections back into Error
 * objects to preserve the specific message text from Rust.
 */
function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

/** Radar API backed by the Rust commands registered in `src-tauri/src/lib.rs`. */
const tauriRadar: RadarApi = {
  async fetchFrames(domain) {
    try {
      return await invoke<FetchFramesResult>('get_radar_frames', { domain });
    } catch (caught) {
      throw toError(caught);
    }
  },
  async fetchImageDataUrl(imageUrl) {
    try {
      return await invoke<string>('get_radar_image', { url: imageUrl });
    } catch (caught) {
      throw toError(caught);
    }
  },
  getRuntimeConfig() {
    return invoke<RuntimeConfig>('get_runtime_config');
  },
  quit() {
    return invoke<void>('quit');
  }
};

/**
 * Radar IPC bridge. Uses the Tauri command API when running inside Tauri, and
 * falls back to the Electron preload bridge (`window.radar`) otherwise — so the
 * Electron build keeps working until it is removed.
 */
export const radar: RadarApi = isTauri() ? tauriRadar : window.radar;
