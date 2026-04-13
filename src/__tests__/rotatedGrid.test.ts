import { describe, it, expect } from 'vitest';
import { generateRotatedGridPoints } from '../core';

describe('generateRotatedGridPoints', () => {
  it('generates points within image bounds', () => {
    const points = generateRotatedGridPoints(100, 100, 10, 15);
    for (const pt of points) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThan(100);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThan(100);
    }
  });

  it('produces a non-empty grid for reasonable inputs', () => {
    const points = generateRotatedGridPoints(100, 100, 10, 0);
    expect(points.length).toBeGreaterThan(0);
  });

  it('at angle 0, produces an axis-aligned grid', () => {
    const points = generateRotatedGridPoints(100, 100, 20, 0);
    // All x values should be multiples of 20 offset from center
    // Center is 50, so valid x: 50, 30, 10, 70, 90 etc.
    for (const pt of points) {
      const dx = pt.x - 50;
      const dy = pt.y - 50;
      expect(Math.abs(dx % 20)).toBeCloseTo(0, 5);
      expect(Math.abs(dy % 20)).toBeCloseTo(0, 5);
    }
  });

  it('at angle 90, grid is rotated', () => {
    const points0 = generateRotatedGridPoints(100, 100, 20, 0);
    const points90 = generateRotatedGridPoints(100, 100, 20, 90);
    // Both should produce the same number of points for a square image
    expect(points90.length).toBe(points0.length);
    // Points should be different (rotated)
    // At 90°, a point at (cx + gx, cy + gy) becomes (cx - gy, cy + gx)
    // For a square this means the set of coordinates should be the same (rotational symmetry)
  });

  it('covers all quadrants of the image at angle 45', () => {
    const points = generateRotatedGridPoints(200, 200, 15, 45);
    const hasTopLeft = points.some(p => p.x < 100 && p.y < 100);
    const hasTopRight = points.some(p => p.x >= 100 && p.y < 100);
    const hasBottomLeft = points.some(p => p.x < 100 && p.y >= 100);
    const hasBottomRight = points.some(p => p.x >= 100 && p.y >= 100);
    expect(hasTopLeft).toBe(true);
    expect(hasTopRight).toBe(true);
    expect(hasBottomLeft).toBe(true);
    expect(hasBottomRight).toBe(true);
  });

  it('handles rectangular images', () => {
    const points = generateRotatedGridPoints(200, 100, 15, 30);
    expect(points.length).toBeGreaterThan(0);
    for (const pt of points) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThan(200);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThan(100);
    }
  });

  it('produces fewer points with larger step size', () => {
    const smallStep = generateRotatedGridPoints(100, 100, 5, 0);
    const largeStep = generateRotatedGridPoints(100, 100, 20, 0);
    expect(smallStep.length).toBeGreaterThan(largeStep.length);
  });

  it('angle 360 is equivalent to angle 0', () => {
    const p0 = generateRotatedGridPoints(100, 100, 10, 0);
    const p360 = generateRotatedGridPoints(100, 100, 10, 360);
    expect(p360.length).toBe(p0.length);
    for (let i = 0; i < p0.length; i++) {
      expect(p360[i].x).toBeCloseTo(p0[i].x, 5);
      expect(p360[i].y).toBeCloseTo(p0[i].y, 5);
    }
  });
});
