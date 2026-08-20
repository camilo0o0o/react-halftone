interface SwatchRowProps {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
}

export function SwatchRow({ colors, value, onChange }: SwatchRowProps) {
  return (
    <div className="swatch-row">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch${color === value ? ' active' : ''}`}
          style={{ background: color }}
          title={color}
          aria-label={`Use ${color}`}
          aria-pressed={color === value}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
