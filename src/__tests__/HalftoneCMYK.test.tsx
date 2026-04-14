import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { HalftoneCMYK } from '../HalftoneCMYK';
import type { UseHalftoneCMYKResult, HalftoneCMYKHandle, HalftoneStatus } from '../types';
import { useHalftoneCMYK } from '../useHalftoneCMYK';

const defaultChannelCircles = [{ x: 10, y: 10, r: 5 }];

const defaultHookResult: UseHalftoneCMYKResult = {
  status: 'ready' as HalftoneStatus,
  error: null,
  channels: {
    c: { circles: defaultChannelCircles, angle: 15, color: '#00FFFF' },
    m: { circles: defaultChannelCircles, angle: 75, color: '#FF00FF' },
    y: { circles: defaultChannelCircles, angle: 0, color: '#FFFF00' },
    k: { circles: defaultChannelCircles, angle: 45, color: '#000000' },
  },
  naturalWidth: 100,
  naturalHeight: 100,
  totalCircleCount: 4,
};

let mockHookResult: UseHalftoneCMYKResult = { ...defaultHookResult };

vi.mock('../useHalftoneCMYK', () => ({
  useHalftoneCMYK: vi.fn(() => mockHookResult),
}));

let fillStyleValues: string[] = [];
let mockCtx: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  mockHookResult = {
    ...defaultHookResult,
    channels: {
      c: { circles: [...defaultChannelCircles], angle: 15, color: '#00FFFF' },
      m: { circles: [...defaultChannelCircles], angle: 75, color: '#FF00FF' },
      y: { circles: [...defaultChannelCircles], angle: 0, color: '#FFFF00' },
      k: { circles: [...defaultChannelCircles], angle: 45, color: '#000000' },
    },
  };

  fillStyleValues = [];

  mockCtx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    roundRect: vi.fn(),
  };

  Object.defineProperty(mockCtx, 'fillStyle', {
    get: vi.fn(),
    set: vi.fn((v: string) => { fillStyleValues.push(v); }),
    configurable: true,
  });

  Object.defineProperty(mockCtx, 'globalCompositeOperation', {
    get: vi.fn(),
    set: vi.fn(),
    configurable: true,
  });

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    mockCtx as unknown as CanvasRenderingContext2D
  );
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
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

