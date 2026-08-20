import { forwardRef, useRef, useEffect, useImperativeHandle } from 'react';
import type { ReactElement } from 'react';
import type { HalftoneCMYKProps, HalftoneCMYKHandle, CMYKChannel } from './types';
import { calculateDisplayDimensions } from './core';
import { useHalftoneCMYK } from './useHalftoneCMYK';
import { resolveFallback, useOnError } from './fallback';

const DRAW_ORDER: CMYKChannel[] = ['c', 'm', 'y', 'k'];

export const HalftoneCMYKCanvas = forwardRef<HalftoneCMYKHandle, HalftoneCMYKProps>(
  function HalftoneCMYKCanvas(
    {
      src,
      step,
      density,
      shape,
      cornerRadius,
      stepBasis,
      crossOrigin,
      channels: channelsProp,
      width: propWidth,
      height: propHeight,
      className,
      style,
      fallback,
      onError,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useImperativeHandle(ref, () => ({
      toDataURL: (type?: string, quality?: number) => {
        if (!canvasRef.current) throw new Error('Canvas not available');
        return canvasRef.current.toDataURL(type, quality);
      },
      toBlob: (callback: BlobCallback, type?: string, quality?: number) => {
        if (!canvasRef.current) throw new Error('Canvas not available');
        canvasRef.current.toBlob(callback, type, quality);
      },
      getCanvas: () => canvasRef.current,
    }), []);

    const { status, error, channels, naturalWidth, naturalHeight } =
      useHalftoneCMYK(src, { step, density, shape, cornerRadius, stepBasis, crossOrigin, channels: channelsProp });

    useOnError(status, error, onError);

    const dotShape = shape ?? 'circle';
    const cr = cornerRadius ?? 0;

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !channels) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // White background is required for multiply blending.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'multiply';

      for (const ch of DRAW_ORDER) {
        const { circles, color } = channels[ch];
        if (circles.length === 0) continue;

        ctx.fillStyle = color;
        ctx.beginPath();

        if (dotShape === 'circle') {
          for (const c of circles) {
            ctx.moveTo(c.x + c.r, c.y);
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          }
        } else if (cr <= 0) {
          for (const c of circles) {
            ctx.rect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
          }
        } else {
          for (const c of circles) {
            const radius = c.r * (cr / 100);
            ctx.roundRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2, radius);
          }
        }

        // One fill per channel keeps overlapping antialiased edges from
        // multiplying against themselves.
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
    }, [channels, dotShape, cr]);

    // Gate on the result, not the status: during a config recompute the hook
    // retains the previous result, so the canvas stays mounted (no flicker,
    // and the imperative toDataURL/toBlob handle keeps working mid-drag).
    if (channels === null || naturalWidth === null || naturalHeight === null) {
      return (resolveFallback(fallback, status, error) as ReactElement | null) ?? null;
    }

    const dims = calculateDisplayDimensions(naturalWidth, naturalHeight, propWidth, propHeight);

    return (
      <canvas
        ref={canvasRef}
        width={naturalWidth}
        height={naturalHeight}
        style={{ ...style, width: dims.width, height: dims.height }}
        className={className}
      />
    );
  }
);
