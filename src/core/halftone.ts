import type {
  HalftoneConfig,
  Circle,
  GridConfig,
  DisplayDimensions,
  ShapeType,
  CMYKChannel,
  HalftoneCMYKConfig,
} from './types';
import { rgbToCmyk } from './color';

const MIN_RADIUS = 0.5;
const MIN_STEP = 0.1;
const MAX_STEP = 50;
const MIN_DENSITY = 0;
const MAX_DENSITY = 100;
const MIN_CORNER_RADIUS = 0;
const MAX_CORNER_RADIUS = 100;
const VALID_SHAPES: ShapeType[] = ['circle', 'square'];

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

export function validateConfig(config: Partial<HalftoneConfig>): HalftoneConfig {
  const shape = VALID_SHAPES.includes(config.shape as ShapeType)
    ? (config.shape as ShapeType)
    : 'circle';
  return {
    step: clamp(config.step ?? 10, MIN_STEP, MAX_STEP),
    density: clamp(config.density ?? 80, MIN_DENSITY, MAX_DENSITY),
    color: isValidHexColor(config.color ?? '') ? config.color! : '#000000',
    invert: config.invert ?? false,
    shape,
    cornerRadius: clamp(config.cornerRadius ?? 0, MIN_CORNER_RADIUS, MAX_CORNER_RADIUS),
    stepBasis: config.stepBasis === 'width' ? 'width' : 'min',
  };
}

export function calculateGrid(
  imageWidth: number,
  imageHeight: number,
  step: number,
  density: number,
  stepBasis: 'min' | 'width' = 'min'
): GridConfig {
  const referenceDimension = stepBasis === 'width'
    ? imageWidth
    : Math.min(imageWidth, imageHeight);
  const stepPx = referenceDimension * (step / 100);
  const maxRadius = (stepPx / 2) * (density / 100);

  const availableWidth = imageWidth - 2 * maxRadius;
  const availableHeight = imageHeight - 2 * maxRadius;

  const numCols = Math.floor(availableWidth / stepPx) + 1;
  const numRows = Math.floor(availableHeight / stepPx) + 1;

  const gridWidth = (numCols - 1) * stepPx;
  const gridHeight = (numRows - 1) * stepPx;

  const marginX = (imageWidth - gridWidth) / 2;
  const marginY = (imageHeight - gridHeight) / 2;

  return {
    stepPx,
    maxRadius,
    numCols,
    numRows,
    startX: marginX,
    startY: marginY,
  };
}

export function samplePixelFromBuffer(
  pixels: Uint8ClampedArray,
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number
): { r: number; g: number; b: number } {
  const px = clamp(Math.round(x), 0, imageWidth - 1);
  const py = clamp(Math.round(y), 0, imageHeight - 1);
  const offset = (py * imageWidth + px) * 4;
  const r = pixels[offset];
  const g = pixels[offset + 1];
  const b = pixels[offset + 2];
  const a = pixels[offset + 3];

  // Composite over white so transparent regions read as paper, not black ink.
  if (a === 255) return { r, g, b };
  const alpha = a / 255;
  const inv = 255 * (1 - alpha);
  return {
    r: r * alpha + inv,
    g: g * alpha + inv,
    b: b * alpha + inv,
  };
}

export function toGreyscale(r: number, g: number, b: number): number {
  return (r + g + b) / 3;
}

export function generateCircles(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  grid: GridConfig,
  invert: boolean = false,
  scale: number = 1
): Circle[] {
  const circles: Circle[] = [];

  for (let row = 0; row < grid.numRows; row++) {
    for (let col = 0; col < grid.numCols; col++) {
      const x = grid.startX + col * grid.stepPx;
      const y = grid.startY + row * grid.stepPx;

      const pixel = samplePixelFromBuffer(pixels, x, y, imageWidth, imageHeight);
      if (!invert && pixel.r > 250 && pixel.g > 250 && pixel.b > 250) continue;
      if (invert && pixel.r < 5 && pixel.g < 5 && pixel.b < 5) continue;

      const greyscale = toGreyscale(pixel.r, pixel.g, pixel.b);
      const brightness = greyscale / 255;
      const factor = invert ? brightness : 1 - brightness;
      const radius = grid.maxRadius * factor;

      // Filter against the final (natural-space) radius so downsampling doesn't
      // inflate the visibility threshold and drop dots.
      if (radius * scale > MIN_RADIUS) {
        circles.push({ x, y, r: radius });
      }
    }
  }

  return circles;
}

export function calculateDisplayDimensions(
  naturalWidth: number,
  naturalHeight: number,
  propWidth?: number,
  propHeight?: number
): DisplayDimensions {
  const aspectRatio = naturalWidth / naturalHeight;

  if (propWidth && propWidth > 0 && propHeight && propHeight > 0) {
    const scaleX = propWidth / naturalWidth;
    const scaleY = propHeight / naturalHeight;
    const scale = Math.min(scaleX, scaleY);
    return {
      width: naturalWidth * scale,
      height: naturalHeight * scale,
    };
  }

  if (propWidth && propWidth > 0) {
    return {
      width: propWidth,
      height: propWidth / aspectRatio,
    };
  }

  if (propHeight && propHeight > 0) {
    return {
      width: propHeight * aspectRatio,
      height: propHeight,
    };
  }

  return {
    width: naturalWidth,
    height: naturalHeight,
  };
}

