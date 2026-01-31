import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Halftone } from '../Halftone';

// Mock Image so we can control onload/onerror
let mockImageInstances: any[] = [];

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  naturalWidth = 100;
  naturalHeight = 100;
  private _src = '';

  constructor() {
    mockImageInstances.push(this);
  }

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
  }
}

// Mock generateHalftone to avoid canvas dependency in component tests
vi.mock('../core', async () => {
  const actual = await vi.importActual('../core');
  return {
    ...actual,
    generateHalftone: vi.fn().mockReturnValue({
      circles: [{ x: 10, y: 10, r: 5 }],
      pathData: 'M10,10 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 ',
      viewBox: '0 0 100 100',
    }),
  };
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  mockImageInstances = [];
  vi.stubGlobal('Image', MockImage);
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

function triggerImageLoad(index = 0) {
  const img = mockImageInstances[index];
  if (img?.onload) {
    act(() => {
      img.onload();
    });
  }
}

function triggerImageError(index = 0) {
  const img = mockImageInstances[index];
  if (img?.onerror) {
    act(() => {
      img.onerror();
    });
  }
}

describe('Halftone component', () => {
  describe('rendering states', () => {
    it('returns null while loading (empty container)', () => {
      render(<Halftone src="test.png" />);
      // Image hasn't loaded yet — should be empty
      expect(container.querySelector('svg')).toBeNull();
    });

    it('renders SVG after image loads', () => {
      render(<Halftone src="test.png" />);
      triggerImageLoad();

      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
    });

    it('returns null on image error', () => {
      render(<Halftone src="bad.png" />);
      triggerImageError();

      expect(container.querySelector('svg')).toBeNull();
    });

    it('returns null when src is empty', () => {
      render(<Halftone src="" />);
      expect(container.querySelector('svg')).toBeNull();
    });
  });

  describe('SVG output', () => {
    it('has correct viewBox, width, height attributes', () => {
      render(<Halftone src="test.png" />);
      triggerImageLoad();

      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
      expect(svg.getAttribute('width')).toBe('100');
      expect(svg.getAttribute('height')).toBe('100');
    });

    it('<path> has correct fill color', () => {
      render(<Halftone src="test.png" color="#ff0000" />);
      triggerImageLoad();

      const path = container.querySelector('path')!;
      expect(path.getAttribute('fill')).toBe('#ff0000');
    });

    it('className forwarded to <svg>', () => {
      render(<Halftone src="test.png" className="my-class" />);
      triggerImageLoad();

      const svg = container.querySelector('svg')!;
      expect(svg.classList.contains('my-class')).toBe(true);
    });

    it('style forwarded to <svg>', () => {
      render(<Halftone src="test.png" style={{ opacity: 0.5 }} />);
      triggerImageLoad();

      const svg = container.querySelector('svg')!;
      expect(svg.style.opacity).toBe('0.5');
    });
  });

  describe('prop changes', () => {
    it('changing src triggers re-render', () => {
      render(<Halftone src="first.png" />);
      triggerImageLoad(0);

      const svg1 = container.querySelector('svg');
      expect(svg1).not.toBeNull();

      // Change src — should go back to loading (null)
      render(<Halftone src="second.png" />);
      // New image hasn't loaded yet
      expect(container.querySelector('svg')).toBeNull();

      triggerImageLoad(1);
      expect(container.querySelector('svg')).not.toBeNull();
    });

    it('changing step/density/color re-processes', () => {
      render(<Halftone src="test.png" step={10} density={80} color="#000000" />);
      triggerImageLoad(0);
      expect(container.querySelector('svg')).not.toBeNull();

      // Changing props triggers a new useEffect → new Image load
      render(<Halftone src="test.png" step={20} density={50} color="#ff0000" />);
      triggerImageLoad(1);
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });
});
