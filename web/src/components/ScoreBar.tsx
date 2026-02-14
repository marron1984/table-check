interface ScoreBarProps {
  value: number; // 0-1
  label: string;
  color?: string;
}

export function ScoreBar({ value, label, color = "#2563eb" }: ScoreBarProps) {
  const pct = Math.round(value * 100);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
      {label}: {pct}%
      <span className="score-bar">
        <span
          className="score-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
    </span>
  );
}
