# react-halftone

A React component that converts images into SVG-based halftone effects. It samples pixel brightness from an image and renders a grid of circles — darker areas produce larger circles, lighter areas produce smaller ones.

## Install

```bash
npm install github:camilo0o0o/react-halftone
```

Requires React 18+.

## Usage

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
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | **(required)** | Image source URL |
| `color` | `string` | `"#000000"` | Fill color for circles (hex format) |
| `step` | `number` | `10` | Grid spacing as % of the smaller image dimension (0.1–50). Lower = more circles. |
| `density` | `number` | `80` | Max circle size as % of grid cell (0–100). Higher = larger circles. |
| `width` | `number` | natural width | Display width in pixels |
| `height` | `number` | natural height | Display height in pixels |
| `className` | `string` | — | CSS class for the SVG element |
| `style` | `CSSProperties` | — | Inline styles for the SVG element |

If both `width` and `height` are provided, the image scales to fit within those bounds while preserving aspect ratio. If only one is provided, the other is calculated automatically.

## How it works

1. Loads the image and draws it to an offscreen canvas
2. Samples each grid point's pixel brightness (converted to greyscale)
3. Maps darkness to circle radius — darker pixels get bigger circles
4. Renders all circles as a single SVG `<path>` for performance

