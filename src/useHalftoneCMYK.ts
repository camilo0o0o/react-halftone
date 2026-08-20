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

/** Everything a channel's dots depend on, beyond the pixel buffer itself. */
function channelKey(
  chConfig: { angle: number; step: number; density: number },
  stepBasis: string
): string {
  return `${chConfig.angle}|${chConfig.step}|${chConfig.density}|${stepBasis}`;
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

      const channels = {} as Record<CMYKChannel, CMYKChannelResult>;
      for (const ch of CMYK_CHANNELS) {
        const key = channelKey(validated.channels[ch], validated.stepBasis);
        const cached = channelCacheRef.current[ch];

        if (cached && cached.key === key) {
          channels[ch] = cached.result;
          continue;
        }

        const result = computeHalftoneCMYKChannel(
          cache.pixels, cache.workWidth, cache.workHeight, cache.scale,
          ch, validated.channels[ch], validated.stepBasis
        );
        channelCacheRef.current[ch] = { key, result };
        channels[ch] = result;
      }

      return { channels, naturalWidth, naturalHeight };
    },
    // `shape` and `cornerRadius` are deliberately absent: computeHalftoneCMYK
    // produces circle data only and never reads them (the canvas applies them
    // at draw time), so including them would recompute all four channels on a
    // shape change.
    [
      config.step,
      config.density,
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
