import { useState, useRef } from 'react';
import { HalftoneCanvas, HalftoneCMYKCanvas } from 'react-halftone';
import type { HalftoneCMYKHandle, ShapeType } from 'react-halftone';

type Mode = 'mono' | 'cmyk';

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

  // Mono controls
  const [color, setColor] = useState('#000000');
  const [invert, setInvert] = useState(false);

  // CMYK angles
  const [angleC, setAngleC] = useState(15);
  const [angleM, setAngleM] = useState(75);
  const [angleY, setAngleY] = useState(0);
  const [angleK, setAngleK] = useState(45);

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

        <h2>Grid</h2>
        <div className="field">
          <label>
            Step <span>{step}</span>
          </label>
          <input
            type="range"
            min={0.1}
            max={20}
            step={0.1}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
          />
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
      </div>

      <div className="preview">
        {mode === 'mono' ? (
          <HalftoneCanvas
            src={imageSrc}
            step={step}
            density={density}
            color={color}
            invert={invert}
            shape={shape}
            cornerRadius={cornerRadius}
            width={700}
            fallback={(status) =>
              status === 'loading' ? (
                <p className="status-text">Loading image…</p>
              ) : status === 'processing' ? (
                <p className="status-text">Generating halftone…</p>
              ) : null
            }
          />
        ) : (
          <HalftoneCMYKCanvas
            ref={cmykRef}
            src={imageSrc}
            step={step}
            density={density}
            shape={shape}
            cornerRadius={cornerRadius}
            channels={{
              c: { angle: angleC },
              m: { angle: angleM },
              y: { angle: angleY },
              k: { angle: angleK },
            }}
            width={700}
            fallback={(status) =>
              status === 'loading' ? (
                <p className="status-text">Loading image…</p>
              ) : status === 'processing' ? (
                <p className="status-text">Generating halftone…</p>
              ) : null
            }
          />
        )}
      </div>
    </div>
  );
}
