import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { HalftoneCanvas } from '../HalftoneCanvas';
import type { UseHalftoneResult, HalftoneStatus } from '../types';
import { useHalftone } from '../useHalftone';

const defaultHookResult: UseHalftoneResult = {
  status: 'ready' as HalftoneStatus,
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

let mockCtx: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  mockHookResult = { ...defaultHookResult };

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

describe('HalftoneCanvas component', () => {
  describe('rendering states', () => {
    it('returns null while loading', () => {
      mockHookResult = { ...defaultHookResult, status: 'loading' as HalftoneStatus, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<HalftoneCanvas src="test.png" />);
      expect(container.querySelector('canvas')).toBeNull();
    });

    it('renders canvas after successful load', () => {
      render(<HalftoneCanvas src="test.png" />);
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    it('returns null on error', () => {
      mockHookResult = { ...defaultHookResult, status: 'error' as HalftoneStatus, error: new Error('fail'), circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<HalftoneCanvas src="bad.png" />);
      expect(container.querySelector('canvas')).toBeNull();
    });

    it('returns null when src is empty', () => {
      mockHookResult = { ...defaultHookResult, status: 'idle' as HalftoneStatus, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<HalftoneCanvas src="" />);
      expect(container.querySelector('canvas')).toBeNull();
    });

    // An empty circles array is a valid result (a blank image), not a
    // not-ready signal — it mounts an empty canvas so refs stay usable.
    it('mounts an empty canvas when circles array is empty', () => {
      mockHookResult = { ...defaultHookResult, circles: [], circleCount: 0 };
      render(<HalftoneCanvas src="test.png" />);
      expect(container.querySelector('canvas')).not.toBeNull();
      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.arc).not.toHaveBeenCalled();
    });

    // Recomputing on a config change keeps the previous result, so the canvas
    // must not unmount mid-drag.
    it('stays mounted while recomputing with a retained result', () => {
      const ref = createRef<HTMLCanvasElement>();
      render(<HalftoneCanvas ref={ref} src="test.png" step={10} />);
      expect(ref.current).toBeInstanceOf(HTMLCanvasElement);

      mockHookResult = { ...defaultHookResult, status: 'processing' as HalftoneStatus };
      render(<HalftoneCanvas ref={ref} src="test.png" step={20} />);

      expect(container.querySelector('canvas')).not.toBeNull();
      expect(ref.current).toBeInstanceOf(HTMLCanvasElement);
    });
  });

  describe('canvas attributes', () => {
    it('has correct width and height attributes (natural resolution)', () => {
      render(<HalftoneCanvas src="test.png" />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.getAttribute('width')).toBe('100');
      expect(canvas.getAttribute('height')).toBe('100');
    });

    it('has correct CSS display dimensions', () => {
      render(<HalftoneCanvas src="test.png" />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.style.width).toBe('100px');
      expect(canvas.style.height).toBe('100px');
    });

    it('className forwarded to canvas', () => {
      render(<HalftoneCanvas src="test.png" className="my-class" />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.classList.contains('my-class')).toBe(true);
    });

    it('style forwarded to canvas', () => {
      render(<HalftoneCanvas src="test.png" style={{ opacity: 0.5 }} />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.style.opacity).toBe('0.5');
    });
  });

  describe('canvas drawing', () => {
    it('calls clearRect on draw', () => {
      render(<HalftoneCanvas src="test.png" />);
      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
    });

    it('sets fillStyle to the color prop', () => {
      render(<HalftoneCanvas src="test.png" color="#ff0000" />);
      const setter = Object.getOwnPropertyDescriptor(mockCtx, 'fillStyle')!.set!;
      expect(setter).toHaveBeenCalledWith('#ff0000');
    });

    it('uses default color when none provided', () => {
      render(<HalftoneCanvas src="test.png" />);
      const setter = Object.getOwnPropertyDescriptor(mockCtx, 'fillStyle')!.set!;
      expect(setter).toHaveBeenCalledWith('#000000');
    });

    it('draws circles with arc', () => {
      render(<HalftoneCanvas src="test.png" />);
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalledWith(15, 10);
      expect(mockCtx.arc).toHaveBeenCalledWith(10, 10, 5, 0, Math.PI * 2);
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('draws squares with fillRect', () => {
      render(<HalftoneCanvas src="test.png" shape="square" cornerRadius={0} />);
      expect(mockCtx.fillRect).toHaveBeenCalledWith(5, 5, 10, 10);
    });

    it('draws rounded squares with roundRect', () => {
      render(<HalftoneCanvas src="test.png" shape="square" cornerRadius={50} />);
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.roundRect).toHaveBeenCalledWith(5, 5, 10, 10, 2.5);
      expect(mockCtx.fill).toHaveBeenCalled();
    });
  });

  // The canvas path used to read these props raw while the SVG path ran them
  // through validateConfig, so the two renderers disagreed on bad input.
  describe('prop validation matches the SVG path', () => {
    it('clamps an out-of-range cornerRadius to 100', () => {
      render(<HalftoneCanvas src="test.png" shape="square" cornerRadius={500} />);
      // cornerRadius 100 of a radius-5 dot => 5, not 25.
      expect(mockCtx.roundRect).toHaveBeenCalledWith(5, 5, 10, 10, 5);
    });

    it('clamps a negative cornerRadius to 0 (plain square)', () => {
      render(<HalftoneCanvas src="test.png" shape="square" cornerRadius={-20} />);
      expect(mockCtx.fillRect).toHaveBeenCalledWith(5, 5, 10, 10);
      expect(mockCtx.roundRect).not.toHaveBeenCalled();
    });

    it('treats NaN cornerRadius as 0 rather than passing NaN to roundRect', () => {
      render(<HalftoneCanvas src="test.png" shape="square" cornerRadius={NaN} />);
      expect(mockCtx.roundRect).not.toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalledWith(5, 5, 10, 10);
    });

    it('falls back to circles for an unknown shape', () => {
      render(<HalftoneCanvas src="test.png" shape={'triangle' as any} />);
      expect(mockCtx.arc).toHaveBeenCalledWith(10, 10, 5, 0, Math.PI * 2);
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('falls back to #000000 for an invalid color', () => {
      render(<HalftoneCanvas src="test.png" color="not-a-color" />);
      const setter = Object.getOwnPropertyDescriptor(mockCtx, 'fillStyle')!.set!;
      expect(setter).toHaveBeenCalledWith('#000000');
    });
  });

  describe('props forwarding', () => {
    it('forwards shape and cornerRadius to useHalftone', () => {
      render(<HalftoneCanvas src="test.png" shape="square" cornerRadius={30} />);
      expect(useHalftone).toHaveBeenCalledWith('test.png', expect.objectContaining({
        shape: 'square',
        cornerRadius: 30,
      }));
    });

    it('forwards shape without cornerRadius', () => {
      render(<HalftoneCanvas src="test.png" shape="square" />);
      expect(useHalftone).toHaveBeenCalledWith('test.png', expect.objectContaining({
        shape: 'square',
      }));
    });
  });

  describe('display dimensions', () => {
    it('uses natural dimensions by default', () => {
      render(<HalftoneCanvas src="test.png" />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.style.width).toBe('100px');
      expect(canvas.style.height).toBe('100px');
    });

    it('calculates dimensions from width prop', () => {
      render(<HalftoneCanvas src="test.png" width={200} />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.style.width).toBe('200px');
      expect(canvas.style.height).toBe('200px');
    });

    it('calculates dimensions from height prop', () => {
      render(<HalftoneCanvas src="test.png" height={50} />);
      const canvas = container.querySelector('canvas')!;
      expect(canvas.style.width).toBe('50px');
      expect(canvas.style.height).toBe('50px');
    });
  });

  describe('ref forwarding', () => {
    it('createRef receives canvas element', () => {
      const ref = createRef<HTMLCanvasElement>();
      render(<HalftoneCanvas ref={ref} src="test.png" />);
      expect(ref.current).toBeInstanceOf(HTMLCanvasElement);
    });

    it('callback ref receives canvas element', () => {
      const callbackRef = vi.fn();
      render(<HalftoneCanvas ref={callbackRef} src="test.png" />);
      expect(callbackRef).toHaveBeenCalledWith(expect.any(HTMLCanvasElement));
    });

    it('ref is null when component returns null', () => {
      const ref = createRef<HTMLCanvasElement>();
      mockHookResult = { ...defaultHookResult, status: 'loading' as HalftoneStatus, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<HalftoneCanvas ref={ref} src="test.png" />);
      expect(ref.current).toBeNull();
    });
  });

  describe('fallback and onError', () => {
    it('renders a static fallback node while not ready', () => {
      mockHookResult = { ...defaultHookResult, status: 'loading' as HalftoneStatus, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<HalftoneCanvas src="test.png" fallback={<span className="ph">wait</span>} />);
      expect(container.querySelector('.ph')?.textContent).toBe('wait');
      expect(container.querySelector('canvas')).toBeNull();
    });

    it('renders a fallback render-function with the current status', () => {
      mockHookResult = { ...defaultHookResult, status: 'processing' as HalftoneStatus, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<HalftoneCanvas src="test.png" fallback={(status) => <span className="ph">{status}</span>} />);
      expect(container.querySelector('.ph')?.textContent).toBe('processing');
    });

    it('returns null (no fallback provided) while not ready', () => {
      mockHookResult = { ...defaultHookResult, status: 'loading' as HalftoneStatus, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<HalftoneCanvas src="test.png" />);
      expect(container.querySelector('canvas')).toBeNull();
      expect(container.firstChild).toBeNull();
    });

    it('calls onError when the hook reports an error', () => {
      const onError = vi.fn();
      const err = new Error('boom');
      mockHookResult = { ...defaultHookResult, status: 'error' as HalftoneStatus, error: err, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };
      render(<HalftoneCanvas src="bad.png" onError={onError} />);
      expect(onError).toHaveBeenCalledWith(err);
    });

    it('does not call onError on a normal ready render', () => {
      const onError = vi.fn();
      render(<HalftoneCanvas src="test.png" onError={onError} />);
      expect(onError).not.toHaveBeenCalled();
    });

    // Callers pass inline arrows, so a fresh identity every render must not
    // count as a new error.
    it('does not re-fire onError when a re-render brings a new handler identity', () => {
      const onError = vi.fn();
      const err = new Error('boom');
      mockHookResult = { ...defaultHookResult, status: 'error' as HalftoneStatus, error: err, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };

      render(<HalftoneCanvas src="bad.png" onError={(e) => onError(e)} />);
      expect(onError).toHaveBeenCalledTimes(1);

      render(<HalftoneCanvas src="bad.png" onError={(e) => onError(e)} />);
      render(<HalftoneCanvas src="bad.png" onError={(e) => onError(e)} />);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    // An onError that sets state re-renders the parent with a new inline
    // handler; depending on that identity used to loop until React bailed out.
    it('survives an onError that sets state', () => {
      const err = new Error('boom');
      mockHookResult = { ...defaultHookResult, status: 'error' as HalftoneStatus, error: err, circles: null, pathData: null, naturalWidth: null, naturalHeight: null, circleCount: 0 };

      const seen: Error[] = [];
      function Parent() {
        const [caught, setCaught] = React.useState<Error | null>(null);
        return (
          <HalftoneCanvas
            src="bad.png"
            onError={(e) => {
              seen.push(e);
              setCaught(e);
            }}
            fallback={<span className="ph">{caught ? 'caught' : 'waiting'}</span>}
          />
        );
      }

      render(<Parent />);
      expect(seen).toHaveLength(1);
      expect(container.querySelector('.ph')?.textContent).toBe('caught');
    });
  });
});
