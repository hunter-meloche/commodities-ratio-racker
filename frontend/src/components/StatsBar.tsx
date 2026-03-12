import type { DerivedPair } from "../types";

interface StatsBarProps {
  pair: DerivedPair;
}

function StatCard({ label, value, sub, highlight }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "danger" | "warning" | "normal" | "active";
}) {
  const colors = { danger: "text-red-400", warning: "text-amber-400", normal: "text-white", active: "text-purple-400" };
  return (
    <div className="stat-card flex-1 min-w-[120px]">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${colors[highlight ?? "normal"]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function StatsBar({ pair }: StatsBarProps) {
  const { current, asset_a, asset_b } = pair;
  const absZ = Math.abs(current.z_score);
  const zHighlight = absZ >= 2.5 ? "danger" : absZ >= 2.0 ? "warning" : "normal";

  const directionLabel =
    current.direction === "a_overvalued" ? `${asset_a.name} expensive vs ${asset_b.name}`
    : current.direction === "b_overvalued" ? `${asset_b.name} expensive vs ${asset_a.name}`
    : "Within normal range";

  return (
    <div className="flex flex-wrap gap-3">
      <StatCard label="Current Ratio" value={current.ratio.toFixed(4)} sub={`${asset_a.symbol} / ${asset_b.symbol}`} />
      <StatCard
        label="Z-Score"
        value={`${current.z_score >= 0 ? "+" : ""}${current.z_score.toFixed(2)}σ`}
        sub={directionLabel}
        highlight={zHighlight}
      />
      <StatCard label="1Y Mean" value={current.mean.toFixed(4)} sub="252-day rolling" />
      <StatCard label="Upper Band (+2σ)" value={current.upper_band.toFixed(4)} sub="Overbought threshold" />
      <StatCard label="Lower Band (−2σ)" value={current.lower_band.toFixed(4)} sub="Oversold threshold" />
      <StatCard
        label="ML Signal"
        value={current.if_anomaly ? "ACTIVE" : "Normal"}
        sub={current.if_anomaly ? "Multi-pair dislocation" : "No cross-pair anomaly"}
        highlight={current.if_anomaly ? "active" : "normal"}
      />
    </div>
  );
}
