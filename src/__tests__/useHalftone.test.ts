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

// Mock the orchestrator: the hook's job is load-image → compute → set-state.
vi.mock('../core', async () => {
  const actual = await vi.importActual<typeof import('../core')>('../core');
  return {
    ...actual,
    computeHalftone: vi.fn(() => ({
      circles: [
        { x: 10, y: 10, r: 5 },
        { x: 20, y: 20, r: 3 },
      ],
      pathData:
        'M10,10 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 M20,20 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0 ',
    })),
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
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
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
    it('returns loading status before image loads', () => {
      const { result } = renderHook(() => useHalftone('test.png'));

      expect(result.current).toEqual({
        status: 'loading',
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
    it('returns ready status with circles and pathData after load', () => {
      const { result } = renderHook(() => useHalftone('test.png'));
      triggerImageLoad();

      expect(result.current.status).toBe('ready');
      expect(result.current.error).toBeNull();
      expect(result.current.circles).toHaveLength(2);
      expect(result.current.pathData).toContain('M10,10');
      expect(result.current.naturalWidth).toBe(100);
      expect(result.current.naturalHeight).toBe(100);
      expect(result.current.circleCount).toBe(2);
    });
  });

  describe('error handling', () => {
    it('sets error status on image load failure', () => {
      const { result } = renderHook(() => useHalftone('bad.png'));
      triggerImageError();

      expect(result.current.status).toBe('error');
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

      expect(result.current.status).toBe('ready');
      expect(result.current.circles).not.toBeNull();
    });
  });

  describe('crossOrigin', () => {
    it('defaults to anonymous', () => {
      renderHook(() => useHalftone('test.png'));
      expect(mockImageInstances[0].crossOrigin).toBe('anonymous');
    });

    it('null opts out of the attribute entirely', () => {
      renderHook(() => useHalftone('test.png', { crossOrigin: null }));
      expect(mockImageInstances[0].crossOrigin).toBe('');
    });

    it('passes an explicit value through', () => {
      renderHook(() => useHalftone('test.png', { crossOrigin: 'use-credentials' }));
      expect(mockImageInstances[0].crossOrigin).toBe('use-credentials');
    });
  });

  describe('dependency changes', () => {
    it('changing src triggers a new image load', () => {
      const { result, rerender } = renderHook(
        ({ src }) => useHalftone(src),
        { initialProps: { src: 'first.png' } }
      );
      triggerImageLoad(0);
      expect(result.current.status).toBe('ready');

      rerender({ src: 'second.png' });
      expect(result.current.status).toBe('loading');
      expect(mockImageInstances).toHaveLength(2);

      // The first image's result must not linger while the second loads —
      // it would render the old image under the new src.
      expect(result.current.circles).toBeNull();
      expect(result.current.pathData).toBeNull();
      expect(result.current.naturalWidth).toBeNull();
      expect(result.current.naturalHeight).toBeNull();
      expect(result.current.circleCount).toBe(0);

      triggerImageLoad(1);
      expect(result.current.status).toBe('ready');
    });

    // Config changes recompute from the cached image WITHOUT reloading it —
    // this is the realtime perf win (no re-fetch/re-decode per slider tick).
    it('changing step recomputes without reloading the image', () => {
      const { result, rerender } = renderHook(
        ({ step }) => useHalftone('test.png', { step }),
        { initialProps: { step: 10 } }
      );
      triggerImageLoad(0);
      expect(result.current.status).toBe('ready');

      rerender({ step: 20 });
      expect(result.current.status).toBe('ready');
      expect(mockImageInstances).toHaveLength(1);
    });

    it('changing shape recomputes without reloading the image', () => {
      const { result, rerender } = renderHook(
        ({ shape }: { shape: 'circle' | 'square' }) => useHalftone('test.png', { shape }),
        { initialProps: { shape: 'circle' as 'circle' | 'square' } }
      );
      triggerImageLoad(0);
      expect(result.current.status).toBe('ready');

      rerender({ shape: 'square' as const });
      expect(result.current.status).toBe('ready');
      expect(mockImageInstances).toHaveLength(1);
    });

    it('changing invert recomputes without reloading the image', () => {
      const { result, rerender } = renderHook(
        ({ invert }) => useHalftone('test.png', { invert }),
        { initialProps: { invert: false } }
      );
      triggerImageLoad(0);
      expect(result.current.status).toBe('ready');

      rerender({ invert: true });
      expect(result.current.status).toBe('ready');
      expect(mockImageInstances).toHaveLength(1);
    });

    it('changing stepBasis recomputes without reloading the image', () => {
      const { result, rerender } = renderHook(
        ({ stepBasis }: { stepBasis: 'min' | 'width' }) => useHalftone('test.png', { stepBasis }),
        { initialProps: { stepBasis: 'min' as 'min' | 'width' } }
      );
      triggerImageLoad(0);
      expect(result.current.status).toBe('ready');

      rerender({ stepBasis: 'width' as const });
      expect(result.current.status).toBe('ready');
      expect(mockImageInstances).toHaveLength(1);
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
      expect(result.current.status).toBe('loading');
      expect(result.current.circles).toBeNull();

      // Trigger load on second image
      triggerImageLoad(1);
      expect(result.current.status).toBe('ready');
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
    it('returns idle status with empty src', () => {
      const { result } = renderHook(() => useHalftone(''));

      expect(result.current).toEqual({
        status: 'idle',
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
