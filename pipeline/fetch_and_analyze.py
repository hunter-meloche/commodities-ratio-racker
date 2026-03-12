#!/usr/bin/env python3
"""
Commodity Ratio Tracker Pipeline
Fetches historical price data for indices and commodities, outputs individual
asset series + IsolationForest anomaly dates for dynamic ratio computation
in the frontend.
"""

import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.ensemble import IsolationForest

warnings.filterwarnings("ignore")

OUTPUT_PATH = Path(__file__).parent.parent / "frontend" / "public" / "data.json"

ASSETS = [
    {"symbol": "^GSPC",  "name": "S&P 500",        "type": "index",      "unit": "USD"},
    {"symbol": "^IXIC",  "name": "Nasdaq",          "type": "index",      "unit": "USD"},
    {"symbol": "^DJI",   "name": "Dow Jones",       "type": "index",      "unit": "USD"},
    {"symbol": "GC=F",   "name": "Gold",            "type": "metal",      "unit": "USD/oz"},
    {"symbol": "SI=F",   "name": "Silver",          "type": "metal",      "unit": "USD/oz"},
    {"symbol": "PL=F",   "name": "Platinum",        "type": "metal",      "unit": "USD/oz"},
    {"symbol": "CL=F",   "name": "WTI Crude Oil",   "type": "energy",     "unit": "USD/bbl"},
    {"symbol": "NG=F",   "name": "Natural Gas",     "type": "energy",     "unit": "USD/MMBtu"},
    {"symbol": "HG=F",   "name": "Copper",          "type": "industrial", "unit": "USD/lb"},
]

# Classic pairs used to train IsolationForest — alerts still generated for these
CLASSIC_PAIRS = [
    {"asset_a": "^GSPC", "asset_b": "GC=F", "name": "S&P 500 / Gold"},
    {"asset_a": "^GSPC", "asset_b": "SI=F", "name": "S&P 500 / Silver"},
    {"asset_a": "^IXIC", "asset_b": "GC=F", "name": "Nasdaq / Gold"},
    {"asset_a": "^IXIC", "asset_b": "SI=F", "name": "Nasdaq / Silver"},
]

ROLLING_WINDOW = 252
ANOMALY_THRESHOLD = 2.0
CONTAMINATION = 0.05


def fetch_ticker(symbol: str, name: str) -> Optional[pd.Series]:
    print(f"  Fetching {symbol} ({name})...")
    try:
        df = yf.download(symbol, period="max", auto_adjust=True, progress=False)
        if df.empty:
            print(f"  WARNING: No data for {symbol}")
            return None
        close = df["Close"].squeeze() if isinstance(df.columns, pd.MultiIndex) else df["Close"]
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        close = close.dropna()
        print(f"  OK: {symbol} — {len(close)} rows, {close.index[0].date()} to {close.index[-1].date()}")
        return close
    except Exception as e:
        print(f"  ERROR {symbol}: {e}")
        return None


def rolling_stats(series: pd.Series, window: int) -> dict:
    mean = series.rolling(window).mean()
    std = series.rolling(window).std()
    z = (series - mean) / std
    return {
        "mean": mean,
        "std": std,
        "z_score": z,
        "upper_band": mean + ANOMALY_THRESHOLD * std,
        "lower_band": mean - ANOMALY_THRESHOLD * std,
        "is_anomaly": z.abs() > ANOMALY_THRESHOLD,
    }


def get_direction(z: float) -> Optional[str]:
    if z > ANOMALY_THRESHOLD:
        return "a_overvalued"   # asset A costs more A-units of B than usual
    if z < -ANOMALY_THRESHOLD:
        return "b_overvalued"
    return None


def get_signal(direction: Optional[str]) -> Optional[str]:
    if direction == "a_overvalued":
        return "revert_down"
    if direction == "b_overvalued":
        return "revert_up"
    return None


