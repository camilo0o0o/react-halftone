import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Halftone } from '../Halftone';
import type { UseHalftoneResult } from '../types';
import { useHalftone } from '../useHalftone';

const defaultHookResult: UseHalftoneResult = {
  loading: false,
  error: null,
  circles: [{ x: 10, y: 10, r: 5 }],
  pathData: 'M10,10 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 ',
  naturalWidth: 100,
  naturalHeight: 100,
  circleCount: 1,
};

let mockHookResult: UseHalftoneResult = { ...defaultHookResult };

vi.mock('../useHalftone', () => ({
  useHalftone: vi.fn(() => mockHookResult),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  mockHookResult = { ...defaultHookResult };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

function render(el: React.ReactElement) {
  act(() => {
    root.render(el);
  });
}

describe('Halftone component', () => {
  describe('rendering states', () => {
    it('returns null while loading', () => {
      mockHookResult = { ...defaultHookResult, loading: true, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<Halftone src="test.png" />);
      expect(container.querySelector('svg')).toBeNull();
    });

    it('renders SVG after successful load', () => {
      render(<Halftone src="test.png" />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
    });

    it('returns null on error', () => {
      mockHookResult = { ...defaultHookResult, error: new Error('fail'), circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<Halftone src="bad.png" />);
      expect(container.querySelector('svg')).toBeNull();
    });

    it('returns null when src is empty', () => {
      mockHookResult = { ...defaultHookResult, loading: false, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<Halftone src="" />);
      expect(container.querySelector('svg')).toBeNull();
    });
  });

  describe('SVG output', () => {
    it('has correct viewBox, width, height attributes', () => {
      render(<Halftone src="test.png" />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
      expect(svg.getAttribute('width')).toBe('100');
      expect(svg.getAttribute('height')).toBe('100');
    });

    it('<path> has correct fill color', () => {
      render(<Halftone src="test.png" color="#ff0000" />);
      const path = container.querySelector('path')!;
      expect(path.getAttribute('fill')).toBe('#ff0000');
    });

    it('uses default color when none provided', () => {
      render(<Halftone src="test.png" />);
      const path = container.querySelector('path')!;
      expect(path.getAttribute('fill')).toBe('#000000');
    });

    it('className forwarded to <svg>', () => {
      render(<Halftone src="test.png" className="my-class" />);
      const svg = container.querySelector('svg')!;
      expect(svg.classList.contains('my-class')).toBe(true);
    });

    it('style forwarded to <svg>', () => {
      render(<Halftone src="test.png" style={{ opacity: 0.5 }} />);
      const svg = container.querySelector('svg')!;
      expect(svg.style.opacity).toBe('0.5');
    });
  });

  describe('shape and cornerRadius props', () => {
    it('forwards shape and cornerRadius to useHalftone', () => {
      render(<Halftone src="test.png" shape="square" cornerRadius={30} />);
      expect(useHalftone).toHaveBeenCalledWith('test.png', expect.objectContaining({
        shape: 'square',
        cornerRadius: 30,
      }));
    });

    it('forwards shape without cornerRadius', () => {
      render(<Halftone src="test.png" shape="square" />);
      expect(useHalftone).toHaveBeenCalledWith('test.png', expect.objectContaining({
        shape: 'square',
      }));
    });

    it('renders SVG when shape is square', () => {
      render(<Halftone src="test.png" shape="square" />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
    });
  });

  describe('display dimensions', () => {
    it('uses natural dimensions by default', () => {
      render(<Halftone src="test.png" />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('width')).toBe('100');
      expect(svg.getAttribute('height')).toBe('100');
    });

    it('calculates dimensions from width prop', () => {
      render(<Halftone src="test.png" width={200} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('width')).toBe('200');
      expect(svg.getAttribute('height')).toBe('200');
    });

    it('calculates dimensions from height prop', () => {
      render(<Halftone src="test.png" height={50} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('width')).toBe('50');
      expect(svg.getAttribute('height')).toBe('50');
    });
  });
});
