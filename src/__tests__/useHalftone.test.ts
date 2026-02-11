import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHalftone } from '../useHalftone';

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

// Mock core functions that depend on canvas
vi.mock('../core', async () => {
  const actual = await vi.importActual('../core');
  return {
    ...actual,
    calculateGrid: vi.fn().mockReturnValue({
      stepPx: 10,
      maxRadius: 4,
      numCols: 10,
      numRows: 10,
      startX: 5,
      startY: 5,
    }),
    generateCircles: vi.fn().mockReturnValue([
      { x: 10, y: 10, r: 5 },
      { x: 20, y: 20, r: 3 },
    ]),
    generatePathData: vi.fn().mockReturnValue(
      'M10,10 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 M20,20 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0 '
    ),
  };
});

const mockCtx = {
  drawImage: vi.fn(),
  getImageData: vi.fn().mockReturnValue({ data: [0, 0, 0, 255] }),
};

const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  mockImageInstances = [];
  vi.stubGlobal('Image', MockImage);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: any) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => mockCtx,
      } as any;
    }
    return originalCreateElement(tag, options);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('useHalftone', () => {
  describe('initial/loading state', () => {
    it('returns loading state before image loads', () => {
      const { result } = renderHook(() => useHalftone('test.png'));

      expect(result.current).toEqual({
        loading: true,
        error: null,
        circles: null,
        pathData: null,
        naturalWidth: null,
        naturalHeight: null,
        circleCount: 0,
      });
    });
  });

  describe('successful load', () => {
    it('returns circles, pathData, and dimensions after load', () => {
      const { result } = renderHook(() => useHalftone('test.png'));
      triggerImageLoad();

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.circles).toHaveLength(2);
      expect(result.current.pathData).toContain('M10,10');
      expect(result.current.naturalWidth).toBe(100);
      expect(result.current.naturalHeight).toBe(100);
      expect(result.current.circleCount).toBe(2);
    });
  });

  describe('error handling', () => {
    it('sets error on image load failure', () => {
      const { result } = renderHook(() => useHalftone('bad.png'));
      triggerImageError();

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Failed to load image: bad.png');
      expect(result.current.circles).toBeNull();
      expect(result.current.pathData).toBeNull();
      expect(result.current.circleCount).toBe(0);
    });
  });

  describe('config defaults', () => {
    it('works with empty config', () => {
      const { result } = renderHook(() => useHalftone('test.png', {}));
      triggerImageLoad();

      expect(result.current.loading).toBe(false);
      expect(result.current.circles).not.toBeNull();
    });
  });

  describe('dependency changes', () => {
    it('changing src triggers a new image load', () => {
      const { result, rerender } = renderHook(
        ({ src }) => useHalftone(src),
        { initialProps: { src: 'first.png' } }
      );
      triggerImageLoad(0);
      expect(result.current.loading).toBe(false);

      rerender({ src: 'second.png' });
      expect(result.current.loading).toBe(true);
      expect(mockImageInstances).toHaveLength(2);

      triggerImageLoad(1);
      expect(result.current.loading).toBe(false);
    });

    it('changing config values triggers re-processing', () => {
      const { result, rerender } = renderHook(
        ({ step }) => useHalftone('test.png', { step }),
        { initialProps: { step: 10 } }
      );
      triggerImageLoad(0);
      expect(result.current.loading).toBe(false);

      rerender({ step: 20 });
      expect(result.current.loading).toBe(true);
      expect(mockImageInstances).toHaveLength(2);
    });

    it('changing shape config triggers re-processing', () => {
      const { result, rerender } = renderHook(
        ({ shape }) => useHalftone('test.png', { shape }),
        { initialProps: { shape: 'circle' as const } }
      );
      triggerImageLoad(0);
      expect(result.current.loading).toBe(false);

      rerender({ shape: 'square' as const });
      expect(result.current.loading).toBe(true);
      expect(mockImageInstances).toHaveLength(2);

      triggerImageLoad(1);
      expect(result.current.loading).toBe(false);
    });

    it('changing cornerRadius config triggers re-processing', () => {
      const { result, rerender } = renderHook(
        ({ cornerRadius }) => useHalftone('test.png', { shape: 'square', cornerRadius }),
        { initialProps: { cornerRadius: 0 } }
      );
      triggerImageLoad(0);
      expect(result.current.loading).toBe(false);

      rerender({ cornerRadius: 50 });
      expect(result.current.loading).toBe(true);
      expect(mockImageInstances).toHaveLength(2);

      triggerImageLoad(1);
      expect(result.current.loading).toBe(false);
    });

    it('changing invert config triggers re-processing', () => {
      const { result, rerender } = renderHook(
        ({ invert }) => useHalftone('test.png', { invert }),
        { initialProps: { invert: false } }
      );
      triggerImageLoad(0);
      expect(result.current.loading).toBe(false);

      rerender({ invert: true });
      expect(result.current.loading).toBe(true);
      expect(mockImageInstances).toHaveLength(2);

      triggerImageLoad(1);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('cleanup / stale closure', () => {
    it('ignores stale load when src changes before completion', () => {
      const { result, rerender } = renderHook(
        ({ src }) => useHalftone(src),
        { initialProps: { src: 'first.png' } }
      );

      // Change src before first image loads
      rerender({ src: 'second.png' });

      // Trigger load on first (stale) image — should be ignored
      triggerImageLoad(0);
      expect(result.current.loading).toBe(true);
      expect(result.current.circles).toBeNull();

      // Trigger load on second image
      triggerImageLoad(1);
      expect(result.current.loading).toBe(false);
      expect(result.current.circles).not.toBeNull();
    });

    it('no state updates after unmount', () => {
      const { result, unmount } = renderHook(() => useHalftone('test.png'));
      unmount();

      // Should not throw — handlers are cleared
      const img = mockImageInstances[0];
      expect(img.onload).toBeNull();
      expect(img.onerror).toBeNull();
    });
  });

  describe('empty src', () => {
    it('returns idle state with empty src', () => {
      const { result } = renderHook(() => useHalftone(''));

      expect(result.current).toEqual({
        loading: false,
        error: null,
        circles: null,
        pathData: null,
        naturalWidth: null,
        naturalHeight: null,
        circleCount: 0,
      });
      expect(mockImageInstances).toHaveLength(0);
    });
  });
});
