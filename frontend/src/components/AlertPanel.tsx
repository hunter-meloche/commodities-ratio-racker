import type { RawAlert, AssetInfo, DerivedPair } from "../types";

interface AlertPanelProps {
  alerts: RawAlert[];
  assets: Record<string, AssetInfo>;
  currentPair: DerivedPair | null;
}

function DirectionBadge({ direction, assetA, assetB }: {
  direction: RawAlert["direction"];
  assetA: string;
  assetB: string;
}) {
  if (direction === "a_overvalued") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/50 text-amber-300 border border-amber-700">
        ▲ {assetA} overvalued
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700">
      ▲ {assetB} overvalued
    </span>
  );
}

function SignalBadge({ signal, assetA, assetB }: {
  signal: RawAlert["signal"];
  assetA: string;
  assetB: string;
}) {
  if (signal === "revert_down") {
    return <span className="text-xs text-amber-400 font-medium">→ Mean reversion: {assetA} likely to fall or {assetB} to rise</span>;
  }
  return <span className="text-xs text-blue-400 font-medium">→ Mean reversion: {assetB} likely to fall or {assetA} to rise</span>;
}

export function AlertPanel({ alerts, assets, currentPair }: AlertPanelProps) {
  const ifActive = currentPair?.current.if_anomaly ?? false;
  const hasAny = alerts.length > 0 || ifActive;

  if (!hasAny) {
    return (
      <div className="stat-card">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Alerts</h2>
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm">All classic pairs within normal range — no anomalies detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Active Alerts ({alerts.length + (ifActive ? 1 : 0)})
      </h2>

      {alerts.map((alert) => {
        const aName = assets[alert.asset_a]?.name ?? alert.asset_a;
        const bName = assets[alert.asset_b]?.name ?? alert.asset_b;
        return (
          <div
            key={`${alert.asset_a}/${alert.asset_b}`}
            className={`rounded-xl p-4 border ${
              alert.direction === "a_overvalued"
                ? "bg-amber-950/40 border-amber-800"
                : "bg-blue-950/40 border-blue-800"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <span className="font-semibold text-white text-sm">{alert.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-300 bg-gray-800 px-2 py-0.5 rounded">
                  Z = {alert.z_score >= 0 ? "+" : ""}{alert.z_score.toFixed(2)}σ
                </span>
                <DirectionBadge direction={alert.direction} assetA={aName} assetB={bName} />
              </div>
            </div>
            <p className="text-gray-300 text-xs mb-2">{alert.message}</p>
            <SignalBadge signal={alert.signal} assetA={aName} assetB={bName} />
          </div>
        );
      })}

      {ifActive && (
        <div className="rounded-xl p-4 border bg-purple-950/30 border-purple-800">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <span className="font-semibold text-white text-sm">Multi-Pair ML Dislocation</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-700">
              ⬥ IsolationForest
            </span>
          </div>
          <p className="text-gray-300 text-xs mb-2">
            Today is flagged by the ML model as anomalous across the classic gold/silver vs index pairs.
            This cross-pair signal suggests a systemic dislocation rather than an isolated move.
          </p>
        </div>
      )}
    </div>
  );
}
