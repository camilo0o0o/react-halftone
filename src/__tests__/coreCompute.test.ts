import { describe, it, expect } from 'vitest';
import { createCanvas } from 'canvas';
import {
  computeHalftone,
  computeHalftoneCMYK,
  renderHalftoneSVG,
  renderHalftoneCMYKSVG,
} from '../core';

function pixelsFor(width: number, height: number, color: string) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  (ctx as any).fillStyle = color;
  (ctx as any).fillRect(0, 0, width, height);
  return (ctx as any).getImageData(0, 0, width, height).data as Uint8ClampedArray;
}

describe('computeHalftoneCMYK', () => {
  it('a black image populates only the K channel', () => {
    const pixels = pixelsFor(100, 100, '#000000');
    const { channels } = computeHalftoneCMYK(pixels, 100, 100, 1, { step: 10 });

    expect(channels.k.circles.length).toBeGreaterThan(0);
    expect(channels.c.circles.length).toBe(0);
    expect(channels.m.circles.length).toBe(0);
    expect(channels.y.circles.length).toBe(0);
  });

  it('carries default screen angles and channel colors', () => {
    const pixels = pixelsFor(50, 50, '#6496C8');
    const { channels } = computeHalftoneCMYK(pixels, 50, 50, 1);

    expect(channels.c.angle).toBe(15);
    expect(channels.m.angle).toBe(75);
    expect(channels.y.angle).toBe(0);
    expect(channels.k.angle).toBe(45);
    expect(channels.c.color).toBe('#00FFFF');
    expect(channels.k.color).toBe('#000000');
  });

  it('returns circles in natural space when scale > 1', () => {
    const pixels = pixelsFor(50, 50, '#000000');
    const scaled = computeHalftoneCMYK(pixels, 50, 50, 2, { step: 10 });
    const unscaled = computeHalftoneCMYK(pixels, 50, 50, 1, { step: 10 });

    // Same grid, but scaled coordinates should be ~2x the unscaled ones.
    const maxScaledX = Math.max(...scaled.channels.k.circles.map((c) => c.x));
    const maxUnscaledX = Math.max(...unscaled.channels.k.circles.map((c) => c.x));
    expect(maxScaledX).toBeGreaterThan(maxUnscaledX * 1.5);
  });
});

describe('renderHalftoneSVG', () => {
  it('produces a valid standalone SVG with the path and color', () => {
    const pixels = pixelsFor(100, 100, '#333333');
    const { pathData } = computeHalftone(pixels, 100, 100, 1, { step: 10 });
    const svg = renderHalftoneSVG(pathData, { width: 100, height: 100, color: '#123456' });

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain('<path');
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});

describe('renderHalftoneCMYKSVG', () => {
  it('renders a white backdrop and multiply-blended channel groups', () => {
    const pixels = pixelsFor(100, 100, '#6496C8');
    const { channels } = computeHalftoneCMYK(pixels, 100, 100, 1, { step: 10 });
    const svg = renderHalftoneCMYKSVG(channels, { width: 100, height: 100 });

    expect(svg).toContain('<rect width="100" height="100" fill="#FFFFFF"/>');
    expect(svg).toContain('mix-blend-mode:multiply');
    // C, M and K are present for this blue-ish color; each gets its own path.
    expect(svg).toContain('fill="#00FFFF"');
    expect(svg).toContain('fill="#000000"');
  });

  it('omits channels with no dots', () => {
    const pixels = pixelsFor(100, 100, '#000000'); // pure black -> only K
    const { channels } = computeHalftoneCMYK(pixels, 100, 100, 1, { step: 10 });
    const svg = renderHalftoneCMYKSVG(channels, { width: 100, height: 100 });

    expect(svg).toContain('fill="#000000"');
    expect(svg).not.toContain('fill="#00FFFF"');
  });
});
