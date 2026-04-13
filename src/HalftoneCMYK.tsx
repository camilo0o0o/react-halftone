import { forwardRef, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import type { HalftoneCMYKProps, HalftoneCMYKHandle, CMYKChannel } from './types';
import { calculateDisplayDimensions } from './core';
import { useHalftoneCMYK } from './useHalftoneCMYK';

const DRAW_ORDER: CMYKChannel[] = ['c', 'm', 'y', 'k'];

export const HalftoneCMYK = forwardRef<HalftoneCMYKHandle, HalftoneCMYKProps>(
  function HalftoneCMYK(
    {
      src,
      step,
      density,
      shape,
      cornerRadius,
      stepBasis,
      channels: channelsProp,
      width: propWidth,
      height: propHeight,
      className,
      style,
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
    }), []);

    const { loading, error, channels, naturalWidth, naturalHeight } =
      useHalftoneCMYK(src, { step, density, shape, cornerRadius, stepBasis, channels: channelsProp });

    const dotShape = shape ?? 'circle';
    const cr = cornerRadius ?? 0;

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !channels) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // White background is required for multiply blending
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'multiply';

      for (const ch of DRAW_ORDER) {
        const { circles, color } = channels[ch];
        if (circles.length === 0) continue;

        // Resolve per-channel shape (fall back to global)
        const chShape = dotShape;
        const chCr = cr;

        ctx.fillStyle = color;

        if (chShape === 'circle') {
          ctx.beginPath();
          for (const c of circles) {
            ctx.moveTo(c.x + c.r, c.y);
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          }
          ctx.fill();
        } else if (chCr <= 0) {
          for (const c of circles) {
            ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
          }
        } else {
          for (const c of circles) {
            const radius = c.r * (chCr / 100);
            const side = c.r * 2;
            ctx.beginPath();
            ctx.roundRect(c.x - c.r, c.y - c.r, side, side, radius);
            ctx.fill();
          }
        }
      }

      ctx.globalCompositeOperation = 'source-over';
    }, [channels, dotShape, cr]);

    if (loading || error || !channels || naturalWidth === null || naturalHeight === null) {
      return null;
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
