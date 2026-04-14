import type { HalftoneProps } from './types';
import { calculateDisplayDimensions } from './core';
import { useHalftone } from './useHalftone';

export function Halftone({
  src,
  color,
  step,
  density,
  invert,
  shape,
  cornerRadius,
  stepBasis,
  width: propWidth,
  height: propHeight,
  className,
  style,
}: HalftoneProps): JSX.Element | null {
  const { status, pathData, naturalWidth, naturalHeight } =
    useHalftone(src, { step, density, color, invert, shape, cornerRadius, stepBasis });

  if (status !== 'ready' || !pathData || naturalWidth === null || naturalHeight === null) {
    return null;
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
