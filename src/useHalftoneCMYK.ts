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
  computeHalftoneCMYK,
  CMYK_CHANNELS,
} from './core';
import { useHalftoneEngine } from './useHalftoneEngine';

interface Result {
  channels: Record<CMYKChannel, CMYKChannelResult>;
  naturalWidth: number;
  naturalHeight: number;
}

export function useHalftoneCMYK(
  src: string,
  config: Partial<HalftoneCMYKConfig> & { crossOrigin?: string | null } = {}
): UseHalftoneCMYKResult {
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

      const { channels } = computeHalftoneCMYK(
        cache.pixels, cache.workWidth, cache.workHeight, cache.scale, config
      );

      return { channels, naturalWidth, naturalHeight };
    },
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
