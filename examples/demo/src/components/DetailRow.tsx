interface DetailRowProps {
  label: string;
  value: string;
  /** Dims the row when the value belongs to a superseded computation. */
  stale?: boolean;
}

export function DetailRow({ label, value, stale }: DetailRowProps) {
  return (
    <div className="detail-row" data-stale={stale || undefined}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
