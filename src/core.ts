import type { HalftoneConfig, Circle, GridConfig, DisplayDimensions, ShapeType } from './types';

const MIN_RADIUS = 0.5;
const MIN_STEP = 0.1;
const MAX_STEP = 50;
const MIN_DENSITY = 0;
const MAX_DENSITY = 100;
const MIN_CORNER_RADIUS = 0;
const MAX_CORNER_RADIUS = 100;
const VALID_SHAPES: ShapeType[] = ['circle', 'square'];

function clamp(value: number, min: number, max: number): number {
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
