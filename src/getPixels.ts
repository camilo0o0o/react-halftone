/**
 * Browser-only pixel acquisition — the single DOM seam that the pure core sits
 * behind. Kept separate so both hooks share one implementation and so the core
 * stays environment-agnostic.
 */

export interface LoadedImage {
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
}

export interface ExtractedPixels {
  pixels: Uint8ClampedArray;
  workWidth: number;
  workHeight: number;
  scale: number;
}

/**
 * Load and decode an image via callbacks. Returns the underlying element so the
 * caller can detach handlers on cleanup (React effects need synchronous
 * cancellation, not a promise). `onLoad` fires once the bitmap is drawable.
 */
export function loadImageElement(
  src: string,
  onLoad: (loaded: LoadedImage) => void,
  onError: (error: Error) => void,
  crossOrigin: string | null = 'anonymous'
): HTMLImageElement {
  const image = new Image();
  if (crossOrigin !== null) image.crossOrigin = crossOrigin;

  image.onload = () => {
    onLoad({ image, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
  };
  image.onerror = () => {
    onError(new Error(`Failed to load image: ${src}`));
  };

  image.src = src;
  return image;
}

/**
 * Draw a decoded image into an offscreen canvas at `1/scale` resolution and
 * return its raw RGBA buffer. The downscale area-averages each cell for free.
 */
export function extractPixels(
  image: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  scale: number
): ExtractedPixels {
  const workWidth = Math.max(1, Math.round(naturalWidth / scale));
  const workHeight = Math.max(1, Math.round(naturalHeight / scale));

  const canvas = document.createElement('canvas');
  canvas.width = workWidth;
  canvas.height = workHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire a 2D canvas context');

  ctx.drawImage(image, 0, 0, workWidth, workHeight);
  const pixels = ctx.getImageData(0, 0, workWidth, workHeight).data;

  return { pixels, workWidth, workHeight, scale };
}
