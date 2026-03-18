import { useEffect, useState, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import type { RatioData } from "./types";
import { computePair } from "./lib/computePair";
import { LoadingState, ErrorState } from "./components/LoadingState";
import { AssetSelector } from "./components/AssetSelector";
import { RatioChart } from "./components/RatioChart";
import { AlertPanel } from "./components/AlertPanel";
import { StatsBar } from "./components/StatsBar";
import { ImpliedPrices } from "./components/ImpliedPrices";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Render error:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center max-w-lg px-4 space-y-3">
            <p className="text-red-400 font-semibold">Render error</p>
            <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded text-left overflow-auto">
              {(this.state.error as Error).message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type LoadStatus = "loading" | "loaded" | "error";

export default function App() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [data, setData] = useState<RatioData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [symbolA, setSymbolA] = useState("^GSPC");
  const [symbolB, setSymbolB] = useState("GC=F");

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((json: RatioData) => {
        if (!json.assets || Object.keys(json.assets).length === 0) {
          throw new Error("No assets found in data.json — run the pipeline first.");
        }
        setData(json);
        setStatus("loaded");
      })
      .catch((err) => {
        setErrorMsg(err.message || "Failed to load data.json. Run the pipeline first.");
        setStatus("error");
      });
  }, []);

  const ifAnomalyDates = useMemo(
    () => new Set(data?.if_anomaly_dates ?? []),
    [data?.if_anomaly_dates]
  );

  const derivedPair = useMemo(() => {
    if (!data) return null;
    const assetA = data.assets[symbolA];
    const assetB = data.assets[symbolB];
    if (!assetA || !assetB) return null;
    return computePair(assetA, assetB, ifAnomalyDates);
  }, [data, symbolA, symbolB, ifAnomalyDates]);

  if (status === "loading") return <LoadingState />;
  if (status === "error") return <ErrorState message={errorMsg} />;
  if (!data) return null;

  const generatedAt = new Date(data.generated_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const assetList = Object.keys(data.assets).join(" · ");

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-950">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                <span className="text-amber-500">⚖</span> Ratio Tracker
              </h1>
              <p className="text-xs text-gray-500">Commodities, Metals &amp; Indices — Historical Ratio Analysis</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Last updated</p>
              <p className="text-xs text-gray-400 font-mono">{generatedAt}</p>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Alert Panel */}
          <AlertPanel alerts={data.alerts} assets={data.assets} currentPair={derivedPair} />

          {/* Asset Selector */}
          <AssetSelector
            assets={data.assets}
            symbolA={symbolA}
            symbolB={symbolB}
            onChangeA={setSymbolA}
            onChangeB={setSymbolB}
          />

          {/* Stats and Chart for selected pair */}
          {derivedPair && (
            <>
              <StatsBar pair={derivedPair} />
              <RatioChart pair={derivedPair} />
              <ImpliedPrices pair={derivedPair} />

              {/* Interpretation */}
              <div className="stat-card">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  How to Read This Chart
                </h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-400">
                  <div>
                    <p className="text-gray-300 font-medium mb-1">The Ratio</p>
                    <p>
                      Shows the price of <span className="text-gray-200">{derivedPair.asset_a.name}</span> divided
                      by the price of <span className="text-gray-200">{derivedPair.asset_b.name}</span>. A rising
                      ratio means Asset A is getting more expensive relative to Asset B.
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
                    <p className="text-gray-300 font-medium mb-1">Reading the Signal</p>
                    <p>
                      <span className="text-amber-400">Ratio above +2σ → {derivedPair.asset_a.name} overvalued</span>: may fall
                      or {derivedPair.asset_b.name} may rise.{" "}
                      <span className="text-blue-400">Ratio below −2σ → {derivedPair.asset_b.name} overvalued</span>: may fall
                      or {derivedPair.asset_a.name} may rise.
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-300 font-medium mb-1">IsolationForest</p>
                    <p>
                      An unsupervised ML model trained on the classic gold/silver vs index pairs
                      simultaneously flags multi-dimensional anomalies — periods where the entire
                      metals/equities complex is dislocated (5% contamination rate).
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
            <p className="mt-1">Assets: {assetList}</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
