import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  calculateGrid,
  toGreyscale,
  circleToPath,
  squareToPath,
  generatePathData,
  calculateDisplayDimensions,
  computeDownsampleScale,
  scaleCircles,
} from '../core';

describe('validateConfig', () => {
  it('returns defaults when called with {}', () => {
    const config = validateConfig({});
    expect(config).toEqual({ step: 10, density: 80, color: '#000000', invert: false, shape: 'circle', cornerRadius: 0, stepBasis: 'min' });
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

  it('accepts invert: true', () => {
    expect(validateConfig({ invert: true }).invert).toBe(true);
  });

  it('defaults invert to false when not provided', () => {
    expect(validateConfig({}).invert).toBe(false);
    expect(validateConfig({ step: 5 }).invert).toBe(false);
  });

  it('defaults shape to circle when not provided', () => {
    expect(validateConfig({}).shape).toBe('circle');
  });

  it('accepts shape: square', () => {
    expect(validateConfig({ shape: 'square' }).shape).toBe('square');
  });

  it('accepts shape: circle', () => {
    expect(validateConfig({ shape: 'circle' }).shape).toBe('circle');
  });

  it('falls back to circle for invalid shape values', () => {
    expect(validateConfig({ shape: 'triangle' as any }).shape).toBe('circle');
    expect(validateConfig({ shape: '' as any }).shape).toBe('circle');
  });

  it('defaults cornerRadius to 0 when not provided', () => {
    expect(validateConfig({}).cornerRadius).toBe(0);
  });

  it('clamps cornerRadius below 0', () => {
    expect(validateConfig({ cornerRadius: -10 }).cornerRadius).toBe(0);
  });

  it('clamps cornerRadius above 100', () => {
    expect(validateConfig({ cornerRadius: 150 }).cornerRadius).toBe(100);
  });

  it('accepts valid cornerRadius values', () => {
    expect(validateConfig({ cornerRadius: 50 }).cornerRadius).toBe(50);
    expect(validateConfig({ cornerRadius: 0 }).cornerRadius).toBe(0);
    expect(validateConfig({ cornerRadius: 100 }).cornerRadius).toBe(100);
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

  it('stepBasis=width on landscape uses width as reference', () => {
    const grid = calculateGrid(400, 200, 10, 50, 'width');
    // reference = width = 400, stepPx = 400 * 0.1 = 40
    expect(grid.stepPx).toBe(40);
  });

  it('stepBasis=min on landscape uses smaller dimension', () => {
    const grid = calculateGrid(400, 200, 10, 50, 'min');
    // reference = min(400,200) = 200, stepPx = 200 * 0.1 = 20
    expect(grid.stepPx).toBe(20);
  });

  it('stepBasis=width on portrait matches min (width is smaller)', () => {
    const grid = calculateGrid(200, 400, 10, 50, 'width');
    const gridMin = calculateGrid(200, 400, 10, 50, 'min');
    // portrait: width=200 is the smaller dim, so both should give stepPx=20
    expect(grid.stepPx).toBe(20);
    expect(grid.stepPx).toBe(gridMin.stepPx);
  });

  it('stepBasis=width on square matches min', () => {
    const grid = calculateGrid(200, 200, 10, 50, 'width');
    const gridMin = calculateGrid(200, 200, 10, 50, 'min');
    expect(grid.stepPx).toBe(gridMin.stepPx);
  });

  it('defaults to min when stepBasis is omitted', () => {
    const gridDefault = calculateGrid(400, 200, 10, 50);
    const gridMin = calculateGrid(400, 200, 10, 50, 'min');
    expect(gridDefault.stepPx).toBe(gridMin.stepPx);
  });
});

describe('toGreyscale', () => {
  it('white → 255', () => {
    expect(toGreyscale(255, 255, 255)).toBe(255);
  });

  it('black → 0', () => {
    expect(toGreyscale(0, 0, 0)).toBe(0);
  });

  it('pure colors → average of RGB', () => {
    // Simple average: (r + g + b) / 3
    expect(toGreyscale(255, 0, 0)).toBe(85); // 255 / 3
    expect(toGreyscale(0, 255, 0)).toBe(85);
    expect(toGreyscale(0, 0, 255)).toBe(85);
  });

  it('mixed color → correct average', () => {
    expect(toGreyscale(100, 150, 200)).toBeCloseTo(150, 0); // (100+150+200) / 3
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

describe('squareToPath', () => {
  it('returns sharp-corner square path when cornerRadius is 0', () => {
    const path = squareToPath(10, 20, 5, 0);
    // Square centered at (10,20) with half-side 5: top-left (5,15), side=10
    expect(path).toContain('M5,15');
    expect(path).toContain('h10');
    expect(path).toContain('v10');
    expect(path).toContain('h-10');
    expect(path).toContain('z');
  });

  it('returns rounded-corner square path when cornerRadius > 0', () => {
    const path = squareToPath(10, 20, 5, 50);
    // cornerRadiusPct=50, s=5 → cr = 5 * 0.5 = 2.5, straight = 2*(5-2.5)=5
    expect(path).toContain('a2.5,2.5');
    expect(path).toContain('h5');
    expect(path).toContain('v5');
    expect(path).toContain('z');
  });

  it('handles cornerRadius 100 (fully rounded)', () => {
    const path = squareToPath(10, 20, 5, 100);
    // cr = 5 * 1.0 = 5, straight = 2*(5-5) = 0
    expect(path).toContain('a5,5');
    expect(path).toContain('h0');
    expect(path).toContain('v0');
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

  it('with shape=square produces square paths', () => {
    const circles = [
      { x: 10, y: 10, r: 5 },
    ];
    const result = generatePathData(circles, 'square', 0);
    // Should contain square path elements, not arc elements
    expect(result).toContain('h10');
    expect(result).toContain('v10');
    expect(result).not.toContain('a5,5');
  });

  it('with shape=square and cornerRadius produces rounded square paths', () => {
    const circles = [
      { x: 10, y: 10, r: 5 },
    ];
    const result = generatePathData(circles, 'square', 50);
    expect(result).toContain('a2.5,2.5');
  });

  it('with shape=circle (default) produces circle paths', () => {
    const circles = [
      { x: 10, y: 10, r: 5 },
    ];
    const result = generatePathData(circles);
    expect(result).toContain('a5,5 0 1,0');
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

describe('computeDownsampleScale', () => {
  // Target is ~3.5 source pixels per grid cell: scale = max(1, stepPx / 3.5).
  it('returns 1 when cells are at/below the target size', () => {
    expect(computeDownsampleScale(3.5)).toBe(1);
    expect(computeDownsampleScale(1.5)).toBe(1);
    expect(computeDownsampleScale(1)).toBe(1);
    expect(computeDownsampleScale(0.1)).toBe(1);
  });

  it('downsamples proportionally as cell size grows', () => {
    expect(computeDownsampleScale(7)).toBeCloseTo(2);
    expect(computeDownsampleScale(35)).toBeCloseTo(10);
    expect(computeDownsampleScale(350)).toBeCloseTo(100);
  });
});

describe('scaleCircles', () => {
  it('returns same array when scale is 1', () => {
    const circles = [{ x: 10, y: 20, r: 5 }];
    expect(scaleCircles(circles, 1)).toBe(circles);
  });

  it('multiplies all coords and radii by scale', () => {
    const circles = [
      { x: 10, y: 20, r: 5 },
      { x: 30, y: 40, r: 2 },
    ];
    const scaled = scaleCircles(circles, 2);
    expect(scaled).toEqual([
      { x: 20, y: 40, r: 10 },
      { x: 60, y: 80, r: 4 },
    ]);
  });

  it('handles fractional scale', () => {
    const circles = [{ x: 10, y: 10, r: 4 }];
    const scaled = scaleCircles(circles, 1.5);
    expect(scaled[0].x).toBeCloseTo(15);
    expect(scaled[0].y).toBeCloseTo(15);
    expect(scaled[0].r).toBeCloseTo(6);
  });
});
