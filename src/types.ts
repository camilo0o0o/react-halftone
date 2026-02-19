import type { CSSProperties } from 'react';

/**
 * Shape type for halftone dots
 */
export type ShapeType = 'circle' | 'square';

/**
 * Configuration for halftone generation
 */
export interface HalftoneConfig {
  /** Grid spacing as percentage of smaller dimension (0.1-50) */
  step: number;

  /** Maximum circle size as percentage (0-100) */
  density: number;

  /** Fill color for circles (hex format) */
  color: string;

  /** Invert brightness mapping (for dark backgrounds) */
  invert: boolean;

  /** Shape of halftone dots */
  shape: ShapeType;

  /** Corner radius percentage for square shapes (0-100) */
  cornerRadius: number;

  /** Dimension used to calculate step size: 'min' (smaller dimension) or 'width' (image width) */
  stepBasis: 'min' | 'width';
}

/**
 * Props for the Halftone React component
 */
export interface HalftoneProps {
  /** Image source URL */
  src: string;

  /** Fill color for circles */
  color?: string;

  /** Grid spacing percentage (0.1-50) */
  step?: number;

  /** Maximum circle size percentage (0-100) */
  density?: number;

  /** Invert brightness mapping (for dark backgrounds) */
  invert?: boolean;

  /** Shape of halftone dots */
  shape?: ShapeType;

  /** Corner radius percentage for square shapes (0-100) */
  cornerRadius?: number;

  /** Dimension used to calculate step size: 'min' (smaller dimension) or 'width' (image width) */
  stepBasis?: 'min' | 'width';

  /** Display width in pixels */
  width?: number;

  /** Display height in pixels */
  height?: number;

  /** CSS class name */
  className?: string;

  /** Inline styles */
  style?: CSSProperties;
}

/**
 * Circle data for SVG generation
 */
export interface Circle {
  /** Center X coordinate */
  x: number;

  /** Center Y coordinate */
  y: number;

  /** Radius */
  r: number;
}

/**
 * Grid calculation result
 */
export interface GridConfig {
  /** Step size in pixels */
  stepPx: number;

  /** Maximum circle radius */
  maxRadius: number;

  /** Number of columns */
  numCols: number;

  /** Number of rows */
  numRows: number;

  /** Starting X position */
  startX: number;

  /** Starting Y position */
  startY: number;
}

/**
 * Display dimensions
 */
export interface DisplayDimensions {
  /** Display width */
  width: number;

  /** Display height */
  height: number;
}

/**
 * Return type for the useHalftone hook
 */
export interface UseHalftoneResult {
  loading: boolean;
  error: Error | null;
  circles: Circle[] | null;
  pathData: string | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
  circleCount: number;
}
