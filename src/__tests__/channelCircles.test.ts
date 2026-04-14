import { describe, it, expect } from 'vitest';
import { createCanvas } from 'canvas';
import { generateRotatedGridPoints, generateChannelCircles } from '../core';

function makePixels(width: number, height: number, color: string) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  (ctx as any).fillStyle = color;
  (ctx as any).fillRect(0, 0, width, height);
  return (ctx as any).getImageData(0, 0, width, height).data as Uint8ClampedArray;
}

describe('generateChannelCircles', () => {
  const W = 100, H = 100;
  const stepPx = 10;
  const maxRadius = 4;
  const gridPoints = generateRotatedGridPoints(W, H, stepPx, 0);

  it('solid cyan image produces circles only in C channel', () => {
    const pixels = makePixels(W, H, '#00FFFF');
    const cCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'c');
    const mCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'm');
    const yCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'y');
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'k');

    expect(cCircles.length).toBeGreaterThan(0);
    expect(mCircles.length).toBe(0);
    expect(yCircles.length).toBe(0);
    expect(kCircles.length).toBe(0);
  });

  it('solid magenta image produces circles only in M channel', () => {
    const pixels = makePixels(W, H, '#FF00FF');
    const cCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'c');
    const mCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'm');
    const yCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'y');
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'k');

    expect(cCircles.length).toBe(0);
    expect(mCircles.length).toBeGreaterThan(0);
    expect(yCircles.length).toBe(0);
    expect(kCircles.length).toBe(0);
  });

  it('solid yellow image produces circles only in Y channel', () => {
    const pixels = makePixels(W, H, '#FFFF00');
    const cCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'c');
    const mCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'm');
    const yCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'y');
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'k');

    expect(cCircles.length).toBe(0);
    expect(mCircles.length).toBe(0);
    expect(yCircles.length).toBeGreaterThan(0);
    expect(kCircles.length).toBe(0);
  });

  it('solid black image produces circles only in K channel', () => {
    const pixels = makePixels(W, H, '#000000');
    const cCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'c');
    const mCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'm');
    const yCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'y');
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'k');

    expect(cCircles.length).toBe(0);
    expect(mCircles.length).toBe(0);
    expect(yCircles.length).toBe(0);
    expect(kCircles.length).toBeGreaterThan(0);
  });

  it('solid white image produces no circles in any channel', () => {
    const pixels = makePixels(W, H, '#FFFFFF');
    const cCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'c');
    const mCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'm');
    const yCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'y');
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'k');

    expect(cCircles.length).toBe(0);
    expect(mCircles.length).toBe(0);
    expect(yCircles.length).toBe(0);
    expect(kCircles.length).toBe(0);
  });

  it('K channel circles have max radius for pure black', () => {
    const pixels = makePixels(W, H, '#000000');
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'k');
    for (const c of kCircles) {
      expect(c.r).toBeCloseTo(maxRadius);
    }
  });

  it('mixed color produces circles in multiple channels', () => {
    // RGB(100, 150, 200) has non-zero C, M, Y and K
    const pixels = makePixels(W, H, '#6496C8');
    const cCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'c');
    const mCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'm');
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'k');

    expect(cCircles.length).toBeGreaterThan(0);
    expect(mCircles.length).toBeGreaterThan(0);
    expect(kCircles.length).toBeGreaterThan(0);
  });

  it('all circles have positive radius above MIN_RADIUS', () => {
    const pixels = makePixels(W, H, '#6496C8');
    const circles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'c');
    for (const c of circles) {
      expect(c.r).toBeGreaterThan(0.5);
    }
  });

  it('near-white pixels (251,251,251) are skipped by early-exit', () => {
    const pixels = makePixels(W, H, '#fbfbfb');
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, maxRadius, 'k');
    expect(kCircles.length).toBe(0);
  });

  it('off-white pixels (240,240,240) still produce dots', () => {
    const pixels = makePixels(W, H, '#f0f0f0');
    // RGB(240,240,240) → K ≈ 0.059, radius = 4 * 0.059 ≈ 0.24 → below MIN_RADIUS
    // So no dots expected at maxRadius=4, but with larger maxRadius they would appear
    const largeMaxRadius = 20;
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, largeMaxRadius, 'k');
    expect(kCircles.length).toBeGreaterThan(0);
  });
});
