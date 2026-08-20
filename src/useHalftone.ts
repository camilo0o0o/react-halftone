import type { HalftoneConfig, UseHalftoneResult, Circle } from './types';
import { validateConfig, calculateGrid, computeDownsampleScale, computeHalftone } from './core';
import { useHalftoneEngine } from './useHalftoneEngine';

interface Result {
  circles: Circle[];
  pathData: string;
  naturalWidth: number;
  naturalHeight: number;
}

export function useHalftone(
  src: string,
  config: Partial<HalftoneConfig> & { crossOrigin?: string | null } = {}
): UseHalftoneResult {
  const state = useHalftoneEngine<Result>(
    src,
    config.crossOrigin,
    (loaded, getPixels) => {
      const validated = validateConfig(config);
      const { naturalWidth, naturalHeight } = loaded;

      const { stepPx } = calculateGrid(
        naturalWidth, naturalHeight, validated.step, validated.density, validated.stepBasis
      );
      const cache = getPixels(computeDownsampleScale(stepPx));

      const { circles, pathData } = computeHalftone(
        cache.pixels, cache.workWidth, cache.workHeight, cache.scale, config
      );

      return { circles, pathData, naturalWidth, naturalHeight };
    },
    // `color` is deliberately absent: computeHalftone never reads it (the
    // renderers apply it at draw time), so including it would recompute every
    // dot on a color change.
    [
      config.step,
      config.density,
      config.invert,
      config.shape,
      config.cornerRadius,
      config.stepBasis,
    ]
  );

  return {
    status: state.status,
    error: state.error,
    circles: state.result?.circles ?? null,
    pathData: state.result?.pathData ?? null,
    naturalWidth: state.result?.naturalWidth ?? null,
    naturalHeight: state.result?.naturalHeight ?? null,
    circleCount: state.result?.circles?.length ?? 0,
  };
}