describe('HalftoneCMYK component', () => {
  describe('rendering states', () => {
    it('returns null while loading', () => {
      mockHookResult = { ...defaultHookResult, status: 'loading' as HalftoneStatus, channels: null, naturalWidth: null, naturalHeight: null, totalCircleCount: 0 };
      render(<HalftoneCMYK src="test.png" />);
      expect(container.querySelector('canvas')).toBeNull();
    });

    it('renders canvas after successful load', () => {
      render(<HalftoneCMYK src="test.png" />);
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    it('returns null on error', () => {
      mockHookResult = { ...defaultHookResult, status: 'error' as HalftoneStatus, error: new Error('fail'), channels: null, naturalWidth: null, naturalHeight: null, totalCircleCount: 0 };
      render(<HalftoneCMYK src="bad.png" />);
      expect(container.querySelector('canvas')).toBeNull();
    });
  });

  describe('canvas attributes', () => {
    it('has correct width and height attributes', () => {
      render(<HalftoneCMYK src="test.png" />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.getAttribute('width')).toBe('100');
      expect(canvas.getAttribute('height')).toBe('100');
    });

    it('has correct CSS display dimensions', () => {
      render(<HalftoneCMYK src="test.png" />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.style.width).toBe('100px');
      expect(canvas.style.height).toBe('100px');
    });

    it('forwards className to canvas', () => {
      render(<HalftoneCMYK src="test.png" className="my-class" />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.classList.contains('my-class')).toBe(true);
    });

    it('forwards style to canvas', () => {
      render(<HalftoneCMYK src="test.png" style={{ opacity: 0.5 }} />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.style.opacity).toBe('0.5');
    });
  });

  describe('canvas drawing', () => {
    it('fills white background first', () => {
      render(<HalftoneCMYK src="test.png" />);
      expect(fillStyleValues[0]).toBe('#FFFFFF');
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
    });

    it('sets multiply composite operation', () => {
      render(<HalftoneCMYK src="test.png" />);
      const setter = Object.getOwnPropertyDescriptor(mockCtx, 'globalCompositeOperation')!.set!;
      expect(setter).toHaveBeenCalledWith('multiply');
    });

    it('draws all 4 channel colors', () => {
      render(<HalftoneCMYK src="test.png" />);
      // White bg + 4 channels = 5 fillStyle sets
      expect(fillStyleValues).toContain('#00FFFF');
      expect(fillStyleValues).toContain('#FF00FF');
      expect(fillStyleValues).toContain('#FFFF00');
      expect(fillStyleValues).toContain('#000000');
    });

    it('draws channels in order C, M, Y, K', () => {
      render(<HalftoneCMYK src="test.png" />);
      // fillStyleValues[0] = '#FFFFFF' (background)
      // Then C, M, Y, K
      expect(fillStyleValues[1]).toBe('#00FFFF');
      expect(fillStyleValues[2]).toBe('#FF00FF');
      expect(fillStyleValues[3]).toBe('#FFFF00');
      expect(fillStyleValues[4]).toBe('#000000');
    });

    it('draws circles with arc for each channel', () => {
      render(<HalftoneCMYK src="test.png" />);
      // 4 channels × 1 circle each = 4 arc calls
      expect(mockCtx.arc).toHaveBeenCalledTimes(4);
    });

    it('resets composite operation after drawing', () => {
      render(<HalftoneCMYK src="test.png" />);
      const setter = Object.getOwnPropertyDescriptor(mockCtx, 'globalCompositeOperation')!.set!;
      expect(setter).toHaveBeenCalledWith('source-over');
    });

    it('skips channels with no circles', () => {
      mockHookResult = {
        ...defaultHookResult,
        channels: {
          c: { circles: [], angle: 15, color: '#00FFFF' },
          m: { circles: defaultChannelCircles, angle: 75, color: '#FF00FF' },
          y: { circles: [], angle: 0, color: '#FFFF00' },
          k: { circles: defaultChannelCircles, angle: 45, color: '#000000' },
        },
      };
      render(<HalftoneCMYK src="test.png" />);
      // White bg + M + K = only M and K colors set
      expect(fillStyleValues).toEqual(['#FFFFFF', '#FF00FF', '#000000']);
    });
  });

  describe('props forwarding', () => {
    it('forwards config props to useHalftoneCMYK', () => {
      render(<HalftoneCMYK src="test.png" step={5} density={90} />);
      expect(useHalftoneCMYK).toHaveBeenCalledWith('test.png', expect.objectContaining({
        step: 5,
        density: 90,
      }));
    });
  });

  describe('imperative handle', () => {
    it('toDataURL calls canvas toDataURL', () => {
      const mockToDataURL = vi.fn().mockReturnValue('data:image/png;base64,abc');
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(mockToDataURL);

      const ref = createRef<HalftoneCMYKHandle>();
      render(<HalftoneCMYK ref={ref} src="test.png" />);

      const result = ref.current!.toDataURL('image/png', 1.0);
      expect(mockToDataURL).toHaveBeenCalledWith('image/png', 1.0);
      expect(result).toBe('data:image/png;base64,abc');
    });

    it('toBlob calls canvas toBlob', () => {
      const mockToBlob = vi.fn();
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(mockToBlob);

      const ref = createRef<HalftoneCMYKHandle>();
      render(<HalftoneCMYK ref={ref} src="test.png" />);

      const callback = vi.fn();
      ref.current!.toBlob(callback, 'image/jpeg', 0.95);
      expect(mockToBlob).toHaveBeenCalledWith(callback, 'image/jpeg', 0.95);
    });
  });
});
