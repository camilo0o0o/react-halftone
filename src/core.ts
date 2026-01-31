import type { HalftoneConfig, Circle, GridConfig, DisplayDimensions } from './types';

const MIN_RADIUS = 0.5;
const MIN_STEP = 0.1;
const MAX_STEP = 50;
const MIN_DENSITY = 0;
const MAX_DENSITY = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

export function validateConfig(config: Partial<HalftoneConfig>): HalftoneConfig {
  return {
    step: clamp(config.step ?? 10, MIN_STEP, MAX_STEP),
    density: clamp(config.density ?? 80, MIN_DENSITY, MAX_DENSITY),
    color: isValidHexColor(config.color ?? '') ? config.color! : '#000000',
  };
}

export function calculateGrid(
  imageWidth: number,
  imageHeight: number,
  step: number,
  density: number
): GridConfig {
  const smallerDimension = Math.min(imageWidth, imageHeight);
  const stepPx = smallerDimension * (step / 100);
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

export function samplePixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): { r: number; g: number; b: number } {
  const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return { r: data[0], g: data[1], b: data[2] };
}

export function toGreyscale(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function generateCircles(
  ctx: CanvasRenderingContext2D,
  grid: GridConfig
): Circle[] {
  const circles: Circle[] = [];

  for (let row = 0; row < grid.numRows; row++) {
    for (let col = 0; col < grid.numCols; col++) {
      const x = grid.startX + col * grid.stepPx;
      const y = grid.startY + row * grid.stepPx;

      const pixel = samplePixel(ctx, x, y);
      const greyscale = toGreyscale(pixel.r, pixel.g, pixel.b);
      const brightness = greyscale / 255;
      const darkness = 1 - brightness;
      const radius = grid.maxRadius * darkness;

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

export function generatePathData(circles: Circle[]): string {
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

  const grid = calculateGrid(naturalWidth, naturalHeight, config.step, config.density);

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

  const circles = generateCircles(ctx, grid);
  const pathData = generatePathData(circles);

  return {
    circles,
    pathData,
    viewBox: `0 0 ${naturalWidth} ${naturalHeight}`,
  };
}
