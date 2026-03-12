import { useEffect, useState } from "react";
import type { RatioData, RatioPair } from "./types";
import { LoadingState, ErrorState } from "./components/LoadingState";
import { PairSelector } from "./components/PairSelector";
import { RatioChart } from "./components/RatioChart";
import { AlertPanel } from "./components/AlertPanel";
import { StatsBar } from "./components/StatsBar";

type LoadStatus = "loading" | "loaded" | "error";

export default function App() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [data, setData] = useState<RatioData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    fetch("/data.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((json: RatioData) => {
        if (!json.pairs || json.pairs.length === 0) {
          throw new Error("No pairs found in data.json");
        }
        setData(json);
        setSelectedId(json.pairs[0].id);
        setStatus("loaded");
      })
      .catch((err) => {
        setErrorMsg(err.message || "Failed to load data.json. Run the pipeline first.");
        setStatus("error");
      });
  }, []);

  if (status === "loading") return <LoadingState />;
  if (status === "error") return <ErrorState message={errorMsg} />;
  if (!data) return null;

  const selectedPair: RatioPair | undefined = data.pairs.find((p) => p.id === selectedId);

  const generatedAt = new Date(data.generated_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              <span className="text-amber-500">⚖</span> Metals Ratio Tracker
            </h1>
            <p className="text-xs text-gray-500">Indices vs Precious Metals — Historical Ratio Analysis</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Last updated</p>
            <p className="text-xs text-gray-400 font-mono">{generatedAt}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Alert Panel */}
        <AlertPanel alerts={data.alerts} />

        {/* Pair Selector */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Select Asset Pair</p>
          <PairSelector
            pairs={data.pairs}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Stats and Chart for selected pair */}
        {selectedPair && (
          <>
            <StatsBar pair={selectedPair} />
            <RatioChart pair={selectedPair} />

            {/* Interpretation */}
            <div className="stat-card">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                How to Read This Chart
              </h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-400">
                <div>
                  <p className="text-gray-300 font-medium mb-1">The Ratio</p>
                  <p>
                    Shows how many ounces of {selectedPair.metal_symbol === "GC=F" ? "gold" : "silver"} it
                    takes to buy one unit of {selectedPair.index_symbol}. A rising ratio means equities are
                    getting more expensive relative to metals.
                  </p>
                </div>
                <div>
                  <p className="text-gray-300 font-medium mb-1">Z-Score Anomalies</p>
                  <p>
                    When the ratio exceeds ±2 standard deviations from its 252-day rolling mean, the
                    system flags an anomaly. Extreme readings historically precede mean reversion — one
                    asset tends to correct toward the other.
                  </p>
                </div>
                <div>
                  <p className="text-gray-300 font-medium mb-1">Metals Undervalued</p>
                  <p>
                    Ratio far above mean → it takes unusually many ounces of metal to buy equities.
                    Historically, metals have rallied or equities have corrected in these conditions.
                  </p>
                </div>
                <div>
                  <p className="text-gray-300 font-medium mb-1">IsolationForest</p>
                  <p>
                    An unsupervised ML model trained on all 4 ratio pairs simultaneously flags
                    multi-dimensional anomalies — periods where the entire metals/equities complex
                    is dislocated (5% contamination rate).
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-gray-800 mt-10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-xs text-gray-600">
          <p>Data via Yahoo Finance (yfinance). Not financial advice.</p>
          <p className="mt-1">
            Pairs: {data.pairs.map((p) => p.name).join(" · ")}
          </p>
        </div>
      </footer>
    </div>
  );
}
