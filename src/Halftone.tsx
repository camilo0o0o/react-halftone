import { useState, useEffect, useRef } from 'react';
import type { HalftoneProps } from './types';
import { validateConfig, calculateDisplayDimensions, generateHalftone } from './core';

type State = 'idle' | 'loading' | 'rendered' | 'error';

export function Halftone({
  src,
  color,
  step,
  density,
  width: propWidth,
  height: propHeight,
  className,
  style,
}: HalftoneProps): JSX.Element | null {
  const [state, setState] = useState<State>('idle');
  const [svgData, setSvgData] = useState<{
    pathData: string;
    viewBox: string;
    displayWidth: number;
    displayHeight: number;
    fillColor: string;
  } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setState('idle');
      setSvgData(null);
      return;
    }

    setState('loading');
    setSvgData(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    imageRef.current = img;

    img.onload = () => {
      if (imageRef.current !== img) return;

      const config = validateConfig({ step, density, color });
      const result = generateHalftone(img, config);
      const dims = calculateDisplayDimensions(
        img.naturalWidth,
        img.naturalHeight,
        propWidth,
        propHeight
      );

      setSvgData({
        pathData: result.pathData,
        viewBox: result.viewBox,
        displayWidth: dims.width,
        displayHeight: dims.height,
        fillColor: config.color,
      });
      setState('rendered');
    };

    img.onerror = () => {
      if (imageRef.current !== img) return;
      setState('error');
      setSvgData(null);
    };

    img.src = src;

    return () => {
      imageRef.current = null;
    };
  }, [src, color, step, density, propWidth, propHeight]);

  if (state !== 'rendered' || !svgData) {
    return null;
  }

  return (
    <svg
      viewBox={svgData.viewBox}
      width={svgData.displayWidth}
      height={svgData.displayHeight}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {svgData.pathData && <path d={svgData.pathData} fill={svgData.fillColor} />}
    </svg>
  );
}
