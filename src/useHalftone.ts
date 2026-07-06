import { useState, useEffect } from 'react';
import type { HalftoneConfig, HalftoneStatus, UseHalftoneResult, Circle } from './types';
import { validateConfig, calculateGrid, computeDownsampleScale, computeHalftone } from './core';

interface State {
  status: HalftoneStatus;
  error: Error | null;
  result: {
    circles: Circle[];
    pathData: string;
    naturalWidth: number;
    naturalHeight: number;
  } | null;
}

const IDLE_STATE: State = { status: 'idle', error: null, result: null };

const CORS_HINT =
  'Failed to process image (this often means a cross-origin image without CORS headers)';

export function useHalftone(
  src: string,
  config: Partial<HalftoneConfig> = {}
): UseHalftoneResult {
  const [state, setState] = useState<State>(IDLE_STATE);

  useEffect(() => {
    if (!src) {
      setState(IDLE_STATE);
      return;
    }

    let cancelled = false;

    setState({ status: 'loading', error: null, result: null });

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;

      setState({ status: 'processing', error: null, result: null });

      requestAnimationFrame(() => {
        if (cancelled) return;

        try {
          const validated = validateConfig(config);
          const { naturalWidth, naturalHeight } = img;

          // Decide the work resolution here (adapter concern); the pure core
          // then computes against whatever pixel buffer we hand it.
          const fullGrid = calculateGrid(
            naturalWidth, naturalHeight, validated.step, validated.density, validated.stepBasis
          );
          const scale = computeDownsampleScale(fullGrid.stepPx);
          const workWidth = Math.round(naturalWidth / scale);
          const workHeight = Math.round(naturalHeight / scale);

          const canvas = document.createElement('canvas');
          canvas.width = workWidth;
          canvas.height = workHeight;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, workWidth, workHeight);
          const pixels = ctx.getImageData(0, 0, workWidth, workHeight).data;

          const { circles, pathData } = computeHalftone(pixels, workWidth, workHeight, scale, config);

          setState({
            status: 'ready',
            error: null,
            result: { circles, pathData, naturalWidth, naturalHeight },
          });
        } catch (err) {
          if (cancelled) return;
          const message = err instanceof Error ? err.message : String(err);
          setState({
            status: 'error',
            error: new Error(`${CORS_HINT}: ${message}`),
            result: null,
          });
        }
      });
    };

    img.onerror = () => {
      if (cancelled) return;
      setState({ status: 'error', error: new Error(`Failed to load image: ${src}`), result: null });
    };

    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, config.step, config.density, config.color, config.invert, config.shape, config.cornerRadius, config.stepBasis]);

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
