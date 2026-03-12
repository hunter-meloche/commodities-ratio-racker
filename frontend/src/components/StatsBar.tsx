import type { RatioPair } from "../types";

interface StatsBarProps {
  pair: RatioPair;
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "danger" | "warning" | "normal";
}) {
  const colors = {
    danger: "text-red-400",
    warning: "text-amber-400",
    normal: "text-white",
  };
  const color = colors[highlight || "normal"];
  return (
    <div className="stat-card flex-1 min-w-[120px]">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function StatsBar({ pair }: StatsBarProps) {
  const { current } = pair;
  const absZ = Math.abs(current.z_score);
  const zHighlight =
    absZ >= 2.5 ? "danger" : absZ >= 2.0 ? "warning" : "normal";

  const directionLabel = current.direction === "metals_undervalued"
    ? "Metals cheap vs equities"
    : current.direction === "metals_overvalued"
      ? "Metals expensive vs equities"
      : "Within normal range";

  return (
    <div className="flex flex-wrap gap-3">
      <StatCard
        label="Current Ratio"
        value={current.ratio.toFixed(4)}
        sub={`${pair.index_symbol} / ${pair.metal_symbol}`}
      />
      <StatCard
        label="Z-Score"
        value={`${current.z_score >= 0 ? "+" : ""}${current.z_score.toFixed(2)}σ`}
        sub={directionLabel}
        highlight={zHighlight}
      />
      <StatCard
        label="1Y Mean"
        value={current.mean.toFixed(4)}
        sub="252-day rolling"
      />
      <StatCard
        label="Upper Band (+2σ)"
        value={current.upper_band.toFixed(4)}
        sub="Overbought threshold"
      />
      <StatCard
        label="Lower Band (−2σ)"
        value={current.lower_band.toFixed(4)}
        sub="Oversold threshold"
      />
    </div>
  );
}
