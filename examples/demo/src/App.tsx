import { useRef, useState } from 'react';
import {
  Halftone,
  HalftoneCanvas,
  HalftoneCMYKCanvas,
  useHalftone,
  useHalftoneCMYK,
} from 'react-halftone';
import type {
  CMYKChannelsConfig,
  HalftoneCMYKHandle,
  HalftoneFallback,
  HalftoneStatus,
  ShapeType,
} from 'react-halftone';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Checkbox } from './components/Checkbox';
import { DetailRow } from './components/DetailRow';
import { SegmentedControl } from './components/SegmentedControl';
import { Slider } from './components/Slider';
import { SwatchRow } from './components/SwatchRow';
import { UploadButton } from './components/UploadButton';

type Mode = 'mono' | 'cmyk';
type Renderer = 'canvas' | 'svg';
type StepBasis = 'min' | 'width';
type PreviewBg = 'light' | 'dark' | 'checker';

const COLOR_PRESETS = ['#000000', '#ffffff', '#e63946', '#1d4ed8', '#f77f00'];

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'mono', label: 'Monochrome' },
  { value: 'cmyk', label: 'CMYK' },
];

const RENDERER_OPTIONS: { value: Renderer; label: string }[] = [
  { value: 'canvas', label: 'Canvas' },
  { value: 'svg', label: 'SVG' },
];

const STEP_BASIS_OPTIONS: { value: StepBasis; label: string }[] = [
  { value: 'min', label: 'Min' },
  { value: 'width', label: 'Width' },
];

const SHAPE_OPTIONS: { value: ShapeType; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
];

const PREVIEW_BG_OPTIONS: { value: PreviewBg; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'checker', label: 'Checker' },
];

const CHANNEL_SWATCHES = {
  c: '#00ffff',
  m: '#ff00ff',
  y: '#ffff00',
  k: '#000000',
} as const;

interface StatsViewProps {
  status: HalftoneStatus;
  naturalWidth: number | null;
  naturalHeight: number | null;
  dots: number;
}

function StatsView({ status, naturalWidth, naturalHeight, dots }: StatsViewProps) {
  if (status === 'error') {
    return <DetailRow label="Stats" value="unavailable" />;
  }

  // Gate on the result rather than `status === 'ready'`: the hooks retain the
  // previous result while a config change recomputes, so the numbers hold
  // steady instead of blanking on every slider tick — same as the preview
  // beside them. They lag by a frame while recomputing, so mark them stale.
  if (naturalWidth === null || naturalHeight === null) {
    return <DetailRow label="Stats" value="computing…" />;
  }

  const stale = status === 'processing';

  return (
    <>
      <DetailRow label="Width" value={`${naturalWidth}px`} stale={stale} />
      <DetailRow label="Height" value={`${naturalHeight}px`} stale={stale} />
      <DetailRow label="Dots" value={dots.toLocaleString()} stale={stale} />
    </>
  );
}

interface MonoStatsProps {
  src: string;
  step: number;
  density: number;
  color: string;
  invert: boolean;
  shape: ShapeType;
  cornerRadius: number;
  stepBasis: StepBasis;
}

// Both stats components run the computation a second time, in parallel with
// the one the preview component does — the rendering components don't expose
// their counts. That's the price of the panel, and why it's behind a toggle.
function MonoStats({ src, ...config }: MonoStatsProps) {
  const { status, circleCount, naturalWidth, naturalHeight } = useHalftone(src, config);

  return (
    <StatsView
      status={status}
      naturalWidth={naturalWidth}
      naturalHeight={naturalHeight}
      dots={circleCount}
    />
  );
}

interface CmykStatsProps {
  src: string;
  step: number;
  density: number;
  shape: ShapeType;
  cornerRadius: number;
  stepBasis: StepBasis;
  channels: CMYKChannelsConfig;
}

function CmykStats({ src, ...config }: CmykStatsProps) {
  const { status, totalCircleCount, naturalWidth, naturalHeight } = useHalftoneCMYK(
    src,
    config
  );

  return (
    <StatsView
      status={status}
      naturalWidth={naturalWidth}
      naturalHeight={naturalHeight}
      dots={totalCircleCount}
    />
  );
}

