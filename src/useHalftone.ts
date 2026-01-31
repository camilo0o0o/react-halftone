import { useState, useEffect } from 'react';
import type { HalftoneConfig, UseHalftoneResult } from './types';
import { validateConfig, calculateGrid, generateCircles, generatePathData } from './core';

export function useHalftone(
  src: string,
  config: Partial<HalftoneConfig> = {}
): UseHalftoneResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<{
    circles: import('./types').Circle[];
    pathData: string;
    naturalWidth: number;
    naturalHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(null);
      setResult(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);
    setResult(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;

      const validated = validateConfig(config);
      const { naturalWidth, naturalHeight } = img;

      const grid = calculateGrid(naturalWidth, naturalHeight, validated.step, validated.density);

      if (grid.numCols < 1 || grid.numRows < 1) {
        setResult({
          circles: [],
          pathData: '',
          naturalWidth,
          naturalHeight,
        });
        setLoading(false);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const circles = generateCircles(ctx, grid);
      const pathData = generatePathData(circles);

      setResult({ circles, pathData, naturalWidth, naturalHeight });
      setLoading(false);
    };

    img.onerror = () => {
      if (cancelled) return;
      setError(new Error(`Failed to load image: ${src}`));
      setLoading(false);
    };

    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, config.step, config.density, config.color]);

  return {
    loading,
    error,
    circles: result?.circles ?? null,
    pathData: result?.pathData ?? null,
    naturalWidth: result?.naturalWidth ?? null,
    naturalHeight: result?.naturalHeight ?? null,
    circleCount: result?.circles?.length ?? 0,
  };
}
