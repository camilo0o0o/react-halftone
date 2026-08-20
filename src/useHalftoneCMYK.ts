import { useState, useEffect, useRef } from 'react';
import type {
  HalftoneCMYKConfig,
  HalftoneStatus,
  UseHalftoneCMYKResult,
  CMYKChannel,
  CMYKChannelResult,
} from './types';
import {
  validateCMYKConfig,
  calculateGrid,
  computeDownsampleScale,
  computeHalftoneCMYK,
} from './core';
import { loadImageElement, extractPixels } from './getPixels';
import type { LoadedImage, ExtractedPixels } from './getPixels';

const CHANNEL_KEYS: CMYKChannel[] = ['c', 'm', 'y', 'k'];

interface State {
  status: HalftoneStatus;
  error: Error | null;
  result: {
    channels: Record<CMYKChannel, CMYKChannelResult>;
    naturalWidth: number;
    naturalHeight: number;
  } | null;
}

const IDLE_STATE: State = { status: 'idle', error: null, result: null };

const CORS_HINT =
  'Failed to process image (this often means a cross-origin image without CORS headers)';

export function useHalftoneCMYK(
  src: string,
  config: Partial<HalftoneCMYKConfig> & { crossOrigin?: string | null } = {}
): UseHalftoneCMYKResult {
  // `??` would swallow an explicit null, which is the documented way to opt
  // out of the crossorigin attribute entirely.
  const crossOrigin = config.crossOrigin === undefined ? 'anonymous' : config.crossOrigin;
  const [state, setState] = useState<State>(IDLE_STATE);
  const loadedRef = useRef<LoadedImage | null>(null);
  const pixelCacheRef = useRef<ExtractedPixels | null>(null);
  const [loadedVersion, setLoadedVersion] = useState(0);

  // Effect A — load/decode once per src.
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

  // Effect B — compute from the cached image. Because the pixel buffer is keyed
  // on the downsample scale (driven by step/density, not angle), dragging a
  // channel angle reuses the cached buffer and skips getImageData entirely.
  useEffect(() => {
    const loaded = loadedRef.current;
    if (!loaded) return;

    let cancelled = false;
    setState((prev) => ({ status: 'processing', error: null, result: prev.result }));

    const raf = requestAnimationFrame(() => {
      if (cancelled) return;

      try {
        const validated = validateCMYKConfig(config);
        const { naturalWidth, naturalHeight } = loaded;

        // The finest channel (smallest stepPx) drives the work resolution.
        let minStepPx = Infinity;
        for (const ch of CHANNEL_KEYS) {
          const chConfig = validated.channels[ch];
          const { stepPx } = calculateGrid(
            naturalWidth, naturalHeight, chConfig.step, chConfig.density, validated.stepBasis
          );
          if (stepPx < minStepPx) minStepPx = stepPx;
        }
        const scale = computeDownsampleScale(minStepPx);

        let cache = pixelCacheRef.current;
        if (!cache || cache.scale !== scale) {
          cache = extractPixels(loaded.image, naturalWidth, naturalHeight, scale);
          pixelCacheRef.current = cache;
        }

        const { channels } = computeHalftoneCMYK(
          cache.pixels, cache.workWidth, cache.workHeight, scale, config
        );

        setState({
          status: 'ready',
          error: null,
          result: { channels, naturalWidth, naturalHeight },
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
  }, [loadedVersion, config.step, config.density, config.shape, config.cornerRadius, config.stepBasis, JSON.stringify(config.channels)]);

  const totalCircleCount = state.result
    ? CHANNEL_KEYS.reduce((sum, ch) => sum + state.result!.channels[ch].circles.length, 0)
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
