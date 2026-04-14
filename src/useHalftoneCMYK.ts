import { useState, useEffect } from 'react';
import type { HalftoneCMYKProps, HalftoneStatus, UseHalftoneCMYKResult, CMYKChannel, CMYKChannelResult } from './types';
import {
  validateCMYKConfig,
  calculateGrid,
  generateRotatedGridPoints,
  generateChannelCircles,
  computeDownsampleScale,
  scaleCircles,
  CMYK_CHANNEL_COLORS,
} from './core';

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

export function useHalftoneCMYK(
  src: string,
  config: Partial<HalftoneCMYKProps> = {}
): UseHalftoneCMYKResult {
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

        const validated = validateCMYKConfig(config);
        const { naturalWidth, naturalHeight } = img;

        // Find the smallest stepPx across all channels to determine downsample scale
        let minStepPx = Infinity;
        for (const ch of CHANNEL_KEYS) {
          const chConfig = validated.channels[ch];
          const { stepPx } = calculateGrid(
            naturalWidth, naturalHeight,
            chConfig.step, chConfig.density,
            validated.stepBasis
          );
          if (stepPx < minStepPx) minStepPx = stepPx;
        }

        const scale = computeDownsampleScale(minStepPx);
        const workWidth = Math.round(naturalWidth / scale);
        const workHeight = Math.round(naturalHeight / scale);

        const canvas = document.createElement('canvas');
        canvas.width = workWidth;
        canvas.height = workHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, workWidth, workHeight);
        const pixels = ctx.getImageData(0, 0, workWidth, workHeight).data;

        const channels = {} as Record<CMYKChannel, CMYKChannelResult>;

        for (const ch of CHANNEL_KEYS) {
          const chConfig = validated.channels[ch];
          const { stepPx, maxRadius } = calculateGrid(
            workWidth, workHeight,
            chConfig.step, chConfig.density,
            validated.stepBasis
          );

          const gridPoints = generateRotatedGridPoints(
            workWidth, workHeight,
            stepPx, chConfig.angle
          );

          const rawCircles = generateChannelCircles(
            pixels, workWidth, workHeight,
            gridPoints, maxRadius, ch
          );

          channels[ch] = {
            circles: scaleCircles(rawCircles, scale),
            angle: chConfig.angle,
            color: CMYK_CHANNEL_COLORS[ch],
          };
        }

        setState({
          status: 'ready',
          error: null,
          result: { channels, naturalWidth, naturalHeight },
        });
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
  }, [src, config.step, config.density, config.shape, config.cornerRadius, config.stepBasis, JSON.stringify(config.channels)]);

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
