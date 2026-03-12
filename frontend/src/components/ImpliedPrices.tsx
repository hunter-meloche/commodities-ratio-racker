import type { DerivedPair } from "../types";

function fmt(v: number, decimals = 2) {
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function PriceRow({ label, aVal, bVal, aSymbol, bSymbol, aUnit, bUnit, highlight }: {
  label: string;
  aVal: number;
  bVal: number;
  aSymbol: string;
  bSymbol: string;
  aUnit: string;
  bUnit: string;
  highlight?: "current" | "mean" | "band";
}) {
  const labelColors = { current: "text-emerald-400", mean: "text-blue-400", band: "text-amber-400" };
  const color = highlight ? labelColors[highlight] : "text-gray-400";
  // Determine decimal places from unit
  const aDecimals = aUnit.includes("/lb") ? 4 : 2;
  const bDecimals = bUnit.includes("/lb") ? 4 : 2;

  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-800 last:border-0 items-center">
      <span className={`text-xs font-medium ${color}`}>{label}</span>
      <span className="text-xs font-mono text-white text-right">
        <span className="text-gray-500 text-xs mr-1">{aSymbol}</span>${fmt(aVal, aDecimals)}
      </span>
      <span className="text-xs font-mono text-white text-right">
        <span className="text-gray-500 text-xs mr-1">{bSymbol}</span>${fmt(bVal, bDecimals)}
      </span>
    </div>
  );
}

export function ImpliedPrices({ pair }: { pair: DerivedPair }) {
  const { current, asset_a, asset_b } = pair;
  const { price_a, price_b, mean, upper_band, lower_band, ratio } = current;

  const pctToMean = ((ratio / mean) - 1) * 100;
  const pctLabel = pctToMean > 0
    ? `Ratio ${pctToMean.toFixed(1)}% above mean`
    : `Ratio ${Math.abs(pctToMean).toFixed(1)}% below mean`;

  const rows = [
    { label: "Current",  aVal: price_a, bVal: price_b,           highlight: "current" as const },
    { label: "At mean",  aVal: price_b * mean,        bVal: price_a / mean,        highlight: "mean" as const },
    { label: "At +2σ",   aVal: price_b * upper_band,  bVal: price_a / upper_band,  highlight: "band" as const },
    { label: "At −2σ",   aVal: price_b * lower_band,  bVal: price_a / lower_band,  highlight: "band" as const },
  ];

  return (
    <div className="stat-card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Implied Prices</h3>
        <span className={`text-xs font-medium ${pctToMean > 0 ? "text-amber-400" : "text-blue-400"}`}>
          {pctLabel}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Each row anchors one asset at its current price and shows what the other must be for that ratio to hold.
      </p>

      <div className="grid grid-cols-3 gap-2 pb-1 mb-1">
        <span className="text-xs text-gray-600 uppercase tracking-wider">Ratio level</span>
        <span className="text-xs text-gray-600 uppercase tracking-wider text-right">
          {asset_a.name} implied
        </span>
        <span className="text-xs text-gray-600 uppercase tracking-wider text-right">
          {asset_b.name} implied
        </span>
      </div>

      {rows.map((row) => (
        <PriceRow
          key={row.label}
          label={row.label}
          aVal={row.aVal}
          bVal={row.bVal}
          aSymbol={asset_a.symbol}
          bSymbol={asset_b.symbol}
          aUnit={asset_a.unit}
          bUnit={asset_b.unit}
          highlight={row.highlight}
        />
      ))}

      <p className="text-xs text-gray-600 mt-3">
        <span className="text-gray-500">{asset_a.name} implied</span> = current {asset_b.name} × ratio &nbsp;·&nbsp;
        <span className="text-gray-500">{asset_b.name} implied</span> = current {asset_a.name} ÷ ratio
      </p>
    </div>
  );
}
