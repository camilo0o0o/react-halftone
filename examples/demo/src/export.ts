/**
 * Export helpers for the mono preview.
 *
 * Nothing here is demo-only plumbing the library is missing: the SVG comes
 * from `renderHalftoneSVG`, the dots from `computeHalftone`, and the PNG from
 * the canvas the `HalftoneCanvas` ref hands over. The only reason this file
 * exists is that exporting is an on-click job — recomputing on every slider
 * tick just to have a string ready would cost a third halftone pass per frame.
 */
import { computeHalftone, renderHalftoneSVG } from 'react-halftone';
import type { HalftoneConfig } from 'react-halftone';

interface Pixels {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Decode `src` and read its RGBA buffer back at natural resolution. */
async function loadPixels(src: string): Promise<Pixels> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D context for the export canvas');

  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return { pixels: data, width: canvas.width, height: canvas.height };
}

export interface MonoSVG {
  svg: string;
  width: number;
  height: number;
}

/**
 * Build a standalone monochrome SVG at the image's natural resolution.
 *
 * Deliberately not downsampled the way the live preview is — the preview
 * trades dot precision for a smooth drag, an export has no reason to.
 */
export async function buildMonoSVG(
  src: string,
  config: Partial<HalftoneConfig>
): Promise<MonoSVG> {
  const { pixels, width, height } = await loadPixels(src);
  const { pathData } = computeHalftone(pixels, width, height, 1, config);

  return {
    svg: renderHalftoneSVG(pathData, { width, height, color: config.color }),
    width,
    height,
  };
}

/** Rasterize an SVG string to a PNG data URL, background left transparent. */
export function svgToPNG(svg: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get a 2D context for the export canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not rasterize the halftone SVG'));
    };

    img.src = url;
  });
}

/** Trigger a browser download for an already-built URL. */
export function downloadURL(filename: string, url: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  downloadURL(filename, url);
  // Revoking synchronously can beat the click's own fetch of the URL, so let
  // the current task finish first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
