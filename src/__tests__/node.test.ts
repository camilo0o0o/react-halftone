// @vitest-environment node
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  halftoneToSVG,
  halftoneToPNG,
  halftoneCMYKToSVG,
  halftoneCMYKToPNG,
} from '../node';

// A 120x80 image: red left half, blue right half.
async function testPng(): Promise<Buffer> {
  const w = 120;
  const h = 80;
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      if (x < w / 2) {
        raw[o] = 220; raw[o + 1] = 40; raw[o + 2] = 40;
      } else {
        raw[o] = 40; raw[o + 1] = 40; raw[o + 2] = 220;
      }
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

describe('react-halftone/node build-time API', () => {
  it('halftoneToSVG returns a standalone SVG at natural dimensions', async () => {
    const svg = await halftoneToSVG(await testPng(), { step: 6, color: '#112233' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 120 80"');
    expect(svg).toContain('fill="#112233"');
    expect(svg).toContain('<path');
  });

  it('halftoneToPNG returns a PNG buffer at natural dimensions', async () => {
    const png = await halftoneToPNG(await testPng(), { step: 6 });
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(80);
  });

  it('halftoneCMYKToSVG uses multiply blending over a white backdrop', async () => {
    const svg = await halftoneCMYKToSVG(await testPng(), { step: 6 });
    expect(svg).toContain('<rect width="120" height="80" fill="#FFFFFF"/>');
    expect(svg).toContain('mix-blend-mode:multiply');
    // A red/blue image exercises the cyan/magenta/yellow channels.
    expect(svg).toContain('fill="#00FFFF"');
  });

  it('halftoneCMYKToPNG composites channels into a PNG at natural dimensions', async () => {
    const png = await halftoneCMYKToPNG(await testPng(), { step: 6 });
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(80);
  });
}, 20000);
