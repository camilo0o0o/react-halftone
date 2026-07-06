/**
 * CMYK color values, each in the range [0, 1]
 */
export interface CMYK {
  c: number;
  m: number;
  y: number;
  k: number;
}

/**
 * Convert RGB (0-255) to CMYK (0-1) with Grey Component Replacement.
 * K = min(C', M', Y') where C', M', Y' are naive CMY values.
 * For pure black (r=g=b=0), returns {c:0, m:0, y:0, k:1}.
 */
export function rgbToCmyk(r: number, g: number, b: number): CMYK {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const cRaw = 1 - rn;
  const mRaw = 1 - gn;
  const yRaw = 1 - bn;

  const k = Math.min(cRaw, mRaw, yRaw);

  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 1 };
  }

  const invK = 1 - k;
  return {
    c: (cRaw - k) / invK,
    m: (mRaw - k) / invK,
    y: (yRaw - k) / invK,
    k,
  };
}
