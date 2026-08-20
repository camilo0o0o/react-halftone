import { useState, useEffect, useRef } from 'react';
import type { HalftoneStatus } from './types';
import { loadImageElement, extractPixels } from './getPixels';
import type { LoadedImage, ExtractedPixels } from './getPixels';

export interface EngineState<TResult> {
  status: HalftoneStatus;
  error: Error | null;
  result: TResult | null;
}

/**
 * Fetch the source pixels at `scale`, reusing the cached buffer when the scale
 * is unchanged. Call this once the compute step knows its work resolution.
 */
export type GetPixels = (scale: number) => ExtractedPixels;

export type EngineCompute<TResult> = (loaded: LoadedImage, getPixels: GetPixels) => TResult;

const CORS_HINT =
  'Failed to process image (this often means a cross-origin image without CORS headers)';

/**
 * Shared machinery behind `useHalftone` and `useHalftoneCMYK`: load the image
 * once per `src`, cache the decoded bitmap and the extracted pixel buffer, and
 * drive the idle → loading → processing → ready state machine.
 *
 * Callers supply only `compute` — the part that actually differs between
 * monochrome and CMYK — and the `deps` that should trigger a recompute. Keep
 * `deps` limited to values `compute` genuinely reads: anything else recomputes
 * the whole image for nothing.
 */
export function useHalftoneEngine<TResult>(
  src: string,
  crossOrigin: string | null | undefined,
  compute: EngineCompute<TResult>,
  deps: unknown[]
): EngineState<TResult> {
  // `??` would swallow an explicit null, which is the documented way to opt
  // out of the crossorigin attribute entirely.
  const resolvedCrossOrigin = crossOrigin === undefined ? 'anonymous' : crossOrigin;

  const [state, setState] = useState<EngineState<TResult>>({
    status: 'idle',
    error: null,
    result: null,
  });
  const loadedRef = useRef<LoadedImage | null>(null);
  const pixelCacheRef = useRef<ExtractedPixels | null>(null);
  const [loadedVersion, setLoadedVersion] = useState(0);

  // `compute` is an inline closure, so its identity changes every render.
  // Hold it in a ref and let `deps` alone decide when to recompute. Declared
  // before the compute effect so it is refreshed first on each commit.
  const computeRef = useRef(compute);
  useEffect(() => {
    computeRef.current = compute;
  });

  // Load/decode the image. Keyed on `src` only, so dragging config sliders
  // never re-fetches or re-decodes the bitmap.
  useEffect(() => {
    if (!src) {
      loadedRef.current = null;
      pixelCacheRef.current = null;
      setState({ status: 'idle', error: null, result: null });
      return;
    }

    let cancelled = false;
    loadedRef.current = null;
    pixelCacheRef.current = null;
    // Drop the old result: it belongs to the previous src, so keeping it on
    // screen would show the wrong image. Retention is only for same-src
    // recomputes, below.
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
      resolvedCrossOrigin
    );

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [src, resolvedCrossOrigin]);

  // Recompute from the cached image. Keeps the previous result on screen while
  // working, so the output never unmounts mid-drag.
  useEffect(() => {
    const loaded = loadedRef.current;
    if (!loaded) return;

    let cancelled = false;
    setState((prev) => ({ status: 'processing', error: null, result: prev.result }));

    const raf = requestAnimationFrame(() => {
      if (cancelled) return;

      try {
        const getPixels: GetPixels = (scale) => {
          let cache = pixelCacheRef.current;
          if (!cache || cache.scale !== scale) {
            cache = extractPixels(loaded.image, loaded.naturalWidth, loaded.naturalHeight, scale);
            pixelCacheRef.current = cache;
          }
          return cache;
        };

        const result = computeRef.current(loaded, getPixels);
        setState({ status: 'ready', error: null, result });
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
  }, [loadedVersion, ...deps]);

  return state;
}
