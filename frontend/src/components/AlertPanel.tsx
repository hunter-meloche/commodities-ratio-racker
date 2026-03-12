import type { Alert } from "../types";

interface AlertPanelProps {
  alerts: Alert[];
}

function DirectionBadge({ direction }: { direction: Alert["direction"] }) {
  if (direction === "metals_undervalued") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/50 text-amber-300 border border-amber-700">
        <span>▼</span> Metals Undervalued
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700">
      <span>▲</span> Metals Overvalued
    </span>
  );
}

function SignalBadge({ signal }: { signal: Alert["signal"] }) {
  if (signal === "revert_to_metals") {
    return (
      <span className="text-xs text-amber-400 font-medium">
        → Mean reversion: favor metals
      </span>
    );
  }
  return (
    <span className="text-xs text-blue-400 font-medium">
      → Mean reversion: favor equities
    </span>
  );
}

export function AlertPanel({ alerts }: AlertPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="stat-card">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Active Alerts
        </h2>
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm">All ratios within normal range (±2σ)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Active Alerts ({alerts.length})
      </h2>
      {alerts.map((alert) => (
        <div
          key={alert.pair_id}
          className={`rounded-xl p-4 border ${
            alert.direction === "metals_undervalued"
              ? "bg-amber-950/40 border-amber-800"
              : "bg-blue-950/40 border-blue-800"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <span className="font-semibold text-white text-sm">{alert.pair_name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-300 bg-gray-800 px-2 py-0.5 rounded">
                Z = {alert.z_score > 0 ? "+" : ""}{alert.z_score?.toFixed(2)}σ
              </span>
              <DirectionBadge direction={alert.direction} />
            </div>
          </div>
          <p className="text-gray-300 text-xs mb-2">{alert.message}</p>
          <SignalBadge signal={alert.signal} />
        </div>
      ))}
    </div>
  );
}
