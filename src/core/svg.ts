import type { Circle, ShapeType, CMYKChannel, CMYKChannelResult } from './types';

const CMYK_DRAW_ORDER: CMYKChannel[] = ['c', 'm', 'y', 'k'];

export function circleToPath(cx: number, cy: number, r: number): string {
  return `M${cx},${cy} m-${r},0 a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 -${r * 2},0 `;
}

export function squareToPath(cx: number, cy: number, s: number, cornerRadiusPct: number): string {
  if (cornerRadiusPct <= 0) {
    const x = cx - s;
    const y = cy - s;
    const side = s * 2;
    return `M${x},${y} h${side} v${side} h-${side} z `;
  }

  const cr = s * (cornerRadiusPct / 100);
  const straight = 2 * (s - cr);
  const x0 = cx - s + cr;
  const y0 = cy - s;
  return `M${x0},${y0} h${straight} a${cr},${cr} 0 0,1 ${cr},${cr} v${straight} a${cr},${cr} 0 0,1 -${cr},${cr} h-${straight} a${cr},${cr} 0 0,1 -${cr},-${cr} v-${straight} a${cr},${cr} 0 0,1 ${cr},-${cr} z `;
}

export function generatePathData(
  circles: Circle[],
  shape: ShapeType = 'circle',
  cornerRadius: number = 0
): string {
  if (shape === 'square') {
    return circles.map((c) => squareToPath(c.x, c.y, c.r, cornerRadius)).join('');
  }
  return circles.map((c) => circleToPath(c.x, c.y, c.r)).join('');
}

export interface SVGRenderOptions {
  width: number;
  height: number;
  color?: string;
}

/**
 * Render a monochrome halftone result to a standalone SVG string.
 * Environment-agnostic — usable in the browser or at build time in Node.
 */
export function renderHalftoneSVG(
  pathData: string,
  { width, height, color = '#000000' }: SVGRenderOptions
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<path d="${pathData}" fill="${color}"/>` +
    `</svg>`
  );
}

export interface CMYKSVGRenderOptions {
  width: number;
  height: number;
  shape?: ShapeType;
  cornerRadius?: number;
}

/**
 * Render a CMYK halftone result to a standalone SVG string using multiply
 * blending over a white background — the vector equivalent of the canvas output.
 * Environment-agnostic — usable in the browser or at build time in Node.
 */
export function renderHalftoneCMYKSVG(
  channels: Record<CMYKChannel, CMYKChannelResult>,
  { width, height, shape = 'circle', cornerRadius = 0 }: CMYKSVGRenderOptions
): string {
  let groups = '';
  for (const ch of CMYK_DRAW_ORDER) {
    const { circles, color } = channels[ch];
    if (circles.length === 0) continue;
    const d = generatePathData(circles, shape, cornerRadius);
    groups += `<path d="${d}" fill="${color}" style="mix-blend-mode:multiply"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="#FFFFFF"/>` +
    groups +
    `</svg>`
  );
}
