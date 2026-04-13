import { useState, useEffect } from 'react';
import type { HalftoneCMYKProps, UseHalftoneCMYKResult, CMYKChannel, CMYKChannelResult } from './types';
import {
  validateCMYKConfig,
  calculateGrid,
  generateRotatedGridPoints,
  generateChannelCircles,
  CMYK_CHANNEL_COLORS,
} from './core';

const CHANNEL_KEYS: CMYKChannel[] = ['c', 'm', 'y', 'k'];

export function useHalftoneCMYK(
  src: string,
  config: Partial<HalftoneCMYKProps> = {}
): UseHalftoneCMYKResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<{
    channels: Record<CMYKChannel, CMYKChannelResult>;
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

      const validated = validateCMYKConfig(config);
      const { naturalWidth, naturalHeight } = img;

      const canvas = document.createElement('canvas');
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, naturalWidth, naturalHeight).data;

      const channels = {} as Record<CMYKChannel, CMYKChannelResult>;

      for (const ch of CHANNEL_KEYS) {
        const chConfig = validated.channels[ch];
        const { stepPx, maxRadius } = calculateGrid(
          naturalWidth, naturalHeight,
          chConfig.step, chConfig.density,
          validated.stepBasis
        );

        const gridPoints = generateRotatedGridPoints(
          naturalWidth, naturalHeight,
          stepPx, chConfig.angle
        );

        const circles = generateChannelCircles(
          pixels, naturalWidth, naturalHeight,
          gridPoints, maxRadius, ch
        );

        channels[ch] = {
          circles,
          angle: chConfig.angle,
          color: CMYK_CHANNEL_COLORS[ch],
        };
      }

      setResult({ channels, naturalWidth, naturalHeight });
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
  }, [src, config.step, config.density, config.shape, config.cornerRadius, config.stepBasis, JSON.stringify(config.channels)]);

  const totalCircleCount = result
    ? CHANNEL_KEYS.reduce((sum, ch) => sum + result.channels[ch].circles.length, 0)
    : 0;

  return {
    loading,
    error,
    channels: result?.channels ?? null,
    naturalWidth: result?.naturalWidth ?? null,
    naturalHeight: result?.naturalHeight ?? null,
    totalCircleCount,
  };
}
