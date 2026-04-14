import type { HalftoneConfig, Circle, GridConfig, DisplayDimensions, ShapeType, CMYKChannel, HalftoneCMYKProps } from './types';
import { rgbToCmyk } from './colorConversion';

const MIN_RADIUS = 0.5;
const MIN_STEP = 0.1;
const MAX_STEP = 50;
const MIN_DENSITY = 0;
const MAX_DENSITY = 100;
const MIN_CORNER_RADIUS = 0;
const MAX_CORNER_RADIUS = 100;
const VALID_SHAPES: ShapeType[] = ['circle', 'square'];

export function clamp(value: number, min: number, max: number): number {
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
  return { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] };
}

export function toGreyscale(r: number, g: number, b: number): number {
  return (r + g + b) / 3;
}

export function generateCircles(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  grid: GridConfig,
  invert: boolean = false
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

      if (radius > MIN_RADIUS) {
        circles.push({ x, y, r: radius });
      }
    }
  }

  return circles;
}

export function circleToPath(cx: number, cy: number, r: number): string {
  return `M${cx},${cy} m-${r},0 a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 -${r * 2},0 `;
}

export function squareToPath(cx: number, cy: number, s: number, cornerRadiusPct: number): string {
  if (cornerRadiusPct <= 0) {
    const x = cx - s;
    const y = cy - s;
    const side = s * 2;
    return `M${x},${y} h${side} v${side} h-${side} z `;
  }

  const cr = s * (cornerRadiusPct / 100);
  const straight = 2 * (s - cr);
  const x0 = cx - s + cr;
  const y0 = cy - s;
  return `M${x0},${y0} h${straight} a${cr},${cr} 0 0,1 ${cr},${cr} v${straight} a${cr},${cr} 0 0,1 -${cr},${cr} h-${straight} a${cr},${cr} 0 0,1 -${cr},-${cr} v-${straight} a${cr},${cr} 0 0,1 ${cr},-${cr} z `;
}

export function generatePathData(
  circles: Circle[],
  shape: ShapeType = 'circle',
  cornerRadius: number = 0
): string {
  if (shape === 'square') {
    return circles.map((c) => squareToPath(c.x, c.y, c.r, cornerRadius)).join('');
  }
  return circles.map((c) => circleToPath(c.x, c.y, c.r)).join('');
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

export function generateHalftone(
  image: HTMLImageElement,
  config: HalftoneConfig
): {
  circles: Circle[];
  pathData: string;
  viewBox: string;
} {
  const { naturalWidth, naturalHeight } = image;

  const grid = calculateGrid(naturalWidth, naturalHeight, config.step, config.density, config.stepBasis);

  if (grid.numCols < 1 || grid.numRows < 1) {
    return {
      circles: [],
      pathData: '',
      viewBox: `0 0 ${naturalWidth} ${naturalHeight}`,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);

  const pixels = ctx.getImageData(0, 0, naturalWidth, naturalHeight).data;
  const circles = generateCircles(pixels, naturalWidth, naturalHeight, grid, config.invert);
  const pathData = generatePathData(circles, config.shape, config.cornerRadius);

  return {
    circles,
    pathData,
    viewBox: `0 0 ${naturalWidth} ${naturalHeight}`,
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
  shape: ShapeType;
  cornerRadius: number;
}

export interface ValidatedCMYKConfig {
  stepBasis: 'min' | 'width';
  channels: Record<CMYKChannel, ValidatedCMYKChannelConfig>;
}

export function validateCMYKConfig(props: Partial<HalftoneCMYKProps>): ValidatedCMYKConfig {
  const globalStep = clamp(props.step ?? 10, MIN_STEP, MAX_STEP);
  const globalDensity = clamp(props.density ?? 80, MIN_DENSITY, MAX_DENSITY);
  const globalShape = VALID_SHAPES.includes(props.shape as ShapeType)
    ? (props.shape as ShapeType)
    : 'circle';
  const globalCornerRadius = clamp(props.cornerRadius ?? 0, MIN_CORNER_RADIUS, MAX_CORNER_RADIUS);
  const stepBasis = props.stepBasis === 'width' ? 'width' : 'min' as const;

  const channels = {} as Record<CMYKChannel, ValidatedCMYKChannelConfig>;

  for (const ch of CMYK_CHANNELS) {
    const override = props.channels?.[ch];
    const shape = override?.shape && VALID_SHAPES.includes(override.shape)
      ? override.shape
      : globalShape;
    channels[ch] = {
      angle: ((override?.angle ?? CMYK_DEFAULT_ANGLES[ch]) % 360 + 360) % 360,
      step: clamp(override?.step ?? globalStep, MIN_STEP, MAX_STEP),
      density: clamp(override?.density ?? globalDensity, MIN_DENSITY, MAX_DENSITY),
      shape,
      cornerRadius: clamp(override?.cornerRadius ?? globalCornerRadius, MIN_CORNER_RADIUS, MAX_CORNER_RADIUS),
    };
  }

  return { stepBasis, channels };
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
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

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
  channel: CMYKChannel
): Circle[] {
  const circles: Circle[] = [];

  for (const pt of gridPoints) {
    const pixel = samplePixelFromBuffer(pixels, pt.x, pt.y, imageWidth, imageHeight);
    if (pixel.r > 250 && pixel.g > 250 && pixel.b > 250) continue;

    const cmyk = rgbToCmyk(pixel.r, pixel.g, pixel.b);
    const radius = maxRadius * cmyk[channel];

    if (radius > MIN_RADIUS) {
      circles.push({ x: pt.x, y: pt.y, r: radius });
    }
  }

  return circles;
}

const DOWNSAMPLE_MIN_STEP_PX = 3;
const DOWNSAMPLE_MAX_SCALE = 4;

export function computeDownsampleScale(stepPx: number): number {
  if (stepPx >= DOWNSAMPLE_MIN_STEP_PX) return 1;
  return Math.min(DOWNSAMPLE_MIN_STEP_PX / stepPx, DOWNSAMPLE_MAX_SCALE);
}

export function scaleCircles(circles: Circle[], scale: number): Circle[] {
  if (scale === 1) return circles;
  return circles.map(c => ({ x: c.x * scale, y: c.y * scale, r: c.r * scale }));
}
