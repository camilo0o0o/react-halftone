import { useRef } from 'react';
import type {
  HalftoneCMYKConfig,
  UseHalftoneCMYKResult,
  CMYKChannel,
  CMYKChannelResult,
} from './types';
import {
  validateCMYKConfig,
  calculateGrid,
  computeDownsampleScale,
  computeHalftoneCMYKChannel,
  dotRoundness,
  CMYK_CHANNELS,
} from './core';
import { useHalftoneEngine } from './useHalftoneEngine';

interface Result {
  channels: Record<CMYKChannel, CMYKChannelResult>;
  naturalWidth: number;
  naturalHeight: number;
}

interface ChannelCacheEntry {
  key: string;
  result: CMYKChannelResult;
}

/**
 * Everything a channel's dots depend on, beyond the pixel buffer itself. Shape
 * enters as its roundness, so a corner-radius change while drawing circles
 * (which can't affect their sizes) keeps the cache.
 */
function channelKey(
  chConfig: { angle: number; step: number; density: number },
  stepBasis: string,
  roundness: number
): string {
  return `${chConfig.angle}|${chConfig.step}|${chConfig.density}|${stepBasis}|${roundness}`;
}

export function useHalftoneCMYK(
  src: string,
  config: Partial<HalftoneCMYKConfig> & { crossOrigin?: string | null } = {}
): UseHalftoneCMYKResult {
  // Per-channel memo. The four channels are independent, so moving one angle
  // slider should cost one channel, not four.
  const channelCacheRef = useRef<Partial<Record<CMYKChannel, ChannelCacheEntry>>>({});
  const cachedPixelsRef = useRef<Uint8ClampedArray | null>(null);

  const state = useHalftoneEngine<Result>(
    src,
    config.crossOrigin,
    (loaded, getPixels) => {
      const validated = validateCMYKConfig(config);
      const { naturalWidth, naturalHeight } = loaded;

      // The finest channel (smallest stepPx) drives the work resolution.
      let minStepPx = Infinity;
      for (const ch of CMYK_CHANNELS) {
        const chConfig = validated.channels[ch];
        const { stepPx } = calculateGrid(
          naturalWidth, naturalHeight, chConfig.step, chConfig.density, validated.stepBasis
        );
        if (stepPx < minStepPx) minStepPx = stepPx;
      }
      const cache = getPixels(computeDownsampleScale(minStepPx));

      // A different buffer means a new image or a new downsample scale — every
      // cached channel is stale.
      if (cachedPixelsRef.current !== cache.pixels) {
        channelCacheRef.current = {};
        cachedPixelsRef.current = cache.pixels;
      }

      const roundness = dotRoundness(validated.shape, validated.cornerRadius);
      const channels = {} as Record<CMYKChannel, CMYKChannelResult>;
      for (const ch of CMYK_CHANNELS) {
        const key = channelKey(validated.channels[ch], validated.stepBasis, roundness);
        const cached = channelCacheRef.current[ch];

        if (cached && cached.key === key) {
          channels[ch] = cached.result;
          continue;
        }

        const result = computeHalftoneCMYKChannel(
          cache.pixels, cache.workWidth, cache.workHeight, cache.scale,
          ch, validated.channels[ch], validated.stepBasis,
          validated.shape, validated.cornerRadius
        );
        channelCacheRef.current[ch] = { key, result };
        channels[ch] = result;
      }

      return { channels, naturalWidth, naturalHeight };
    },
    // `shape` and `cornerRadius` are here because dots are sized so every
    // shape covers the same area for the same ink — a square needs a smaller
    // half-size than a circle. The per-channel key above skips the recompute
    // when the change can't affect sizes.
    [
      config.step,
      config.density,
      config.shape,
      config.cornerRadius,
      config.stepBasis,
      JSON.stringify(config.channels),
    ]
  );

  const totalCircleCount = state.result
    ? CMYK_CHANNELS.reduce((sum, ch) => sum + state.result!.channels[ch].circles.length, 0)
    : 0;

  return {
    status: state.status,
    error: state.error,
    channels: state.result?.channels ?? null,
    naturalWidth: state.result?.naturalWidth ?? null,
    naturalHeight: state.result?.naturalHeight ?? null,
    totalCircleCount,
  };
}
