import { forwardRef, useRef, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import type { HalftoneProps } from './types';
import { calculateDisplayDimensions } from './core';
import { useHalftone } from './useHalftone';
import { resolveFallback, useOnError } from './fallback';

export const HalftoneCanvas = forwardRef<HTMLCanvasElement, HalftoneProps>(
  function HalftoneCanvas(
    {
      src,
      color,
      step,
      density,
      invert,
      shape,
      cornerRadius,
      stepBasis,
      crossOrigin,
      width: propWidth,
      height: propHeight,
      className,
      style,
      fallback,
      onError,
    },
    forwardedRef
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const mergedRef = useCallback(
      (node: HTMLCanvasElement | null) => {
        canvasRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    const { status, error, circles, naturalWidth, naturalHeight } =
      useHalftone(src, { step, density, color, invert, shape, cornerRadius, stepBasis, crossOrigin });

    useOnError(status, error, onError);

    const fillColor = color ?? '#000000';

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !circles || circles.length === 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = fillColor;

      const dotShape = shape ?? 'circle';
      const cr = cornerRadius ?? 0;

      if (dotShape === 'circle') {
        ctx.beginPath();
        for (const c of circles) {
          ctx.moveTo(c.x + c.r, c.y);
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        }
        ctx.fill();
      } else if (cr <= 0) {
        for (const c of circles) {
          ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
        }
      } else {
        for (const c of circles) {
          const radius = c.r * (cr / 100);
          const side = c.r * 2;
          ctx.beginPath();
          ctx.roundRect(c.x - c.r, c.y - c.r, side, side, radius);
          ctx.fill();
        }
      }
    }, [circles, fillColor, shape, cornerRadius]);

    if (status !== 'ready' || !circles || circles.length === 0 || naturalWidth === null || naturalHeight === null) {
      return (resolveFallback(fallback, status, error) as ReactElement | null) ?? null;
    }

    const dims = calculateDisplayDimensions(naturalWidth, naturalHeight, propWidth, propHeight);

    return (
      <canvas
        ref={mergedRef}
        width={naturalWidth}
        height={naturalHeight}
        style={{ ...style, width: dims.width, height: dims.height }}
        className={className}
      />
    );
  }
);
