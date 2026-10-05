import type { ShapeType } from './types';

/**
 * Dot sizing.
 *
 * A halftone reads as the fraction of each grid cell its dot covers, so a dot
 * is sized by area, not radius: ink 0.5 at density 100 covers half the cell.
 * Sizing the radius linearly instead covers ink² of the cell — midtones come
 * out far too light and solids never fill in.
 *
 * Sizes here are half-sizes (a circle's radius, half a square's side), which is
 * what `Circle.r` holds for every shape. Geometry is in cell units (a 1×1
 * cell) unless a name says otherwise.
 */

/**
 * How round a dot is: 1 for a circle, `cornerRadius / 100` for a square (0 is
 * sharp corners). A rounded square's corner arcs have radius
 * `roundness × halfSize`, matching how both renderers draw it.
 */
export function dotRoundness(shape: ShapeType, cornerRadius: number): number {
  if (shape === 'circle') return 1;
  return Math.max(0, Math.min(1, cornerRadius / 100));
}

/**
 * Fraction of its 1×1 cell covered by a dot of half-size `s`, including where
 * the dot grows into its neighbours.
 *
 * Neighbours never darken a cell beyond what its own dot does: every point in
 * a cell is nearer its own centre than any other, and these shapes are convex
 * and symmetric, so a neighbour's overspill always lands inside the cell's own
 * dot. Coverage is therefore just the dot clipped to its cell. (On a rotated
 * CMYK screen squares stay axis-aligned, so once they touch this slightly
 * overstates their coverage.)
 */
export function dotCoverage(s: number, roundness: number): number {
  if (s <= 0) return 0;
  const arcRadius = s * roundness;
  if (s <= 0.5) return 4 * s * s - (4 - Math.PI) * arcRadius * arcRadius;

  // The dot overflows its cell. Per quarter cell, the only part it can leave
  // uncovered is the corner square between the arc's centre and the cell
  // corner, minus whatever of that square the arc still reaches.
  const corner = 0.5 - (s - arcRadius);
  if (corner <= 0) return 1;
  return 1 - 4 * (corner * corner - quarterDiscInSquare(arcRadius, corner));
}

/** Area of a quarter disc of radius `r` that lies inside the square [0, a]². */
function quarterDiscInSquare(r: number, a: number): number {
  if (r <= a) return (Math.PI * r * r) / 4;
  if (r >= a * Math.SQRT2) return a * a;
  const x0 = Math.sqrt(r * r - a * a);
  return a * x0 + 0.5 * r * r * (Math.asin(a / r) - Math.asin(x0 / r));
}

/** Maps an ink amount (0–1) to a dot half-size in pixels — see `createDotSizer`. */
export type DotSizer = (ink: number) => number;

// Above the point where dots overflow their cells, coverage has no closed-form
// inverse. It is inverted once per sizer into this many table steps and
// interpolated per dot, which keeps the per-dot cost to a lookup.
const OVERFLOW_TABLE_STEPS = 256;
const BISECT_ITERATIONS = 40;

/**
 * Build a function mapping an ink amount (0–1) to a dot half-size in pixels,
 * such that the dot covers `ink × density%` of its cell.
 *
 * At density 100, full ink is a solid: dots grow past their cells until they
 * merge (a circle reaches `stepPx / √2`).
 */
export function createDotSizer(
  stepPx: number,
  density: number,
  shape: ShapeType,
  cornerRadius: number
): DotSizer {
  const roundness = dotRoundness(shape, cornerRadius);
  const maxCoverage = density / 100;

  // While a dot fits inside its cell its area is `areaPerS2 × s²`.
  const areaPerS2 = 4 - (4 - Math.PI) * roundness * roundness;
  const fitCoverage = dotCoverage(0.5, roundness);
  // The half-size at which the cell is fully covered.
  const solidS = (0.5 * Math.SQRT2) / (roundness + Math.SQRT2 * (1 - roundness));

  const table = fitCoverage < 1 ? buildOverflowTable(roundness, fitCoverage, solidS) : null;

  return (ink: number): number => {
    const coverage = ink * maxCoverage;
    if (!(coverage > 0)) return 0;
    if (coverage <= fitCoverage) return Math.sqrt(coverage / areaPerS2) * stepPx;
    if (coverage >= 1 || table === null) return solidS * stepPx;

    const pos = ((coverage - fitCoverage) / (1 - fitCoverage)) * OVERFLOW_TABLE_STEPS;
    const i = Math.min(Math.floor(pos), OVERFLOW_TABLE_STEPS - 1);
    const t = pos - i;
    return (table[i] + (table[i + 1] - table[i]) * t) * stepPx;
  };
}

/**
 * Half-sizes for coverages evenly spaced from `fitCoverage` (half-size 0.5) to
 * 1 (half-size `solidS`), found by bisection — coverage rises monotonically
 * with size, so bisection always converges.
 */
function buildOverflowTable(roundness: number, fitCoverage: number, solidS: number): Float64Array {
  const table = new Float64Array(OVERFLOW_TABLE_STEPS + 1);
  table[0] = 0.5;
  table[OVERFLOW_TABLE_STEPS] = solidS;

  for (let i = 1; i < OVERFLOW_TABLE_STEPS; i++) {
    const target = fitCoverage + ((1 - fitCoverage) * i) / OVERFLOW_TABLE_STEPS;
    let lo = 0.5;
    let hi = solidS;
    for (let k = 0; k < BISECT_ITERATIONS; k++) {
      const mid = (lo + hi) / 2;
      if (dotCoverage(mid, roundness) < target) lo = mid;
      else hi = mid;
    }
    table[i] = (lo + hi) / 2;
  }

  return table;
}
