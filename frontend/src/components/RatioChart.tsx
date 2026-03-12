import { useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { DerivedPair, ComputedPoint } from "../types";

interface RatioChartProps {
  pair: DerivedPair;
}

type Range = "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "10Y" | "All";

const RANGES: { label: Range; days: number | null }[] = [
  { label: "1M",  days: 30   },
  { label: "3M",  days: 90   },
  { label: "6M",  days: 182  },
  { label: "1Y",  days: 365  },
  { label: "3Y",  days: 1095 },
  { label: "5Y",  days: 1825 },
  { label: "10Y", days: 3650 },
  { label: "All", days: null },
];

function filterByRange(data: ComputedPoint[], days: number | null): ComputedPoint[] {
  if (days === null) return data;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((p) => p.date >= cutoffStr);
}

function downsample(data: ComputedPoint[], targetPoints = 500): ComputedPoint[] {
  if (data.length <= targetPoints) return data;
  const step = Math.ceil(data.length / targetPoints);
  const sampled = data.filter((_, i) => i % step === 0);
  if (sampled[sampled.length - 1] !== data[data.length - 1]) sampled.push(data[data.length - 1]);
  return sampled;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).getFullYear().toString();
}

function AnomalyDot(props: { cx?: number; cy?: number; payload?: ComputedPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  if (payload.is_anomaly) return <circle cx={cx} cy={cy} r={3} fill="#ef4444" stroke="none" opacity={0.85} />;
  if (payload.if_anomaly) {
    const s = 4;
    const pts = `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
    return <polygon points={pts} fill="#a855f7" stroke="none" opacity={0.75} />;
  }
  return null;
}

function fmt(v: number, decimals = 2) {
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function CustomTooltip({ active, payload, pair }: {
  active?: boolean;
  payload?: Array<{ name: string; payload: ComputedPoint }>;
  pair: DerivedPair;
}) {
  if (!active || !payload || !payload[0]) return null;
  const p = payload[0].payload;
  const { asset_a, asset_b } = pair;
  const aDecimals = asset_a.unit.includes("/lb") ? 4 : 2;
  const bDecimals = asset_b.unit.includes("/lb") ? 4 : 2;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs w-64">
      <p className="text-gray-400 mb-2 font-semibold">{p.date}</p>

      <div className="mb-2 space-y-0.5">
        <p className="text-gray-500 uppercase tracking-wider" style={{ fontSize: "10px" }}>Actual prices</p>
        <p className="text-amber-300">{asset_a.symbol}: <span className="font-mono font-bold">${fmt(p.price_a, aDecimals)}</span> <span className="text-gray-500">{asset_a.unit}</span></p>
        <p className="text-amber-300">{asset_b.symbol}: <span className="font-mono font-bold">${fmt(p.price_b, bDecimals)}</span> <span className="text-gray-500">{asset_b.unit}</span></p>
      </div>

      <div className="mb-2 space-y-0.5 border-t border-gray-800 pt-2">
        <p className="text-gray-500 uppercase tracking-wider" style={{ fontSize: "10px" }}>Ratio metrics</p>
        <p className="text-white">Ratio: <span className="font-mono">{fmt(p.ratio, 4)}</span></p>
        <p className="text-blue-400">Mean: <span className="font-mono">{fmt(p.mean, 4)}</span></p>
        <p className="text-gray-400">+2σ: <span className="font-mono">{fmt(p.upper_band, 4)}</span>  −2σ: <span className="font-mono">{fmt(p.lower_band, 4)}</span></p>
        <p className="text-gray-300">Z-Score: <span className="font-mono">{p.z_score >= 0 ? "+" : ""}{fmt(p.z_score, 2)}σ</span></p>
      </div>

      <div className="space-y-0.5 border-t border-gray-800 pt-2">
        <p className="text-gray-500 uppercase tracking-wider" style={{ fontSize: "10px" }}>At mean ratio — implied</p>
        <p className="text-blue-300">{asset_a.symbol}: <span className="font-mono">${fmt(p.price_b * p.mean, aDecimals)}</span></p>
        <p className="text-blue-300">{asset_b.symbol}: <span className="font-mono">${fmt(p.price_a / p.mean, bDecimals)}</span></p>
      </div>

      {p.if_anomaly && <p className="text-purple-400 mt-2 font-medium border-t border-gray-800 pt-2">⬥ ML multi-pair anomaly</p>}
    </div>
  );
}

export function RatioChart({ pair }: RatioChartProps) {
  const [range, setRange] = useState<Range>("All");
  const activeDays = RANGES.find((r) => r.label === range)?.days ?? null;

  const chartData = useMemo(() => {
    return downsample(filterByRange(pair.timeseries, activeDays));
  }, [pair.timeseries, activeDays]);

  return (
    <div className="stat-card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold text-white">{pair.name} — Ratio</h3>
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {RANGES.map(({ label }) => (
            <button
              key={label}
              onClick={() => setRange(label)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                range === label ? "bg-amber-500 text-gray-950" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#374151" }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(2)} width={60} />
          <Tooltip content={<CustomTooltip pair={pair} />} />
          <Legend wrapperStyle={{ fontSize: "12px" }} formatter={(v) => <span style={{ color: "#9ca3af" }}>{v}</span>} />

          <Area type="monotone" dataKey="upper_band" name="Upper Band" stroke="#d97706" strokeWidth={0.5} strokeDasharray="4 4" fill="#d97706" fillOpacity={0.08} legendType="none" dot={false} activeDot={false} />
          <Area type="monotone" dataKey="lower_band" name="Lower Band" stroke="#d97706" strokeWidth={0.5} strokeDasharray="4 4" fill="#030712" fillOpacity={1} legendType="none" dot={false} activeDot={false} />
          <Line type="monotone" dataKey="mean" name="Mean" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="6 3" activeDot={{ r: 3, fill: "#3b82f6" }} />
          <Line type="monotone" dataKey="ratio" name="Ratio" stroke="#f59e0b" strokeWidth={1.5} dot={<AnomalyDot />} activeDot={{ r: 4, fill: "#f59e0b" }} />
          <Line type="monotone" dataKey="z_score" name="Z-Score" stroke="transparent" dot={false} legendType="none" activeDot={false} />
          <Line type="monotone" dataKey="if_anomaly" name="IF" stroke="transparent" dot={false} legendType="none" activeDot={false} />

          <ReferenceLine y={pair.current.ratio} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} label={{ value: "Now", fill: "#10b981", fontSize: 10, position: "right" }} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-amber-500 inline-block" /><span>Ratio</span></div>
        <div className="flex items-center gap-1.5"><span className="w-6 h-0.5 opacity-60" style={{ borderTop: "1px dashed #3b82f6" }} /><span>252-Day Mean</span></div>
        <div className="flex items-center gap-1.5"><span className="w-6 h-3 rounded" style={{ background: "rgba(217,119,6,0.15)", border: "1px dashed rgba(217,119,6,0.5)" }} /><span>±2σ Band</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /><span>Z-Score Anomaly</span></div>
        <div className="flex items-center gap-1.5"><svg width="10" height="10" viewBox="-5 -5 10 10"><polygon points="0,-4 4,0 0,4 -4,0" fill="#a855f7" /></svg><span>ML Anomaly</span></div>
        <div className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-emerald-500 inline-block" /><span>Current</span></div>
      </div>
    </div>
  );
}
