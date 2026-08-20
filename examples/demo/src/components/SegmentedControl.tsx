interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Omit for a bare control (the Mode switch at the top of the sidebar). */
  label?: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="control">
      {label && <span className="control-label">{label}</span>}
      {/* Adjacent buttons collapse their shared border in CSS, so the group
          reads as one bordered strip rather than a row of separate buttons. */}
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`toggle-btn${option.value === value ? ' active' : ''}`}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
