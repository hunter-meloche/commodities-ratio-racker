import type { AssetInfo, ComputedPoint, DerivedPair } from "../types";

const WINDOW = 252;
const THRESHOLD = 2.0;

// O(n) sliding-window mean + sample std dev
function rollingMeanStd(values: number[], window: number) {
  const n = values.length;
  const mean: (number | null)[] = new Array(n).fill(null);
  const std: (number | null)[] = new Array(n).fill(null);

  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    sum += v;
    sumSq += v * v;

    if (i >= window) {
      const old = values[i - window];
      sum -= old;
      sumSq -= old * old;
    }

    if (i >= window - 1) {
      const m = sum / window;
      const sampleVar = Math.max(0, (sumSq - (sum * sum) / window) / (window - 1));
      mean[i] = m;
      std[i] = Math.sqrt(sampleVar);
    }
  }

  return { mean, std };
}

export function computePair(
  assetA: AssetInfo,
  assetB: AssetInfo,
  ifAnomalyDates: Set<string>
): DerivedPair | null {
  // Build date→price map for B
  const bMap = new Map(assetB.timeseries.map((p) => [p.date, p.price]));

  // Find common dates, compute raw ratios
  const common = assetA.timeseries
    .filter((p) => bMap.has(p.date))
    .map((p) => ({
      date: p.date,
      price_a: p.price,
      price_b: bMap.get(p.date)!,
      ratio: p.price / bMap.get(p.date)!,
    }));

  if (common.length < WINDOW + 10) return null;

  const { mean, std } = rollingMeanStd(common.map((p) => p.ratio), WINDOW);

  const timeseries: ComputedPoint[] = [];
  for (let i = 0; i < common.length; i++) {
    const m = mean[i];
    const s = std[i];
    if (m == null || s == null || s === 0) continue;

    const z = (common[i].ratio - m) / s;
    timeseries.push({
      ...common[i],
      mean: m,
      upper_band: m + THRESHOLD * s,
      lower_band: m - THRESHOLD * s,
      z_score: z,
      is_anomaly: Math.abs(z) > THRESHOLD,
      if_anomaly: ifAnomalyDates.has(common[i].date),
    });
  }

  if (timeseries.length === 0) return null;

  const last = timeseries[timeseries.length - 1];
  const direction =
    last.z_score > THRESHOLD ? "a_overvalued"
    : last.z_score < -THRESHOLD ? "b_overvalued"
    : null;

  return {
    name: `${assetA.name} / ${assetB.name}`,
    asset_a: assetA,
    asset_b: assetB,
    timeseries,
    current: {
      ratio: last.ratio,
      z_score: last.z_score,
      mean: last.mean,
      upper_band: last.upper_band,
      lower_band: last.lower_band,
      price_a: last.price_a,
      price_b: last.price_b,
      is_anomaly: last.is_anomaly,
      if_anomaly: last.if_anomaly,
      direction,
    },
  };
}
