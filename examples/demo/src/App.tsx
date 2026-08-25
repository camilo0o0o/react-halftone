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
import { buildMonoSVG, downloadText, downloadURL, svgToPNG } from './export';

type Mode = 'mono' | 'cmyk';
type Renderer = 'canvas' | 'svg';
type StepBasis = 'min' | 'width';
/** `custom` is whatever the background colour picker last produced. */
type PreviewBg = 'light' | 'dark' | 'checker' | 'custom';
/** Shape, plus the escape hatch that shows the source image untouched. */
type DisplayMode = ShapeType | 'original';

const COLOR_PRESETS = ['#000000', '#ffffff', '#e63946', '#1d4ed8', '#f77f00'];

const DEFAULTS = {
  imageSrc: '/sample.jpeg',
  mode: 'cmyk',
  step: 5,
  density: 80,
  displayMode: 'circle',
  cornerRadius: 0,
  stepBasis: 'min',
  renderer: 'canvas',
  color: '#000000',
  invert: false,
  showStats: true,
  previewBg: 'light',
  customBg: '#d9d9d9',
  angleC: 15,
  angleM: 75,
  angleY: 0,
  angleK: 45,
} as const;

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

const SHAPE_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'original', label: 'Original' },
];

// No `custom` entry: picking a colour selects that state, and none of these
// three staying lit is exactly the right signal that a custom fill is active.
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
  const monoCanvasRef = useRef<HTMLCanvasElement>(null);

  // Image source
  const [imageSrc, setImageSrc] = useState<string>(DEFAULTS.imageSrc);

  // Mode
  const [mode, setMode] = useState<Mode>(DEFAULTS.mode);

  // Shared controls
  const [step, setStep] = useState<number>(DEFAULTS.step);
  const [density, setDensity] = useState<number>(DEFAULTS.density);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(DEFAULTS.displayMode);
  const [cornerRadius, setCornerRadius] = useState<number>(DEFAULTS.cornerRadius);
  const [stepBasis, setStepBasis] = useState<StepBasis>(DEFAULTS.stepBasis);

  // Mono controls
  const [renderer, setRenderer] = useState<Renderer>(DEFAULTS.renderer);
  const [color, setColor] = useState<string>(DEFAULTS.color);
  const [invert, setInvert] = useState<boolean>(DEFAULTS.invert);
  const [showStats, setShowStats] = useState<boolean>(DEFAULTS.showStats);

  // Preview pane
  const [previewBg, setPreviewBg] = useState<PreviewBg>(DEFAULTS.previewBg);
  const [customBg, setCustomBg] = useState<string>(DEFAULTS.customBg);

  // Export
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  // CMYK angles
  const [angleC, setAngleC] = useState<number>(DEFAULTS.angleC);
  const [angleM, setAngleM] = useState<number>(DEFAULTS.angleM);
  const [angleY, setAngleY] = useState<number>(DEFAULTS.angleY);
  const [angleK, setAngleK] = useState<number>(DEFAULTS.angleK);

  // `original` isn't a shape the core knows about — it only decides whether
  // the preview shows the halftone at all, so the halftone config keeps the
  // last real shape's neighbour, circle.
  const shape: ShapeType = displayMode === 'original' ? 'circle' : displayMode;

  // Step is shared by the slider and the exact-value number input; clamp to the
  // range the core accepts (min matches the core's MIN_STEP of 0.1).
  function setStepClamped(value: number) {
    if (Number.isNaN(value)) return;
    setStep(Math.min(10, Math.max(0.1, value)));
  }

  // Uploads hand out object URLs that stay alive until revoked, so every
  // replacement of one has to release it first.
  function replaceImageSrc(next: string) {
    setImageSrc((current) => {
      if (current.startsWith('blob:')) URL.revokeObjectURL(current);
      return next;
    });
  }

  function handleFileUpload(file: File) {
    replaceImageSrc(URL.createObjectURL(file));
  }

  function handleReset() {
    replaceImageSrc(DEFAULTS.imageSrc);
    setMode(DEFAULTS.mode);
    setStep(DEFAULTS.step);
    setDensity(DEFAULTS.density);
    setDisplayMode(DEFAULTS.displayMode);
    setCornerRadius(DEFAULTS.cornerRadius);
    setStepBasis(DEFAULTS.stepBasis);
    setRenderer(DEFAULTS.renderer);
    setColor(DEFAULTS.color);
    setInvert(DEFAULTS.invert);
    setShowStats(DEFAULTS.showStats);
    setPreviewBg(DEFAULTS.previewBg);
    setCustomBg(DEFAULTS.customBg);
    setAngleC(DEFAULTS.angleC);
    setAngleM(DEFAULTS.angleM);
    setAngleY(DEFAULTS.angleY);
    setAngleK(DEFAULTS.angleK);
  }

  function handleCustomBg(value: string) {
    setCustomBg(value);
    setPreviewBg('custom');
  }

  function handleExportCMYK() {
    if (!cmykRef.current) return;
    downloadURL('halftone-cmyk.png', cmykRef.current.toDataURL('image/png'));
  }

  // The mono exports recompute from the source pixels rather than reading the
  // preview, so they come out at the image's natural resolution regardless of
  // the 700px the preview is displayed at.
  async function runMonoExport(work: () => Promise<void>) {
    setExporting(true);
    setExportNote('Rendering export…');
    try {
      await work();
      setExportNote(null);
    } catch (error) {
      setExportNote(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  function handleExportMonoSVG() {
    void runMonoExport(async () => {
      const { svg } = await buildMonoSVG(imageSrc, monoConfig);
      downloadText('halftone-mono.svg', svg, 'image/svg+xml');
    });
  }

  function handleExportMonoPNG() {
    void runMonoExport(async () => {
      // In canvas mode the pixels are already on screen — the forwarded ref is
      // the whole export. The SVG renderer has no canvas to read, so that path
      // rasterizes the same standalone SVG the SVG button downloads.
      const canvas = monoCanvasRef.current;
      if (canvas) {
        downloadURL('halftone-mono.png', canvas.toDataURL('image/png'));
        return;
      }
      const { svg, width, height } = await buildMonoSVG(imageSrc, monoConfig);
      downloadURL('halftone-mono.png', await svgToPNG(svg, width, height));
    });
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

  // Shared by the preview and the exports so a download can never disagree
  // with what's on screen.
  const monoConfig = { step, density, color, invert, shape, cornerRadius, stepBasis };

  const monoProps = {
    ...monoConfig,
    src: imageSrc,
    width: 700,
    fallback: previewFallback,
  };

  return (
    <div className="app">
      <div className="sidebar">
        <header className="sidebar-header">
          <h1 className="app-title">react-halftone</h1>
          {/* Per-section cards leave no single "Controls" header for this to
              sit in, the way the style reference has it — the sidebar's own
              header row plays that part instead. */}
          <Button onClick={handleReset}>Reset</Button>
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
          <SegmentedControl
            value={displayMode}
            options={SHAPE_OPTIONS}
            onChange={setDisplayMode}
          />
          {displayMode === 'square' && (
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
          </Card>
        )}

        <Card title="Export">
          {mode === 'mono' ? (
            <>
              <Button
                variant="accent"
                block
                disabled={exporting || displayMode === 'original'}
                onClick={handleExportMonoPNG}
              >
                Export PNG
              </Button>
              <Button
                block
                disabled={exporting || displayMode === 'original'}
                onClick={handleExportMonoSVG}
              >
                Export SVG
              </Button>
            </>
          ) : (
            <Button variant="accent" block onClick={handleExportCMYK}>
              Export PNG
            </Button>
          )}
          {/* An export always matches the preview — and in `original` there is
              no halftone on screen to match. */}
          {mode === 'mono' && displayMode === 'original' && (
            <span className="control-value">Pick a shape to export a halftone.</span>
          )}
          {exportNote && <span className="control-value">{exportNote}</span>}
        </Card>

        <Card title="Preview">
          <SegmentedControl
            label="Background"
            value={previewBg}
            options={PREVIEW_BG_OPTIONS}
            onChange={setPreviewBg}
          />
          <div className="color-row">
            <input
              type="color"
              value={customBg}
              aria-label="Custom background colour"
              onChange={(e) => handleCustomBg(e.target.value)}
            />
            <span className="control-value">
              {previewBg === 'custom' ? customBg : 'Pick a custom background'}
            </span>
          </div>
          <Checkbox label="Show dot count" checked={showStats} onChange={setShowStats} />
        </Card>
      </div>

      <div className="preview">
        {/* Framed in CSS on purpose: the library components keep rendering
            their own canvas/svg, so the renderer toggle still exercises both
            paths. The frame is never part of what they draw. */}
        <div
          className={`preview-frame bg-${previewBg}`}
          style={previewBg === 'custom' ? { background: customBg } : undefined}
        >
          {displayMode === 'original' ? (
            <img src={imageSrc} alt="Source image, unprocessed" />
          ) : mode === 'mono' ? (
            renderer === 'svg' ? (
              <Halftone {...monoProps} />
            ) : (
              <HalftoneCanvas ref={monoCanvasRef} {...monoProps} />
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
    </div>
  );
}
