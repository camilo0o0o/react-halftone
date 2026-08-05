import { useState, useRef } from 'react';
import { Halftone, HalftoneCanvas, HalftoneCMYKCanvas, useHalftone } from 'react-halftone';
import type {
  HalftoneCMYKHandle,
  HalftoneFallback,
  ShapeType,
} from 'react-halftone';

type Mode = 'mono' | 'cmyk';
type Renderer = 'canvas' | 'svg';
type StepBasis = 'min' | 'width';
type PreviewBg = 'light' | 'dark' | 'checker';

const COLOR_PRESETS = ['#000000', '#ffffff', '#e63946', '#1d4ed8', '#f77f00'];

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

function MonoStats({ src, ...config }: MonoStatsProps) {
  const { status, circleCount, naturalWidth, naturalHeight } = useHalftone(src, config);
  if (status === 'error') return <p className="stats-line">stats unavailable</p>;
  if (status !== 'ready') return <p className="stats-line">computing…</p>;
  return (
    <p className="stats-line">
      {circleCount.toLocaleString()} dots · {naturalWidth}×{naturalHeight}px source
    </p>
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

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
    }
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
      <div className="controls">
        <h1>react-halftone</h1>

        <div className="mode-toggle">
          <button
            className={mode === 'mono' ? 'active' : ''}
            onClick={() => setMode('mono')}
          >
            Monochrome
          </button>
          <button
            className={mode === 'cmyk' ? 'active' : ''}
            onClick={() => setMode('cmyk')}
          >
            CMYK
          </button>
        </div>

        <h2>Image</h2>
        <div className="field">
          <input type="file" accept="image/*" onChange={handleFileUpload} />
        </div>

        {mode === 'mono' && (
          <>
            <h2>Renderer</h2>
            <div className="shape-toggle">
              <button
                className={renderer === 'canvas' ? 'active' : ''}
                onClick={() => setRenderer('canvas')}
              >
                Canvas (raster)
              </button>
              <button
                className={renderer === 'svg' ? 'active' : ''}
                onClick={() => setRenderer('svg')}
              >
                SVG
              </button>
            </div>
          </>
        )}

        <h2>Grid</h2>
        <div className="field">
          <label>
            Step <span>{step}</span>
          </label>
          <div className="step-row">
            <input
              type="range"
              min={0.1}
              max={10}
              step={0.1}
              value={step}
              onChange={(e) => setStepClamped(Number(e.target.value))}
            />
            <input
              type="number"
              className="step-number"
              min={0.1}
              max={10}
              step={0.01}
              value={step}
              onChange={(e) => setStepClamped(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="field">
          <label>
            Density <span>{density}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Step basis</label>
          <div className="shape-toggle">
            <button
              className={stepBasis === 'min' ? 'active' : ''}
              onClick={() => setStepBasis('min')}
            >
              min
            </button>
            <button
              className={stepBasis === 'width' ? 'active' : ''}
              onClick={() => setStepBasis('width')}
            >
              width
            </button>
          </div>
        </div>

        <h2>Shape</h2>
        <div className="shape-toggle">
          <button
            className={shape === 'circle' ? 'active' : ''}
            onClick={() => setShape('circle')}
          >
            Circle
          </button>
          <button
            className={shape === 'square' ? 'active' : ''}
            onClick={() => setShape('square')}
          >
            Square
          </button>
        </div>
        {shape === 'square' && (
          <div className="field">
            <label>
              Corner Radius <span>{cornerRadius}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={cornerRadius}
              onChange={(e) => setCornerRadius(Number(e.target.value))}
            />
          </div>
        )}

        {mode === 'mono' && (
          <>
            <h2>Color</h2>
            <div className="field">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            <div className="swatch-row">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  className={`swatch ${color === preset ? 'active' : ''}`}
                  style={{ background: preset }}
                  title={preset}
                  onClick={() => setColor(preset)}
                />
              ))}
            </div>
            <div className="toggle-row">
              <input
                type="checkbox"
                id="invert"
                checked={invert}
                onChange={(e) => setInvert(e.target.checked)}
              />
              <label htmlFor="invert">Invert (for dark backgrounds)</label>
            </div>
          </>
        )}

        {mode === 'cmyk' && (
          <>
            <h2>Channel Angles</h2>
            <div className="channel-group">
              <div className="channel-label">
                <span className="channel-dot" style={{ background: '#00FFFF' }} />
                Cyan
              </div>
              <div className="field">
                <label>
                  Angle <span>{angleC}°</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={angleC}
                  onChange={(e) => setAngleC(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="channel-group">
              <div className="channel-label">
                <span className="channel-dot" style={{ background: '#FF00FF' }} />
                Magenta
              </div>
              <div className="field">
                <label>
                  Angle <span>{angleM}°</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={angleM}
                  onChange={(e) => setAngleM(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="channel-group">
              <div className="channel-label">
                <span className="channel-dot" style={{ background: '#FFFF00', border: '1px solid #ccc' }} />
                Yellow
              </div>
              <div className="field">
                <label>
                  Angle <span>{angleY}°</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={angleY}
                  onChange={(e) => setAngleY(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="channel-group">
              <div className="channel-label">
                <span className="channel-dot" style={{ background: '#000000' }} />
                Black (K)
              </div>
              <div className="field">
                <label>
                  Angle <span>{angleK}°</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={angleK}
                  onChange={(e) => setAngleK(Number(e.target.value))}
                />
              </div>
            </div>

            <button className="export-btn" onClick={handleExport}>
              Export PNG
            </button>
          </>
        )}

        <h2>Preview</h2>
        <div className="shape-toggle">
          <button
            className={previewBg === 'light' ? 'active' : ''}
            onClick={() => setPreviewBg('light')}
          >
            Light
          </button>
          <button
            className={previewBg === 'dark' ? 'active' : ''}
            onClick={() => setPreviewBg('dark')}
          >
            Dark
          </button>
          <button
            className={previewBg === 'checker' ? 'active' : ''}
            onClick={() => setPreviewBg('checker')}
          >
            Checker
          </button>
        </div>
        {mode === 'mono' && (
          <>
            <div className="toggle-row">
              <input
                type="checkbox"
                id="stats"
                checked={showStats}
                onChange={(e) => setShowStats(e.target.checked)}
              />
              <label htmlFor="stats">Show dot count</label>
            </div>
            {showStats && (
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
            )}
          </>
        )}
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
            channels={{
              c: { angle: angleC },
              m: { angle: angleM },
              y: { angle: angleY },
              k: { angle: angleK },
            }}
            width={700}
            fallback={previewFallback}
          />
        )}
      </div>
    </div>
  );
}
