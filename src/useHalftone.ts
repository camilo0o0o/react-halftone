import { useState, useEffect, useRef } from 'react';
import type { HalftoneConfig, HalftoneStatus, UseHalftoneResult, Circle } from './types';
import { validateConfig, calculateGrid, computeDownsampleScale, computeHalftone } from './core';
import { loadImageElement, extractPixels } from './getPixels';
import type { LoadedImage, ExtractedPixels } from './getPixels';

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
  config: Partial<HalftoneConfig> & { crossOrigin?: string | null } = {}
): UseHalftoneResult {
  const crossOrigin = config.crossOrigin ?? 'anonymous';
  const [state, setState] = useState<State>(IDLE_STATE);
  const loadedRef = useRef<LoadedImage | null>(null);
  const pixelCacheRef = useRef<ExtractedPixels | null>(null);
  const [loadedVersion, setLoadedVersion] = useState(0);

  // Effect A — load/decode the image. Keyed on `src` only, so dragging config
  // sliders never re-fetches or re-decodes the bitmap.
  useEffect(() => {
    if (!src) {
      loadedRef.current = null;
      pixelCacheRef.current = null;
      setState(IDLE_STATE);
      return;
    }

    let cancelled = false;
    loadedRef.current = null;
    pixelCacheRef.current = null;
    // Drop the old result: it belongs to the previous src, so keeping it on
    // screen would show the wrong image. Retention is only for same-src
    // recomputes (effect B).
    setState({ status: 'loading', error: null, result: null });

    const image = loadImageElement(
      src,
      (loaded) => {
        if (cancelled) return;
        loadedRef.current = loaded;
        pixelCacheRef.current = null;
        setLoadedVersion((v) => v + 1);
      },
      (err) => {
        if (cancelled) return;
        setState({ status: 'error', error: err, result: null });
      },
      crossOrigin
    );

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [src, crossOrigin]);

  // Effect B — compute from the cached image. Reuses the extracted pixel buffer
  // whenever the downsample scale is unchanged, and keeps the previous result
  // on screen while recomputing so the output never unmounts mid-drag.
  useEffect(() => {
    const loaded = loadedRef.current;
    if (!loaded) return;

    let cancelled = false;
    setState((prev) => ({ status: 'processing', error: null, result: prev.result }));

    const raf = requestAnimationFrame(() => {
      if (cancelled) return;

      try {
        const validated = validateConfig(config);
        const { naturalWidth, naturalHeight } = loaded;

        const { stepPx } = calculateGrid(
          naturalWidth, naturalHeight, validated.step, validated.density, validated.stepBasis
        );
        const scale = computeDownsampleScale(stepPx);

        let cache = pixelCacheRef.current;
        if (!cache || cache.scale !== scale) {
          cache = extractPixels(loaded.image, naturalWidth, naturalHeight, scale);
          pixelCacheRef.current = cache;
        }

        const { circles, pathData } = computeHalftone(
          cache.pixels, cache.workWidth, cache.workHeight, scale, config
        );

        setState({
          status: 'ready',
          error: null,
          result: { circles, pathData, naturalWidth, naturalHeight },
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', error: new Error(`${CORS_HINT}: ${message}`), result: null });
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedVersion, config.step, config.density, config.color, config.invert, config.shape, config.cornerRadius, config.stepBasis]);

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
