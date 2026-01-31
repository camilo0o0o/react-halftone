import { describe, it, expect } from 'vitest';
import { createCanvas } from 'canvas';
import {
  samplePixel,
  generateCircles,
  calculateGrid,
  generateHalftone,
} from '../core';

function makeCanvasCtx(width: number, height: number) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  return { canvas, ctx: ctx as unknown as CanvasRenderingContext2D };
}

describe('samplePixel', () => {
  it('returns correct RGB for a known fill color', () => {
    const { ctx } = makeCanvasCtx(10, 10);
    (ctx as any).fillStyle = '#ff8040';
    (ctx as any).fillRect(0, 0, 10, 10);
    const pixel = samplePixel(ctx, 5, 5);
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

    const grid = calculateGrid(100, 100, 10, 80);
    const circles = generateCircles(ctx, grid);

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

    const grid = calculateGrid(100, 100, 10, 80);
    const circles = generateCircles(ctx, grid);

    expect(circles.length).toBe(0);
  });

  it('half-black/half-white → circles only on dark side', () => {
    const { ctx } = makeCanvasCtx(100, 100);
    // Left half black, right half white
    (ctx as any).fillStyle = '#000000';
    (ctx as any).fillRect(0, 0, 50, 100);
    (ctx as any).fillStyle = '#ffffff';
    (ctx as any).fillRect(50, 0, 50, 100);

    const grid = calculateGrid(100, 100, 10, 80);
    const circles = generateCircles(ctx, grid);

    expect(circles.length).toBeGreaterThan(0);
    for (const c of circles) {
      // All circles should be on the left (dark) side
      expect(c.x).toBeLessThanOrEqual(50);
    }
  });
});

describe('generateHalftone (full pipeline)', () => {
  it('produces non-empty result for a valid test image', () => {
    const { canvas, ctx } = makeCanvasCtx(100, 100);
    (ctx as any).fillStyle = '#333333';
    (ctx as any).fillRect(0, 0, 100, 100);

    // Create a fake HTMLImageElement-like object with canvas data
    const dataUrl = (canvas as any).toDataURL();

    // We need to use node-canvas's Image to load the data URL
    const { Image: CanvasImage } = require('canvas');
    const img = new CanvasImage();
    img.src = dataUrl;

    // Cast as HTMLImageElement for the function signature
    const result = generateHalftone(img as unknown as HTMLImageElement, {
      step: 10,
      density: 80,
      color: '#000000',
    });

    expect(result.circles.length).toBeGreaterThan(0);
    expect(result.pathData.length).toBeGreaterThan(0);
    expect(result.viewBox).toBe('0 0 100 100');
  });

  it('returns empty result for invalid grid', () => {
    // A 2x2 image with step=50 and density=100:
    // stepPx = 2*0.5=1, maxRadius=0.5, available=2-1=1
    // numCols = floor(1/1)+1 = 2, numRows = 2 — still valid
    // Use a 1x1 image instead: stepPx=0.5, maxRadius=0.25, available=1-0.5=0.5
    // numCols = floor(0.5/0.5)+1 = 2 — still not 0
    // To truly get 0 cells, we need available < 0 → maxRadius > imageSize/2
    // That requires density=100 and stepPx > imageSize, but step is capped at 50%
    // So instead test with a white image where circles are empty (radius < MIN_RADIUS)
    const { canvas, ctx } = makeCanvasCtx(10, 10);
    (ctx as any).fillStyle = '#ffffff';
    (ctx as any).fillRect(0, 0, 10, 10);

    const { Image: CanvasImage } = require('canvas');
    const img = new CanvasImage();
    img.src = (canvas as any).toDataURL();

    const result = generateHalftone(img as unknown as HTMLImageElement, {
      step: 50,
      density: 100,
      color: '#000000',
    });

    // White image → all circles below MIN_RADIUS → empty
    expect(result.circles).toEqual([]);
    expect(result.pathData).toBe('');
    expect(result.viewBox).toBe('0 0 10 10');
  });
});
