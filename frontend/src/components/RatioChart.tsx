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
  Scatter,
} from "recharts";
import type { RatioPair, TimeseriesPoint } from "../types";

interface RatioChartProps {
  pair: RatioPair;
}

// Downsample to ~500 points for performance (show every Nth point)
function downsample(data: TimeseriesPoint[], targetPoints = 500): TimeseriesPoint[] {
  if (data.length <= targetPoints) return data;
  const step = Math.ceil(data.length / targetPoints);
  const sampled = data.filter((_, i) => i % step === 0);
  // Always include the last point
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1]);
  }
  return sampled;
}

interface ChartPoint {
  date: string;
  ratio: number;
  mean: number;
  band: [number, number]; // [lower, upper] for area
  z_score: number;
  is_anomaly: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}`;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const ratioEntry = payload.find((p) => p.name === "Ratio");
  const meanEntry = payload.find((p) => p.name === "Mean");
  const zEntry = payload.find((p) => p.name === "Z-Score");

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-2 font-medium">{label}</p>
      {ratioEntry && (
        <p className="text-amber-400">
          Ratio: <span className="font-mono font-bold">{ratioEntry.value?.toFixed(4)}</span>
        </p>
      )}
      {meanEntry && (
        <p className="text-blue-400">
          Mean: <span className="font-mono">{meanEntry.value?.toFixed(4)}</span>
        </p>
      )}
      {zEntry && (
        <p className="text-gray-300">
          Z-Score: <span className="font-mono">{zEntry.value >= 0 ? "+" : ""}{zEntry.value?.toFixed(2)}σ</span>
        </p>
      )}
    </div>
  );
}

export function RatioChart({ pair }: RatioChartProps) {
  const sampled = downsample(pair.timeseries);

  // Build chart data with band as a tuple for Area stacking
  const chartData: ChartPoint[] = sampled.map((p) => ({
    date: p.date,
    ratio: p.ratio,
    mean: p.mean,
    band: [p.lower_band, p.upper_band],
    z_score: p.z_score,
    is_anomaly: p.is_anomaly,
  }));

  // Anomaly scatter points
  const anomalyPoints = chartData
    .filter((p) => p.is_anomaly)
    .map((p) => ({ date: p.date, ratio: p.ratio }));

  // Current ratio reference
  const currentRatio = pair.current.ratio;

  return (
    <div className="stat-card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-semibold text-white">{pair.name} — Historical Ratio</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>
            {pair.date_range.start} → {pair.date_range.end}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#374151" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(2)}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
            formatter={(value) => <span style={{ color: "#9ca3af" }}>{value}</span>}
          />

          {/* Std deviation band — render as stacked area */}
          <Area
            type="monotone"
            dataKey={(d: ChartPoint) => d.band[1]}
            name="Upper Band"
            stroke="none"
            fill="#d97706"
            fillOpacity={0.08}
            legendType="none"
            dot={false}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey={(d: ChartPoint) => d.band[0]}
            name="Lower Band"
            stroke="none"
            fill="#d97706"
            fillOpacity={0.0}
            legendType="none"
            dot={false}
            activeDot={false}
          />

          {/* Mean line */}
          <Line
            type="monotone"
            dataKey="mean"
            name="Mean"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="6 3"
          />

          {/* Ratio line */}
          <Line
            type="monotone"
            dataKey="ratio"
            name="Ratio"
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={false}
          />

          {/* Anomaly scatter overlay */}
          <Scatter
            data={anomalyPoints}
            fill="#ef4444"
            name="Anomaly"
            line={false}
            r={2}
          />

          {/* Current value reference line */}
          <ReferenceLine
            y={currentRatio}
            stroke="#10b981"
            strokeDasharray="4 2"
            strokeWidth={1}
            label={{ value: "Now", fill: "#10b981", fontSize: 10, position: "right" }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Band legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-0.5 bg-amber-500 inline-block" />
          <span>Ratio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-0.5 bg-blue-500 inline-block" style={{ borderTop: "1px dashed #3b82f6", background: "none" }} />
          <span>252-Day Mean</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-3 rounded" style={{ background: "rgba(217,119,6,0.15)", border: "1px solid rgba(217,119,6,0.3)" }} />
          <span>±2σ Band</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span>Anomaly</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-0.5 bg-emerald-500 inline-block" />
          <span>Current</span>
        </div>
      </div>
    </div>
  );
}
