import { describe, it, expect } from 'vitest';
import { dotCoverage, dotRoundness, createDotSizer } from '../core';

/**
 * Ground truth by brute force: sample the central cell of a 3×3 block of dots
 * on a fine grid and count points inside ANY dot, so overlap with neighbours
 * is measured rather than assumed.
 */
function rasterCoverage(s: number, roundness: number, samples = 400): number {
  const arc = s * roundness;
  const inside = (dx: number, dy: number) => {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax > s || ay > s) return false;
    const cx = Math.max(ax - (s - arc), 0);
    const cy = Math.max(ay - (s - arc), 0);
    return cx * cx + cy * cy <= arc * arc + 1e-12;
  };

  let hit = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const x = (i + 0.5) / samples - 0.5;
      const y = (j + 0.5) / samples - 0.5;
      let covered = false;
      for (let nx = -1; nx <= 1 && !covered; nx++) {
        for (let ny = -1; ny <= 1 && !covered; ny++) {
          covered = inside(x - nx, y - ny);
        }
      }
      if (covered) hit++;
    }
  }
  return hit / (samples * samples);
}

const ROUNDNESSES = [1, 0, 0.25, 0.5, 0.75];
const HALF_SIZES = [0.1, 0.3, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7];

describe('dotCoverage', () => {
  for (const roundness of ROUNDNESSES) {
    it(`matches a brute-force raster at roundness ${roundness}`, () => {
      for (const s of HALF_SIZES) {
        expect(dotCoverage(s, roundness)).toBeCloseTo(rasterCoverage(s, roundness), 2);
      }
    });
  }

  it('is a circle area / square area while the dot fits its cell', () => {
    expect(dotCoverage(0.3, 1)).toBeCloseTo(Math.PI * 0.09);
    expect(dotCoverage(0.3, 0)).toBeCloseTo(0.36);
  });

  it('is solid once a circle reaches half the cell diagonal', () => {
    expect(dotCoverage(Math.SQRT1_2, 1)).toBeCloseTo(1);
    expect(dotCoverage(0.5, 0)).toBe(1);
  });

  it('is zero for a zero-size dot', () => {
    expect(dotCoverage(0, 1)).toBe(0);
  });
});

describe('dotRoundness', () => {
  it('is 1 for circles regardless of corner radius', () => {
    expect(dotRoundness('circle', 0)).toBe(1);
    expect(dotRoundness('circle', 40)).toBe(1);
  });

  it('is the corner radius fraction for squares', () => {
    expect(dotRoundness('square', 0)).toBe(0);
    expect(dotRoundness('square', 40)).toBe(0.4);
  });
});

describe('createDotSizer', () => {
  const STEP = 10;

  it('covers ink × density of the cell, for every shape', () => {
    const shapes = [
      ['circle', 0],
      ['square', 0],
      ['square', 50],
    ] as const;
    for (const [shape, cornerRadius] of shapes) {
      for (const density of [100, 80, 50]) {
        const size = createDotSizer(STEP, density, shape, cornerRadius);
        const roundness = dotRoundness(shape, cornerRadius);
        for (let ink = 0.05; ink <= 1; ink += 0.05) {
          const coverage = dotCoverage(size(ink) / STEP, roundness);
          expect(coverage).toBeCloseTo((ink * density) / 100, 3);
        }
      }
    }
  });

  it('prints full ink at density 100 as a solid', () => {
    expect(createDotSizer(STEP, 100, 'circle', 0)(1)).toBeCloseTo(STEP * Math.SQRT1_2);
    expect(createDotSizer(STEP, 100, 'square', 0)(1)).toBeCloseTo(STEP / 2);
  });

  it('gives half ink half the cell — area, not radius, tracks ink', () => {
    const r = createDotSizer(STEP, 100, 'circle', 0)(0.5);
    expect((Math.PI * r * r) / (STEP * STEP)).toBeCloseTo(0.5);
  });

  it('sizes squares smaller than circles for the same ink', () => {
    const circle = createDotSizer(STEP, 100, 'circle', 0)(0.4);
    const square = createDotSizer(STEP, 100, 'square', 0)(0.4);
    expect(square).toBeLessThan(circle);
    expect(4 * square * square).toBeCloseTo(Math.PI * circle * circle);
  });

  it('returns 0 for no ink, no density, and non-finite ink', () => {
    expect(createDotSizer(STEP, 100, 'circle', 0)(0)).toBe(0);
    expect(createDotSizer(STEP, 0, 'circle', 0)(1)).toBe(0);
    expect(createDotSizer(STEP, 100, 'circle', 0)(NaN)).toBe(0);
  });

  it('grows monotonically with ink', () => {
    const size = createDotSizer(STEP, 100, 'square', 30);
    let prev = 0;
    for (let ink = 0.01; ink <= 1; ink += 0.01) {
      const r = size(ink);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });
});
