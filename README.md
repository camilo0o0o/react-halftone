# react-halftone

A React component and hook that converts images into halftone effects. It samples pixel brightness from an image and renders a grid of shapes — darker areas produce larger shapes, lighter areas produce smaller ones. Supports SVG and Canvas output, CMYK color separation with per-channel angle control, circle and square dot shapes, optional rounded corners on squares, and inverted mode for light-on-dark designs.

Generation runs **in the browser in realtime** (React components + hooks), driven by a pure, dependency-free core (`react-halftone/core`) that you can also call directly.

![halftone_gif](https://github.com/user-attachments/assets/f1be70b2-84e4-4773-9f63-81335fb911eb)

## Install

```bash
npm install github:camilo0o0o/react-halftone
```

Requires React 18+. The package ships two entry points:

| Import | Contents | Environment |
|--------|----------|-------------|
| `react-halftone` | Components + hooks | Browser (React) |
| `react-halftone/core` | Pure compute + SVG renderers | Any (no React, no DOM) |

## Usage

### `Halftone` component

Drop-in component that renders a halftone SVG from an image source.

```tsx
import { Halftone } from 'react-halftone';

<Halftone src="/photo.jpg" />

<Halftone
  src="/photo.jpg"
  color="#ff0000"
  step={8}
  density={90}
  width={400}
/>

{/* Square dots */}
<Halftone src="/photo.jpg" shape="square" />

{/* Square dots with rounded corners */}
<Halftone src="/photo.jpg" shape="square" cornerRadius={30} />

{/* For dark backgrounds, use invert to flip brightness mapping */}
<div style={{ background: '#1a1a1a' }}>
  <Halftone
    src="/photo.jpg"
    color="#ffffff"
    invert
    step={6}
    density={85}
  />
</div>
```

### `HalftoneCanvas` component

Drop-in Canvas alternative to `Halftone`. Produces a rasterized `<canvas>` instead of SVG, which is lighter on the DOM when rendering many halftone images simultaneously. Accepts the same props and supports `ref` forwarding for direct canvas access (e.g. `toDataURL()`).

```tsx
import { HalftoneCanvas } from 'react-halftone';

<HalftoneCanvas src="/photo.jpg" />

<HalftoneCanvas
  src="/photo.jpg"
  color="#ff0000"
  step={8}
  density={90}
  width={400}
/>

{/* Square dots with rounded corners */}
<HalftoneCanvas src="/photo.jpg" shape="square" cornerRadius={30} />

{/* Access the canvas element via ref */}
const canvasRef = useRef<HTMLCanvasElement>(null);
<HalftoneCanvas ref={canvasRef} src="/photo.jpg" />
// canvasRef.current.toDataURL('image/png')
```

### `HalftoneCMYKCanvas` component

Canvas-based CMYK halftone that separates the image into Cyan, Magenta, Yellow, and Black channels. Each channel is rendered as a rotated dot grid at traditional print screen angles, then composited with multiply blending for a realistic color halftone effect.

```tsx
import { HalftoneCMYKCanvas } from 'react-halftone';

{/* Minimal — defaults handle angles, density, everything */}
<HalftoneCMYKCanvas src="/photo.jpg" step={3} />

{/* Override individual channel angles */}
<HalftoneCMYKCanvas
  src="/photo.jpg"
  step={3}
  channels={{
    c: { angle: 15 },
    m: { angle: 75 },
    y: { angle: 0 },
    k: { angle: 45 },
  }}
/>

{/* Per-channel density and step overrides */}
<HalftoneCMYKCanvas
  src="/photo.jpg"
  step={4}
  density={80}
  channels={{
    k: { density: 95, step: 3 },
    y: { step: 5 },
  }}
/>
```

Export the result as PNG or JPEG using the imperative handle:

```tsx
import { useRef } from 'react';
import { HalftoneCMYKCanvas } from 'react-halftone';
import type { HalftoneCMYKHandle } from 'react-halftone';

function MyComponent() {
  const ref = useRef<HalftoneCMYKHandle>(null);

  function handleExport() {
    const dataUrl = ref.current!.toDataURL('image/png');
    // or: ref.current!.toBlob(blob => saveAs(blob), 'image/jpeg', 0.95);
  }

  return (
    <>
      <HalftoneCMYKCanvas ref={ref} src="/photo.jpg" step={3} />
      <button onClick={handleExport}>Export</button>
    </>
  );
}
```

### `useHalftone` hook

For custom rendering or data access, use the hook directly. It returns the raw circle data, SVG path string, and image dimensions.

```tsx
import { useHalftone } from 'react-halftone';

function CustomHalftone({ src }: { src: string }) {
  const { status, error, circles, naturalWidth, naturalHeight } =
    useHalftone(src, { step: 5, density: 90, color: '#000000' });

  if (status === 'error') return <p>Error: {error!.message}</p>;

  // Gate on the result, not on `status === 'ready'`. The hook keeps the
  // previous result while a config change recomputes, so this renders the
  // last good output instead of unmounting on every slider tick.
  if (circles === null || naturalWidth === null || naturalHeight === null) {
    return <p>Loading...</p>;
  }

  return (
    <svg viewBox={`0 0 ${naturalWidth} ${naturalHeight}`} width={400}>
      {circles.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="tomato" />
      ))}
    </svg>
  );
}
```

You can also use `pathData` directly if you don't need per-circle control:

```tsx
const { pathData, naturalWidth, naturalHeight } = useHalftone(src);

<svg viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}>
  <path d={pathData} fill="#000" />
</svg>
```

### `useHalftoneCMYK` hook

Returns per-channel circle data for custom CMYK rendering.

```tsx
import { useHalftoneCMYK } from 'react-halftone';

function CustomCMYK({ src }: { src: string }) {
  const { channels, naturalWidth, naturalHeight } =
    useHalftoneCMYK(src, { step: 3 });

  // Gate on the result, not on `status === 'ready'` — see the note above.
  if (channels === null || naturalWidth === null || naturalHeight === null) return null;

  // Access individual channel data
  const { circles, color } = channels.c; // cyan channel
  console.log(`Cyan: ${circles.length} dots at ${channels.c.angle} degrees`);

  return null; // render however you want
}
```

### `rgbToCmyk` utility

The RGB-to-CMYK conversion function with Grey Component Replacement is exported for use in custom pipelines:

```tsx
import { rgbToCmyk } from 'react-halftone';

const cmyk = rgbToCmyk(255, 100, 50);
// { c: 0, m: 0.608, y: 0.804, k: 0 }
```

## Pure core (`react-halftone/core`)

If you already have raw RGBA pixels (from a worker, a different image loader, or your own canvas), the framework-agnostic core computes halftones with no React and no DOM:

```ts
import { computeHalftoneCMYK, renderHalftoneCMYKSVG } from 'react-halftone/core';

const { channels } = computeHalftoneCMYK(pixels, width, height, /* scale */ 1, { step: 3 });
const svg = renderHalftoneCMYKSVG(channels, { width, height });
```

## Props

### `Halftone` / `HalftoneCanvas` component props

Both components accept the same props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | **(required)** | Image source URL |
| `color` | `string` | `"#000000"` | Fill color for circles (hex format) |
| `step` | `number` | `10` | Grid spacing as % of the smaller image dimension (0.1–50). Lower = more circles. |
| `density` | `number` | `80` | Max circle size as % of grid cell (0–100). Higher = larger circles. |
| `invert` | `boolean` | `false` | Invert brightness mapping — bright areas get large circles. Use for dark backgrounds. |
| `shape` | `'circle' \| 'square'` | `"circle"` | Shape of halftone dots |
| `cornerRadius` | `number` | `0` | Corner radius for squares as % of half-side (0–100). Ignored when shape is `"circle"`. |
| `stepBasis` | `'min' \| 'width'` | `'min'` | Dimension used for step calculation. `'width'` uses image width for consistent dot sizes across orientations. |
| `width` | `number` | natural width | Display width in pixels |
| `height` | `number` | natural height | Display height in pixels |
| `className` | `string` | — | CSS class for the element |
| `style` | `CSSProperties` | — | Inline styles for the element |
| `crossOrigin` | `string \| null` | `'anonymous'` | crossOrigin attribute for the loaded image (`null` to omit) |
| `fallback` | `ReactNode \| ((status, error) => ReactNode)` | — | Rendered until there is output to show — `idle`/`loading`/`error`, and the first `processing` pass. Not shown during later recomputes, where the previous output stays. Defaults to nothing. |
| `onError` | `(error: Error) => void` | — | Called once each time the component enters the error state. Safe to pass an inline arrow, and safe to call `setState` from. |
| `ref` | `Ref<HTMLCanvasElement>` | — | (`HalftoneCanvas` only) Ref to the canvas element. Non-null whenever output is mounted, including during a recompute. |

If both `width` and `height` are provided, the image scales to fit within those bounds while preserving aspect ratio. If only one is provided, the other is calculated automatically.

Props are validated rather than trusted: numeric values are clamped to the ranges above (`NaN` included), an unrecognized `shape` falls back to `'circle'`, and a malformed `color` falls back to `#000000`. `Halftone` and `HalftoneCanvas` apply identical validation, so the SVG and canvas renderers always agree for the same props.

### `HalftoneCMYKCanvas` component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | **(required)** | Image source URL |
| `step` | `number` | `10` | Grid spacing as % of the smaller image dimension (0.1–50) |
| `density` | `number` | `80` | Max dot size as % of grid cell (0–100) |
| `shape` | `'circle' \| 'square'` | `"circle"` | Dot shape (global default for all channels) |
| `cornerRadius` | `number` | `0` | Corner radius for squares (0–100) |
| `stepBasis` | `'min' \| 'width'` | `'min'` | Dimension used for step calculation |
| `channels` | `CMYKChannelsConfig` | — | Per-channel overrides (see below) |
| `width` | `number` | natural width | Display width in pixels |
| `height` | `number` | natural height | Display height in pixels |
| `className` | `string` | — | CSS class for the canvas |
| `style` | `CSSProperties` | — | Inline styles for the canvas |
| `crossOrigin` | `string \| null` | `'anonymous'` | crossOrigin attribute for the loaded image (`null` to omit) |
| `fallback` | `ReactNode \| ((status, error) => ReactNode)` | — | Rendered until there is output to show — `idle`/`loading`/`error`, and the first `processing` pass. Not shown during later recomputes, where the previous output stays. |
| `onError` | `(error: Error) => void` | — | Called once each time the component enters the error state. Safe to pass an inline arrow, and safe to call `setState` from. |
| `ref` | `Ref<HalftoneCMYKHandle>` | — | Imperative handle for export. Stays usable during a recompute, so exporting mid-drag works. |

**`channels` prop:**

Each channel (`c`, `m`, `y`, `k`) accepts optional overrides. Omitted fields fall back to the global prop or default:

```ts
{
  c?: { angle?: number; step?: number; density?: number };
  m?: { ... };
  y?: { ... };
  k?: { ... };
}
```

`shape` and `cornerRadius` are global (all-or-nothing across channels) — set them as top-level props, not per channel.

Default angles: **C=15°, M=75°, Y=0°, K=45°** (traditional print screen angles, 30° apart for the three most visible inks to avoid moire patterns).

**`HalftoneCMYKHandle` (ref):**

| Method | Signature | Description |
|--------|-----------|-------------|
| `toDataURL` | `(type?: string, quality?: number) => string` | Export canvas as data URL |
| `toBlob` | `(callback: BlobCallback, type?: string, quality?: number) => void` | Export canvas as Blob |
| `getCanvas` | `() => HTMLCanvasElement \| null` | The underlying canvas element (null before mount) |

### `useHalftone` hook

```ts
function useHalftone(src: string, config?: Partial<HalftoneConfig>): UseHalftoneResult
```

**Config options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `step` | `number` | `10` | Grid spacing as % of smaller dimension (0.1–50) |
| `density` | `number` | `80` | Max circle size as % of grid cell (0–100) |
| `color` | `string` | `"#000000"` | Fill color (hex format, validated internally) |
| `invert` | `boolean` | `false` | Invert brightness mapping for dark backgrounds |
| `shape` | `'circle' \| 'square'` | `"circle"` | Shape of halftone dots |
| `cornerRadius` | `number` | `0` | Corner radius for squares as % of half-side (0–100) |
| `stepBasis` | `'min' \| 'width'` | `'min'` | Dimension used for step calculation. `'width'` uses image width instead of smaller dimension. |

**Return value (`UseHalftoneResult`):**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `HalftoneStatus` | `'idle'` \| `'loading'` \| `'processing'` \| `'ready'` \| `'error'` |
| `error` | `Error \| null` | Error if the image failed to load |
| `circles` | `Circle[] \| null` | Array of `{ x, y, r }` circle data |
| `pathData` | `string \| null` | SVG path string for all circles |
| `naturalWidth` | `number \| null` | Source image width in pixels |
| `naturalHeight` | `number \| null` | Source image height in pixels |
| `circleCount` | `number` | Number of circles (0 when not yet loaded) |

The `status` field tracks the full lifecycle: `idle` (no src), `loading` (fetching image), `processing` (generating halftone dots), `ready` (complete), `error` (failed). The `processing` state is useful for showing feedback during heavy generation at low step values.

`status` and the result fields move independently, and the result is usually what you want to render on:

- Changing `src` clears the result, so `circles`/`pathData`/`channels` are `null` while the new image loads — you never render the old image under a new `src`.
- Changing any other config keeps the previous result while `status` is `'processing'`, so you can keep rendering it instead of unmounting on every slider tick.

The hook re-runs when `src`, `step`, `density`, `color`, `invert`, `shape`, `cornerRadius`, or `stepBasis` change. Stale loads are automatically cancelled.

### `useHalftoneCMYK` hook

```ts
function useHalftoneCMYK(src: string, config?: Partial<HalftoneCMYKConfig>): UseHalftoneCMYKResult
```

Accepts `step`, `density`, `shape`, `cornerRadius`, `stepBasis`, `channels`, and `crossOrigin`. Returns per-channel circle data.

**Return value (`UseHalftoneCMYKResult`):**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `HalftoneStatus` | `'idle'` \| `'loading'` \| `'processing'` \| `'ready'` \| `'error'` |
| `error` | `Error \| null` | Error if the image failed to load |
| `channels` | `Record<CMYKChannel, CMYKChannelResult> \| null` | Per-channel circle data, angle, and color |
| `naturalWidth` | `number \| null` | Source image width in pixels |
| `naturalHeight` | `number \| null` | Source image height in pixels |
| `totalCircleCount` | `number` | Total circles across all 4 channels |

Each `CMYKChannelResult` contains:

| Field | Type | Description |
|-------|------|-------------|
| `circles` | `Circle[]` | Array of `{ x, y, r }` dot data for this channel |
| `angle` | `number` | Resolved rotation angle in degrees |
| `color` | `string` | Channel color hex (`#00FFFF`, `#FF00FF`, `#FFFF00`, or `#000000`) |

## Types

All types are exported for use in your own code:

```ts
import type {
  // Monochrome
  HalftoneProps, HalftoneCanvasProps, HalftoneConfig,
  Circle, UseHalftoneResult, HalftoneStatus, ShapeType,
  HalftoneFallback, HalftoneResult,
  // CMYK
  CMYKChannel, CMYKChannelConfig, CMYKChannelsConfig, HalftoneCMYKConfig,
  HalftoneCMYKProps, HalftoneCMYKHandle,
  UseHalftoneCMYKResult, CMYKChannelResult, HalftoneCMYKResult,
  CMYK,
} from 'react-halftone';
```

```ts
interface Circle {
  x: number; // Center X coordinate
  y: number; // Center Y coordinate
  r: number; // Radius
}

type ShapeType = 'circle' | 'square';

type HalftoneStatus = 'idle' | 'loading' | 'processing' | 'ready' | 'error';

type CMYKChannel = 'c' | 'm' | 'y' | 'k';

interface CMYK {
  c: number; // 0–1
  m: number; // 0–1
  y: number; // 0–1
  k: number; // 0–1
}

interface HalftoneConfig {
  step: number;           // Grid spacing % (0.1–50)
  density: number;        // Max circle size % (0–100)
  color: string;          // Hex color
  invert: boolean;        // Invert brightness mapping
  shape: ShapeType;       // Dot shape ('circle' or 'square')
  cornerRadius: number;   // Corner radius % for squares (0–100)
  stepBasis: 'min' | 'width'; // Dimension for step calculation
}

interface CMYKChannelConfig {
  angle?: number;         // Rotation angle in degrees
  step?: number;          // Grid spacing override
  density?: number;       // Max dot size override
}

interface HalftoneCMYKHandle {
  toDataURL: (type?: string, quality?: number) => string;
  toBlob: (callback: BlobCallback, type?: string, quality?: number) => void;
  getCanvas: () => HTMLCanvasElement | null;
}
```

## How it works

### Monochrome

1. Loads the image and draws it to an offscreen canvas
2. Samples each grid point's pixel brightness (converted to greyscale using RGB average)
3. Maps brightness to shape size — by default, darker pixels get bigger shapes; with `invert: true`, brighter pixels get bigger shapes. The only dots dropped are those whose computed radius is too small to see, so highlights fade out smoothly rather than banding at a brightness threshold; pure white produces no dots because its radius is zero
4. Generates SVG path commands based on the selected shape (circle arcs, square lines, or rounded-rect lines+arcs)
5. `Halftone` renders all shapes as a single SVG `<path>` for performance; `HalftoneCanvas` draws to a `<canvas>` bitmap for lighter DOM weight

### CMYK

1. Loads the image and extracts pixel data (single `getImageData` call shared across all channels)
2. Converts each sampled pixel from RGB to CMYK using Grey Component Replacement (GCR) — the common dark component is extracted as the K (black) channel, producing cleaner darks than overlapping CMY
3. For each channel, generates a dot grid rotated to that channel's screen angle. Default angles (C=15°, M=75°, Y=0°, K=45°) are spaced 30° apart for the three most visible inks to create pleasing rosette patterns instead of moire interference
4. Each channel's dot sizes are proportional to its CMYK intensity at that grid point — higher ink values produce larger dots
5. The four channel layers are composited onto a white canvas using `globalCompositeOperation: 'multiply'`, simulating how transparent inks layer in print

### Performance

The hooks are built for smooth realtime interaction:

- **The decoded image is cached per `src`** — dragging a config slider recomputes without re-fetching or re-decoding the image.
- **The extracted pixel buffer is cached per downsample scale** — changing a CMYK channel angle (which doesn't change the scale) reuses the buffer and skips `getImageData` entirely.
- **Resolution-aware downsampling** targets a constant number of source pixels per grid cell, so processing cost tracks the dot count rather than the source resolution — a 24MP photo and a 1MP photo do comparable work at the same `step`. The downscale also area-averages each cell, which is the tone a halftone dot should represent.
- **The previous result stays on screen while recomputing**, so the output never flickers mid-drag and the mounted element never disappears — a forwarded `ref` stays valid throughout, which is what makes exporting mid-drag work.

## Example app

An interactive demo is included in [`examples/demo/`](./examples/demo/). It lets you toggle between monochrome and CMYK modes, adjust all parameters with sliders, upload custom images, and export the result as PNG.

```bash
cd examples/demo
npm install
npm run dev
```