def main():
    print("=== Commodity Ratio Tracker Pipeline ===\n")

    # 1. Fetch all assets
    print("Step 1: Fetching price data...")
    raw: dict[str, pd.Series] = {}
    for asset in ASSETS:
        series = fetch_ticker(asset["symbol"], asset["name"])
        if series is not None:
            raw[asset["symbol"]] = series

    fetched_symbols = set(raw.keys())
    missing = [a["symbol"] for a in ASSETS if a["symbol"] not in fetched_symbols]
    if missing:
        print(f"  WARNING: Could not fetch: {missing}. Continuing with available assets.")

    # 2. Train IsolationForest on classic pairs (aligned dates)
    print("\nStep 2: Training IsolationForest on classic pairs...")
    classic_symbols = {a["asset_a"] for a in CLASSIC_PAIRS} | {a["asset_b"] for a in CLASSIC_PAIRS}
    available_classic = classic_symbols & fetched_symbols

    if_anomaly_dates: list[str] = []

    if available_classic == classic_symbols:
        # Align classic symbols to common dates
        classic_df = pd.DataFrame({s: raw[s] for s in classic_symbols}).dropna()
        ratio_df = pd.DataFrame({
            f"{p['asset_a']}/{p['asset_b']}": classic_df[p["asset_a"]] / classic_df[p["asset_b"]]
            for p in CLASSIC_PAIRS
        })
        # Rolling stats for warmup
        warmup_mask = pd.concat(
            [ratio_df[col].rolling(ROLLING_WINDOW).mean() for col in ratio_df.columns],
            axis=1
        ).notna().all(axis=1)
        valid_ratios = ratio_df[warmup_mask]

        clf = IsolationForest(contamination=CONTAMINATION, random_state=42)
        labels = clf.fit_predict(valid_ratios)
        anomaly_mask = labels == -1
        if_anomaly_dates = [d.strftime("%Y-%m-%d") for d in valid_ratios.index[anomaly_mask]]
        print(f"  Flagged {sum(anomaly_mask)} anomalous days out of {len(valid_ratios)}")
    else:
        print(f"  Skipping IF — missing classic symbols: {classic_symbols - available_classic}")
        classic_df = pd.DataFrame()
        ratio_df = pd.DataFrame()

    # 3. Generate alerts for classic pairs
    print("\nStep 3: Generating classic pair alerts...")
    alerts = []
    for pair in CLASSIC_PAIRS:
        a, b = pair["asset_a"], pair["asset_b"]
        if a not in raw or b not in raw:
            continue
        aligned = pd.DataFrame({"a": raw[a], "b": raw[b]}).dropna()
        ratio = aligned["a"] / aligned["b"]
        stats = rolling_stats(ratio, ROLLING_WINDOW)
        valid = stats["mean"].notna()
        if not valid.any():
            continue
        latest_z = float(stats["z_score"][valid].iloc[-1])
        latest_dir = get_direction(latest_z)
        if latest_dir is None:
            continue
        asset_a_info = next(x for x in ASSETS if x["symbol"] == a)
        asset_b_info = next(x for x in ASSETS if x["symbol"] == b)
        msg = (
            f"{pair['name']} ratio is {abs(latest_z):.2f}σ "
            f"{'above' if latest_z > 0 else 'below'} historical mean"
        )
        alerts.append({
            "asset_a": a,
            "asset_b": b,
            "name": pair["name"],
            "z_score": round(latest_z, 4),
            "direction": latest_dir,
            "signal": get_signal(latest_dir),
            "message": msg,
        })

    print(f"  {len(alerts)} alert(s) generated")

    # 4. Build per-asset output
    print("\nStep 4: Building asset timeseries...")
    assets_output = {}
    for asset in ASSETS:
        sym = asset["symbol"]
        if sym not in raw:
            continue
        series = raw[sym]
        ts = [
            {"date": d.strftime("%Y-%m-%d"), "price": round(float(p), 4)}
            for d, p in series.items()
            if pd.notna(p)
        ]
        assets_output[sym] = {
            "symbol": sym,
            "name": asset["name"],
            "type": asset["type"],
            "unit": asset["unit"],
            "timeseries": ts,
        }
        print(f"  {sym}: {len(ts)} points")

    # 5. Write output
    print("\nStep 5: Writing output...")
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assets": assets_output,
        "if_anomaly_dates": if_anomaly_dates,
        "alerts": alerts,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, separators=(",", ":"))  # compact — no indent, file is large

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"\nOutput: {OUTPUT_PATH} ({size_kb:.0f} KB)")
    print(f"Assets: {len(assets_output)}, Alerts: {len(alerts)}, IF dates: {len(if_anomaly_dates)}")
    print("Done!")


if __name__ == "__main__":
    main()
