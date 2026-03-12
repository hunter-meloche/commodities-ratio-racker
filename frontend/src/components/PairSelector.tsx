import type { RatioPair } from "../types";

interface PairSelectorProps {
  pairs: RatioPair[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function PairSelector({ pairs, selectedId, onSelect }: PairSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {pairs.map((pair) => {
        const isSelected = pair.id === selectedId;
        const isAnomaly = pair.current.is_anomaly;
        return (
          <button
            key={pair.id}
            onClick={() => onSelect(pair.id)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border
              ${isSelected
                ? "bg-amber-500 text-gray-950 border-amber-500 shadow-lg shadow-amber-500/20"
                : isAnomaly
                  ? "bg-gray-900 text-red-400 border-red-800 hover:border-red-600"
                  : "bg-gray-900 text-gray-300 border-gray-700 hover:border-gray-500"
              }
            `}
          >
            {pair.name}
            {isAnomaly && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
                Alert
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
