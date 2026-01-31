import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  calculateGrid,
  toGreyscale,
  circleToPath,
  generatePathData,
  calculateDisplayDimensions,
} from '../core';

describe('validateConfig', () => {
  it('returns defaults when called with {}', () => {
    const config = validateConfig({});
    expect(config).toEqual({ step: 10, density: 80, color: '#000000' });
  });

  it('clamps step below 0.1', () => {
    expect(validateConfig({ step: 0 }).step).toBe(0.1);
    expect(validateConfig({ step: -5 }).step).toBe(0.1);
  });

  it('clamps step above 50', () => {
    expect(validateConfig({ step: 100 }).step).toBe(50);
    expect(validateConfig({ step: 51 }).step).toBe(50);
  });

  it('clamps density below 0', () => {
    expect(validateConfig({ density: -10 }).density).toBe(0);
  });

  it('clamps density above 100', () => {
    expect(validateConfig({ density: 150 }).density).toBe(100);
  });

  it('accepts valid 3-digit hex', () => {
    expect(validateConfig({ color: '#abc' }).color).toBe('#abc');
    expect(validateConfig({ color: '#FFF' }).color).toBe('#FFF');
  });

  it('accepts valid 6-digit hex', () => {
    expect(validateConfig({ color: '#aabbcc' }).color).toBe('#aabbcc');
    expect(validateConfig({ color: '#FF00FF' }).color).toBe('#FF00FF');
  });

  it('falls back to #000000 for invalid colors', () => {
    expect(validateConfig({ color: 'red' }).color).toBe('#000000');
    expect(validateConfig({ color: '#gg0000' }).color).toBe('#000000');
    expect(validateConfig({ color: '' }).color).toBe('#000000');
    expect(validateConfig({ color: '#12345' }).color).toBe('#000000');
  });
});

describe('calculateGrid', () => {
  it('returns correct stepPx and maxRadius for known inputs', () => {
    // 100x100 image, step=10% → stepPx=10, density=80% → maxRadius=4
    const grid = calculateGrid(100, 100, 10, 80);
    expect(grid.stepPx).toBe(10);
    expect(grid.maxRadius).toBe(4);
  });

  it('grid is centered (symmetric margins)', () => {
    const grid = calculateGrid(100, 100, 10, 80);
    // Grid should be centered: margins should be equal on both sides
    const rightMargin = 100 - (grid.startX + (grid.numCols - 1) * grid.stepPx);
    expect(grid.startX).toBeCloseTo(rightMargin, 5);
    const bottomMargin = 100 - (grid.startY + (grid.numRows - 1) * grid.stepPx);
    expect(grid.startY).toBeCloseTo(bottomMargin, 5);
  });

  it('handles square image', () => {
    const grid = calculateGrid(200, 200, 10, 50);
    expect(grid.stepPx).toBe(20); // 200 * 0.1
    expect(grid.maxRadius).toBe(5); // 10 * 0.5
  });

  it('handles landscape image', () => {
    const grid = calculateGrid(400, 200, 10, 50);
    // smaller dimension is 200 → stepPx = 20
    expect(grid.stepPx).toBe(20);
    expect(grid.numCols).toBeGreaterThan(grid.numRows);
  });

  it('handles portrait image', () => {
    const grid = calculateGrid(200, 400, 10, 50);
    expect(grid.stepPx).toBe(20);
    expect(grid.numRows).toBeGreaterThan(grid.numCols);
  });

  it('edge case: very large step → few or 0 grid cells', () => {
    const grid = calculateGrid(100, 100, 50, 80);
    // stepPx = 50, maxRadius = 20, available = 100 - 40 = 60, numCols = floor(60/50)+1 = 2
    expect(grid.numCols).toBeLessThanOrEqual(2);
    expect(grid.numRows).toBeLessThanOrEqual(2);
  });

  it('edge case: density=0 → maxRadius=0', () => {
    const grid = calculateGrid(100, 100, 10, 0);
    expect(grid.maxRadius).toBe(0);
  });
});

describe('toGreyscale', () => {
  it('white → 255', () => {
    expect(toGreyscale(255, 255, 255)).toBeCloseTo(255, 0);
  });

  it('black → 0', () => {
    expect(toGreyscale(0, 0, 0)).toBe(0);
  });

  it('known color → expected luminance', () => {
    // Pure red: 0.299 * 255 = 76.245
    expect(toGreyscale(255, 0, 0)).toBeCloseTo(76.245, 1);
    // Pure green: 0.587 * 255 = 149.685
    expect(toGreyscale(0, 255, 0)).toBeCloseTo(149.685, 1);
    // Pure blue: 0.114 * 255 = 29.07
    expect(toGreyscale(0, 0, 255)).toBeCloseTo(29.07, 1);
  });
});

describe('circleToPath', () => {
  it('returns valid SVG arc path string', () => {
    const path = circleToPath(10, 20, 5);
    expect(path).toContain('M10,20');
    expect(path).toContain('m-5,0');
    expect(path).toContain('a5,5 0 1,0 10,0');
    expect(path).toContain('a5,5 0 1,0 -10,0');
  });
});

describe('generatePathData', () => {
  it('empty array → empty string', () => {
    expect(generatePathData([])).toBe('');
  });

  it('multiple circles → concatenated paths', () => {
    const circles = [
      { x: 0, y: 0, r: 1 },
      { x: 10, y: 10, r: 2 },
    ];
    const result = generatePathData(circles);
    expect(result).toContain('M0,0');
    expect(result).toContain('M10,10');
  });
});

describe('calculateDisplayDimensions', () => {
  const natW = 800;
  const natH = 400;

  it('no props → natural dimensions', () => {
    const dims = calculateDisplayDimensions(natW, natH);
    expect(dims).toEqual({ width: 800, height: 400 });
  });

  it('width only → height scaled by aspect ratio', () => {
    const dims = calculateDisplayDimensions(natW, natH, 400);
    expect(dims.width).toBe(400);
    expect(dims.height).toBe(200); // 400 / (800/400)
  });

  it('height only → width scaled by aspect ratio', () => {
    const dims = calculateDisplayDimensions(natW, natH, undefined, 200);
    expect(dims.height).toBe(200);
    expect(dims.width).toBe(400); // 200 * (800/400)
  });

  it('both → fit within bounds preserving aspect ratio', () => {
    // Constrained by width: 300/800 = 0.375, 300/400 = 0.75 → scale = 0.375
    const dims = calculateDisplayDimensions(natW, natH, 300, 300);
    expect(dims.width).toBe(300);
    expect(dims.height).toBe(150);
  });

  it('both → constrained by height', () => {
    // 800/800 = 1, 100/400 = 0.25 → scale = 0.25
    const dims = calculateDisplayDimensions(natW, natH, 800, 100);
    expect(dims.width).toBe(200); // 800 * 0.25
    expect(dims.height).toBe(100); // 400 * 0.25
  });
});
