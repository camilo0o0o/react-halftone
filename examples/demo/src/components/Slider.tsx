import { useId } from 'react';
import type { ReactNode } from 'react';

interface SliderProps {
  label: string;
  value: number;
  /** Formatted value shown right-aligned in the label. Defaults to `value`. */
  display?: ReactNode;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Rendered beside the track — used for Step's exact-value number input. */
  children?: ReactNode;
}

export function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  children,
}: SliderProps) {
  const id = useId();

  return (
    <div className="control">
      <label className="control-label" htmlFor={id}>
        <span>{label}</span>
        <span className="control-value">{display ?? value}</span>
      </label>
      <div className="control-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {children}
      </div>
    </div>
  );
}
