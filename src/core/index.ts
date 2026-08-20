/**
 * Pure, environment-agnostic halftone core.
 *
 * Nothing in this module touches React or the DOM — every function operates on
 * plain numbers and a raw RGBA `Uint8ClampedArray`. That keeps the halftone
 * math directly testable and callable from anywhere the pixels come from,
 * including a Web Worker.
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
  CMYK_CHANNELS,
} from './halftone';
import type { ValidatedCMYKChannelConfig } from './halftone';
import { generatePathData } from './svg';

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
 * Compute a single CMYK channel's rotated dot grid.
 *
 * Channels are fully independent, so callers that only changed one channel's
 * settings (an angle slider, say) can recompute just that one instead of all
 * four — see `useHalftoneCMYK`.
 *
 * @param pixels    RGBA buffer at work resolution (`width` x `height`).
 * @param width     Buffer width in pixels.
 * @param height    Buffer height in pixels.
 * @param scale     Work→natural multiplier (1 when not downsampled). Circles
 *                  are returned in natural-space coordinates.
 * @param channel   Which ink to separate.
 * @param chConfig  Already-validated angle/step/density for this channel.
 * @param stepBasis Dimension the step percentage is measured against.
 */
export function computeHalftoneCMYKChannel(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
  channel: CMYKChannel,
  chConfig: ValidatedCMYKChannelConfig,
  stepBasis: 'min' | 'width'
): CMYKChannelResult {
  const { stepPx, maxRadius } = calculateGrid(
    width, height, chConfig.step, chConfig.density, stepBasis
  );
  const gridPoints = generateRotatedGridPoints(width, height, stepPx, chConfig.angle);
  const rawCircles = generateChannelCircles(
    pixels, width, height, gridPoints, maxRadius, channel, scale
  );

  return {
    circles: scaleCircles(rawCircles, scale),
    angle: chConfig.angle,
    color: CMYK_CHANNEL_COLORS[channel],
  };
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
    channels[ch] = computeHalftoneCMYKChannel(
      pixels, width, height, scale, ch, validated.channels[ch], validated.stepBasis
    );
  }

  return { channels };
}
