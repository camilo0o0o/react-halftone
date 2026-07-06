import type { CSSProperties } from 'react';
import type {
  ShapeType,
  Circle,
  HalftoneStatus,
  CMYKChannel,
  CMYKChannelResult,
} from './core/types';

// Re-export the environment-agnostic core types so existing consumers that
// import them from './types' keep working.
export type {
  ShapeType,
  HalftoneConfig,
  Circle,
  GridConfig,
  DisplayDimensions,
  HalftoneStatus,
  CMYKChannel,
  CMYKChannelConfig,
  CMYKChannelsConfig,
  HalftoneCMYKConfig,
  CMYKChannelResult,
  HalftoneResult,
  HalftoneCMYKResult,
} from './core/types';

/**
 * Props for the Halftone / HalftoneCanvas React components
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
 * Props for the HalftoneCMYKCanvas component
 */
export interface HalftoneCMYKProps {
  /** Image source URL */
  src: string;
  /** Grid spacing percentage (0.1-50) — global default */
  step?: number;
  /** Maximum dot size percentage (0-100) — global default */
  density?: number;
  /** Dot shape — global default (applies to every channel) */
  shape?: ShapeType;
  /** Corner radius percentage for square shapes — global default */
  cornerRadius?: number;
  /** Dimension used to calculate step size */
  stepBasis?: 'min' | 'width';
  /** Per-channel config overrides (angle/step/density only) */
  channels?: import('./core/types').CMYKChannelsConfig;
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
 * Imperative handle for HalftoneCMYKCanvas export
 */
export interface HalftoneCMYKHandle {
  toDataURL: (type?: string, quality?: number) => string;
  toBlob: (callback: BlobCallback, type?: string, quality?: number) => void;
  /** The underlying canvas element, or null before it mounts. */
  getCanvas: () => HTMLCanvasElement | null;
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
