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
 * Status of halftone generation
 */
export type HalftoneStatus = 'idle' | 'loading' | 'processing' | 'ready' | 'error';

/**
 * Return type for the useHalftone hook
 */
export interface UseHalftoneResult {
  status: HalftoneStatus;
  error: Error | null;
  circles: Circle[] | null;
  pathData: string | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
  circleCount: number;
}

export type HalftoneCanvasProps = HalftoneProps;

/**
 * CMYK channel identifier
 */
export type CMYKChannel = 'c' | 'm' | 'y' | 'k';

/**
 * Configuration for a single CMYK channel (all fields optional, falls back to global defaults)
 */
export interface CMYKChannelConfig {
  /** Rotation angle in degrees */
  angle?: number;
  /** Grid spacing override */
  step?: number;
  /** Max dot size override */
  density?: number;
  /** Dot shape override */
  shape?: ShapeType;
  /** Corner radius override for square shapes */
  cornerRadius?: number;
}

/**
 * Per-channel configuration overrides
 */
export interface CMYKChannelsConfig {
  c?: CMYKChannelConfig;
  m?: CMYKChannelConfig;
  y?: CMYKChannelConfig;
  k?: CMYKChannelConfig;
}

/**
 * Props for the HalftoneCMYK component
 */
export interface HalftoneCMYKProps {
  /** Image source URL */
  src: string;
  /** Grid spacing percentage (0.1-50) — global default */
  step?: number;
  /** Maximum dot size percentage (0-100) — global default */
  density?: number;
  /** Dot shape — global default */
  shape?: ShapeType;
  /** Corner radius percentage for square shapes — global default */
  cornerRadius?: number;
  /** Dimension used to calculate step size */
  stepBasis?: 'min' | 'width';
  /** Per-channel config overrides */
  channels?: CMYKChannelsConfig;
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
 * Imperative handle for HalftoneCMYK canvas export
 */
export interface HalftoneCMYKHandle {
  toDataURL: (type?: string, quality?: number) => string;
  toBlob: (callback: BlobCallback, type?: string, quality?: number) => void;
}

/**
 * Result data for a single CMYK channel
 */
export interface CMYKChannelResult {
  circles: Circle[];
  angle: number;
  color: string;
}

/**
 * Return type for the useHalftoneCMYK hook
 */
export interface UseHalftoneCMYKResult {
  status: HalftoneStatus;
  error: Error | null;
  channels: Record<CMYKChannel, CMYKChannelResult> | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
  totalCircleCount: number;
}
