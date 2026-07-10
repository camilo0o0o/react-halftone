import { describe, it, expect } from 'vitest';
import { createCanvas } from 'canvas';
import {
  samplePixelFromBuffer,
  generateCircles,
  calculateGrid,
  computeHalftone,
} from '../core';

function pixelsFor(width: number, height: number, paint: (ctx: any) => void) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return (ctx as any).getImageData(0, 0, width, height).data as Uint8ClampedArray;
}

function makeCanvasCtx(width: number, height: number) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  return { canvas, ctx: ctx as unknown as CanvasRenderingContext2D };
}

describe('samplePixelFromBuffer', () => {
  it('returns correct RGB for a known fill color', () => {
    const { ctx } = makeCanvasCtx(10, 10);
    (ctx as any).fillStyle = '#ff8040';
    (ctx as any).fillRect(0, 0, 10, 10);
    const pixels = (ctx as any).getImageData(0, 0, 10, 10).data;
    const pixel = samplePixelFromBuffer(pixels, 5, 5, 10, 10);
    expect(pixel.r).toBe(255);
    expect(pixel.g).toBe(128);
    expect(pixel.b).toBe(64);
  });

  it('clamps out-of-bounds coordinates to image edges', () => {
    const { ctx } = makeCanvasCtx(10, 10);
    (ctx as any).fillStyle = '#ff8040';
    (ctx as any).fillRect(0, 0, 10, 10);
    const pixels = (ctx as any).getImageData(0, 0, 10, 10).data;
    const pixel = samplePixelFromBuffer(pixels, 20, 20, 10, 10);
    expect(pixel.r).toBe(255);
    expect(pixel.g).toBe(128);
    expect(pixel.b).toBe(64);
  });

  it('clamps negative coordinates to zero', () => {
    const { ctx } = makeCanvasCtx(10, 10);
    (ctx as any).fillStyle = '#ff8040';
    (ctx as any).fillRect(0, 0, 10, 10);
    const pixels = (ctx as any).getImageData(0, 0, 10, 10).data;
    const pixel = samplePixelFromBuffer(pixels, -5, -5, 10, 10);
    expect(pixel.r).toBe(255);
    expect(pixel.g).toBe(128);
    expect(pixel.b).toBe(64);
  });
});

describe('generateCircles', () => {
  it('solid black canvas → circles at max radius', () => {
    const { ctx } = makeCanvasCtx(100, 100);
    (ctx as any).fillStyle = '#000000';
    (ctx as any).fillRect(0, 0, 100, 100);
    const pixels = (ctx as any).getImageData(0, 0, 100, 100).data;

    const grid = calculateGrid(100, 100, 10, 80);
    const circles = generateCircles(pixels, 100, 100, grid);

    expect(circles.length).toBeGreaterThan(0);
    for (const c of circles) {
      // All circles should be near max radius (darkness = 1)
      expect(c.r).toBeCloseTo(grid.maxRadius, 1);
    }
  });

  it('solid white canvas → no circles (below MIN_RADIUS)', () => {
    const { ctx } = makeCanvasCtx(100, 100);
    (ctx as any).fillStyle = '#ffffff';
    (ctx as any).fillRect(0, 0, 100, 100);
    const pixels = (ctx as any).getImageData(0, 0, 100, 100).data;

    const grid = calculateGrid(100, 100, 10, 80);
    const circles = generateCircles(pixels, 100, 100, grid);

    expect(circles.length).toBe(0);
  });

  it('half-black/half-white → circles only on dark side', () => {
    const { ctx } = makeCanvasCtx(100, 100);
    // Left half black, right half white
    (ctx as any).fillStyle = '#000000';
    (ctx as any).fillRect(0, 0, 50, 100);
    (ctx as any).fillStyle = '#ffffff';
    (ctx as any).fillRect(50, 0, 50, 100);
    const pixels = (ctx as any).getImageData(0, 0, 100, 100).data;

    const grid = calculateGrid(100, 100, 10, 80);
    const circles = generateCircles(pixels, 100, 100, grid);

    expect(circles.length).toBeGreaterThan(0);
    for (const c of circles) {
      // All circles should be on the left (dark) side
      expect(c.x).toBeLessThanOrEqual(50);
    }
  });

  it('solid white canvas with invert=true → circles at max radius', () => {
    const { ctx } = makeCanvasCtx(100, 100);
    (ctx as any).fillStyle = '#ffffff';
    (ctx as any).fillRect(0, 0, 100, 100);
    const pixels = (ctx as any).getImageData(0, 0, 100, 100).data;

    const grid = calculateGrid(100, 100, 10, 80);
    const circles = generateCircles(pixels, 100, 100, grid, true);

    expect(circles.length).toBeGreaterThan(0);
    for (const c of circles) {
      // With invert, white (brightness=1) → factor=1 → max radius
      expect(c.r).toBeCloseTo(grid.maxRadius, 1);
    }
  });

  it('solid black canvas with invert=true → no circles', () => {
    const { ctx } = makeCanvasCtx(100, 100);
    (ctx as any).fillStyle = '#000000';
    (ctx as any).fillRect(0, 0, 100, 100);
    const pixels = (ctx as any).getImageData(0, 0, 100, 100).data;

    const grid = calculateGrid(100, 100, 10, 80);
    const circles = generateCircles(pixels, 100, 100, grid, true);

    // With invert, black (brightness=0) → factor=0 → radius below MIN_RADIUS
    expect(circles.length).toBe(0);
  });

  it('half-black/half-white with invert=true → circles only on light side', () => {
    const { ctx } = makeCanvasCtx(100, 100);
    // Left half black, right half white
    (ctx as any).fillStyle = '#000000';
    (ctx as any).fillRect(0, 0, 50, 100);
    (ctx as any).fillStyle = '#ffffff';
    (ctx as any).fillRect(50, 0, 50, 100);
    const pixels = (ctx as any).getImageData(0, 0, 100, 100).data;

    const grid = calculateGrid(100, 100, 10, 80);
    const circles = generateCircles(pixels, 100, 100, grid, true);

    expect(circles.length).toBeGreaterThan(0);
    for (const c of circles) {
      // With invert, circles should be on the right (light) side
      expect(c.x).toBeGreaterThanOrEqual(50);
    }
  });
});

