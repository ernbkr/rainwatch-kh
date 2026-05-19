import { mapConfig } from './map-config';
import { radar } from './radar';
import type { Frame, RawFrame } from './types';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Radar image could not be loaded.'));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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

// Fetches a radar frame image, crops it to the configured area, and returns
// an object URL for the cropped PNG.
async function createOverlayUrl(frame: RawFrame): Promise<string> {
  const dataUrl = await radar.fetchImageDataUrl(frame.url);
  const image = await loadImage(dataUrl);
  const { crop } = mapConfig.imageLayout;

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context unavailable.');
  }
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

async function preloadFrame(frame: RawFrame): Promise<Frame | null> {
  try {
    return { ...frame, overlayUrl: await createOverlayUrl(frame) };
  } catch {
    return null;
  }
}

/** Fetches and crops every frame's image; drops frames that failed to load. */
export async function preloadFrames(frames: RawFrame[]): Promise<Frame[]> {
  if (frames.length === 0) {
    return [];
  }

  const first = await preloadFrame(frames[0]);
  const rest = await Promise.all(frames.slice(1).map(preloadFrame));
  return [first, ...rest].filter((frame): frame is Frame => frame !== null);
}

/** Releases the object URLs held by a set of frames. */
export function revokeFrameOverlayUrls(frames: Frame[]): void {
  for (const frame of frames) {
    if (frame.overlayUrl) {
      URL.revokeObjectURL(frame.overlayUrl);
    }
  }
}
