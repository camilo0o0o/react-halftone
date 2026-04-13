import { describe, it, expect } from 'vitest';
import { rgbToCmyk } from '../colorConversion';

describe('rgbToCmyk', () => {
  it('converts pure white to all zeros', () => {
    expect(rgbToCmyk(255, 255, 255)).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });

  it('converts pure black to k=1, rest zero', () => {
    expect(rgbToCmyk(0, 0, 0)).toEqual({ c: 0, m: 0, y: 0, k: 1 });
  });

  it('converts pure red (255,0,0) correctly', () => {
    const result = rgbToCmyk(255, 0, 0);
    expect(result.c).toBeCloseTo(0);
    expect(result.m).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(1);
    expect(result.k).toBeCloseTo(0);
  });

  it('converts pure green (0,255,0) correctly', () => {
    const result = rgbToCmyk(0, 255, 0);
    expect(result.c).toBeCloseTo(1);
    expect(result.m).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
    expect(result.k).toBeCloseTo(0);
  });

  it('converts pure blue (0,0,255) correctly', () => {
    const result = rgbToCmyk(0, 0, 255);
    expect(result.c).toBeCloseTo(1);
    expect(result.m).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
    expect(result.k).toBeCloseTo(0);
  });

  it('converts pure cyan (0,255,255) correctly', () => {
    const result = rgbToCmyk(0, 255, 255);
    expect(result.c).toBeCloseTo(1);
    expect(result.m).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.k).toBeCloseTo(0);
  });

  it('converts pure magenta (255,0,255) correctly', () => {
    const result = rgbToCmyk(255, 0, 255);
    expect(result.c).toBeCloseTo(0);
    expect(result.m).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
    expect(result.k).toBeCloseTo(0);
  });

  it('converts pure yellow (255,255,0) correctly', () => {
    const result = rgbToCmyk(255, 255, 0);
    expect(result.c).toBeCloseTo(0);
    expect(result.m).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
    expect(result.k).toBeCloseTo(0);
  });

  it('converts grey (128,128,128) to only K component', () => {
    const result = rgbToCmyk(128, 128, 128);
    expect(result.c).toBeCloseTo(0);
    expect(result.m).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.k).toBeCloseTo(1 - 128 / 255);
  });

  it('applies GCR — common component moves to K', () => {
    // RGB(100, 150, 200): the darkest channel determines K
    const result = rgbToCmyk(100, 150, 200);
    const rn = 100 / 255, gn = 150 / 255, bn = 200 / 255;
    const cRaw = 1 - rn, mRaw = 1 - gn, yRaw = 1 - bn;
    const k = Math.min(cRaw, mRaw, yRaw);
    expect(result.k).toBeCloseTo(k);
    expect(result.c).toBeCloseTo((cRaw - k) / (1 - k));
    expect(result.m).toBeCloseTo((mRaw - k) / (1 - k));
    expect(result.y).toBeCloseTo((yRaw - k) / (1 - k));
  });

  it('handles near-black values (1,1,1)', () => {
    const result = rgbToCmyk(1, 1, 1);
    expect(result.k).toBeCloseTo(1 - 1 / 255);
    expect(result.c).toBeCloseTo(0);
    expect(result.m).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });
});