// --- CMYK Halftone ---

export const CMYK_DEFAULT_ANGLES = { c: 15, m: 75, y: 0, k: 45 } as const;
export const CMYK_CHANNEL_COLORS = { c: '#00FFFF', m: '#FF00FF', y: '#FFFF00', k: '#000000' } as const;
const CMYK_CHANNELS: CMYKChannel[] = ['c', 'm', 'y', 'k'];

export interface ValidatedCMYKChannelConfig {
  angle: number;
  step: number;
  density: number;
}

export interface ValidatedCMYKConfig {
  stepBasis: 'min' | 'width';
  shape: ShapeType;
  cornerRadius: number;
  channels: Record<CMYKChannel, ValidatedCMYKChannelConfig>;
}

export function validateCMYKConfig(config: Partial<HalftoneCMYKConfig>): ValidatedCMYKConfig {
  const globalStep = clamp(config.step ?? 10, MIN_STEP, MAX_STEP);
  const globalDensity = clamp(config.density ?? 80, MIN_DENSITY, MAX_DENSITY);
  const shape = VALID_SHAPES.includes(config.shape as ShapeType)
    ? (config.shape as ShapeType)
    : 'circle';
  const cornerRadius = clamp(config.cornerRadius ?? 0, MIN_CORNER_RADIUS, MAX_CORNER_RADIUS);
  const stepBasis = config.stepBasis === 'width' ? 'width' : 'min' as const;

  const channels = {} as Record<CMYKChannel, ValidatedCMYKChannelConfig>;

  for (const ch of CMYK_CHANNELS) {
    const override = config.channels?.[ch];
    const rawAngle = override?.angle ?? CMYK_DEFAULT_ANGLES[ch];
    const angle = Number.isFinite(rawAngle) ? rawAngle : CMYK_DEFAULT_ANGLES[ch];
    channels[ch] = {
      angle: ((angle % 360) + 360) % 360,
      step: clamp(override?.step ?? globalStep, MIN_STEP, MAX_STEP),
      density: clamp(override?.density ?? globalDensity, MIN_DENSITY, MAX_DENSITY),
    };
  }

  return { stepBasis, shape, cornerRadius, channels };
}

export function generateRotatedGridPoints(
  imageWidth: number,
  imageHeight: number,
  stepPx: number,
  angleDeg: number
): Array<{ x: number; y: number }> {
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;
  const diag = Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight);
  const halfDiag = diag / 2;

  const normalizedAngle = ((angleDeg % 360) + 360) % 360;
  const theta = (normalizedAngle * Math.PI) / 180;
  // Snap near-zero trig so axis-aligned angles (0/90/180/270) don't drop edge
  // rows to floating-point noise (e.g. Math.cos(Math.PI / 2) ≈ 6.1e-17).
  const EPSILON = 1e-12;
  let cosT = Math.cos(theta);
  let sinT = Math.sin(theta);
  if (Math.abs(cosT) < EPSILON) cosT = 0;
  if (Math.abs(sinT) < EPSILON) sinT = 0;

  const numSteps = Math.ceil(halfDiag / stepPx);
  const points: Array<{ x: number; y: number }> = [];

  for (let row = -numSteps; row <= numSteps; row++) {
    for (let col = -numSteps; col <= numSteps; col++) {
      const gx = col * stepPx;
      const gy = row * stepPx;

      const x = cx + gx * cosT - gy * sinT;
      const y = cy + gx * sinT + gy * cosT;

      if (x >= 0 && x < imageWidth && y >= 0 && y < imageHeight) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

export function generateChannelCircles(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  gridPoints: Array<{ x: number; y: number }>,
  maxRadius: number,
  channel: CMYKChannel,
  scale: number = 1
): Circle[] {
  const circles: Circle[] = [];

  for (const pt of gridPoints) {
    const pixel = samplePixelFromBuffer(pixels, pt.x, pt.y, imageWidth, imageHeight);
    if (pixel.r > 250 && pixel.g > 250 && pixel.b > 250) continue;

    const cmyk = rgbToCmyk(pixel.r, pixel.g, pixel.b);
    const radius = maxRadius * cmyk[channel];

    // Filter against the final (natural-space) radius so downsampling doesn't
    // inflate the visibility threshold and drop dots.
    if (radius * scale > MIN_RADIUS) {
      circles.push({ x: pt.x, y: pt.y, r: radius });
    }
  }

  return circles;
}

// Target number of source pixels per grid cell in the downsampled work buffer.
// Keeping this constant makes processing cost track the dot count rather than
// the source resolution: a 24MP photo and a 1MP photo at the same `step` do the
// same amount of work. The `drawImage` downscale also area-averages each cell,
// which is exactly the tone a halftone dot should represent.
const TARGET_CELL_PX = 3.5;

export function computeDownsampleScale(stepPx: number): number {
  if (!Number.isFinite(stepPx) || stepPx <= 0) return 1;
  // Never upsample: cells already at/below the target stay at natural resolution.
  return Math.max(1, stepPx / TARGET_CELL_PX);
}

export function scaleCircles(circles: Circle[], scale: number): Circle[] {
  if (scale === 1) return circles;
  return circles.map(c => ({ x: c.x * scale, y: c.y * scale, r: c.r * scale }));
}
