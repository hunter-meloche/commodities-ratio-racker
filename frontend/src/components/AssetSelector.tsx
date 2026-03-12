import type { AssetInfo, AssetType } from "../types";

interface AssetSelectorProps {
  assets: Record<string, AssetInfo>;
  symbolA: string;
  symbolB: string;
  onChangeA: (s: string) => void;
  onChangeB: (s: string) => void;
}

const GROUP_LABELS: Record<AssetType, string> = {
  index: "Indices",
  metal: "Precious Metals",
  energy: "Energy",
  industrial: "Industrial",
};

const GROUP_ORDER: AssetType[] = ["index", "metal", "energy", "industrial"];

function AssetDropdown({
  label,
  assets,
  value,
  disabledSymbol,
  onChange,
}: {
  label: string;
  assets: Record<string, AssetInfo>;
  value: string;
  disabledSymbol: string;
  onChange: (s: string) => void;
}) {
  const grouped = GROUP_ORDER.reduce<Record<AssetType, AssetInfo[]>>(
    (acc, type) => {
      acc[type] = Object.values(assets).filter((a) => a.type === type);
      return acc;
    },
    { index: [], metal: [], energy: [], industrial: [] }
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2
                   focus:outline-none focus:border-amber-500 cursor-pointer min-w-[200px]"
      >
        {GROUP_ORDER.map((type) =>
          grouped[type].length === 0 ? null : (
            <optgroup key={type} label={GROUP_LABELS[type]}>
              {grouped[type].map((asset) => (
                <option
                  key={asset.symbol}
                  value={asset.symbol}
                  disabled={asset.symbol === disabledSymbol}
                >
                  {asset.name} ({asset.unit})
                </option>
              ))}
            </optgroup>
          )
        )}
      </select>
    </div>
  );
}

export function AssetSelector({ assets, symbolA, symbolB, onChangeA, onChangeB }: AssetSelectorProps) {
  return (
    <div className="stat-card">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Compare Assets</p>
      <div className="flex flex-wrap items-end gap-4">
        <AssetDropdown
          label="Asset A (numerator)"
          assets={assets}
          value={symbolA}
          disabledSymbol={symbolB}
          onChange={onChangeA}
        />
        <div className="text-gray-600 text-2xl font-light pb-1">÷</div>
        <AssetDropdown
          label="Asset B (denominator)"
          assets={assets}
          value={symbolB}
          disabledSymbol={symbolA}
          onChange={onChangeB}
        />
        <div className="pb-1 text-xs text-gray-500">
          Ratio = price of <span className="text-gray-300">{assets[symbolA]?.name}</span>
          {" "}÷ price of <span className="text-gray-300">{assets[symbolB]?.name}</span>
        </div>
      </div>
    </div>
  );
}
