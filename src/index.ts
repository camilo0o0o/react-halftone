// React components + hooks (browser entry)
export { Halftone } from './Halftone';
export { HalftoneCanvas } from './HalftoneCanvas';
export { HalftoneCMYKCanvas } from './HalftoneCMYKCanvas';
export { useHalftone } from './useHalftone';
export { useHalftoneCMYK } from './useHalftoneCMYK';

// Pure core (also available dependency-free via 'react-halftone/core')
export {
  rgbToCmyk,
  computeHalftone,
  computeHalftoneCMYK,
  renderHalftoneSVG,
  renderHalftoneCMYKSVG,
} from './core';
export type { CMYK } from './core';

// React prop / result types
export type {
  HalftoneProps, HalftoneCanvasProps, UseHalftoneResult,
  HalftoneCMYKProps, HalftoneCMYKHandle, UseHalftoneCMYKResult,
  HalftoneFallback,
} from './types';

// Shared config / data types
export type {
  HalftoneConfig, HalftoneCMYKConfig, Circle, HalftoneStatus, ShapeType,
  CMYKChannel, CMYKChannelConfig, CMYKChannelsConfig, CMYKChannelResult,
  HalftoneResult, HalftoneCMYKResult,
} from './types';
