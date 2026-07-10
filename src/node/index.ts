/**
 * Build-time / server-side halftone generation.
 *
 * This entry ('react-halftone/node') runs the SAME pure core as the browser,
 * so output is identical — only pixel acquisition differs (sharp instead of a
 * canvas). Use it to precompute halftones during a build for images that don't
 * need realtime processing, then ship the static SVG/PNG.
 *
 * `sharp` is an OPTIONAL peer dependency, imported lazily so that
 * 'react-halftone' and 'react-halftone/core' never pull it into a browser
 * bundle.
 */
import {
  computeHalftone,
  computeHalftoneCMYK,
  renderHalftoneSVG,
  renderHalftoneCMYKSVG,
  generatePathData,
  validateConfig,
  validateCMYKConfig,
  calculateGrid,
  computeDownsampleScale,
} from '../core';
import type { HalftoneConfig, HalftoneCMYKConfig, CMYKChannel } from '../core';

const DRAW_ORDER: CMYKChannel[] = ['c', 'm', 'y', 'k'];

// Minimal structural type for the slice of sharp we use — avoids a hard type
// dependency on the optional package.
type SharpFactory = (input?: ImageInput | SharpCreateOptions) => SharpInstance;
interface SharpCreateOptions {
  create: { width: number; height: number; channels: 4; background: string };
}
interface SharpInstance {
  metadata(): Promise<{ width?: number; height?: number }>;
  resize(width: number, height: number, opts?: { fit?: string }): SharpInstance;
  ensureAlpha(): SharpInstance;
  raw(): SharpInstance;
  png(): SharpInstance;
  composite(layers: Array<{ input: Buffer; blend: string }>): SharpInstance;
  toBuffer(opts?: { resolveWithObject?: boolean }): Promise<any>;
}

export type ImageInput = string | Buffer | Uint8Array;

let sharpModule: SharpFactory | null = null;

async function getSharp(): Promise<SharpFactory> {
  if (sharpModule) return sharpModule;
  try {
    const mod: any = await import('sharp');
    sharpModule = (mod.default ?? mod) as SharpFactory;
    return sharpModule;
  } catch {
    throw new Error(
      "react-halftone/node requires the optional peer dependency 'sharp'. " +
        'Install it with `npm install sharp`.'
    );
  }
}

async function readDimensions(sharp: SharpFactory, input: ImageInput) {
  const meta = await sharp(input).metadata();
  const naturalWidth = meta.width ?? 0;
  const naturalHeight = meta.height ?? 0;
  if (!naturalWidth || !naturalHeight) {
    throw new Error('Could not read image dimensions');
  }
  return { naturalWidth, naturalHeight };
}

async function extractPixels(
  sharp: SharpFactory,
  input: ImageInput,
  naturalWidth: number,
  naturalHeight: number,
  scale: number
) {
  const workWidth = Math.max(1, Math.round(naturalWidth / scale));
  const workHeight = Math.max(1, Math.round(naturalHeight / scale));
  const { data } = await sharp(input)
    .resize(workWidth, workHeight, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  return { pixels, workWidth, workHeight };
}

/**
 * Generate a monochrome halftone as a standalone SVG string.
 */
export async function halftoneToSVG(
  input: ImageInput,
  config: Partial<HalftoneConfig> = {}
): Promise<string> {
  const sharp = await getSharp();
  const { naturalWidth, naturalHeight } = await readDimensions(sharp, input);

  const validated = validateConfig(config);
  const { stepPx } = calculateGrid(
    naturalWidth, naturalHeight, validated.step, validated.density, validated.stepBasis
  );
  const scale = computeDownsampleScale(stepPx);

  const { pixels, workWidth, workHeight } = await extractPixels(
    sharp, input, naturalWidth, naturalHeight, scale
  );
  const { pathData } = computeHalftone(pixels, workWidth, workHeight, scale, config);

  return renderHalftoneSVG(pathData, {
    width: naturalWidth,
    height: naturalHeight,
    color: validated.color,
  });
}

/**
 * Generate a monochrome halftone as a rasterized PNG buffer.
 */
export async function halftoneToPNG(
  input: ImageInput,
  config: Partial<HalftoneConfig> = {}
): Promise<Buffer> {
  const sharp = await getSharp();
  const svg = await halftoneToSVG(input, config);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generate a CMYK halftone as a standalone SVG string (mix-blend-mode:multiply
 * over white).
 */
export async function halftoneCMYKToSVG(
  input: ImageInput,
  config: Partial<HalftoneCMYKConfig> = {}
): Promise<string> {
  const sharp = await getSharp();
  const { naturalWidth, naturalHeight } = await readDimensions(sharp, input);

  const validated = validateCMYKConfig(config);
  let minStepPx = Infinity;
  for (const ch of DRAW_ORDER) {
    const chConfig = validated.channels[ch];
    const { stepPx } = calculateGrid(
      naturalWidth, naturalHeight, chConfig.step, chConfig.density, validated.stepBasis
    );
    if (stepPx < minStepPx) minStepPx = stepPx;
  }
  const scale = computeDownsampleScale(minStepPx);

  const { pixels, workWidth, workHeight } = await extractPixels(
    sharp, input, naturalWidth, naturalHeight, scale
  );
  const { channels } = computeHalftoneCMYK(pixels, workWidth, workHeight, scale, config);

  return renderHalftoneCMYKSVG(channels, {
    width: naturalWidth,
    height: naturalHeight,
    shape: validated.shape,
    cornerRadius: validated.cornerRadius,
  });
}

/**
 * Generate a CMYK halftone as a rasterized PNG buffer. Each channel is
 * rasterized separately and composited with multiply blending over white, which
 * avoids relying on the SVG renderer's mix-blend-mode support.
 */
export async function halftoneCMYKToPNG(
  input: ImageInput,
  config: Partial<HalftoneCMYKConfig> = {}
): Promise<Buffer> {
  const sharp = await getSharp();
  const { naturalWidth, naturalHeight } = await readDimensions(sharp, input);

  const validated = validateCMYKConfig(config);
  let minStepPx = Infinity;
  for (const ch of DRAW_ORDER) {
    const chConfig = validated.channels[ch];
    const { stepPx } = calculateGrid(
      naturalWidth, naturalHeight, chConfig.step, chConfig.density, validated.stepBasis
    );
    if (stepPx < minStepPx) minStepPx = stepPx;
  }
  const scale = computeDownsampleScale(minStepPx);

  const { pixels, workWidth, workHeight } = await extractPixels(
    sharp, input, naturalWidth, naturalHeight, scale
  );
  const { channels } = computeHalftoneCMYK(pixels, workWidth, workHeight, scale, config);

  const layers: Array<{ input: Buffer; blend: string }> = [];
  for (const ch of DRAW_ORDER) {
    const { circles, color } = channels[ch];
    if (circles.length === 0) continue;
    const pathData = generatePathData(circles, validated.shape, validated.cornerRadius);
    const layerSvg = renderHalftoneSVG(pathData, {
      width: naturalWidth,
      height: naturalHeight,
      color,
    });
    const layerPng = await sharp(Buffer.from(layerSvg)).png().toBuffer();
    layers.push({ input: layerPng, blend: 'multiply' });
  }

  return sharp({
    create: { width: naturalWidth, height: naturalHeight, channels: 4, background: '#FFFFFF' },
  })
    .composite(layers)
    .png()
    .toBuffer();
}
