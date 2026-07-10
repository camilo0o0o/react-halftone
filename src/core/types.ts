/**
 * Pure, environment-agnostic types for halftone computation.
 * No React and no DOM references live here.
 */

/**
 * Shape type for halftone dots
 */
export type ShapeType = 'circle' | 'square';

/**
 * Configuration for monochrome halftone generation
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
 * Circle data for SVG/canvas generation
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
 * CMYK channel identifier
 */
export type CMYKChannel = 'c' | 'm' | 'y' | 'k';

/**
 * Configuration for a single CMYK channel (all fields optional, falls back to global defaults).
 * Shape/cornerRadius are intentionally global-only (all-or-nothing across channels).
 */
export interface CMYKChannelConfig {
  /** Rotation angle in degrees */
  angle?: number;
  /** Grid spacing override */
  step?: number;
  /** Max dot size override */
  density?: number;
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
 * Configuration for CMYK halftone generation (environment-agnostic).
 */
export interface HalftoneCMYKConfig {
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
  /** Per-channel config overrides (angle/step/density only) */
  channels?: CMYKChannelsConfig;
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
 * Result of computeHalftone — plain data, renderable anywhere.
 */
export interface HalftoneResult {
  circles: Circle[];
  pathData: string;
}

/**
 * Result of computeHalftoneCMYK — plain data, renderable anywhere.
 */
export interface HalftoneCMYKResult {
  channels: Record<CMYKChannel, CMYKChannelResult>;
}