export function App() {
  const cmykRef = useRef<HalftoneCMYKHandle>(null);

  // Image source
  const [imageSrc, setImageSrc] = useState('/sample.jpeg');

  // Mode
  const [mode, setMode] = useState<Mode>('cmyk');

  // Shared controls
  const [step, setStep] = useState(5);
  const [density, setDensity] = useState(80);
  const [shape, setShape] = useState<ShapeType>('circle');
  const [cornerRadius, setCornerRadius] = useState(0);
  const [stepBasis, setStepBasis] = useState<StepBasis>('min');

  // Mono controls
  const [renderer, setRenderer] = useState<Renderer>('canvas');
  const [color, setColor] = useState('#000000');
  const [invert, setInvert] = useState(false);
  const [showStats, setShowStats] = useState(true);

  // Preview pane
  const [previewBg, setPreviewBg] = useState<PreviewBg>('light');

  // CMYK angles
  const [angleC, setAngleC] = useState(15);
  const [angleM, setAngleM] = useState(75);
  const [angleY, setAngleY] = useState(0);
  const [angleK, setAngleK] = useState(45);

  // Step is shared by the slider and the exact-value number input; clamp to the
  // range the core accepts (min matches the core's MIN_STEP of 0.1).
  function setStepClamped(value: number) {
    if (Number.isNaN(value)) return;
    setStep(Math.min(10, Math.max(0.1, value)));
  }

  function handleFileUpload(file: File) {
    setImageSrc(URL.createObjectURL(file));
  }

  function handleExport() {
    if (!cmykRef.current) return;
    const dataUrl = cmykRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'halftone-cmyk.png';
    link.href = dataUrl;
    link.click();
  }

  const previewFallback: HalftoneFallback = (status) =>
    status === 'loading' ? (
      <p className="status-text">Loading image…</p>
    ) : status === 'processing' ? (
      <p className="status-text">Generating halftone…</p>
    ) : null;

  const channels: CMYKChannelsConfig = {
    c: { angle: angleC },
    m: { angle: angleM },
    y: { angle: angleY },
    k: { angle: angleK },
  };

  const angleControls: { channel: keyof typeof CHANNEL_SWATCHES; label: string; value: number; onChange: (v: number) => void }[] = [
    { channel: 'c', label: 'Cyan', value: angleC, onChange: setAngleC },
    { channel: 'm', label: 'Magenta', value: angleM, onChange: setAngleM },
    { channel: 'y', label: 'Yellow', value: angleY, onChange: setAngleY },
    { channel: 'k', label: 'Black (K)', value: angleK, onChange: setAngleK },
  ];

  const monoProps = {
    src: imageSrc,
    step,
    density,
    color,
    invert,
    shape,
    cornerRadius,
    stepBasis,
    width: 700,
    fallback: previewFallback,
  };

  return (
    <div className="app">
      <div className="sidebar">
        <header className="sidebar-header">
          <h1 className="app-title">react-halftone</h1>
        </header>

        <SegmentedControl value={mode} options={MODE_OPTIONS} onChange={setMode} />

        {showStats && (
          <Card title="Details">
            {mode === 'mono' ? (
              <MonoStats
                src={imageSrc}
                step={step}
                density={density}
                color={color}
                invert={invert}
                shape={shape}
                cornerRadius={cornerRadius}
                stepBasis={stepBasis}
              />
            ) : (
              <CmykStats
                src={imageSrc}
                step={step}
                density={density}
                shape={shape}
                cornerRadius={cornerRadius}
                stepBasis={stepBasis}
                channels={channels}
              />
            )}
          </Card>
        )}

        <Card title="Image">
          <UploadButton label="Upload image" onFile={handleFileUpload} />
        </Card>

        {mode === 'mono' && (
          <Card title="Renderer">
            <SegmentedControl
              value={renderer}
              options={RENDERER_OPTIONS}
              onChange={setRenderer}
            />
          </Card>
        )}

        <Card title="Grid">
          <Slider
            label="Step"
            value={step}
            min={0.1}
            max={10}
            step={0.1}
            onChange={setStepClamped}
          >
            <input
              type="number"
              min={0.1}
              max={10}
              step={0.01}
              value={step}
              aria-label="Step, exact value"
              onChange={(e) => setStepClamped(Number(e.target.value))}
            />
          </Slider>
          <Slider
            label="Density"
            value={density}
            display={`${density}%`}
            min={0}
            max={100}
            step={1}
            onChange={setDensity}
          />
          <SegmentedControl
            label="Step basis"
            value={stepBasis}
            options={STEP_BASIS_OPTIONS}
            onChange={setStepBasis}
          />
        </Card>

        <Card title="Shape">
          <SegmentedControl value={shape} options={SHAPE_OPTIONS} onChange={setShape} />
          {shape === 'square' && (
            <Slider
              label="Corner radius"
              value={cornerRadius}
              display={`${cornerRadius}%`}
              min={0}
              max={100}
              step={1}
              onChange={setCornerRadius}
            />
          )}
        </Card>

        {mode === 'mono' && (
          <Card title="Colour">
            <div className="color-row">
              <input
                type="color"
                value={color}
                aria-label="Dot colour"
                onChange={(e) => setColor(e.target.value)}
              />
              <SwatchRow colors={COLOR_PRESETS} value={color} onChange={setColor} />
            </div>
            <Checkbox
              label="Invert (for dark backgrounds)"
              checked={invert}
              onChange={setInvert}
            />
          </Card>
        )}

        {mode === 'cmyk' && (
          <Card title="Channels">
            {angleControls.map(({ channel, label, value, onChange }) => (
              <div className="channel-group" key={channel}>
                <span className="channel-label">
                  <span
                    className="channel-dot"
                    style={{ background: CHANNEL_SWATCHES[channel] }}
                  />
                  {label}
                </span>
                <Slider
                  label="Angle"
                  value={value}
                  display={`${value}°`}
                  min={0}
                  max={360}
                  step={1}
                  onChange={onChange}
                />
              </div>
            ))}
            <Button variant="accent" block onClick={handleExport}>
              Export PNG
            </Button>
          </Card>
        )}

        <Card title="Preview">
          <SegmentedControl
            label="Background"
            value={previewBg}
            options={PREVIEW_BG_OPTIONS}
            onChange={setPreviewBg}
          />
          <Checkbox label="Show dot count" checked={showStats} onChange={setShowStats} />
        </Card>
      </div>

      <div className={`preview bg-${previewBg}`}>
        {mode === 'mono' ? (
          renderer === 'svg' ? (
            <Halftone {...monoProps} />
          ) : (
            <HalftoneCanvas {...monoProps} />
          )
        ) : (
          <HalftoneCMYKCanvas
            ref={cmykRef}
            src={imageSrc}
            step={step}
            density={density}
            shape={shape}
            cornerRadius={cornerRadius}
            stepBasis={stepBasis}
            channels={channels}
            width={700}
            fallback={previewFallback}
          />
        )}
      </div>
    </div>
  );
}
