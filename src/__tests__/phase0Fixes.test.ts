import { describe, it, expect } from 'vitest';
import { createCanvas } from 'canvas';
import {
  clamp,
  samplePixelFromBuffer,
  generateChannelCircles,
  generateRotatedGridPoints,
  computeDownsampleScale,
  scaleCircles,
  validateCMYKConfig,
} from '../core';

function makePixels(width: number, height: number, color: string) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  (ctx as any).fillStyle = color;
  (ctx as any).fillRect(0, 0, width, height);
  return (ctx as any).getImageData(0, 0, width, height).data as Uint8ClampedArray;
}

function makeTransparentPixels(width: number, height: number) {
  // A fresh canvas is transparent black (0,0,0,0).
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  return (ctx as any).getImageData(0, 0, width, height).data as Uint8ClampedArray;
}

describe('clamp NaN guard', () => {
  it('returns min for non-finite input instead of propagating NaN', () => {
    expect(clamp(NaN, 0.1, 50)).toBe(0.1);
    expect(clamp(Infinity, 0, 100)).toBe(100);
    expect(clamp(-Infinity, 0, 100)).toBe(0);
  });

  it('still clamps normal values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('samplePixelFromBuffer transparency compositing', () => {
  it('composites fully transparent pixels over white', () => {
    const pixels = makeTransparentPixels(10, 10);
    const p = samplePixelFromBuffer(pixels, 5, 5, 10, 10);
    expect(p.r).toBeCloseTo(255);
    expect(p.g).toBeCloseTo(255);
    expect(p.b).toBeCloseTo(255);
  });

  it('leaves fully opaque pixels unchanged', () => {
    const pixels = makePixels(10, 10, '#336699');
    const p = samplePixelFromBuffer(pixels, 5, 5, 10, 10);
    expect(p.r).toBe(0x33);
    expect(p.g).toBe(0x66);
    expect(p.b).toBe(0x99);
  });
});

describe('transparent pixels do not become black K dots', () => {
  it('a transparent image produces zero K dots', () => {
    const W = 100, H = 100;
    const pixels = makeTransparentPixels(W, H);
    const gridPoints = generateRotatedGridPoints(W, H, 10, 45);
    const kCircles = generateChannelCircles(pixels, W, H, gridPoints, 4, 'k');
    expect(kCircles.length).toBe(0);
  });
});

describe('axis-aligned angles keep the same dot count as angle 0', () => {
  // Step 10 on a 100x100 image places rows exactly on x=0/y=0, which is where
  // floating-point trig noise used to drop edge rows.
  const base = generateRotatedGridPoints(100, 100, 10, 0).length;

  it.each([90, 180, 270, 360])('angle %i matches angle 0', (angle) => {
    const count = generateRotatedGridPoints(100, 100, 10, angle).length;
    expect(count).toBe(base);
  });
});

describe('downsample threshold is applied in natural space', () => {
  const W = 50, H = 50;
  const pixels = makePixels(W, H, '#000000'); // pure black -> K factor 1
  const gridPoints = generateRotatedGridPoints(W, H, 10, 0);

  it('drops sub-MIN_RADIUS dots at scale 1', () => {
    // work radius = 0.4 < MIN_RADIUS (0.5)
    const circles = generateChannelCircles(pixels, W, H, gridPoints, 0.4, 'k', 1);
    expect(circles.length).toBe(0);
  });

  it('keeps dots whose natural-space radius exceeds MIN_RADIUS', () => {
    // work radius 0.4, scale 2 -> natural radius 0.8 > MIN_RADIUS
    const circles = generateChannelCircles(pixels, W, H, gridPoints, 0.4, 'k', 2);
    expect(circles.length).toBeGreaterThan(0);
  });
});

describe('scaleCircles', () => {
  it('scales x, y and r by the factor', () => {
    const scaled = scaleCircles([{ x: 1, y: 2, r: 0.4 }], 2);
    expect(scaled[0]).toEqual({ x: 2, y: 4, r: 0.8 });
  });

  it('returns the same reference at scale 1', () => {
    const input = [{ x: 1, y: 2, r: 3 }];
    expect(scaleCircles(input, 1)).toBe(input);
  });
});

describe('computeDownsampleScale contract', () => {
  it('does not downsample when step is already large enough', () => {
    expect(computeDownsampleScale(3)).toBe(1);
    expect(computeDownsampleScale(10)).toBe(1);
  });

  it('downsamples proportionally for tiny steps', () => {
    expect(computeDownsampleScale(1.5)).toBeCloseTo(2);
  });

  it('caps the scale factor', () => {
    expect(computeDownsampleScale(0.01)).toBeLessThanOrEqual(4);
  });
});

describe('validateCMYKConfig edge inputs', () => {
  it('normalizes negative and >=360 angles', () => {
    const v = validateCMYKConfig({ channels: { c: { angle: -45 }, m: { angle: 360 }, y: { angle: 400 } } });
    expect(v.channels.c.angle).toBe(315);
    expect(v.channels.m.angle).toBe(0);
    expect(v.channels.y.angle).toBe(40);
  });

  it('falls back to the default angle for NaN', () => {
    const v = validateCMYKConfig({ channels: { k: { angle: NaN } } });
    expect(v.channels.k.angle).toBe(45); // CMYK_DEFAULT_ANGLES.k
  });

  it('clamps step and density to bounds', () => {
    const v = validateCMYKConfig({ step: 999, density: -10 });
    expect(v.channels.c.step).toBe(50);
    expect(v.channels.c.density).toBe(0);
  });

  it('accepts density 0 and 100', () => {
    const lo = validateCMYKConfig({ density: 0 });
    const hi = validateCMYKConfig({ density: 100 });
    expect(lo.channels.c.density).toBe(0);
    expect(hi.channels.c.density).toBe(100);
  });
});
