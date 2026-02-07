# react-halftone

A React component and hook that converts images into SVG-based halftone effects. It samples pixel brightness from an image and renders a grid of circles — darker areas produce larger circles, lighter areas produce smaller ones. Supports inverted mode for light-on-dark designs.

## Install

```bash
npm install github:camilo0o0o/react-halftone
```

Requires React 18+.

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

### `useHalftone` hook

For custom rendering or data access, use the hook directly. It returns the raw circle data, SVG path string, and image dimensions.

```tsx
import { useHalftone } from 'react-halftone';

function CustomHalftone({ src }: { src: string }) {
  const { loading, error, circles, naturalWidth, naturalHeight } =
    useHalftone(src, { step: 5, density: 90, color: '#000000' });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!circles || !naturalWidth || !naturalHeight) return null;

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

## Props

### `Halftone` component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | **(required)** | Image source URL |
| `color` | `string` | `"#000000"` | Fill color for circles (hex format) |
| `step` | `number` | `10` | Grid spacing as % of the smaller image dimension (0.1–50). Lower = more circles. |
| `density` | `number` | `80` | Max circle size as % of grid cell (0–100). Higher = larger circles. |
| `invert` | `boolean` | `false` | Invert brightness mapping — bright areas get large circles. Use for dark backgrounds. |
| `width` | `number` | natural width | Display width in pixels |
| `height` | `number` | natural height | Display height in pixels |
| `className` | `string` | — | CSS class for the SVG element |
| `style` | `CSSProperties` | — | Inline styles for the SVG element |

If both `width` and `height` are provided, the image scales to fit within those bounds while preserving aspect ratio. If only one is provided, the other is calculated automatically.

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

**Return value (`UseHalftoneResult`):**

| Field | Type | Description |
|-------|------|-------------|
| `loading` | `boolean` | `true` while the image is loading |
| `error` | `Error \| null` | Error if the image failed to load |
| `circles` | `Circle[] \| null` | Array of `{ x, y, r }` circle data |
| `pathData` | `string \| null` | SVG path string for all circles |
| `naturalWidth` | `number \| null` | Source image width in pixels |
| `naturalHeight` | `number \| null` | Source image height in pixels |
| `circleCount` | `number` | Number of circles (0 when not yet loaded) |

The hook re-runs when `src`, `step`, `density`, `color`, or `invert` change. Stale loads are automatically cancelled.

## Types

All types are exported for use in your own code:

```ts
import type { HalftoneProps, HalftoneConfig, Circle, UseHalftoneResult } from 'react-halftone';
```

```ts
interface Circle {
  x: number; // Center X coordinate
  y: number; // Center Y coordinate
  r: number; // Radius
}

interface HalftoneConfig {
  step: number;    // Grid spacing % (0.1–50)
  density: number; // Max circle size % (0–100)
  color: string;   // Hex color
  invert: boolean; // Invert brightness mapping
}

interface UseHalftoneResult {
  loading: boolean;
  error: Error | null;
  circles: Circle[] | null;
  pathData: string | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
  circleCount: number;
}
```

## How it works

1. Loads the image and draws it to an offscreen canvas
2. Samples each grid point's pixel brightness (converted to greyscale using RGB average)
3. Maps brightness to circle radius — by default, darker pixels get bigger circles; with `invert: true`, brighter pixels get bigger circles
4. Renders all circles as a single SVG `<path>` for performance
