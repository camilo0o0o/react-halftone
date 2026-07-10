/**
 * Pure, environment-agnostic halftone core.
 *
 * Nothing in this module touches React, the DOM, or Node APIs — every function
 * operates on plain numbers and a raw RGBA `Uint8ClampedArray`. Browser and
 * build-time (Node) adapters both call the same `compute*` orchestrators so the
 * output is identical across environments.
 */
export * from './types';
export * from './color';
export * from './halftone';
export * from './svg';

import type {
  HalftoneConfig,
  HalftoneCMYKConfig,
  HalftoneResult,
  HalftoneCMYKResult,
  CMYKChannel,
  CMYKChannelResult,
} from './types';
import {
  validateConfig,
  validateCMYKConfig,
  calculateGrid,
  generateCircles,
  generateRotatedGridPoints,
  generateChannelCircles,
  scaleCircles,
  CMYK_CHANNEL_COLORS,
} from './halftone';
import { generatePathData } from './svg';

const CMYK_CHANNELS: CMYKChannel[] = ['c', 'm', 'y', 'k'];

/**
 * Compute a monochrome halftone from raw RGBA pixels.
 *
 * @param pixels RGBA buffer at work resolution (`width` x `height`).
 * @param width  Buffer width in pixels.
 * @param height Buffer height in pixels.
 * @param scale  Work→natural multiplier (1 when not downsampled). Circles are
 *               returned in natural-space coordinates.
 * @param config Partial monochrome config (defaults applied internally).
 */
export function computeHalftone(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
  config: Partial<HalftoneConfig> = {}
): HalftoneResult {
  const validated = validateConfig(config);
  const grid = calculateGrid(width, height, validated.step, validated.density, validated.stepBasis);

  if (grid.numCols < 1 || grid.numRows < 1) {
    return { circles: [], pathData: '' };
  }

  const rawCircles = generateCircles(pixels, width, height, grid, validated.invert, scale);
  const circles = scaleCircles(rawCircles, scale);
  const pathData = generatePathData(circles, validated.shape, validated.cornerRadius);

  return { circles, pathData };
}

/**
 * Compute a CMYK halftone (four rotated channels) from raw RGBA pixels.
 *
 * @param pixels RGBA buffer at work resolution (`width` x `height`).
 * @param width  Buffer width in pixels.
 * @param height Buffer height in pixels.
 * @param scale  Work→natural multiplier (1 when not downsampled). Circles are
 *               returned in natural-space coordinates.
 * @param config Partial CMYK config (defaults applied internally).
 */
export function computeHalftoneCMYK(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
  config: Partial<HalftoneCMYKConfig> = {}
): HalftoneCMYKResult {
  const validated = validateCMYKConfig(config);
  const channels = {} as Record<CMYKChannel, CMYKChannelResult>;

  for (const ch of CMYK_CHANNELS) {
    const chConfig = validated.channels[ch];
    const { stepPx, maxRadius } = calculateGrid(
      width, height, chConfig.step, chConfig.density, validated.stepBasis
    );
    const gridPoints = generateRotatedGridPoints(width, height, stepPx, chConfig.angle);
    const rawCircles = generateChannelCircles(pixels, width, height, gridPoints, maxRadius, ch, scale);

    channels[ch] = {
      circles: scaleCircles(rawCircles, scale),
      angle: chConfig.angle,
      color: CMYK_CHANNEL_COLORS[ch],
    };
  }

  return { channels };
}
