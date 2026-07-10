import type { HalftoneProps } from './types';
import { calculateDisplayDimensions } from './core';
import { useHalftone } from './useHalftone';
import { resolveFallback, useOnError } from './fallback';

export function Halftone({
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
}: HalftoneProps): JSX.Element | null {
  const { status, error, pathData, naturalWidth, naturalHeight } =
    useHalftone(src, { step, density, color, invert, shape, cornerRadius, stepBasis, crossOrigin });

  useOnError(status, error, onError);

  if (status !== 'ready' || !pathData || naturalWidth === null || naturalHeight === null) {
    return (resolveFallback(fallback, status, error) as JSX.Element | null) ?? null;
  }

  const dims = calculateDisplayDimensions(naturalWidth, naturalHeight, propWidth, propHeight);
  const fillColor = color ?? '#000000';

  return (
    <svg
      viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
      width={dims.width}
      height={dims.height}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path d={pathData} fill={fillColor} />
    </svg>
  );
}
