import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHalftoneCMYK } from '../useHalftoneCMYK';

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

vi.mock('../core', async () => {
  const actual = await vi.importActual<typeof import('../core')>('../core');
  const twoCircles = [
    { x: 10, y: 10, r: 3 },
    { x: 20, y: 20, r: 2 },
  ];
  return {
    ...actual,
    // Mock the orchestrator: the hook's job is load-image → compute → set-state.
    computeHalftoneCMYK: vi.fn(() => ({
      channels: {
        c: { circles: twoCircles, angle: 15, color: '#00FFFF' },
        m: { circles: twoCircles, angle: 75, color: '#FF00FF' },
        y: { circles: twoCircles, angle: 0, color: '#FFFF00' },
        k: { circles: twoCircles, angle: 45, color: '#000000' },
      },
    })),
  };
});

const mockCtx = {
  drawImage: vi.fn(),
  getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
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

describe('useHalftoneCMYK', () => {
  describe('initial/loading state', () => {
    it('returns loading status before image loads', () => {
      const { result } = renderHook(() => useHalftoneCMYK('test.png'));

      expect(result.current).toEqual({
        status: 'loading',
        error: null,
        channels: null,
        naturalWidth: null,
        naturalHeight: null,
        totalCircleCount: 0,
      });
    });
  });

  describe('successful load', () => {
    it('returns all 4 channels after load', () => {
      const { result } = renderHook(() => useHalftoneCMYK('test.png'));
      triggerImageLoad();

      expect(result.current.status).toBe('ready');
      expect(result.current.error).toBeNull();
      expect(result.current.channels).not.toBeNull();
      expect(result.current.channels!.c).toBeDefined();
      expect(result.current.channels!.m).toBeDefined();
      expect(result.current.channels!.y).toBeDefined();
      expect(result.current.channels!.k).toBeDefined();
    });

    it('each channel has circles, angle, and color', () => {
      const { result } = renderHook(() => useHalftoneCMYK('test.png'));
      triggerImageLoad();

      const ch = result.current.channels!;
      for (const key of ['c', 'm', 'y', 'k'] as const) {
        expect(ch[key].circles).toBeInstanceOf(Array);
        expect(typeof ch[key].angle).toBe('number');
        expect(typeof ch[key].color).toBe('string');
      }
    });

    it('uses default angles', () => {
      const { result } = renderHook(() => useHalftoneCMYK('test.png'));
      triggerImageLoad();

      const ch = result.current.channels!;
      expect(ch.c.angle).toBe(15);
      expect(ch.m.angle).toBe(75);
      expect(ch.y.angle).toBe(0);
      expect(ch.k.angle).toBe(45);
    });

    it('uses correct channel colors', () => {
      const { result } = renderHook(() => useHalftoneCMYK('test.png'));
      triggerImageLoad();

      const ch = result.current.channels!;
      expect(ch.c.color).toBe('#00FFFF');
      expect(ch.m.color).toBe('#FF00FF');
      expect(ch.y.color).toBe('#FFFF00');
      expect(ch.k.color).toBe('#000000');
    });

    it('returns dimensions', () => {
      const { result } = renderHook(() => useHalftoneCMYK('test.png'));
      triggerImageLoad();

      expect(result.current.naturalWidth).toBe(100);
      expect(result.current.naturalHeight).toBe(100);
    });

    it('returns total circle count', () => {
      const { result } = renderHook(() => useHalftoneCMYK('test.png'));
      triggerImageLoad();

      // 4 channels x 2 circles each = 8
      expect(result.current.totalCircleCount).toBe(8);
    });
  });

  describe('error handling', () => {
    it('sets error status on image load failure', () => {
      const { result } = renderHook(() => useHalftoneCMYK('bad.png'));
      triggerImageError();

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Failed to load image: bad.png');
      expect(result.current.channels).toBeNull();
      expect(result.current.totalCircleCount).toBe(0);
    });
  });

  describe('dependency changes', () => {
    it('changing src triggers a new image load', () => {
      const { result, rerender } = renderHook(
        ({ src }) => useHalftoneCMYK(src),
        { initialProps: { src: 'first.png' } }
      );
      triggerImageLoad(0);
      expect(result.current.status).toBe('ready');

      rerender({ src: 'second.png' });
      expect(result.current.status).toBe('loading');
      expect(mockImageInstances).toHaveLength(2);

      triggerImageLoad(1);
      expect(result.current.status).toBe('ready');
    });

    // Config changes recompute from the cached image WITHOUT reloading it.
    it('changing step recomputes without reloading the image', () => {
      const { result, rerender } = renderHook(
        ({ step }) => useHalftoneCMYK('test.png', { step }),
        { initialProps: { step: 10 } }
      );
      triggerImageLoad(0);
      expect(result.current.status).toBe('ready');

      rerender({ step: 20 });
      expect(result.current.status).toBe('ready');
      expect(mockImageInstances).toHaveLength(1);
    });

    it('changing a channel angle recomputes without reloading the image', () => {
      const { result, rerender } = renderHook(
        ({ angle }) => useHalftoneCMYK('test.png', { channels: { c: { angle } } }),
        { initialProps: { angle: 15 } }
      );
      triggerImageLoad(0);
      expect(result.current.status).toBe('ready');

      rerender({ angle: 30 });
      expect(result.current.status).toBe('ready');
      expect(mockImageInstances).toHaveLength(1);
    });
  });

  describe('cleanup', () => {
    it('ignores stale load when src changes', () => {
      const { result, rerender } = renderHook(
        ({ src }) => useHalftoneCMYK(src),
        { initialProps: { src: 'first.png' } }
      );

      rerender({ src: 'second.png' });
      triggerImageLoad(0);
      expect(result.current.status).toBe('loading');
      expect(result.current.channels).toBeNull();

      triggerImageLoad(1);
      expect(result.current.status).toBe('ready');
      expect(result.current.channels).not.toBeNull();
    });

    it('clears handlers on unmount', () => {
      const { unmount } = renderHook(() => useHalftoneCMYK('test.png'));
      unmount();

      const img = mockImageInstances[0];
      expect(img.onload).toBeNull();
      expect(img.onerror).toBeNull();
    });
  });

  describe('empty src', () => {
    it('returns idle status with empty src', () => {
      const { result } = renderHook(() => useHalftoneCMYK(''));

      expect(result.current).toEqual({
        status: 'idle',
        error: null,
        channels: null,
        naturalWidth: null,
        naturalHeight: null,
        totalCircleCount: 0,
      });
      expect(mockImageInstances).toHaveLength(0);
    });
  });
});