describe('computeHalftone (full pipeline)', () => {
  it('produces non-empty result for a valid test image', () => {
    const pixels = pixelsFor(100, 100, (ctx) => {
      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 0, 100, 100);
    });

    const result = computeHalftone(pixels, 100, 100, 1, {
      step: 10,
      density: 80,
      color: '#000000',
    });

    expect(result.circles.length).toBeGreaterThan(0);
    expect(result.pathData.length).toBeGreaterThan(0);
  });

  it('returns empty result for a white image (all dots below MIN_RADIUS)', () => {
    const pixels = pixelsFor(10, 10, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 10, 10);
    });

    const result = computeHalftone(pixels, 10, 10, 1, {
      step: 50,
      density: 100,
      color: '#000000',
    });

    expect(result.circles).toEqual([]);
    expect(result.pathData).toBe('');
  });

  it('produces circles on white image with invert=true', () => {
    const pixels = pixelsFor(100, 100, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 100, 100);
    });

    const result = computeHalftone(pixels, 100, 100, 1, {
      step: 10,
      density: 80,
      color: '#ffffff',
      invert: true,
    });

    expect(result.circles.length).toBeGreaterThan(0);
    expect(result.pathData.length).toBeGreaterThan(0);
  });

  it('produces square paths with shape=square', () => {
    const pixels = pixelsFor(100, 100, (ctx) => {
      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 0, 100, 100);
    });

    const result = computeHalftone(pixels, 100, 100, 1, {
      step: 10,
      density: 80,
      color: '#000000',
      invert: false,
      shape: 'square',
      cornerRadius: 0,
    });

    expect(result.circles.length).toBeGreaterThan(0);
    expect(result.pathData.length).toBeGreaterThan(0);
    // Square paths use h/v commands, not arc commands like circles
    expect(result.pathData).toContain('h');
    expect(result.pathData).toContain('v');
    expect(result.pathData).not.toContain('a');
  });

  it('produces rounded square paths with shape=square and cornerRadius=50', () => {
    const pixels = pixelsFor(100, 100, (ctx) => {
      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 0, 100, 100);
    });

    const result = computeHalftone(pixels, 100, 100, 1, {
      step: 10,
      density: 80,
      color: '#000000',
      invert: false,
      shape: 'square',
      cornerRadius: 50,
    });

    expect(result.circles.length).toBeGreaterThan(0);
    expect(result.pathData.length).toBeGreaterThan(0);
    // Rounded square paths include arc commands
    expect(result.pathData).toContain('a');
    expect(result.pathData).toContain('0 0,1');
  });

  it('produces no circles on black image with invert=true', () => {
    const pixels = pixelsFor(100, 100, (ctx) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 100, 100);
    });

    const result = computeHalftone(pixels, 100, 100, 1, {
      step: 10,
      density: 80,
      color: '#ffffff',
      invert: true,
    });

    expect(result.circles).toEqual([]);
    expect(result.pathData).toBe('');
  });
});
